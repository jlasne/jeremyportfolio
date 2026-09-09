import type { DailyStat } from '../types'
import { campaigns } from './campaigns'
import { daysAgo } from './time'

// 90 days per campaign, newest last. Every lead shows in the list, and about
// 9 in 10 reach half a star, which is what counts as qualified.

const DAYS = 90

/** A steady shape with a weekly dip and a slow climb, seeded per campaign so they differ. */
function shape(day: number, seed: number): number {
  const week = day % 7 === 5 || day % 7 === 6 ? 0.78 : 1
  const wave = 1 + 0.12 * Math.sin((day + seed * 9) / 4.5)
  const climb = 0.86 + (day / DAYS) * 0.22
  return week * wave * climb
}

export const dailyStats: DailyStat[] = campaigns.flatMap((campaign, index) =>
  Array.from({ length: DAYS }, (_, i) => {
    const target = campaign.agents.filter((a) => a.active).reduce((sum, a) => sum + a.leadsPerDay, 0)
    const started = i >= DAYS - 34 - index * 12
    const leads = campaign.active && started ? Math.round(target * shape(i, index)) : 0
    const share = 0.86 + 0.06 * Math.sin((i + index * 5) / 3)
    return {
      date: daysAgo(DAYS - 1 - i, 7),
      campaignId: campaign.id,
      gathered: leads,
      leads,
      qualified: Math.round(leads * share),
    }
  }),
)
