// Share price: market return, business value pulled toward fundamentals, debt drag.

import { POOLS, zeroPools } from './constants'
import { defaultConfig } from './config'
import { clamp } from './money'
import type { Config, PoolId } from './types'

/** f(c) = (e^{kc} - 1) / (e^k - 1). */
export function debtDragFactor(c: number, k: number): number {
  const x = clamp(c, 0, 1)
  if (k === 0) return x
  return (Math.exp(k * x) - 1) / (Math.exp(k) - 1)
}

export interface StockReturnInput {
  revenue: number
  /** null on the first round: no revenue growth term. */
  prevRevenue: number | null
  /** Share of last round's revenue from each pool. */
  weights: Record<PoolId, number>
  growth: Record<PoolId, number>
  expected: Record<PoolId, number>
  /** 1 - used / online, 0 to 1. */
  idle: number
}

/** Revenue growth against last round, with the edge cases of DESIGN 2.3 step 9. */
export function revenueGrowth(revenue: number, prevRevenue: number | null, config: Config = defaultConfig): number {
  const lim = config.stock.revenueGrowthClamp
  if (prevRevenue === null) return 0
  if (prevRevenue <= 0) return revenue > 0 ? lim : 0
  return clamp((revenue - prevRevenue) / prevRevenue, -lim, lim)
}

/** P_idle: 1% for every 10 points of idle above 20%, continuous. */
function idlePenalty(idle: number, config: Config = defaultConfig): number {
  return Math.max(0, idle - config.stock.idleFree) * config.stock.idlePenaltyPer10 * 10
}

/** Step 1 of the stock price: r = 0.5 clamp(dRev) + sum w (g - E) - P_idle. */
export function stockReturn(
  input: StockReturnInput,
  config: Config = defaultConfig,
): { r: number; revenueGrowth: number; demandMiss: Record<PoolId, number>; idle: number } {
  const rev = config.stock.revenueGrowthWeight * revenueGrowth(input.revenue, input.prevRevenue, config)
  const demandMiss = zeroPools()
  let miss = 0
  for (const p of POOLS) {
    demandMiss[p] = (input.weights[p] ?? 0) * ((input.growth[p] ?? 0) - (input.expected[p] ?? 0))
    miss += demandMiss[p]
  }
  const idle = idlePenalty(input.idle, config)
  return { r: rev + miss - idle, revenueGrowth: rev, demandMiss, idle }
}

/** FV = profitMultiple × max(mean recent profit, 0) + bookWeight × building price paid. */
export function fundamentalValue(recentProfits: number[], book: number, config: Config = defaultConfig): number {
  const mean = recentProfits.length > 0 ? recentProfits.reduce((a, b) => a + b, 0) / recentProfits.length : 0
  return config.stock.profitMultiple * Math.max(mean, 0) + config.stock.bookWeight * book
}

/** Share of revenue from each pool; all zero without revenue. */
export function revenueWeights(revenueByPool: Record<PoolId, number> | undefined): Record<PoolId, number> {
  const w = zeroPools()
  if (!revenueByPool) return w
  const total = POOLS.reduce((s, p) => s + (revenueByPool[p] ?? 0), 0)
  if (total <= 0) return w
  for (const p of POOLS) w[p] = (revenueByPool[p] ?? 0) / total
  return w
}
