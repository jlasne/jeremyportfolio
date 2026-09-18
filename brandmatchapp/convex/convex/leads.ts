import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// The delivered lead, its status walk and its deals.
//
// Two rules shape this file.
//
// 1. A status change is one click from the list. The route takes a status and
//    nothing else, and the event is appended here rather than by the caller.
// 2. Statuses and deal amounts are strategic: they will feed the scoring loop
//    and a price benchmark. So the event journal is the record and the field on
//    the lead is only a cache of the newest event.

const STATUS = v.union(
  v.literal('new'),
  v.literal('contacted'),
  v.literal('replied'),
  v.literal('call'),
  v.literal('signed'),
  v.literal('lost'),
)

/** One row of the lead flow, joined once so the list is a single read. */
export const list = internalQuery({
  args: {
    accountId: v.id('accounts'),
    campaignId: v.optional(v.id('campaigns')),
    status: v.optional(STATUS),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = args.status
      ? await ctx.db
          .query('leads')
          .withIndex('by_account_status', (q) => q.eq('accountId', args.accountId).eq('status', args.status!))
          .collect()
      : await ctx.db.query('leads').withIndex('by_account', (q) => q.eq('accountId', args.accountId)).collect()

    const filtered = args.campaignId ? rows.filter((l) => l.campaignId === args.campaignId) : rows
    const sorted = filtered
      .sort((a, b) => {
        const untouched = Number(a.status !== 'new') - Number(b.status !== 'new')
        if (untouched !== 0) return untouched
        if (b.score !== a.score) return b.score - a.score
        return b.deliveredAt - a.deliveredAt
      })
      .slice(0, args.limit ?? 500)

    const out = []
    for (const lead of sorted) {
      const creator = await ctx.db.get(lead.creatorId)
      const evaluation = await ctx.db.get(lead.evaluationId)
      if (!creator || !evaluation) continue
      out.push(shape(lead, creator, evaluation))
    }
    return out
  },
})

export const get = internalQuery({
  args: { accountId: v.id('accounts'), leadId: v.id('leads') },
  returns: v.any(),
  handler: async (ctx, { accountId, leadId }) => {
    const lead = await ctx.db.get(leadId)
    if (!lead || lead.accountId !== accountId) return null
    const creator = await ctx.db.get(lead.creatorId)
    const evaluation = await ctx.db.get(lead.evaluationId)
    if (!creator || !evaluation) return null
    const posts = await ctx.db
      .query('creatorPosts')
      .withIndex('by_creator', (q) => q.eq('creatorId', lead.creatorId))
      .collect()
    const events = await ctx.db.query('leadEvents').withIndex('by_lead', (q) => q.eq('leadId', leadId)).collect()
    const deals = await ctx.db.query('deals').withIndex('by_lead', (q) => q.eq('leadId', leadId)).collect()
    return {
      ...shape(lead, creator, evaluation),
      posts: posts.map((p) => ({
        kind: p.kind, url: p.url, views: p.views, likes: p.likes, comments: p.comments, postedAt: p.postedAt,
      })),
      events: events
        .sort((a, b) => a.at - b.at)
        .map((e) => ({ from: e.from ?? null, to: e.to, by: e.by, note: e.note, at: e.at })),
      deals: deals.map((d) => ({
        id: d._id, amountCents: d.amountCents, currency: d.currency, signedAt: d.signedAt, note: d.note,
      })),
    }
  },
})

/** The one click. Status in, event appended, cache on the lead refreshed. */
export const move = internalMutation({
  args: {
    accountId: v.id('accounts'),
    leadId: v.id('leads'),
    status: STATUS,
    by: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.accountId !== args.accountId) return { error: 'No such lead' }
    if (lead.status === args.status) return { ok: true, status: lead.status }
    const at = Date.now()
    await ctx.db.insert('leadEvents', {
      leadId: args.leadId,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      from: lead.status,
      to: args.status,
      by: args.by ?? 'client',
      note: args.note,
      at,
    })
    await ctx.db.patch(args.leadId, { status: args.status, statusAt: at })
    return { ok: true, status: args.status }
  },
})

/**
 * Takes back the last status change. A list built for one click needs one click
 * back out of it, because people click the wrong row.
 *
 * The delivery event is the lead existing at all, so it is never undone.
 */
export const undo = internalMutation({
  args: { accountId: v.id('accounts'), leadId: v.id('leads') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.accountId !== args.accountId) return { error: 'No such lead' }
    const events = await ctx.db.query('leadEvents').withIndex('by_lead', (q) => q.eq('leadId', args.leadId)).collect()
    const last = events.sort((a, b) => a.at - b.at)[events.length - 1]
    if (!last?.from) return { ok: true, status: lead.status }
    await ctx.db.patch(args.leadId, { status: last.from as typeof lead.status, statusAt: last.at })
    await ctx.db.delete(last._id)
    return { ok: true, status: last.from }
  },
})

/** Saved and notes are plain fields. They say nothing about the deal. */
export const mark = internalMutation({
  args: {
    accountId: v.id('accounts'),
    leadId: v.id('leads'),
    saved: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.accountId !== args.accountId) return { error: 'No such lead' }
    const patch: Record<string, unknown> = {}
    if (args.saved !== undefined) patch.saved = args.saved
    if (args.note !== undefined) patch.note = args.note.slice(0, 4_000)
    await ctx.db.patch(args.leadId, patch)
    return { ok: true }
  },
})

/** A signed lead gets an amount. Its own row: one lead can sign twice. */
export const addDeal = internalMutation({
  args: {
    accountId: v.id('accounts'),
    leadId: v.id('leads'),
    amountCents: v.number(),
    currency: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId)
    if (!lead || lead.accountId !== args.accountId) return { error: 'No such lead' }
    const dealId = await ctx.db.insert('deals', {
      leadId: args.leadId,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      amountCents: args.amountCents,
      currency: args.currency ?? 'EUR',
      signedAt: Date.now(),
      note: args.note,
    })
    return { ok: true, dealId }
  },
})

/** The dashboard, in one read. Delivered today, the funnel, signed money. */
export const overview = internalQuery({
  args: { accountId: v.id('accounts'), days: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const leads = await ctx.db.query('leads').withIndex('by_account', (q) => q.eq('accountId', args.accountId)).collect()
    const deals = await ctx.db.query('deals').withIndex('by_account', (q) => q.eq('accountId', args.accountId)).collect()
    const today = new Date().toISOString().slice(0, 10)
    const daily = await ctx.db
      .query('dailyDeliveries')
      .withIndex('by_account_date', (q) => q.eq('accountId', args.accountId))
      .collect()
    const walk = ['new', 'contacted', 'replied', 'call', 'signed']
    return {
      deliveredToday: leads.filter((l) => new Date(l.deliveredAt).toISOString().slice(0, 10) === today).length,
      funnel: walk.map((status) => ({
        status,
        count: leads.filter((l) => l.status !== 'lost' && walk.indexOf(l.status) >= walk.indexOf(status)).length,
      })),
      lost: leads.filter((l) => l.status === 'lost').length,
      signed: { count: deals.length, amountCents: deals.reduce((sum, d) => sum + d.amountCents, 0) },
      daily: daily
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-(args.days ?? 30))
        .map((d) => ({ date: d.date, delivered: d.delivered, target: d.target })),
    }
  },
})

/**
 * The client shape of a lead. Written out field by field on purpose: an
 * evaluation carries no cost, but a spread would let one in the day a field is
 * added upstream.
 */
function shape(
  lead: {
    _id: string; campaignId: string; score: number; status: string
    saved?: boolean; note?: string; refreshedAt?: number
    deliveredAt: number; statusAt: number
  },
  creator: {
    _id: string; handle: string; name: string; bio: string; avatar?: string; email?: string
    followers: number; medianViews?: number; medianComments?: number; postsPerMonth?: number
    lastPostAt?: number; country?: string; language?: string; links: string[]; measuredAt: number
  },
  evaluation: {
    verdict: string; blockedBy?: string; score: number; reason: string; gateSetVersion: number
    hardChecks: unknown[]; knockoutAnswers: unknown[]; criteriaScores: unknown[]; evaluatedAt: number
  },
) {
  return {
    id: lead._id,
    campaignId: lead.campaignId,
    score: lead.score,
    status: lead.status,
    saved: lead.saved ?? false,
    note: lead.note ?? '',
    refreshedAt: lead.refreshedAt ?? null,
    deliveredAt: lead.deliveredAt,
    statusAt: lead.statusAt,
    creator: {
      id: creator._id,
      handle: creator.handle,
      name: creator.name,
      bio: creator.bio,
      avatar: creator.avatar ?? null,
      email: creator.email ?? null,
      followers: creator.followers,
      medianViews: creator.medianViews ?? null,
      medianComments: creator.medianComments ?? null,
      postsPerMonth: creator.postsPerMonth ?? null,
      lastPostAt: creator.lastPostAt ?? null,
      country: creator.country ?? null,
      language: creator.language ?? null,
      links: creator.links,
      measuredAt: creator.measuredAt,
    },
    evaluation: {
      verdict: evaluation.verdict,
      blockedBy: evaluation.blockedBy ?? null,
      score: evaluation.score,
      reason: evaluation.reason,
      gateSetVersion: evaluation.gateSetVersion,
      hardChecks: evaluation.hardChecks,
      knockoutAnswers: evaluation.knockoutAnswers,
      criteriaScores: evaluation.criteriaScores,
      evaluatedAt: evaluation.evaluatedAt,
    },
  }
}
