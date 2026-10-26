// Decision shapes: the empty decision, and reading untrusted input into a well-formed shape.

import type { BuildOrder, Decision } from './types'

/** All zeros, no builds, no finance. */
export function emptyDecision(): Decision {
  return {
    builds: [],
    upgrades: [],
    power: { internal: 0, town: 0, otherDc: 0 },
    compute: { cloud: 0, btc: 0, ai: 0 },
    rentMw: 0,
    loans: { take: 0, repay: {}, refinance: [] },
    shares: { mode: 'none', count: 0 },
    forcedSales: [],
  }
}

type Loose = Record<string, unknown>

const obj = (x: unknown): Loose => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Loose) : {})
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
/** Numbers are kept as they are (NaN included) so validation can report them; missing ones become 0. */
const num = (x: unknown): number => (x === undefined || x === null ? 0 : typeof x === 'number' ? x : Number.NaN)
const str = (x: unknown): string | null => (typeof x === 'string' ? x : null)

export interface ReadDecision extends Decision {
  /** True when the raw shares block asked to issue and buy back at once (or named no valid single mode). */
  sharesConflict: boolean
}

/**
 * Turns any input (a typed draft, JSON from the network, garbage) into the Decision shape without
 * fixing values: validation reports bad values, sanitize repairs them.
 */
export function readDecision(raw: unknown): ReadDecision {
  const d = obj(raw)
  const power = obj(d.power)
  const compute = obj(d.compute)
  const loans = obj(d.loans)
  const shares = obj(d.shares)
  const repay: Record<string, number> = {}
  for (const [k, v] of Object.entries(obj(loans.repay))) repay[k] = num(v)

  const builds: BuildOrder[] = arr(d.builds).map((b) => {
    const o = obj(b)
    const order: BuildOrder = { kind: o.kind as BuildOrder['kind'] }
    if (o.size !== undefined) order.size = o.size as BuildOrder['size']
    if (o.use !== undefined) order.use = o.use as BuildOrder['use']
    if (o.mw !== undefined) order.mw = num(o.mw)
    if (o.tile !== undefined) order.tile = o.tile as BuildOrder['tile']
    return order
  })

  const { mode, conflict } = readShareMode(shares)
  return {
    builds,
    upgrades: arr(d.upgrades).map(str).filter((x): x is string => x !== null),
    power: { internal: num(power.internal), town: num(power.town), otherDc: num(power.otherDc) },
    compute: { cloud: num(compute.cloud), btc: num(compute.btc), ai: num(compute.ai) },
    rentMw: num(d.rentMw),
    loans: {
      take: num(loans.take),
      repay,
      refinance: arr(loans.refinance).map(str).filter((x): x is string => x !== null),
    },
    shares: { mode, count: num(shares.count) },
    forcedSales: arr(d.forcedSales).map(str).filter((x): x is string => x !== null),
    sharesConflict: conflict,
  }
}

/**
 * The typed Decision allows one share mode only, but a client can send anything. A mode list naming
 * both directions, a mode such as 'both', or explicit issue and buyback counts side by side all
 * count as asking for both, which the spec forbids.
 */
function readShareMode(shares: Loose): { mode: Decision['shares']['mode']; conflict: boolean } {
  const m = shares.mode
  const extraIssue = typeof shares.issue === 'number' && shares.issue > 0
  const extraBuyback = typeof shares.buyback === 'number' && shares.buyback > 0
  if (Array.isArray(m)) {
    const both = m.includes('issue') && m.includes('buyback')
    return { mode: both ? 'none' : m.includes('issue') ? 'issue' : m.includes('buyback') ? 'buyback' : 'none', conflict: both }
  }
  if (m === undefined || m === null || m === 'none') {
    return { mode: 'none', conflict: extraIssue && extraBuyback }
  }
  if (m === 'issue') return { mode: 'issue', conflict: extraBuyback }
  if (m === 'buyback') return { mode: 'buyback', conflict: extraIssue }
  return { mode: 'none', conflict: true }
}
