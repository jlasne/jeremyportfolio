// Pure helpers for the results sequence, the forced sale and the end screen: they turn engine
// states into the rows each view draws. No React here, so they stay cheap to memoize and test.

import { POOLS, rankCompanies } from '../../engine'
import type { Building, Company, GameState, PoolId, RoundResult, RoundSummary } from '../../engine'
import { POOL_META, fmtMoney, fmtMw, fmtPct } from '../kit'
import type { IconName } from '../kit'

export const sumParts = (r: Record<PoolId, number>): number => POOLS.reduce((s, p) => s + r[p], 0)

export function buildingName(b: Pick<Building, 'kind' | 'size'>): string {
  return `${b.size === 'big' ? 'Big' : 'Small'} ${b.kind === 'plant' ? 'plant' : 'datacenter'}`
}

export function companyName(state: GameState, id: string, meId: string | null): string {
  if (id === meId) return 'You'
  return state.companies.find((c) => c.id === id)?.name ?? id
}

// ---------- beat 1: demand ----------

export interface DemandRow {
  pool: PoolId
  demand: number
  growth: number
  expected: number
  /** growth − expected, in fraction points. */
  surprise: number
  /** My used MW this round. */
  used: number
  /** My revenue weight last round: how much this surprise moves my price. */
  weight: number
}

export function demandRows(summary: RoundSummary, res: RoundResult, prevRes: RoundResult | undefined): DemandRow[] {
  const prevRev = prevRes?.revenue ?? 0
  return POOLS.map((p) => {
    const s = summary.pools[p]
    return {
      pool: p,
      demand: s.demand,
      growth: s.growth,
      expected: s.expectedGrowth,
      surprise: s.growth - s.expectedGrowth,
      used: res.used[p],
      weight: prevRev > 0 && prevRes ? prevRes.revenueByPool[p] / prevRev : 0,
    }
  })
}

// ---------- beat 3: stock ----------

export interface StockRow {
  key: string
  label: string
  value: number
  /** One short sentence on what this part is. */
  hint: string
  icon?: IconName
  /** Zero rows are kept for the four core parts so the chart reads the same every round. */
  core: boolean
}

export function stockRows(res: RoundResult): StockRow[] {
  const p = res.stock.parts
  const rows: StockRow[] = [{ key: 'rev', label: 'Revenue growth', value: p.revenueGrowth, hint: 'Half of your revenue change against last round, capped at ±30%.', core: true }]
  const misses = POOLS.filter((pool) => Math.round(p.demandMiss[pool] * 100) !== 0)
  if (misses.length === 0)
    rows.push({ key: 'miss', label: 'Demand vs expected', value: 0, hint: 'Pools that grew faster or slower than the market expected, weighted by your revenue there.', core: true })
  for (const pool of misses)
    rows.push({
      key: `miss-${pool}`,
      label: `${POOL_META[pool].short} demand`,
      value: p.demandMiss[pool],
      hint: `${POOL_META[pool].label} grew ${p.demandMiss[pool] >= 0 ? 'faster' : 'slower'} than expected, weighted by your revenue there.`,
      icon: POOL_META[pool].icon,
      core: false,
    })
  rows.push({ key: 'idle', label: 'Idle penalty', value: p.idle, hint: '1% of value for every 10 points of idle capacity above 20%.', core: true })
  rows.push({ key: 'fund', label: 'Fundamentals pull', value: p.fundamentals, hint: 'Value drifts 15% toward 20 × average profit plus 30% of building cost.', core: true })
  rows.push({ key: 'debt', label: 'Debt drag', value: p.debtDrag, hint: 'Debt weighs on market cap when interest and principal due are large against revenue.', core: true })
  if (Math.round(p.shares * 100) !== 0)
    rows.push({
      key: 'shares',
      label: p.shares < 0 ? 'Share issue' : 'Share buyback',
      value: p.shares,
      hint: p.shares < 0 ? 'New shares split the same value over more shares.' : 'Fewer shares share the same value.',
      core: false,
    })
  return rows
}

/** The biggest mover, as one sentence for the stock beat. */
export function stockDriver(rows: StockRow[], move: number): string {
  const top = [...rows].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]
  if (!top || Math.round(top.value * 100) === 0) return 'Nothing moved your price this round.'
  const dir = top.value >= 0 ? 'lifted' : 'pulled down'
  const total = Math.round(move * 100) === 0 ? 'Your price held.' : `Your price ${move > 0 ? 'rose' : 'fell'} ${fmtMoney(Math.abs(move))}.`
  return `${total} ${top.label} ${dir} it most (${fmtMoney(top.value, { sign: true })}).`
}

// ---------- beat 4: ranking ----------

export interface RankRow {
  id: string
  name: string
  color: number
  price: number
  change: number
  rank: number
  /** Positive = climbed. */
  moved: number
  bankrupt: boolean
  isMe: boolean
}

export function rankRows(before: GameState, after: GameState, meId: string): RankRow[] {
  const prevOrder = rankCompanies(before)
  const order = rankCompanies(after)
  const summary = after.history[after.history.length - 1]
  return order.map((id, i) => {
    const c = after.companies.find((x) => x.id === id)!
    const prevPrice = before.companies.find((x) => x.id === id)?.sharePrice ?? c.sharePrice
    const price = summary?.prices[id] ?? c.sharePrice
    const prevRank = prevOrder.indexOf(id)
    return {
      id,
      name: c.name,
      color: c.color,
      price,
      change: price - prevPrice,
      rank: i + 1,
      moved: prevRank < 0 || before.history.length === 0 ? 0 : prevRank - i,
      bankrupt: c.bankrupt,
      isMe: id === meId,
    }
  })
}

export interface LeaderRow {
  pool: PoolId
  leader: string | null
  leaderColor: number
  leaderIsMe: boolean
  /** My place in the pool (1-based) or 0 when I sold nothing there. */
  myPlace: number
  players: number
}

export function leaderRows(after: GameState, summary: RoundSummary, meId: string): LeaderRow[] {
  return POOLS.map((p) => {
    const ranking = summary.pools[p].ranking
    const lead = ranking[0] ? after.companies.find((c) => c.id === ranking[0]) : undefined
    return {
      pool: p,
      leader: lead ? (lead.id === meId ? 'You' : lead.name) : null,
      leaderColor: lead?.color ?? 0,
      leaderIsMe: lead?.id === meId,
      myPlace: ranking.indexOf(meId) + 1,
      players: ranking.length,
    }
  })
}

// ---------- "what happened" ----------

export interface HappenedItem {
  icon: IconName
  tone: 'good' | 'warn' | 'critical' | 'info'
  text: string
}

export function whatHappened(before: GameState, after: GameState, meId: string): HappenedItem[] {
  const out: HappenedItem[] = []
  const me = after.companies.find((c) => c.id === meId)
  const meBefore = before.companies.find((c) => c.id === meId)
  const res = me?.history[me.history.length - 1]
  if (!me || !res || !meBefore) return out

  if (res.bankrupt) out.push({ icon: 'critical', tone: 'critical', text: 'Your market cap hit the floor: the company is bankrupt.' })

  // buildings and links that finished
  const done = new Set(res.completed)
  const finishedBuildings = me.buildings.filter((b) => done.has(b.id))
  for (const b of finishedBuildings) {
    const was = meBefore.buildings.find((x) => x.id === b.id)
    const upgraded = was?.status === 'upgrading'
    out.push({
      icon: b.kind === 'plant' ? 'plant' : 'dc',
      tone: 'good',
      text: upgraded ? `${b.kind === 'plant' ? 'Plant' : 'Datacenter'} upgrade finished: ${fmtMw(b.mw)} online next round.` : `${buildingName(b)} finished: ${fmtMw(b.mw)} online next round.`,
    })
  }
  const finishedLinks = me.links.filter((l) => done.has(l.id))
  if (finishedLinks.length) {
    const byUse = new Map<string, number>()
    for (const l of finishedLinks) byUse.set(l.use, (byUse.get(l.use) ?? 0) + l.mw)
    for (const [use, mw] of byUse) out.push({ icon: 'link', tone: 'good', text: `${use[0].toUpperCase()}${use.slice(1)} link +${fmtMw(mw)} ready.` })
  }

  // forced sales applied this round
  if (res.finance.forcedSold.length) {
    const n = res.finance.forcedSold.length
    out.push({ icon: 'warn', tone: 'warn', text: `Forced sale: ${n} building${n > 1 ? 's' : ''} sold for ${fmtMoney(res.finance.forcedSaleCash)}.` })
  }
  if (res.finance.forcedSharesIssued > 0) out.push({ icon: 'warn', tone: 'warn', text: `${res.finance.forcedSharesIssued} new shares issued to cover the deficit.` })

  // loans
  if (res.principalRepaid > 0) out.push({ icon: 'coin', tone: 'info', text: `Loan due: ${fmtMoney(res.principalRepaid)} of principal paid back.` })
  if (res.refinanced > 0) {
    const fresh = me.loans.filter((l) => l.takenRound === res.round && !meBefore.loans.some((x) => x.id === l.id))
    const rate = fresh.find((l) => Math.abs(l.principal - res.refinanced) < 0.01)?.annualRate
    out.push({ icon: 'coin', tone: 'info', text: `Refinanced ${fmtMoney(res.refinanced)} for 8 more rounds${rate != null ? ` at ${fmtPct(rate, { decimals: 1 })} a year` : ''}.` })
  }
  if (res.finance.repaid > 0) out.push({ icon: 'coin', tone: 'info', text: `Repaid ${fmtMoney(res.finance.repaid)} early.` })
  const dueNext = me.loans.filter((l) => l.dueRound === after.round)
  if (dueNext.length && !after.finished) {
    const total = dueNext.reduce((s, l) => s + l.principal, 0)
    out.push({ icon: 'warn', tone: 'warn', text: `${fmtMoney(total)} of loans fall due next round: repay, refinance or keep the cash.` })
  }

  // treasury below zero
  if (!me.bankrupt && me.treasury < 0 && !after.finished) out.push({ icon: 'critical', tone: 'critical', text: `Treasury is ${fmtMoney(me.treasury)}: next round opens with a forced sale.` })

  // rivals that went bankrupt
  for (const c of after.companies) {
    if (c.id === meId) continue
    const was = before.companies.find((x) => x.id === c.id)
    if (c.bankrupt && was && !was.bankrupt) out.push({ icon: 'rivals', tone: 'info', text: `${c.name} went bankrupt: its clients are up for grabs next round.` })
  }
  return out
}

// ---------- forced sale ----------

export function losingReason(me: Company): string {
  const res = me.history[me.history.length - 1]
  if (!res) return 'Your treasury is below 0.'
  if (res.principalRepaid > 0 && res.profit >= 0) return `A loan of ${fmtMoney(res.principalRepaid)} fell due and the treasury could not cover it.`
  if (res.principalRepaid > 0) return `A loan of ${fmtMoney(res.principalRepaid)} fell due on top of a ${fmtMoney(res.profit)} loss.`
  if (res.profit < 0) return `Costs beat revenue last round (profit ${fmtMoney(res.profit)}).`
  return 'Last round left the treasury below 0.'
}

// ---------- end screen ----------

export interface EndStats {
  totalRevenue: number
  bestProfit: number
  bestProfitRound: number
  built: number
  peakPrice: number
  peakRound: number
}

export function endStats(me: Company): EndStats {
  let bestProfit = -Infinity
  let bestProfitRound = 0
  let peakPrice = 0
  let peakRound = 0
  let totalRevenue = 0
  let sold = 0
  for (const r of me.history) {
    totalRevenue += r.revenue
    if (r.profit > bestProfit) {
      bestProfit = r.profit
      bestProfitRound = r.round
    }
    if (r.sharePrice > peakPrice) {
      peakPrice = r.sharePrice
      peakRound = r.round
    }
    sold += r.finance.forcedSold.length
  }
  return {
    totalRevenue,
    bestProfit: Number.isFinite(bestProfit) ? bestProfit : 0,
    bestProfitRound,
    built: me.buildings.filter((b) => b.builtRound > 0).length + sold,
    peakPrice,
    peakRound,
  }
}

/** Price per company per round: index 0 is the start price, then one point per resolved round. */
export function priceSeries(state: GameState): { id: string; name: string; color: number; prices: number[]; bankrupt: boolean }[] {
  return state.companies.map((c) => {
    const start = c.history[0]?.stock.priceBefore ?? c.sharePrice
    const prices = [start]
    for (const h of state.history) {
      const p = h.prices[c.id]
      prices.push(p != null ? p : prices[prices.length - 1])
    }
    return { id: c.id, name: c.name, color: c.color, prices, bankrupt: c.bankrupt }
  })
}
