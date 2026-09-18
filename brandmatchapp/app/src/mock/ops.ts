import type { CrawlRun } from '../types'
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
