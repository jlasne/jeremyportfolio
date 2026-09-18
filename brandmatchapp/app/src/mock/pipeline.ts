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
    'Runs a waiting list for the next cohort and says so in every caption.',
    'Answers technique questions in the comments, one by one, on every post.',
    'Posts the same eight week structure for every client, with the numbers.',
    'Sells one on one coaching at a public rate and turns people away.',
    'Built a following on rehab work, no app anywhere, spreadsheet in the bio.',
    'Three launches this year, each one sold out, all run from a link hub.',
    'Face on camera in every clip, first person, the audience knows her name.',
    'Reach holds above the follower count across the last twelve posts.',
    'Named method, weekly check ins, and a price people ask about daily.',
  ],
  cmp_finance: [
    'Runs a paid community with a monthly fee, education only, no regulated advice anywhere.',
    'Weekly filing breakdowns, a named framework, and a cohort that sold out twice.',
    'Sells through a third party course tool today and the audience asks for more.',
    'Nine years as an analyst, teaches the research process, reach above the follower count.',
    'Paid cohort at a public price, people ask in every thread where to join.',
    'Publishes the same research checklist every Sunday, and sells the long version.',
    'Members only chat, monthly fee in the bio, and a waiting list twice a year.',
    'Explains one report a week, in full, and never gives a recommendation.',
    'Sells a spreadsheet library today, which is a platform waiting to happen.',
    'Audience in the US and UK, asking about tax and pricing in the comments.',
    'Two years of weekly posts, no gaps, and the reach is climbing.',
    'Teaches the framework by name, repeats it, and sells the workbook.',
    'Runs a live cohort from a booking link, no platform of their own.',
    'Comments are real questions, answered one by one, by the same person.',
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

interface Passed {
  index: number
  creatorId: string
  campaignId: string
  score: number
  evaluationId: string
  niche: string | null
}
const passed: Passed[] = []

built.forEach((b, index) => {
  const campaign = b.niche === 'fitness' ? campaigns[0] : campaigns[1]
  const gates = gateSetById.get(campaign.gateSetId)!
  const niches = campaign.extracted.niches
  const result = evaluate(b.creator, gates, niches, judge(index, b.band, gates, niches), now)
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
    niche: result.niche,
    blockedBy: result.blockedBy,
    hardChecks: result.hardChecks,
    knockoutAnswers: result.knockoutAnswers,
    criteriaScores: result.criteriaScores,
    score: result.score,
    reason: result.verdict === 'qualified' ? pick(rand, REASONS[campaign.id]) : result.reason,
    evaluatedAt: daysAgo(Math.min(daysInPeriod - 1, Math.floor(index / 90))),
  })

  if (result.verdict === 'qualified') {
    passed.push({
      index,
      creatorId: b.creator.id,
      campaignId: campaign.id,
      score: result.score,
      evaluationId,
      niche: result.niche,
    })
  }
})

// Pass two: hand them over, best first, spread over the days of the month ----

// The quota belongs to the account, so the best score wins whichever campaign
// it came from. That is the rule the backend's deliver.ts follows too.
passed.sort((a, b) => b.score - a.score)

// Enough history to have a month behind the current one, so the dashboard can
// compare a period against the one before it.
const daysElapsed = Math.max(1, dayOfPeriod) + 28
const perDay = Math.max(1, Math.round(passed.length / daysElapsed))

/**
 * How likely this person is to answer, before any dice are thrown.
 *
 * Replies are not uniform in real life and they must not be uniform here, or
 * the dashboard would find patterns in noise. Small accounts answer less
 * because they are less sure, very large ones answer less because they get
 * hundreds of messages, and the slices of a market do not behave alike.
 */
function warmth(row: Passed, niches: { id: string }[]): number {
  const followers = built[row.index].creator.followers
  const size =
    followers < 25_000 ? 0.5
      : followers < 100_000 ? 1.2
        : followers < 250_000 ? 1.25
          : 0.65
  const at = niches.findIndex((n) => n.id === row.niche)
  // The first named slice is the core of the market. The tail is a stretch.
  const niche = at < 0 ? 0.5 : at === 0 ? 1.25 : at <= 2 ? 1.05 : 0.55
  const score = row.score >= 13 ? 1.15 : row.score <= 10 ? 0.8 : 1
  return size * niche * score
}

passed.forEach((row, rank) => {
  const daysBack = Math.min(daysElapsed - 1, Math.floor(rank / perDay))
  const deliveredAt = daysAgo(daysBack, 7)
  const rand = seeded(313_007 + row.index * 17)

  claims.push({ creatorId: row.creatorId, accountId: account.id, campaignId: row.campaignId, claimedAt: deliveredAt })

  // Fresh leads sit untouched. The longer a client has had one, the further it
  // has walked, and how far depends on who they are, not on the dice alone.
  // Two separate dice, because two different things are happening. Whether
  // someone answers depends on who they are, so that roll is warmed. Whether a
  // conversation turns into a signature depends on the pitch and the budget,
  // which has nothing to do with their follower count, so that roll is cold.
  const warm = warmth(row, campaigns.find((c) => c.id === row.campaignId)!.extracted.niches)
  const answer = Math.min(0.999, rand() * warm)
  const close = rand()

  let reach =
    daysBack === 0 ? 0
      : daysBack <= 2 ? (answer > 0.45 ? 1 : 0)
        : daysBack <= 5 ? (answer > 0.72 ? 2 : 1)
          : (answer > 0.6 ? 2 : 1)
  // Booking is uncommon and signing is rare, which is the whole reason a lead
  // costs what it costs.
  if (reach === 2 && daysBack > 4 && close > 0.62) reach = 3
  if (reach === 3 && daysBack > 9 && close > 0.945) reach = 4

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

// A few leads the client has touched beyond a status: saved for later, noted,
// or re-measured since they arrived. Enough for the list to look lived in.

const NOTES = [
  'Replied on the second message. Wants a call after the launch.',
  'Big audience but the offer is thin. Worth a soft pitch.',
  'Asked for pricing in the DMs. Send the deck.',
  'Already using a competitor. Follow up in the spring.',
  'Warm intro through Sacha. Do not cold message.',
]

leads.forEach((lead, i) => {
  if (i % 9 === 0) lead.saved = true
  if (i % 17 === 0) lead.note = NOTES[(i / 17) % NOTES.length | 0]
  // A profile we looked at again since it was handed over. The row refreshes
  // and goes back to the top. It never costs a second lead.
  if (i % 53 === 7) lead.refreshedAt = daysAgo(i % 3, 5)
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
  // Only this month's deliveries spend this month's balance. The older leads
  // still exist, they were simply paid for in a period that has closed.
  ...leads
    .filter((lead) => lead.deliveredAt.slice(0, 7) === currentPeriod)
    .map((lead) => ({
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

const deliveredThisMonth = leads.filter((l) => l.deliveredAt.slice(0, 7) === currentPeriod).length

export const quotaPeriod: QuotaPeriod = {
  accountId: account.id,
  period: currentPeriod,
  entitled: entitled + topups[0].leads,
  delivered: deliveredThisMonth,
  carried: 0,
  remaining: entitled + topups[0].leads - deliveredThisMonth,
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
  const out = simulate(gates, campaign.extracted.niches, subscription.tier)
  return {
    id: `fea_${gates.id}`,
    campaignId: gates.campaignId,
    gateSetId: gates.id,
    gateSetVersion: gates.version,
    sampleSize: out.funnel.scanned,
    passedHard: out.funnel.pastHard,
    inNiche: out.funnel.inNiche,
    passedKnockouts: out.funnel.pastKnockouts,
    qualified: out.funnel.qualified,
    blame: out.blame,
    scoreHistogram: out.histogram,
    estimatedPerDay: out.estimatedPerDay,
    ranAt: daysAgo(i === 1 ? 31 : 2),
  }
})
