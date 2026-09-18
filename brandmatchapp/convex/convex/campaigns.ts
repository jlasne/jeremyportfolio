import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'

// Campaigns and their gate versions.
//
// A gate version is never updated in place. An edit writes version n + 1 and
// the campaign points at it, so a lead delivered last Monday can still be
// explained against the rules that were live last Monday.

export function publicCampaign(c: Doc<'campaigns'>) {
  return {
    id: c._id,
    name: c.name,
    status: c.status,
    dailyCap: c.dailyCap ?? null,
    brief: c.brief,
    extracted: c.extracted,
    gateSetId: c.gateSetId ?? null,
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
    hard: g.hard,
    knockouts: g.knockouts,
    criteria: g.criteria,
    passScore: g.passScore,
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
    brief: v.string(),
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
      brief: args.brief,
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
    brief: v.optional(v.string()),
    extracted: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.accountId !== args.accountId) return { error: 'No such campaign' }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    for (const key of ['name', 'status', 'dailyCap', 'brief'] as const) {
      if (args[key] !== undefined) patch[key] = args[key]
    }
    if (args.extracted) patch.extracted = { ...campaign.extracted, ...args.extracted }
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
    hard: v.any(),
    knockouts: v.any(),
    criteria: v.any(),
    passScore: v.number(),
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
    const gateSetId = await ctx.db.insert('gateSets', {
      campaignId: args.campaignId,
      accountId: args.accountId,
      version,
      origin: args.origin,
      hard: args.hard,
      knockouts: args.knockouts,
      criteria: args.criteria,
      passScore: args.passScore,
      createdAt: Date.now(),
    })
    await ctx.db.patch(args.campaignId, { gateSetId, updatedAt: Date.now() })
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
