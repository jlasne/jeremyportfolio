import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { enforceLocks, settle, settleScore, template } from './templates'
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
    // and the seven criteria stay seven.
    const templateId = args.templateId ?? existing[0]?.templateId ?? 'sell_to_creators'
    const lib = template(templateId)
    const criteria = Array.isArray(args.criteria) && args.criteria.length === lib.criteria.length
      ? args.criteria.map((c: any, i: number) => ({
          id: lib.criteria[i].id,
          label: String(c?.label ?? lib.criteria[i].label),
          guide: c?.guide ? String(c.guide) : lib.criteria[i].guide,
        }))
      : lib.criteria

    const hard = settle(args.hard ?? {})
    const passScore = settleScore(args.passScore, criteria.length)

    const gateSetId = await ctx.db.insert('gateSets', {
      campaignId: args.campaignId,
      accountId: args.accountId,
      version,
      origin: args.origin,
      templateId,
      hard,
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
    const opened =
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
