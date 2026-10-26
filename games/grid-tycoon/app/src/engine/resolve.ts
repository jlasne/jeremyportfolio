// resolveRound: one pure function from (state, decisions) to the next state (DESIGN 2.3).

import { allocatePool, matchRent } from './allocation'
import { capacity, totalDebt } from './assets'
import { botDecision } from './bots'
import { buildingSpec, defaultConfig } from './config'
import { COMPUTE_POOLS, MW_EPSILON, POOLS, zeroPools } from './constants'
import { defaultDecision } from './defaults'
import { companyLoanRate, loanInterest } from './finance'
import { clamp, round2 } from './money'
import { applyPhase, type PhaseOutcome } from './phase'
import { rankCompanies } from './ranking'
import { createRng } from './rng'
import { sanitizeDecision } from './sanitize'
import { debtDragFactor, fundamentalValue, revenueWeights, stockReturn } from './stock'
import type { Config, Decision, GameState, PoolId, PoolSummary, RoundResult, RoundSummary, StockBreakdown } from './types'

function offerFor(d: Decision, p: PoolId): number {
  switch (p) {
    case 'citizens':
      return d.power.town
    case 'otherDc':
      return d.power.otherDc
    default:
      return d.compute[p]
  }
}

interface DemandStep {
  demand: Record<PoolId, number>
  growth: Record<PoolId, number>
  expected: Record<PoolId, number>
}

/** Step 2: one normal draw per pool, in POOLS order. */
function growDemand(state: GameState, config: Config): DemandStep {
  const rng = createRng(state.rngState)
  const out: DemandStep = { demand: zeroPools(), growth: zeroPools(), expected: zeroPools() }
  const { meanGrowth, volatility, meanReversion, growthClamp } = config.pool
  for (const p of POOLS) {
    const pool = state.pools[p]
    const eps = rng.normal()
    out.expected[p] = config.expectation.weightOld * pool.expectedGrowth + config.expectation.weightNew * pool.growth
    out.growth[p] = clamp(pool.growth + meanReversion * (meanGrowth[p] - pool.growth) + volatility[p] * eps, growthClamp.min, growthClamp.max)
    out.demand[p] = pool.demand * (1 + out.growth[p])
  }
  state.rngState = rng.state()
  return out
}

/**
 * A copy of everything resolution changes. Past results (history entries) and last round's decision
 * are never modified once written, so they are shared with the input instead of copied: the input
 * stays untouched and a 40-round state does not get deep-copied every round.
 */
function copyForResolution(s: GameState): GameState {
  const pools = {} as GameState['pools']
  for (const p of POOLS) pools[p] = { ...s.pools[p], lastUsed: { ...s.pools[p].lastUsed } }
  return {
    ...s,
    pools,
    companies: s.companies.map((c) => ({
      ...c,
      buildings: c.buildings.map((b) => ({ ...b, tile: [b.tile[0], b.tile[1]] })),
      links: c.links.map((l) => ({ ...l })),
      loans: c.loans.map((l) => ({ ...l })),
      history: [...c.history],
    })),
    history: [...s.history],
  }
}

export function resolveRound(input: GameState, decisions: Record<string, Decision>, config: Config = defaultConfig): GameState {
  const state = copyForResolution(input)
  if (state.finished) return state
  const round = state.round
  const active = state.companies.filter((c) => !c.bankrupt)
  const before = new Map(input.companies.map((c) => [c.id, c]))

  // 0. Decisions, all computed from the pre-resolution state, all sanitized.
  const decided = new Map<string, Decision>()
  for (const c of active) {
    const raw = decisions[c.id] ?? (c.isBot ? botDecision(input, c.id, config) : defaultDecision(input, c.id, config))
    decided.set(c.id, sanitizeDecision(input, c.id, raw, config))
  }

  // 1. Decision-phase effects.
  const nextId = (prefix: string): string => `${prefix}${state.nextId++}`
  const phase = new Map<string, PhaseOutcome>()
  const rates = new Map<string, number>()
  for (const c of active) {
    const rate = companyLoanRate(c, config)
    rates.set(c.id, rate)
    phase.set(c.id, applyPhase(c, decided.get(c.id)!, { round, config, loanRate: rate, nextId }))
  }

  // 2. Demand.
  const step = growDemand(state, config)

  // 3. Rent requests join the other datacenters pool.
  let totalRent = 0
  for (const c of active) totalRent += decided.get(c.id)!.rentMw
  const allocDemand: Record<PoolId, number> = { ...step.demand, otherDc: step.demand.otherDc + totalRent }

  // 4. Allocation.
  const used = {} as Record<PoolId, Record<string, number>>
  for (const p of POOLS) {
    const offers: Record<string, number> = {}
    for (const c of active) offers[c.id] = offerFor(decided.get(c.id)!, p)
    used[p] = allocatePool(allocDemand[p], offers, state.pools[p].lastUsed, config.incumbentShare).used
  }
  const rentAsked: Record<string, number> = {}
  for (const c of active) rentAsked[c.id] = decided.get(c.id)!.rentMw
  const rivalFill = matchRent(rentAsked, used.otherDc)

  const results = new Map<string, RoundResult>()
  for (const c of active) {
    const d = decided.get(c.id)!
    const ph = phase.get(c.id)!
    const prevCompany = before.get(c.id)!
    const cap = capacity(c)

    // 5. Revenue and costs.
    const usedBy = zeroPools()
    const offered = zeroPools()
    const revenueByPool = zeroPools()
    for (const p of POOLS) {
      usedBy[p] = used[p][c.id] ?? 0
      offered[p] = offerFor(d, p)
      revenueByPool[p] = round2(usedBy[p] * config.rate[p])
    }
    const revenue = round2(POOLS.reduce((s, p) => s + revenueByPool[p], 0))
    const computeUsed = COMPUTE_POOLS.reduce((s, p) => s + usedBy[p], 0)
    // Rented MW is paid either way, so compute consumes it before own power.
    const internalConsumed = clamp(computeUsed - d.rentMw, 0, d.power.internal)
    const ownPowerUsed = usedBy.citizens + usedBy.otherDc + internalConsumed
    const fromRivals = Math.min(d.rentMw, rivalFill[c.id] ?? 0)
    const fromMarket = Math.max(0, d.rentMw - fromRivals)
    const costs = {
      power: round2(config.cost.ownPower * ownPowerUsed),
      rent: round2(config.cost.rentRival * fromRivals + config.cost.rentMarket * fromMarket),
      maintenance: round2(config.maintenanceRate * c.buildings.reduce((s, b) => s + (b.status === 'building' ? 0 : b.pricePaid), 0)),
      interest: round2(c.loans.reduce((s, l) => s + loanInterest(l.principal, l.annualRate), 0)),
    }

    // 6. Profit.
    const profit = round2(revenue - costs.power - costs.rent - costs.maintenance - costs.interest)
    c.treasury = round2(c.treasury + profit)

    // 7. Due loans: refinanced ones roll over, the others are paid (a negative treasury is the next losing round).
    const debt = totalDebt(c)
    let principalRepaid = 0
    let refinanced = 0
    const loans = []
    for (const loan of c.loans) {
      if (loan.dueRound !== round) {
        loans.push(loan)
        continue
      }
      if (ph.refinance.includes(loan.id)) {
        refinanced = round2(refinanced + loan.principal)
        loans.push({ id: nextId('n'), principal: loan.principal, annualRate: rates.get(c.id)!, dueRound: round + config.loan.termRounds, takenRound: round + 1 })
      } else {
        principalRepaid = round2(principalRepaid + loan.principal)
        c.treasury = round2(c.treasury - loan.principal)
      }
    }
    c.loans = loans

    // 9. Stock.
    const prev = c.history.at(-1)
    const weights = revenueWeights(prev?.revenueByPool)
    const onlineMw = cap.plantMw + cap.dcMw
    const idle = onlineMw > 0 ? clamp(1 - (ownPowerUsed + computeUsed) / onlineMw, 0, 1) : 0
    const sr = stockReturn({ revenue, prevRevenue: prev ? prev.revenue : null, weights, growth: step.growth, expected: step.expected, idle }, config)
    // slice(-0) would return the whole history, so the start index is computed explicitly.
    const pastRounds = Math.max(0, Math.floor(config.stock.profitWindow) - 1)
    const recent = [...c.history.slice(Math.max(0, c.history.length - pastRounds)).map((h) => h.profit), profit]
    const book = c.buildings.reduce((s, b) => s + b.pricePaid, 0)
    const fv = round2(fundamentalValue(recent, book, config))
    const fw = config.stock.fundamentalWeight
    const bvPrev = c.businessValue
    const bv = round2((1 - fw) * bvPrev * (1 + sr.r) + fw * fv)
    const due = costs.interest + principalRepaid
    const cRatio = revenue > 0 ? Math.min(1, due / revenue) : due > 0 ? 1 : 0
    const fc = debtDragFactor(cRatio, config.debt.dragSteepness)
    const debtDragMoney = round2(debt * fc)
    const marketCap = round2(Math.max(bv - debtDragMoney, config.marketCap.floor))
    const sharePrice = round2(marketCap / c.shares)
    const wentBankrupt = marketCap <= config.marketCap.floor

    const base = (1 - fw) * bvPrev
    const per = (x: number): number => round2(x / c.shares)
    const demandMiss = zeroPools()
    for (const p of POOLS) demandMiss[p] = per(base * sr.demandMiss[p])
    const stock: StockBreakdown = {
      priceBefore: prevCompany.sharePrice,
      priceAfter: sharePrice,
      r: sr.r,
      rParts: { revenueGrowth: sr.revenueGrowth, demandMiss: sr.demandMiss, idle: -sr.idle },
      parts: {
        revenueGrowth: per(base * sr.revenueGrowth),
        demandMiss,
        idle: per(-base * sr.idle),
        fundamentals: per(fw * (fv - bvPrev)),
        // When the floor binds, the floor keeps part of the drag off the market cap; the part shows what was taken.
        debtDrag: per((prev?.stock.debtDragMoney ?? 0) - round2(bv - marketCap)),
        shares: round2(prevCompany.marketCap / c.shares - prevCompany.marketCap / prevCompany.shares),
      },
      fv,
      bvBefore: bvPrev,
      bv,
      c: cRatio,
      fc,
      debt,
      debtDragMoney,
      marketCap,
    }
    c.businessValue = bv
    c.marketCap = marketCap
    c.sharePrice = sharePrice
    if (wentBankrupt) c.bankrupt = true

    // 10. Timers: what finishes now is online from the next round.
    const completed: string[] = []
    for (const b of c.buildings) {
      if (b.roundsLeft <= 0) continue
      b.roundsLeft -= 1
      if (b.roundsLeft > 0) continue
      if (b.status === 'upgrading') b.size = 'big'
      b.status = 'online'
      b.mw = buildingSpec(config, b.kind, b.size).mw
      completed.push(b.id)
    }
    for (const l of c.links) {
      if (l.roundsLeft <= 0) continue
      l.roundsLeft -= 1
      if (l.roundsLeft === 0) completed.push(l.id)
    }

    results.set(c.id, {
      round,
      offered,
      used: usedBy,
      revenueByPool,
      revenue,
      costs,
      profit,
      principalRepaid,
      refinanced,
      rent: { requested: d.rentMw, fromRivals, fromMarket },
      plantMw: cap.plantMw,
      dcMw: cap.dcMw,
      plantUsed: ownPowerUsed,
      dcUsed: computeUsed,
      idle,
      finance: ph.finance,
      treasury: c.treasury,
      stock,
      sharePrice,
      marketCap,
      businessValue: bv,
      shares: c.shares,
      rank: 0,
      completed,
      bankrupt: wentBankrupt,
    })
    c.lastDecision = d
  }

  // Pools remember this round; a company that just went bankrupt frees its MW for the next one.
  const summaryPools = {} as Record<PoolId, PoolSummary>
  for (const p of POOLS) {
    const pool = state.pools[p]
    pool.demand = step.demand[p]
    pool.growth = step.growth[p]
    pool.expectedGrowth = step.expected[p]
    pool.lastUsed = {}
    let total = 0
    for (const c of active) {
      const u = used[p][c.id] ?? 0
      total += u
      if (!c.bankrupt) pool.lastUsed[c.id] = u
    }
    const ranking = active
      .map((c, i) => ({ id: c.id, u: used[p][c.id] ?? 0, i }))
      .filter((x) => x.u > MW_EPSILON)
      .sort((a, b) => b.u - a.u || a.i - b.i)
      .map((x) => x.id)
    summaryPools[p] = {
      demand: allocDemand[p],
      rentDemand: p === 'otherDc' ? totalRent : 0,
      growth: step.growth[p],
      expectedGrowth: step.expected[p],
      used: total,
      ranking,
    }
  }

  const ranking = rankCompanies(state)
  const prices: Record<string, number> = {}
  for (const c of state.companies) prices[c.id] = c.sharePrice
  for (const c of active) {
    const r = results.get(c.id)!
    r.rank = ranking.indexOf(c.id) + 1
    c.history.push(r)
  }
  const summary: RoundSummary = { round, pools: summaryPools, prices, ranking }
  state.history.push(summary)

  state.round = round + 1
  state.finished = state.round > state.rounds
  return state
}
