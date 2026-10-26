// Shared builders for engine tests. Not part of the engine API.

import { createGame, defaultConfig, emptyDecision, type Company, type Config, type Decision, type GameState } from '../index'

export function game(ids: string[] = ['a'], seed = 1, config: Config = defaultConfig): GameState {
  return createGame({ seed, companies: ids.map((id) => ({ id, name: id.toUpperCase(), isBot: false })) }, config)
}

export function company(state: GameState, id: string): Company {
  const c = state.companies.find((x) => x.id === id)
  if (!c) throw new Error(`no company ${id}`)
  return c
}

/** A copy of the state with one company changed. */
export function edit(state: GameState, id: string, change: (c: Company) => void): GameState {
  const next = structuredClone(state)
  change(company(next, id))
  return next
}

export function decision(change: (d: Decision) => void = () => {}): Decision {
  const d = emptyDecision()
  change(d)
  return d
}

/** A config copy with some values replaced (deep paths by mutation). */
export function tuned(change: (c: Config) => void): Config {
  const c = structuredClone(defaultConfig)
  change(c)
  return c
}

/** Adds an online building to a company, at the next free lot. */
export function addOnline(c: Company, kind: 'plant' | 'dc', size: 'small' | 'big', config: Config = defaultConfig): void {
  const spec = config.buildings[kind][size]
  const used = new Set(c.buildings.map((b) => `${b.tile[0]},${b.tile[1]}`))
  let i = 0
  while (used.has(`${i % config.plot.lotsPerRow},${Math.floor(i / config.plot.lotsPerRow)}`)) i++
  c.buildings.push({
    id: `x${c.buildings.length}-${kind}${size}`,
    kind,
    size,
    mw: spec.mw,
    status: 'online',
    roundsLeft: 0,
    pricePaid: spec.cost,
    tile: [i % config.plot.lotsPerRow, Math.floor(i / config.plot.lotsPerRow)],
    builtRound: 0,
  })
}

export function addLink(c: Company, use: 'internal' | 'town' | 'import', mw: number): void {
  c.links.push({ id: `xl${c.links.length}-${use}`, use, mw, roundsLeft: 0 })
}

/** Every money field of a state, for the 2-decimal check. */
export function moneyFields(state: GameState): number[] {
  const out: number[] = []
  for (const c of state.companies) {
    out.push(c.treasury, c.businessValue, c.marketCap, c.sharePrice)
    for (const l of c.loans) out.push(l.principal)
    for (const b of c.buildings) out.push(b.pricePaid)
    for (const r of c.history) {
      out.push(r.revenue, r.profit, r.treasury, r.sharePrice, r.marketCap, r.businessValue, r.principalRepaid, r.refinanced)
      out.push(...Object.values(r.revenueByPool), ...Object.values(r.costs))
      const f = r.finance
      out.push(f.forcedSaleCash, f.loanTaken, f.repaid, f.shareCash, f.buildSpend)
      out.push(r.stock.priceBefore, r.stock.priceAfter, r.stock.fv, r.stock.bv, r.stock.bvBefore, r.stock.debt, r.stock.debtDragMoney, r.stock.marketCap)
    }
  }
  return out
}

export function hasNonFinite(x: unknown): boolean {
  if (typeof x === 'number') return !Number.isFinite(x)
  if (Array.isArray(x)) return x.some(hasNonFinite)
  if (x && typeof x === 'object') return Object.values(x).some(hasNonFinite)
  return false
}

export const isCents = (x: number): boolean => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6
