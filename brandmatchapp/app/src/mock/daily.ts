import type { DailyStat } from '../types'
import { daysAgo } from './time'

// 14 days of crawl output, newest last. Numbers hold to the spec:
// 300 to 500 profiles crawled a day, a fraction kept as leads, a fraction of those at 2 or 3 stars.

const raw: [gathered: number, leads: number, high: number][] = [
  [412, 34, 12],
  [388, 29, 9],
  [431, 41, 16],
  [356, 26, 7],
  [402, 33, 11],
  [478, 47, 19],
  [369, 24, 6],
  [395, 31, 10],
  [441, 39, 15],
  [418, 36, 13],
  [327, 21, 5],
  [463, 44, 17],
  [406, 35, 12],
  [421, 38, 14],
]

export const dailyStats: DailyStat[] = raw.map(([gathered, leads, high], i) => ({
  date: daysAgo(raw.length - 1 - i, 7),
  gathered,
  leads,
  high,
}))
