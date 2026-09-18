import { internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { periodKey } from './accounts'

// The daily hand over.
//
// Qualified evaluations become leads. Two rules decide the order:
//
//   1. The quota belongs to the account, not the campaign. When campaigns
//      compete for the same day, the highest gate 3 score wins, whichever
//      campaign it came from. The client bought qualified leads, so the best
//      ones go first.
//   2. A per campaign cap, when set, stops one campaign taking the whole day.
//
// Delivering claims the profile for this account, for good. It is never
// evaluated for another account after that.

export const candidates = internalQuery({
  args: { accountId: v.id('accounts') },
  returns: v.any(),
  handler: async (ctx, { accountId }) => {
    const campaigns = await ctx.db
      .query('campaigns')
      .withIndex('by_account', (q) => q.eq('accountId', accountId))
      .collect()
    const live = campaigns.filter((c) => c.status === 'live')
    // Held against the kind of offer, not against the world. Two clients
    // selling the same thing never receive the same person; a client selling
    // an app and one selling a platform both can, because one coach can buy
    // both. A claim over every offer at once would empty the pool a little
    // more with every customer we sign.
    const claims = await ctx.db.query('creatorClaims').collect()
    const today = new Date().toISOString().slice(0, 10)

    const out = []
    for (const campaign of live) {
      const offerKey = campaign.extracted.templateId ?? 'sell_to_creators'
      const taken = new Set(
        claims.filter((c) => c.offerKey === offerKey).map((c) => c.creatorId as string),
      )
      const rows = await ctx.db
        .query('evaluations')
        .withIndex('by_campaign_verdict', (q) => q.eq('campaignId', campaign._id).eq('verdict', 'qualified'))
        .collect()
      const deliveredToday = await ctx.db
        .query('dailyDeliveries')
        .withIndex('by_campaign_date', (q) => q.eq('campaignId', campaign._id).eq('date', today))
        .first()
      for (const row of rows) {
        if (taken.has(row.creatorId as string)) continue
        out.push({
          evaluationId: row._id,
          creatorId: row.creatorId,
          campaignId: campaign._id,
          score: row.score,
          offerKey,
          cap: campaign.dailyCap ?? null,
          deliveredToday: deliveredToday?.delivered ?? 0,
        })
      }
    }
    // Best first, across every campaign. The account's quota, not the campaign's.
    return out.sort((a, b) => b.score - a.score)
  },
})

/**
 * Writes today's leads. Stops at the account balance, and at each campaign's
 * cap. Every lead costs exactly one line in the journal.
 */
export const today = internalMutation({
  args: { accountId: v.id('accounts'), max: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const balance = await ctx.runQuery(internal.quota.balance, { accountId: args.accountId })
    const list = await ctx.runQuery(internal.deliver.candidates, { accountId: args.accountId })
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_account', (q) => q.eq('accountId', args.accountId))
      .first()
    if (!sub) return { error: 'No subscription on this account' }

    const today = new Date().toISOString().slice(0, 10)
    // A day never spends more than the tier, even when the month has a surplus.
    const room = Math.min(args.max ?? sub.tier, balance.remaining)
    const takenPerCampaign = new Map<string, number>()
    let delivered = 0
    const now = Date.now()

    for (const row of list as Record<string, any>[]) {
      if (delivered >= room) break
      const taken = takenPerCampaign.get(row.campaignId) ?? row.deliveredToday
      if (row.cap !== null && taken >= row.cap) continue

      const leadId = await ctx.db.insert('leads', {
        accountId: args.accountId,
        campaignId: row.campaignId,
        creatorId: row.creatorId,
        evaluationId: row.evaluationId,
        score: row.score,
        status: 'new',
        deliveredAt: now,
        statusAt: now,
      })
      await ctx.db.insert('leadEvents', {
        leadId,
        accountId: args.accountId,
        campaignId: row.campaignId,
        to: 'new',
        by: 'system',
        at: now,
      })
      // Exclusive against this kind of offer, from here on and with no expiry.
      await ctx.db.insert('creatorClaims', {
        creatorId: row.creatorId,
        accountId: args.accountId,
        campaignId: row.campaignId,
        offerKey: row.offerKey,
        claimedAt: now,
      })
      await ctx.db.insert('quotaEntries', {
        accountId: args.accountId,
        period: periodKey(now),
        kind: 'delivery',
        delta: -1,
        campaignId: row.campaignId,
        leadId,
        at: now,
      })
      takenPerCampaign.set(row.campaignId, taken + 1)
      delivered++
    }

    // The chart reads one row per campaign per day.
    for (const [campaignId, count] of takenPerCampaign) {
      const existing = await ctx.db
        .query('dailyDeliveries')
        .withIndex('by_campaign_date', (q) => q.eq('campaignId', campaignId as any).eq('date', today))
        .first()
      const campaign = await ctx.db.get(campaignId as any)
      const target = (campaign as any)?.dailyCap ?? sub.tier
      if (existing) await ctx.db.patch(existing._id, { delivered: count, target })
      else {
        await ctx.db.insert('dailyDeliveries', {
          accountId: args.accountId,
          campaignId: campaignId as any,
          date: today,
          delivered: count,
          target,
        })
      }
    }

    await ctx.runMutation(internal.quota.recompute, { accountId: args.accountId })
    return { delivered, room, remaining: balance.remaining - delivered }
  },
})

/** Every account with an active plan. Walked by the nightly cron. */
export const activeAccounts = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const subs = await ctx.db.query('subscriptions').filter((q) => q.eq(q.field('status'), 'active')).collect()
    return subs.map((s) => ({ accountId: s.accountId, tier: s.tier }))
  },
})
