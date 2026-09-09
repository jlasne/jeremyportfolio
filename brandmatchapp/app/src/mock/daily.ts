import type { DailyStat } from '../types'
import { daysAgo } from './time'

// 14 days of output, newest last.
// Roughly 1 lead in 10 comes back qualified, which is 2 stars or more.

const raw: [leads: number, qualified: number][] = [
  [412, 38],
  [388, 34],
  [431, 47],
  [356, 29],
  [402, 41],
  [478, 52],
  [369, 31],
  [395, 36],
  [441, 44],
  [418, 40],
  [327, 26],
  [463, 49],
  [406, 39],
  [421, 43],
]

export const dailyStats: DailyStat[] = raw.map(([leads, qualified], i) => ({
  date: daysAgo(raw.length - 1 - i, 7),
  gathered: leads,
  leads,
  qualified,
}))
