import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { cleanSentences, enforceLocks, settle, settleEither, settleScore, template } from './templates'
import { loosens, type Niche } from './gates'


// Campaigns and their gate versions.
//
// A gate version is never updated in place. An edit writes version n + 1 and
// the campaign points at it, so a lead delivered last Monday can still be
// explained against the rules that were live last Monday.
//
// An edit that lets more people through is also a door. The rules in force at
// the first one are kept whole on the campaign, and every lead handed over
// afterwards is measured against them and marked. Both ways in land here, so
// the mark never depends on which screen the client used.

/** The door a widening leaves behind, appended to what the campaign has open. */
function widenedWith(campaign: Doc<'campaigns'>, id: string, label: string, niches: Niche[]) {
  const from = campaign.widened ?? {
    fromGateSetId: campaign.gateSetId!,
    fromNiches: niches,
    doors: [],
  }
  return { ...from, doors: [...from.doors, { id, label, openedAt: Date.now() }] }
}

export function publicCampaign(c: Doc<'campaigns'>) {
  return {
    id: c._id,
    name: c.name,
    status: c.status,
    dailyCap: c.dailyCap ?? null,
    brief: c.brief,
    extracted: c.extracted,
    gateSetId: c.gateSetId ?? null,
    /** What has been opened since the campaign started, and when. */
    widened: c.widened ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export function publicGates(g: Doc<'gateSets'>) {
  return {
    id: g._id,
    campaignId: g.campaignId,
    version: g.version,
    origin: g.origin,
    templateId: g.templateId ?? null,
    hard: g.hard,
    // The choices ride out with the demands. Left behind, the screen shows
    // reach and rhythm as hard filters the client never set.
    either: g.either ?? [],
    knockouts: g.knockouts,
    criteria: g.criteria,
    passScore: g.passScore,
    preset: g.preset ?? 'custom',
    by: g.by ?? 'system',
    changes: g.changes ?? [],
    createdAt: g.createdAt,
  }
}

export const list = internalQuery({
  args: { accountId: v.id('accounts') },
  returns: v.any(),
  handler: async (ctx, { accountId }) => {
    const rows = await ctx.db.query('campaigns').withIndex('by_account', (q) => q.eq('accountId', accountId)).collect()
    return rows.filter((c) => c.status !== 'archived').map(publicCampaign)
  },
})

export const get = internalQuery({
  args: { accountId: v.id('accounts'), campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { accountId, campaignId }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign || campaign.accountId !== accountId) return null
    const gates = campaign.gateSetId ? await ctx.db.get(campaign.gateSetId) : null
    const versions = await ctx.db
      .query('gateSets')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()
    return {
      campaign: publicCampaign(campaign),
      gates: gates ? publicGates(gates) : null,
      versions: versions.sort((a, b) => b.version - a.version).map(publicGates),
    }
  },
})

export const create = internalMutation({
  args: {
    accountId: v.id('accounts'),
    name: v.string(),
    brief: v.object({
      audience: v.string(),
      offer: v.string(),
      seeds: v.optional(v.array(v.string())),
    }),
    dailyCap: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const campaignId = await ctx.db.insert('campaigns', {
      accountId: args.accountId,
      name: args.name,
      status: 'draft',
      dailyCap: args.dailyCap,
      brief: { ...args.brief, writtenAt: now },
      extracted: {},
      createdAt: now,
      updatedAt: now,
    })
    const campaign = await ctx.db.get(campaignId)
    return publicCampaign(campaign!)
  },
})

export const patch = internalMutation({
  args: {
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal('draft'), v.literal('live'), v.literal('paused'), v.literal('archived'))),
    dailyCap: v.optional(v.number()),
    brief: v.optional(v.object({
      audience: v.string(),
      offer: v.string(),
      seeds: v.optional(v.array(v.string())),
    })),
    extracted: v.optional(v.any()),
    niches: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.accountId !== args.accountId) return { error: 'No such campaign' }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    for (const key of ['name', 'status', 'dailyCap'] as const) {
      if (args[key] !== undefined) patch[key] = args[key]
    }
    if (args.brief) patch.brief = { ...args.brief, writtenAt: Date.now() }
    if (args.extracted) patch.extracted = { ...campaign.extracted, ...args.extracted }
    if (args.niches) {
      // A niche's own numbers go through the same limits as the campaign's, so
      // the editor cannot be used to set a bar nobody could ever clear. They
      // are settled against the campaign's current numbers, because half the
      // limits are ties between two dials.
      const gates = campaign.gateSetId ? await ctx.db.get(campaign.gateSetId) : null
      const base = gates?.hard ?? {}
      const niches = (Array.isArray(args.niches) ? args.niches : []).map((n: any) => {
        const raw = (n.hard ?? {}) as Record<string, unknown>
        const keys = Object.keys(raw)
        const row: Record<string, unknown> = {
          id: String(n.id),
          label: String(n.label ?? n.id).slice(0, 80),
          enabled: n.enabled !== false,
        }
        if (!keys.length) return row
        const settled = settle({ ...base, ...raw }) as Record<string, unknown>
        const hard: Record<string, unknown> = {}
        for (const key of keys) {
          if (typeof settled[key] === 'number') hard[key] = settled[key]
        }
        if (Object.keys(hard).length) row.hard = hard
        return row
      })
      // Switching a slice back on is a widening like any other.
      const on = new Set((campaign.extracted.niches ?? []).filter((n) => n.enabled).map((n) => n.id))
      const added = niches.filter((n) => n.enabled && !on.has(String(n.id)))
      if (added.length && campaign.gateSetId) {
        patch.widened = widenedWith(
          campaign,
          `niche_${added[0].id}`,
          `${added.map((n) => n.label).join(', ')} switched on`,
          (campaign.extracted.niches ?? []) as Niche[],
        )
      }
      patch.extracted = { ...(patch.extracted ?? campaign.extracted), niches }
    }
    await ctx.db.patch(args.campaignId, patch)
    const after = await ctx.db.get(args.campaignId)
    return publicCampaign(after!)
  },
})

/**
 * Writes the next gate version and points the campaign at it. The only way to
 * change a gate: nothing is edited in place, so history stays readable.
 */
export const saveGates = internalMutation({
  args: {
    accountId: v.id('accounts'),
    campaignId: v.id('campaigns'),
    origin: v.union(v.literal('generated'), v.literal('edited')),
    templateId: v.optional(v.string()),
    hard: v.any(),
    /** Groups where one alternative is enough. */
    either: v.optional(v.any()),
    knockouts: v.any(),
    criteria: v.any(),
    passScore: v.number(),
    preset: v.optional(v.string()),
    by: v.optional(v.string()),
    changes: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.accountId !== args.accountId) return { error: 'No such campaign' }
    const existing = await ctx.db
      .query('gateSets')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    const version = existing.reduce((top, g) => Math.max(top, g.version), 0) + 1

    // Bounded personalisation is enforced here and not only on screen. A dial
    // outside its limits comes back inside, a locked knockout comes back on,
    // and the sentences are one to twelve lines of plain text.
    const templateId = args.templateId ?? existing[0]?.templateId ?? 'sell_to_creators'
    const lib = template(templateId)
    const criteria =
      cleanSentences(args.criteria) ?? existing.find((g) => g._id === campaign.gateSetId)?.criteria ?? lib.criteria

    // The choices are bounded first: settle needs to know which numbers a
    // group decides before it fills the rest in as demands.
    const asked = (args.hard ?? {}) as { followersMin?: number }
    const either = settleEither(args.either, Number(asked.followersMin) > 0 ? Number(asked.followersMin) : 15_000)
    const hard = settle(args.hard ?? {}, either)
    const passScore = settleScore(args.passScore, criteria.length)

    const gateSetId = await ctx.db.insert('gateSets', {
      campaignId: args.campaignId,
      accountId: args.accountId,
      version,
      origin: args.origin,
      templateId,
      hard,
      ...(either.length ? { either } : {}),
      knockouts: enforceLocks(templateId, args.knockouts),
      criteria,
      passScore,
      preset: args.preset ?? 'custom',
      by: args.by ?? 'system',
      changes: args.changes ?? [],
      createdAt: Date.now(),
    })

    const active = campaign.gateSetId ? await ctx.db.get(campaign.gateSetId) : null
    const niches = (campaign.extracted.niches ?? []) as Niche[]
    // Only an edit can open a door. A generated draft replacing another
    // generated draft is the model changing its mind, and the first real run
    // marked its one lead as outside rules the client never wrote.
    const opened =
      args.origin === 'edited' &&
      active !== null &&
      loosens(
        { hard: active.hard, passScore: active.passScore, niches },
        { hard, passScore, niches },
      )
    await ctx.db.patch(args.campaignId, {
      gateSetId,
      updatedAt: Date.now(),
      ...(opened
        ? {
            widened: widenedWith(
              campaign,
              `v${version}`,
              (args.changes ?? []).slice(0, 2).join(', ') || 'Rules widened',
              niches,
            ),
          }
        : {}),
    })
    const gates = await ctx.db.get(gateSetId)
    return publicGates(gates!)
  },
})

/** The gate version a campaign judges against right now. */
export const activeGates = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign?.gateSetId) return null
    return await ctx.db.get(campaign.gateSetId)
  },
})

/** Live campaigns with room left in their cap. Read by the nightly delivery. */
export const dueToday = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const rows = await ctx.db.query('campaigns').filter((q) => q.eq(q.field('status'), 'live')).collect()
    return rows.filter((c) => Boolean(c.gateSetId))
  },
})

/**
 * Clears what a campaign has opened, and the marks its leads carry from it.
 * For the operator, when a widening was recorded by mistake.
 */
export const unwiden = internalMutation({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign) return { error: 'No such campaign' }
    await ctx.db.patch(campaignId, { widened: undefined })
    const leads = await ctx.db.query('leads').withIndex('by_campaign', (q) => q.eq('campaignId', campaignId)).collect()
    for (const l of leads) await ctx.db.patch(l._id, { reach: 'core', beyond: undefined })
    return { cleared: true, leads: leads.length }
  },
})

/**
 * One campaign, read on its own.
 *
 * The profile pool is shared: a profile bought for one campaign is read by
 * every other one for free, which is the right way round for the money and
 * the wrong way round for a report. Counting the pool told us an
 * entertainment campaign had 44 profiles past its numbers when its own
 * discovery had found one, and that its nine leads were its own when every
 * one came from another campaign's spending.
 *
 * So everything here is read from rows that carry this campaignId: the runs
 * it paid for, and the verdicts it wrote. Nothing scans the pool.
 */
export const report = internalQuery({
  args: { campaignId: v.id('campaigns'), since: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, { campaignId, since }) => {
    const campaign = await ctx.db.get(campaignId)
    if (!campaign) return { error: 'No such campaign' }
    const after = since ?? 0

    const runs = (await ctx.db
      .query('crawlRuns')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()).filter((r) => r.startedAt >= after)

    const byPhase: Record<string, { runs: number; fetched: number; fresh: number; cents: number }> = {}
    for (const r of runs) {
      const b = byPhase[r.phase] ?? (byPhase[r.phase] = { runs: 0, fetched: 0, fresh: 0, cents: 0 })
      b.runs += 1
      b.fetched += r.profilesFetched
      b.fresh += r.profilesFresh ?? 0
      b.cents += r.costCents
    }

    const rows = (await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()).filter((e) => e._creationTime >= after)

    const verdicts: Record<string, number> = {}
    const blockedBy: Record<string, number> = {}
    for (const e of rows) {
      verdicts[e.verdict] = (verdicts[e.verdict] ?? 0) + 1
      if (e.blockedBy) blockedBy[e.blockedBy] = (blockedBy[e.blockedBy] ?? 0) + 1
    }

    const leads = (await ctx.db
      .query('leads')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()).filter((l) => l._creationTime >= after)

    // A model call is only paid for once the numbers have held. Measured at
    // $0.0035 a profile with pictures, and a third of that without.
    const judged = rows.filter((e) => e.verdict !== 'hard_fail').length
    const apifyCents = runs.reduce((sum, r) => sum + r.costCents, 0)
    const modelCents = Math.round(judged * 0.35)

    return {
      campaign: campaign.name,
      discovery: {
        byPhase,
        fetched: runs.reduce((n, r) => n + r.profilesFetched, 0),
        fresh: runs.reduce((n, r) => n + (r.profilesFresh ?? 0), 0),
      },
      funnel: {
        evaluated: rows.length,
        reachedTheJudge: judged,
        qualified: verdicts.qualified ?? 0,
        delivered: leads.length,
      },
      verdicts,
      blockedBy: Object.fromEntries(Object.entries(blockedBy).sort((a, b) => b[1] - a[1])),
      costUsd: {
        apify: apifyCents / 100,
        model: modelCents / 100,
        total: (apifyCents + modelCents) / 100,
        perLead: leads.length ? (apifyCents + modelCents) / 100 / leads.length : null,
      },
    }
  },
})
