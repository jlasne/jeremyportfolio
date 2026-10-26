// Number formatting shared by every screen. Money is unitless with 2 decimals (the engine rounds
// money to cents); MW drop trailing zeros. Negative numbers use a true minus sign.

import { NumberTween } from './NumberTween'

const MINUS = '−'

export function fmtMoney(x: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const d = opts.decimals ?? 2
  const v = Number.isFinite(x) ? x : 0
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const zero = Number(abs.replace(/,/g, '')) === 0
  if (v < 0 && !zero) return `${MINUS}${abs}`
  return opts.sign && !zero ? `+${abs}` : abs
}

export function fmtMw(x: number, opts: { unit?: boolean; sign?: boolean } = {}): string {
  const v = Number.isFinite(x) ? x : 0
  const abs = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })
  const s = v < 0 && abs !== '0' ? `${MINUS}${abs}` : opts.sign && abs !== '0' ? `+${abs}` : abs
  return opts.unit === false ? s : `${s} MW`
}

export function fmtPct(x: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const d = opts.decimals ?? 0
  const v = Number.isFinite(x) ? x * 100 : 0
  const abs = Math.abs(v).toFixed(d)
  const zero = Number(abs) === 0
  if (v < 0 && !zero) return `${MINUS}${abs}%`
  return `${opts.sign && !zero ? '+' : ''}${abs}%`
}

/** -1, 0 or 1 after rounding to cents, so "+0.00" never shows an arrow. */
export function trend(x: number): -1 | 0 | 1 {
  const r = Math.round(x * 100)
  return r > 0 ? 1 : r < 0 ? -1 : 0
}

interface MoneyProps {
  value: number
  sign?: boolean
  /** Ease changes over ~400 ms (instant under reduced motion). */
  tween?: boolean
  className?: string
}

/** A money amount in tabular figures. */
export function Money({ value, sign, tween, className }: MoneyProps) {
  const cls = className ? `num money ${className}` : 'num money'
  if (tween) return <NumberTween value={value} format={(v) => fmtMoney(v, { sign })} className={cls} />
  return <span className={cls}>{fmtMoney(value, { sign })}</span>
}

interface MwProps {
  value: number
  unit?: boolean
  sign?: boolean
  tween?: boolean
  className?: string
}

export function Mw({ value, unit = true, sign, tween, className }: MwProps) {
  const cls = className ? `num mw ${className}` : 'num mw'
  if (tween) return <NumberTween value={value} format={(v) => fmtMw(v, { unit, sign })} className={cls} />
  return <span className={cls}>{fmtMw(value, { unit, sign })}</span>
}
