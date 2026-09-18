import type {
  DailyDelivery,
  Deal,
  Evaluation,
  FeasibilityRun,
  Lead,
  LeadEvent,
  LeadStatus,
  QuotaEntry,
  QuotaPeriod,
} from '../types'
import { evaluate } from '../data/gates'
import { account, currentPeriod, dayOfPeriod, daysInPeriod, subscription, topups } from './account'
import { campaigns } from './campaigns'
import { gateSetById, gateSets } from './gates'
import { built } from './creators'
import { judge } from './judge'
import { simulate } from '../data/simulate'
import { pick, seeded } from './rand'
import { daysAgo, NOW } from './time'

// The sample account is not hand written. The gate engine is run over the 1,600
// generated profiles and whatever comes out is the sample: evaluations, claims,
// leads, the journal. Change a threshold in mock/gates.ts and the whole account
// moves with it, which is exactly what the real pipeline will do.
//
// Two passes. The first judges every profile. The second spreads whatever
// qualified across the days of the month, because a client is delivered a flow
// and not a pile.

const REASONS: Record<string, string[]> = {
  cmp_fitness: [
    'Sells a named programme at a public price and the comments ask where to buy.',
    'Four years of steady posting, reach above the follower count, one offer already live.',
    'Client numbers posted with dates, and the method is repeated across the last thirty posts.',
    'Teaches a four phase system, face on camera, answers every comment herself.',
    'Programme sold through a PDF today, which is exactly what an app replaces.',
  ],
  cmp_finance: [
    'Runs a paid community with a monthly fee, education only, no regulated advice anywhere.',
    'Weekly filing breakdowns, a named framework, and a cohort that sold out twice.',
    'Sells through a third party course tool today and the audience asks for more.',
    'Nine years as an analyst, teaches the research process, reach above the follower count.',
    'Paid cohort at a public price, people ask in every thread where to join.',
  ],
}

const now = NOW.getTime()

export const evaluations: Evaluation[] = []
export const leads: Lead[] = []
export const leadEvents: LeadEvent[] = []
export const deals: Deal[] = []
export const claims: { creatorId: string; accountId: string; campaignId: string; claimedAt: string }[] = []

/** Where a lead sits on the walk, given how long it has been in the client's hands. */
const STATUS_WALK: LeadStatus[] = ['new', 'contacted', 'replied', 'call', 'signed', 'lost']

// Pass one: judge everything ------------------------------------------------

interface Passed { index: number; creatorId: string; campaignId: string; score: number; evaluationId: string }
const passed: Passed[] = []

built.forEach((b, index) => {
  const campaign = b.niche === 'fitness' ? campaigns[0] : campaigns[1]
  const gates = gateSetById.get(campaign.gateSetId)!
  const result = evaluate(b.creator, gates, judge(index, b.band, gates), now)
  const rand = seeded(777_001 + index * 31)

  const evaluationId = `evl_${b.creator.id}`
  evaluations.push({
    id: evaluationId,
    creatorId: b.creator.id,
    campaignId: campaign.id,
    accountId: account.id,
    gateSetId: gates.id,
    gateSetVersion: gates.version,
    verdict: result.verdict,
    blockedBy: result.blockedBy,
    hardChecks: result.hardChecks,
    knockoutAnswers: result.knockoutAnswers,
    criteriaScores: result.criteriaScores,
    score: result.score,
    reason: result.verdict === 'qualified' ? pick(rand, REASONS[campaign.id]) : result.reason,
    evaluatedAt: daysAgo(Math.min(daysInPeriod - 1, Math.floor(index / 90))),
  })

  if (result.verdict === 'qualified') {
    passed.push({ index, creatorId: b.creator.id, campaignId: campaign.id, score: result.score, evaluationId })
  }
})

// Pass two: hand them over, best first, spread over the days of the month ----

// The quota belongs to the account, so the best score wins whichever campaign
// it came from. That is the rule the backend's deliver.ts follows too.
passed.sort((a, b) => b.score - a.score)

const daysElapsed = Math.max(1, dayOfPeriod)
const perDay = Math.max(1, Math.round(passed.length / daysElapsed))

passed.forEach((row, rank) => {
  const daysBack = Math.min(daysElapsed - 1, Math.floor(rank / perDay))
  const deliveredAt = daysAgo(daysBack, 7)
  const rand = seeded(313_007 + row.index * 17)

  claims.push({ creatorId: row.creatorId, accountId: account.id, campaignId: row.campaignId, claimedAt: deliveredAt })

  // Fresh leads sit untouched. The longer a client has had one, the further it
  // has walked, and a few fall out along the way.
  const roll = rand()
  const reach =
    daysBack === 0 ? 0
      : daysBack <= 2 ? (roll > 0.45 ? 1 : 0)
        : daysBack <= 5 ? (roll > 0.75 ? 2 : 1)
          : daysBack <= 10 ? (roll > 0.88 ? 3 : roll > 0.55 ? 2 : 1)
            : (roll > 0.95 ? 4 : roll > 0.86 ? 3 : roll > 0.6 ? 2 : 1)
  const lost = daysBack > 6 && rand() > 0.88 && reach > 0
  const status: LeadStatus = lost ? 'lost' : STATUS_WALK[reach]
  const leadId = `led_${row.creatorId}`
  const statusAt = daysAgo(Math.max(0, daysBack - reach), 11)

  leads.push({
    id: leadId,
    accountId: account.id,
    campaignId: row.campaignId,
    creatorId: row.creatorId,
    evaluationId: row.evaluationId,
    score: row.score,
    status,
    ownerId: reach === 0 ? null : rank % 2 === 0 ? 'mem_1' : 'mem_2',
    deliveredAt,
    statusAt,
  })

  // The journal of the lead: every step it walked, in order.
  let from: LeadStatus | null = null
  for (let step = 0; step <= reach; step++) {
    const to = STATUS_WALK[step]
    leadEvents.push({
      id: `lev_${leadId}_${step}`,
      leadId,
      accountId: account.id,
      campaignId: row.campaignId,
      from,
      to,
      by: step === 0 ? 'system' : rank % 2 === 0 ? 'mem_1' : 'mem_2',
      at: daysAgo(Math.max(0, daysBack - step), 11),
    })
    from = to
  }
  if (lost) {
    leadEvents.push({
      id: `lev_${leadId}_out`,
      leadId,
      accountId: account.id,
      campaignId: row.campaignId,
      from,
      to: 'lost',
      by: rank % 2 === 0 ? 'mem_1' : 'mem_2',
      at: statusAt,
    })
  }

  if (status === 'signed') {
    deals.push({
      id: `dea_${leadId}`,
      leadId,
      accountId: account.id,
      campaignId: row.campaignId,
      amountCents: row.campaignId === 'cmp_fitness' ? 1_200_000 + (rank % 5) * 300_000 : 540_000,
      currency: 'EUR',
      signedAt: statusAt,
      note: row.campaignId === 'cmp_fitness' ? 'App build, three month delivery' : 'Platform, twelve month contract',
    })
  }
})

// ---------------------------------------------------------------------------
// The journal
// ---------------------------------------------------------------------------

const entitled = subscription.tier * daysInPeriod

export const quotaEntries: QuotaEntry[] = [
  {
    id: 'qte_entitlement',
    accountId: account.id,
    period: currentPeriod,
    kind: 'entitlement',
    delta: entitled,
    note: `Tier ${subscription.tier} a day over ${daysInPeriod} days`,
    at: subscription.periodStart,
  },
  {
    id: 'qte_topup',
    accountId: account.id,
    period: currentPeriod,
    kind: 'topup',
    delta: topups[0].leads,
    note: 'One off top up',
    at: topups[0].purchasedAt,
  },
  ...leads.map((lead) => ({
    id: `qte_${lead.id}`,
    accountId: account.id,
    period: currentPeriod,
    kind: 'delivery' as const,
    delta: -1,
    campaignId: lead.campaignId,
    leadId: lead.id,
    at: lead.deliveredAt,
  })),
]

export const quotaPeriod: QuotaPeriod = {
  accountId: account.id,
  period: currentPeriod,
  entitled: entitled + topups[0].leads,
  delivered: leads.length,
  carried: 0,
  remaining: entitled + topups[0].leads - leads.length,
}

// ---------------------------------------------------------------------------
// Daily deliveries, for the dashboard chart
// ---------------------------------------------------------------------------

const countByDay = new Map<string, number>()
for (const lead of leads) {
  const key = `${lead.campaignId}|${lead.deliveredAt.slice(0, 10)}`
  countByDay.set(key, (countByDay.get(key) ?? 0) + 1)
}

export const dailyDeliveries: DailyDelivery[] = []
for (let back = 29; back >= 0; back--) {
  const date = daysAgo(back).slice(0, 10)
  for (const campaign of campaigns) {
    dailyDeliveries.push({
      accountId: account.id,
      campaignId: campaign.id,
      date,
      delivered: countByDay.get(`${campaign.id}|${date}`) ?? 0,
      target: campaign.dailyCap ?? subscription.tier,
    })
  }
}

// ---------------------------------------------------------------------------
// Feasibility, one run per gate version
// ---------------------------------------------------------------------------

export const feasibilityRuns: FeasibilityRun[] = gateSets.map((gates, i) => {
  const out = simulate(gates, subscription.tier)
  return {
    id: `fea_${gates.id}`,
    campaignId: gates.campaignId,
    gateSetId: gates.id,
    gateSetVersion: gates.version,
    sampleSize: out.funnel.scanned,
    passedHard: out.funnel.pastHard,
    passedKnockouts: out.funnel.pastKnockouts,
    qualified: out.funnel.qualified,
    blame: out.blame,
    scoreHistogram: out.histogram,
    estimatedPerDay: out.estimatedPerDay,
    ranAt: daysAgo(i === 1 ? 31 : 2),
  }
})
