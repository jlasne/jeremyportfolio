// Fixed engine constants: pool lists and numeric precision. Tuning numbers live in config/balance.json.

import type { ComputePool, LinkUse, PoolId, PowerPool } from './types'

export const POOLS: PoolId[] = ['citizens', 'otherDc', 'cloud', 'btc', 'ai']
export const POWER_POOLS: PowerPool[] = ['citizens', 'otherDc']
export const COMPUTE_POOLS: ComputePool[] = ['cloud', 'btc', 'ai']
export const LINK_USES: LinkUse[] = ['internal', 'town', 'import']

/** Money is kept in cents. */
export const MONEY_SCALE = 100
/** Tolerance for MW comparisons, so float noise never fails a valid allocation. */
export const MW_EPSILON = 1e-6
/** Sanitized MW are floored to this step, so a scaled allocation always fits its cap. */
export const MW_STEP = 0.01

export function zeroPools(): Record<PoolId, number> {
  return { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }
}

/** One round is one quarter: interest per round = annual rate / 4. */
export const ROUNDS_PER_YEAR = 4
/** Loan rates are stored rounded to this many decimal places, to drop float noise. */
export const RATE_DECIMALS = 8
