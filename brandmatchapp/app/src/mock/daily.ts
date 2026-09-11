import type { DailyStat } from '../types'
import { campaigns } from './campaigns'
import { daysAgo } from './time'

// 90 days per agent, newest last. Every agent has a daily quota of leads and
// fills it every morning, so one row is one agent on one day. Every lead shows
// in the list, and around 6 in 10 reach a full star, which is what qualifies.

const DAYS = 90

/** A steady shape with a weekly dip and a slow climb, seeded per agent so they differ. */
function shape(day: number, seed: number): number {
  const week = day % 7 === 5 || day % 7 === 6 ? 0.78 : 1
  const wave = 1 + 0.12 * Math.sin((day + seed * 9) / 4.5)
  const climb = 0.86 + (day / DAYS) * 0.22
  return week * wave * climb
}

export const dailyStats: DailyStat[] = campaigns.flatMap((campaign, index) =>
  campaign.agents.flatMap((agent, agentIndex) => {
    const seed = index * 3 + agentIndex
    return Array.from({ length: DAYS }, (_, i) => {
      const started = i >= DAYS - 34 - index * 12
      const running = campaign.active && agent.active && started
      const leads = running ? Math.round(agent.leadsPerDay * shape(i, seed)) : 0
      const share = 0.58 + 0.09 * Math.sin((i + seed * 5) / 3)
      return {
        date: daysAgo(DAYS - 1 - i, 7),
        campaignId: campaign.id,
        agentId: agent.id,
        gathered: leads,
        leads,
        qualified: Math.round(leads * share),
      }
    })
  }),
)
