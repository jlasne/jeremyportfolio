import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { settle, type HardRules } from './templates'

// Zone 5, the simulator.
//
// It answers one question: do these criteria hold the daily flow. It reports
// survival per gate, the score spread, and an estimate a day. It reports
// nothing about what the sample cost to read, and nothing about how many
// profiles we are willing to read, which is what turns the estimate into a
// number in the first place.
//
// Everything is computed from the evaluations already on file. A client can
// move a threshold and see the effect without a crawl and without a model call,
// because the audit trail already holds every answer we ever paid for.

/** The one internal number on this page, and it never leaves it. */
function scanRate(analysisBudgetPerDay: number): number {
  return analysisBudgetPerDay
}

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
      qualified: run.qualified,
      blame: run.blame ?? [],
      scoreHistogram: run.scoreHistogram,
      estimatedPerDay: run.estimatedPerDay,
      ranAt: run.ranAt,
    }
  },
})

interface Walk {
  scanned: number
  pastHard: number
  pastKnockouts: number
  qualified: number
  histogram: Map<number, number>
  blame: Map<string, { sole: number; shared: number }>
}

/** One row of the audit trail, reduced to what a re-run needs. */
interface Row {
  verdict: string
  score: number
  hardChecks: { key: string; value: number; pass: boolean }[]
}

/**
 * Walks the stored evaluations under a set of rules.
 *
 * Gate 1 is recomputed from the measurements the evaluation kept, so moving a
 * threshold is free. Gates 2 and 3 cannot be recomputed for a profile the model
 * never saw, so a profile that only passes under the looser rules is counted at
 * the rate observed on the profiles that did go all the way. That is why every
 * figure on this screen is worded as an estimate.
 */
function walk(rows: Row[], hard: HardRules, passScore: number): Walk {
  const out: Walk = {
    scanned: rows.length,
    pastHard: 0,
    pastKnockouts: 0,
    qualified: 0,
    histogram: new Map(),
    blame: new Map(),
  }

  // Observed behaviour past gate 1, used to price the profiles we never asked
  // about. Taken from the rows that actually reached the model.
  const reached = rows.filter((r) => r.verdict !== 'hard_fail')
  const knockoutRate = reached.length
    ? reached.filter((r) => r.verdict !== 'knockout_fail').length / reached.length
    : 0
  const scored = reached.filter((r) => r.verdict !== 'knockout_fail')
  const qualifyRate = scored.length
    ? scored.filter((r) => r.score >= passScore).length / scored.length
    : 0

  let estimatedNew = 0

  for (const row of rows) {
    const failed: string[] = []
    for (const check of row.hardChecks) {
      const limit = (hard as Record<string, unknown>)[check.key]
      if (typeof limit !== 'number') {
        // The threshold was dropped, so this check can no longer fail.
        continue
      }
      if (!passes(check.key, check.value, limit)) failed.push(check.key)
    }

    if (failed.length) {
      for (const key of failed) {
        const at = out.blame.get(key) ?? { sole: 0, shared: 0 }
        if (failed.length === 1) at.sole++
        else at.shared++
        out.blame.set(key, at)
      }
      continue
    }

    out.pastHard++
    if (row.verdict === 'hard_fail') {
      // Newly admitted by a looser threshold, and never seen by the model.
      estimatedNew++
      continue
    }
    if (row.verdict === 'knockout_fail') continue
    out.pastKnockouts++
    out.histogram.set(row.score, (out.histogram.get(row.score) ?? 0) + 1)
    if (row.score >= passScore) out.qualified++
  }

  out.pastKnockouts += Math.round(estimatedNew * knockoutRate)
  out.qualified += Math.round(estimatedNew * knockoutRate * qualifyRate)
  return out
}

function passes(key: string, value: number, limit: number): boolean {
  // A measurement we never took cannot clear a threshold on measured data.
  if (value < 0) return false
  if (key === 'followersMax' || key === 'lastPostWithinDays') return value <= limit
  if (key === 'countries' || key === 'languages') return value === 1
  return value >= limit
}

export const run = internalMutation({
  args: { accountId: v.id('accounts'), campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign || campaign.accountId !== args.accountId) return { error: 'No such campaign' }
    if (!campaign.gateSetId) return { error: 'This campaign has no gates yet' }
    const gates = await ctx.db.get(campaign.gateSetId)
    if (!gates) return { error: 'The gate version is missing' }
    const account = await ctx.db.get(args.accountId)
    if (!account) return { error: 'No such account' }

    const rows = await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    if (!rows.length) return { error: 'Nothing has been tested against these gates yet' }

    const out = walk(rows as unknown as Row[], gates.hard, gates.passScore)
    const estimatedPerDay = Math.round(
      (out.qualified / Math.max(1, out.scanned)) * scanRate(account.analysisBudgetPerDay),
    )

    const id = await ctx.db.insert('feasibilityRuns', {
      campaignId: args.campaignId,
      accountId: args.accountId,
      gateSetId: gates._id,
      gateSetVersion: gates.version,
      sampleSize: out.scanned,
      passedHard: out.pastHard,
      passedKnockouts: out.pastKnockouts,
      qualified: out.qualified,
      blame: [...out.blame.entries()].map(([key, v2]) => ({ key, ...v2 })).sort((a, b) => b.sole - a.sole),
      scoreHistogram: Array.from({ length: gates.criteria.length * 2 + 1 }, (_, score) => ({
        score,
        count: out.histogram.get(score) ?? 0,
      })),
      estimatedPerDay,
      ranAt: Date.now(),
    })
    const written = await ctx.db.get(id)
    return {
      id,
      gateSetVersion: gates.version,
      sampleSize: written!.sampleSize,
      passedHard: written!.passedHard,
      passedKnockouts: written!.passedKnockouts,
      qualified: written!.qualified,
      blame: written!.blame,
      scoreHistogram: written!.scoreHistogram,
      estimatedPerDay,
      ranAt: written!.ranAt,
    }
  },
})

// ---------------------------------------------------------------------------
// Levers
// ---------------------------------------------------------------------------

/** One notch looser, per threshold. Enough to move the needle, not to surprise. */
const NOTCH: Record<string, (v: number) => number> = {
  followersMin: (v) => Math.round(v * 0.67),
  followersMax: (v) => Math.round(v * 1.5),
  lastPostWithinDays: (v) => Math.round(v * 2),
  medianViewsMin: (v) => Math.round(v * 0.6),
  postsPerMonthMin: (v) => Math.round(v * 0.67),
  medianCommentsMin: () => 0,
}

const LABEL: Record<string, string> = {
  followersMin: 'Followers, floor',
  followersMax: 'Followers, ceiling',
  lastPostWithinDays: 'Last post, no older than',
  medianViewsMin: 'Median views, floor',
  postsPerMonthMin: 'Posts a month, floor',
  medianCommentsMin: 'Median comments, floor',
}

/**
 * The two moves worth a click.
 *
 * Each candidate is measured by re-walking the whole sample with that one
 * change, because "what do I get if I move this and nothing else" has no
 * shortcut. Sole blame only breaks ties.
 *
 * Gate 2 is never a candidate. Telling a client to stop asking whether a
 * creator has a paid offer, so a quota is met, is selling them worse leads.
 * Volume is negotiated on the numbers, never on the questions.
 */
export const levers = internalQuery({
  args: { accountId: v.id('accounts'), campaignId: v.id('campaigns') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId)
    if (!campaign?.gateSetId || campaign.accountId !== args.accountId) return { levers: [] }
    const gates = await ctx.db.get(campaign.gateSetId)
    if (!gates) return { levers: [] }
    const rows = (await ctx.db
      .query('evaluations')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()) as unknown as Row[]
    if (!rows.length) return { levers: [] }

    const base = walk(rows, gates.hard, gates.passScore)
    const from = Math.max(1, base.qualified)
    const out: Record<string, unknown>[] = []

    for (const key of Object.keys(NOTCH)) {
      const value = (gates.hard as Record<string, unknown>)[key]
      if (typeof value !== 'number') continue
      const loosened = settle({ ...gates.hard, [key]: NOTCH[key](value) })
      const after = (loosened as Record<string, unknown>)[key] as number
      if (after === value) continue
      const gain = walk(rows, loosened, gates.passScore).qualified / from
      out.push({
        id: key,
        label: `${LABEL[key]}, ${value}`,
        action: `${verb(key)} it to ${after} ${phrase(gain)}.`,
        gain,
        next: { hard: loosened, passScore: gates.passScore },
        change: `${LABEL[key]}: ${value} to ${after}`,
        sole: base.blame.get(key)?.sole ?? 0,
      })
    }

    // The score is a candidate like any other, and its gain is exact rather
    // than estimated: lowering the bar by one admits exactly one bucket.
    if (gates.passScore > 5) {
      const next = gates.passScore - 1
      const admitted = base.histogram.get(next) ?? 0
      const gain = (base.qualified + admitted) / from
      out.push({
        id: 'passScore',
        label: `Qualifying score, ${gates.passScore} of ${gates.criteria.length * 2}`,
        action: `Lowering it to ${next} ${phrase(gain)}.`,
        gain,
        next: { hard: gates.hard, passScore: next },
        change: `Qualifying score: ${gates.passScore} to ${next}`,
        sole: 0,
      })
    }

    return {
      levers: out
        // Under a fifth more, it is not worth a click.
        .filter((c) => (c.gain as number) >= 1.2)
        .sort((a, b) => (b.gain as number) - (a.gain as number) || (b.sole as number) - (a.sole as number))
        .slice(0, 2),
    }
  },
})

function verb(key: string): string {
  if (key === 'followersMax') return 'Raising'
  if (key === 'lastPostWithinDays') return 'Allowing'
  if (key === 'medianCommentsMin') return 'Dropping'
  return 'Lowering'
}

/** Estimates, said as estimates. Never a guarantee. */
function phrase(gain: number): string {
  if (gain >= 2.8) return 'roughly triples your volume'
  if (gain >= 1.8) return 'roughly doubles your volume'
  return `adds about ${Math.max(10, Math.round(((gain - 1) * 100) / 10) * 10)}% more`
}
