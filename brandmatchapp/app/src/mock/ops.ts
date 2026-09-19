import type { CrawlRun } from '../types'
import type { OpsCampaign, OpsDay } from '../lib/api'
import { account, subscription } from './account'
import { campaigns } from './campaigns'
import { evaluations, leads } from './pipeline'
import { daysAgo } from './time'

// Internal only. Cost per crawl, profiles analysed, fair use: none of it is
// allowed on a client screen, so none of it is imported by data/index.ts. The
// admin screen is the one reader.

export const crawlRuns: CrawlRun[] = Array.from({ length: 14 }, (_, i) => {
  const back = i
  const campaign = campaigns[i % 2]
  const fetched = 600 + ((i * 137) % 420)
  const evaluated = Math.round(fetched * 0.34)
  const qualified = leads.filter((l) => l.deliveredAt.slice(0, 10) === daysAgo(back).slice(0, 10)).length
  return {
    id: `run_${back}`,
    campaignId: campaign.id,
    source: 'apify',
    phase: 'detail',
    status: i === 0 ? 'running' : 'succeeded',
    profilesFetched: fetched,
    profilesEvaluated: evaluated,
    qualified,
    // Search plus detail, measured on real runs: roughly 0.6 cents a profile.
    costCents: Math.round(fetched * 0.6),
    startedAt: daysAgo(back, 4),
    finishedAt: i === 0 ? null : daysAgo(back, 6),
  }
})

/** Fair use, the internal ceiling on analysed volume. Never rendered client side. */
export const analysisBudgetPerDay = 1_200

export const analysedToday = crawlRuns
  .filter((r) => r.startedAt.slice(0, 10) === daysAgo(0).slice(0, 10))
  .reduce((sum, r) => sum + r.profilesFetched, 0)

export const evaluatedTotal = evaluations.length

/**
 * Each campaign, the way the operator reads it: how many looked at, how many
 * made it past each check, what it cost, and how many qualified people we
 * hold that have not been handed over. All of it from the engine's own
 * output over the sample, none of it reachable from a client screen.
 */
export const opsCampaigns: OpsCampaign[] = campaigns.map((c) => {
  const mine = evaluations.filter((e) => e.campaignId === c.id)
  const passedSize = mine.filter((e) => e.verdict !== 'hard_fail').length
  const passedNiche = mine.filter((e) => e.verdict !== 'hard_fail' && e.verdict !== 'off_niche').length
  const passedBreakers = mine.filter((e) => e.verdict === 'qualified' || e.verdict === 'below_threshold').length
  const qualified = mine.filter((e) => e.verdict === 'qualified').length
  const delivered = leads.filter((l) => l.campaignId === c.id).length
  const costCents = crawlRuns.filter((r) => r.campaignId === c.id).reduce((sum, r) => sum + r.costCents, 0)
  const perDay = c.dailyCap ?? subscription.tier
  const held = Math.max(0, qualified - delivered)
  return {
    id: c.id,
    name: c.name,
    account: account.name,
    status: c.status,
    perDay,
    analysed: mine.length,
    passedSize,
    passedNiche,
    passedBreakers,
    qualified,
    delivered,
    costCents,
    costPerQualifiedCents: qualified ? Math.round(costCents / qualified) : null,
    held,
    daysHeld: perDay ? Math.floor(held / perDay) : null,
  }
})

/** The last fourteen days: what was looked at, what qualified, what it cost. */
export const opsDays: OpsDay[] = Array.from({ length: 14 }, (_, i) => {
  const back = 13 - i
  const date = daysAgo(back).slice(0, 10)
  const runs = crawlRuns.filter((r) => r.startedAt.slice(0, 10) === date)
  return {
    date,
    analysed: runs.reduce((sum, r) => sum + r.profilesFetched, 0),
    qualified: runs.reduce((sum, r) => sum + r.qualified, 0),
    costCents: runs.reduce((sum, r) => sum + r.costCents, 0),
  }
})
