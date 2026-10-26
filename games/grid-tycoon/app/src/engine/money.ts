import { MONEY_SCALE, MW_STEP } from './constants'

/** Rounds money to 2 decimals (half away from zero), the way every resolution step does. */
export function round2(x: number): number {
  if (!Number.isFinite(x)) return 0
  // From 2^52 up every double is a whole number, so it is already in cents; scaling it could overflow to Infinity.
  if (Math.abs(x) >= 2 ** 52) return x
  const scaled = Math.abs(x) * MONEY_SCALE
  // The relative nudge absorbs binary noise such as 1.005 * 100 = 100.49999...
  const r = Math.round(scaled * (1 + 4 * Number.EPSILON)) / MONEY_SCALE
  return r === 0 ? 0 : Math.sign(x) * r
}

/** Floors MW to the sanitize step so a scaled value never exceeds its cap. */
export function floorMw(x: number): number {
  const perMw = Math.round(1 / MW_STEP)
  const steps = Math.floor(x * perMw + 1e-9)
  return Math.max(0, steps / perMw)
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** A finite number, or the fallback for NaN, Infinity and non-numbers. */
export function finite(x: unknown, fallback = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback
}
