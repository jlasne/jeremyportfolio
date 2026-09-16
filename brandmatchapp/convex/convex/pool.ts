import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { CLAIM_WINDOW, DAY, passes, type Filters } from './scoring'

// Who gets which lead, and what it costs.
//
// Two rules live here and nowhere else:
//
//   A lead belongs to one brand at a time. Handing a creator over sets
//   claimedBy and claimedUntil on the creator itself, so another brand asking
//   for the same handle inside 14 days is refused by a field read rather than
//   by a scan of the discovery log.
//
//   One credit, one lead. A handle out of the pool costs us nothing to hand
//   over and earns the same credit as one we crawled. deliver() is the only
//   way a discovery is ever written, so no path can give a lead away free.

export function isFree(creator: Doc<'creators'>, brandId: Id<'brands'>, now = Date.now()): boolean {
  if (!creator.claimedUntil || creator.claimedUntil <= now) return true
  return creator.claimedBy === brandId
}

/**
 * Hands one creator to one campaign: claims it, charges a credit, writes the
 * discovery. False when the brand is out of credits, when another brand holds
 * the handle, or when this campaign already has it.
 */
export async function deliver(
  ctx: MutationCtx,
  args: { creator: Doc<'creators'>; campaign: Doc<'campaigns'>; agentId?: Id<'agents'>; fresh: boolean },
): Promise<boolean> {
  const now = Date.now()
  const brand = await ctx.db.get(args.campaign.brandId)
  if (!brand || brand.credits <= 0) return false
  if (!isFree(args.creator, brand._id, now)) return false

  const already = await ctx.db
    .query('discoveries')
    .withIndex('by_campaign_creator', (q) =>
      q.eq('campaignId', args.campaign._id).eq('creatorId', args.creator._id))
    .first()
  if (already) return false

  await ctx.db.patch(args.creator._id, { claimedBy: brand._id, claimedUntil: now + CLAIM_WINDOW })
  await ctx.db.insert('discoveries', {
    creatorId: args.creator._id,
    campaignId: args.campaign._id,
    agentId: args.agentId,
    brandId: brand._id,
    fresh: args.fresh,
    discoveredAt: now,
  })
  await ctx.db.patch(brand._id, { credits: Math.max(brand.credits - 1, 0) })
  await ctx.db.insert('ledger', {
    brandId: brand._id,
    delta: -1,
    reason: args.fresh ? 'lead, crawled fresh' : 'lead, from the pool',
    campaignId: args.campaign._id,
  })
  return true
}

/** How many leads this campaign has already been given today. */
export async function deliveredToday(ctx: MutationCtx, campaignId: Id<'campaigns'>): Promise<number> {
  const midnight = new Date().setHours(0, 0, 0, 0)
  let n = 0
  for await (const d of ctx.db
    .query('discoveries')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))) {
    if (d.discoveredAt >= midnight) n++
  }
  return n
}

/**
 * Fills a campaign from the pool, freshest signal first, and returns how many
 * it handed over. Free to us, one credit each to the brand.
 *
 * The walk goes over the signal index rather than the whole table, so the
 * leads worth having are reached before the budget runs out. A second pass on
 * followers picks up the ones carrying no signal at all.
 */
async function fillFromPool(ctx: MutationCtx, campaignId: Id<'campaigns'>, limit: number): Promise<number> {
  if (limit <= 0) return 0
  const campaign = await ctx.db.get(campaignId)
  if (!campaign) return 0
  const brand = await ctx.db.get(campaign.brandId)
  if (!brand) return 0

  const budget = Math.min(limit, brand.credits)
  if (budget <= 0) return 0

  const now = Date.now()
  const filters = (campaign.filters ?? {}) as Filters
  let given = 0
  const seen = new Set<string>()

  for (const order of ['by_signal', 'by_followers'] as const) {
    if (given >= budget) break
    for await (const creator of ctx.db.query('creators').withIndex(order).order('desc')) {
      if (given >= budget) break
      if (seen.has(creator._id)) continue
      seen.add(creator._id)
      if (!isFree(creator, brand._id, now)) continue
      if (!passes(creator, filters, now)) continue
      if (await deliver(ctx, { creator, campaign, fresh: false })) given++
    }
  }
  return given
}

export const seedFromPool = internalMutation({
  args: { campaignId: v.id('campaigns'), limit: v.number() },
  returns: v.number(),
  handler: (ctx, { campaignId, limit }) => fillFromPool(ctx, campaignId, limit),
})

/**
 * What one agent should crawl tonight.
 *
 * Fills the campaign's remaining quota from the free pool first, then returns
 * how many profiles are still missing. Zero means the day is covered and no
 * Apify run needs to start at all, which is the whole point: a handle already
 * in the database costs nothing, and Apify bills about $0.0023 a profile.
 */
export const shortfall = internalMutation({
  args: { agentId: v.id('agents') },
  returns: v.number(),
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId)
    if (!agent) return 0
    const campaign = await ctx.db.get(agent.campaignId)
    if (!campaign) return 0
    const brand = await ctx.db.get(campaign.brandId)
    if (!brand) return 0

    const done = await deliveredToday(ctx, campaign._id)
    const want = Math.min(Math.max(agent.leadsPerDay - done, 0), brand.credits)
    if (want <= 0) return 0

    const filled = await fillFromPool(ctx, campaign._id, want)
    return Math.max(want - filled, 0)
  },
})

/**
 * Roughly how much of the pool a brand could still be given. Counting is a
 * walk, so it stops at `cap` and says so rather than reading every document
 * on a page load.
 */
export async function countFree(ctx: QueryCtx, brandId: Id<'brands'>, cap = 5000): Promise<{ free: number; capped: boolean }> {
  const now = Date.now()
  let free = 0
  for await (const c of ctx.db.query('creators').withIndex('by_claim', (q) => q.lte('claimedUntil', now))) {
    if (c.claimedBy && c.claimedBy !== brandId && (c.claimedUntil ?? 0) > now) continue
    free++
    if (free >= cap) return { free, capped: true }
  }
  return { free, capped: false }
}

export const freePool = internalQuery({
  args: { brandId: v.id('brands') },
  returns: v.object({ free: v.number(), capped: v.boolean() }),
  handler: (ctx, { brandId }) => countFree(ctx, brandId),
})

export { DAY }
