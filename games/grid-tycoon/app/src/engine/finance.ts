// Loan pricing: stable clients make cheap debt.

import { POOLS, RATE_DECIMALS, ROUNDS_PER_YEAR } from './constants'
import { defaultConfig } from './config'
import { revenueWeights } from './stock'
import type { Company, Config } from './types'

/** Revenue-weighted stability of last round's clients, 0 to 1. */
function stabilityScore(company: Company, config: Config = defaultConfig): number {
  const w = revenueWeights(company.history.at(-1)?.revenueByPool)
  return POOLS.reduce((s, p) => s + w[p] * config.stability[p], 0)
}

/** Annual rate a new loan gets now: 12% - 8% × stability score (+4 points under stress). */
export function companyLoanRate(company: Company, config: Config = defaultConfig): number {
  const last = company.history.at(-1)
  const stressed = company.treasury < 0 || (last !== undefined && last.profit < 0)
  const rate = config.loan.baseRate - config.loan.stabilitySpread * stabilityScore(company, config) + (stressed ? config.loan.stressAdd : 0)
  // Clean float noise (0.048000000000000001) so the rate reads as it is shown.
  const scale = 10 ** RATE_DECIMALS
  return Math.round(rate * scale) / scale
}

/** Interest one round of a loan costs. */
export function loanInterest(principal: number, annualRate: number): number {
  return (principal * annualRate) / ROUNDS_PER_YEAR
}
