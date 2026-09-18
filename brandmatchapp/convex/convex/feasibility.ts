import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// The simulator, zone five.
//
// It answers one question: do these gates hold the quota. It reports survival
// per gate and the score spread, and it reports nothing about what testing cost
// or how many profiles we hold. That is rule one of the product.

export const latest = internalQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, { campaignId }) => {
    const runs = await ctx.db
      .query('feasibilityRuns')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect()
    const run = runs.sort((a, b) => b.ranAt - a.ranAt)[0]
    if (!run) return null
    return {
      id: run._id,
      gateSetVersion: run.gateSetVersion,
      sampleSize: run.sampleSize,
      passedHard: run.passedHard,
      passedKnockouts: run.passedKnockouts,
      scoreHistogram: run.scoreHistogram,
      estimatedPerDay: run.estimatedPerDay,
      ranAt: run.ranAt,
    }
  },
})

/**
 * Reads the evaluations already on file for this campaign and turns them into a
 * distribution. No crawl and no model call: the audit trail already holds every
 * answer, so a client can move the bar and see the effect for nothing.
 */
export const run = internalMutation({
  args: { accountId: v.id('accounts'), campaignId: v.id('campaigns'), profilesPerDay: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.accountId !== args.accountId) return { error: 'No such campaign' }
    if (!campaign.gateSetId) return { error: 'This campaign has no gates yet' }
    const gates = await ctx.db.get(campaign.gateSetId)
    if (!gates) return { error: 'The gate version is missing' }

    const rows = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    if (!rows.length) return { error: 'Nothing has been tested against these gates yet' }

    let passedHard = 0
    let passedKnockouts = 0
    const histogram = new Map<number, number>()
    for (const row of rows) {
      if (row.verdict === 'hard_fail') continue
      passedHard++
      if (row.verdict === 'knockout_fail') continue
      passedKnockouts++
      histogram.set(row.score, (histogram.get(row.score) ?? 0) + 1)
    }
    const qualified = [...histogram.entries()]
      .filter(([score]) => score >= gates.passScore)
      .reduce((sum, [, count]) => sum + count, 0)

    // What the ratio turns into over a day at the current crawl rate. The rate
    // itself is an internal number and never leaves this calculation.
    const perDay = Math.round((qualified / rows.length) * (args.profilesPerDay ?? 900))

    const id = await ctx.db.insert('feasibilityRuns', {
      campaignId: args.campaignId,
      accountId: args.accountId,
      gateSetId: gates._id,
      gateSetVersion: gates.version,
      sampleSize: rows.length,
      passedHard,
      passedKnockouts,
      scoreHistogram: [...histogram.entries()]
        .map(([score, count]) => ({ score, count }))
        .sort((a, b) => a.score - b.score),
      estimatedPerDay: perDay,
      ranAt: Date.now(),
    })
    const written = await ctx.db.get(id)
    return {
      id,
      gateSetVersion: gates.version,
      sampleSize: rows.length,
      passedHard,
      passedKnockouts,
      scoreHistogram: written!.scoreHistogram,
      estimatedPerDay: perDay,
      ranAt: written!.ranAt,
    }
  },
})
