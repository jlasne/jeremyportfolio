import type {
  CriterionScore,
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
import { evaluate, type Judgement } from '../data/gates'
import { account, currentPeriod, dayOfPeriod, daysInPeriod, subscription, topups } from './account'
import { campaigns } from './campaigns'
import { gateSetById, gateSets } from './gates'
import { built } from './creators'
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

const KNOCKOUT_NOTES: Record<string, [string, string]> = {
  k_method: ['Names a four phase system and repeats it across posts', 'Posts results, never the method behind them'],
  k_software: ['Programme is a weekly plan and a check in, both fit an app', 'Value is hands on gym work, an app cannot carry it'],
  k_no_app: ['Sells through a PDF and a spreadsheet today', 'Already ships an app on both stores'],
  k_buys: ['Cohort sold out twice this year', 'No paid offer anywhere on the account'],
  k_person: ['Face on camera in every post, answers the comments themselves', 'Theme page reposting other people, no named owner'],
  k_paid: ['Runs a paid community with a monthly fee', 'Everything published is free'],
  k_clear: ['Education only, and says so in the bio', 'Gives position sized recommendations, that is regulated advice'],
  k_no_platform: ['Sells through a third party course tool today', 'Already runs a platform of their own'],
}

const CRITERION_NOTES: Record<string, [string, string, string]> = {
  c_sells: ['No paid offer found', 'Coaching mentioned, no price in public', 'Programme sold at a public price'],
  c_method: ['No method named', 'A loose framework, unnamed', 'Names the method and repeats it'],
  c_demand: ['Comments are compliments', 'A few asking how to start', 'People asking where to buy, every post'],
  c_proof: ['No numbers shown', 'Before and after, no dates', 'Client numbers with dates, repeatedly'],
  c_stable: ['Under a year old', 'Two years, with a long gap', 'Four years, no gap over a month'],
  c_person: ['Faceless account', 'Face sometimes, mostly reposts', 'Face on camera, first person, replies'],
  c_reach: ['Reach well under the count', 'Reach near the count', 'Median views above the follower count'],
}

/** Builds the model's answer for one profile, from its band. */
function judge(index: number, band: string, gateId: string): Judgement {
  const rand = seeded(4_400_011 + index * 104_729)
  const gates = gateSetById.get(gateId)!
  const knockouts: Judgement['knockouts'] = {}
  // A strong profile clears the knockouts. A fair one fails roughly one in five.
  const failOdds = band === 'strong' ? 0.04 : band === 'fair' ? 0.2 : 0.4
  let failed = false
  for (const k of gates.knockouts) {
    const pass = failed ? true : rand() > failOdds
    if (!pass) failed = true
    const notes = KNOCKOUT_NOTES[k.id] ?? ['Yes', 'No']
    knockouts[k.id] = { pass, note: pass ? notes[0] : notes[1] }
  }
  const criteria: Judgement['criteria'] = {}
  for (const c of gates.criteria) {
    const roll = rand()
    const score: CriterionScore =
      band === 'strong' ? (roll > 0.22 ? 2 : 1)
        : band === 'fair' ? (roll > 0.6 ? 2 : roll > 0.24 ? 1 : 0)
          : (roll > 0.8 ? 1 : 0)
    const notes = CRITERION_NOTES[c.id] ?? ['No', 'Partly', 'Yes']
    criteria[c.id] = { score, note: notes[score] }
  }
  return { knockouts, criteria, reason: '' }
}

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
  const result = evaluate(b.creator, gates, judge(index, b.band, gates.id), now)
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
  const campaign = campaigns.find((c) => c.id === gates.campaignId)!
  const sample = built.filter((b) => (b.niche === 'fitness') === (campaign.id === 'cmp_fitness'))
  let passedHard = 0
  let passedKnockouts = 0
  const histogram = new Map<number, number>()
  sample.forEach((b, index) => {
    const result = evaluate(b.creator, gates, judge(index, b.band, gates.id), now)
    if (result.verdict === 'hard_fail') return
    passedHard++
    if (result.verdict === 'knockout_fail') return
    passedKnockouts++
    histogram.set(result.score, (histogram.get(result.score) ?? 0) + 1)
  })
  const qualified = [...histogram.entries()]
    .filter(([score]) => score >= gates.passScore)
    .reduce((sum, [, count]) => sum + count, 0)
  // Every score from 0 to the ceiling, so the spread reads as a spread.
  const dense = Array.from({ length: gates.criteria.length * 2 + 1 }, (_, score) => ({
    score,
    count: histogram.get(score) ?? 0,
  }))
  return {
    id: `fea_${gates.id}`,
    campaignId: gates.campaignId,
    gateSetId: gates.id,
    gateSetVersion: gates.version,
    sampleSize: sample.length,
    passedHard,
    passedKnockouts,
    scoreHistogram: dense,
    // What the ratio turns into over a day at the current crawl rate.
    estimatedPerDay: Math.round((qualified / Math.max(1, sample.length)) * 900),
    ranAt: daysAgo(i === 1 ? 31 : 2),
  }
})
