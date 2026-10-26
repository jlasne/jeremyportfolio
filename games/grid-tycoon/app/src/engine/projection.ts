// UI helpers (DESIGN 2.5): the draft applied to a copy of the company, the projection line,
// the risk view under the loan stepper, and coins per building.

import { capacity, companyById, finalCapacity, totalDebt } from './assets'
import { buildingSpec, defaultConfig } from './config'
import { COMPUTE_POOLS, POOLS, zeroPools } from './constants'
import { readDecision } from './decision'
import { companyLoanRate, loanInterest } from './finance'
import { clamp, round2 } from './money'
import { applyPhase, type PhaseOutcome } from './phase'
import { clampAllocations } from './sanitize'
import { debtDragFactor, revenueWeights } from './stock'
import type { Building, Company, CompanyPreview, Config, Decision, GameState, PoolId, Projection, RiskView } from './types'

export interface DraftApplied {
  company: Company
  draft: Decision
  outcome: PhaseOutcome
}

/** The company with the draft's forced sales, finance and builds applied (a copy; the state is untouched). */
export function applyDraft(state: GameState, companyId: string, decision: unknown, config: Config = defaultConfig): DraftApplied {
  const original = companyById(state, companyId)
  const company = structuredClone(original)
  const draft = readDecision(decision)
  let n = 0
  const outcome = applyPhase(company, draft, {
    round: state.round,
    config,
    loanRate: companyLoanRate(original, config),
    nextId: (prefix) => `draft-${prefix}${++n}`,
  })
  return { company, draft, outcome }
}

export function previewCompany(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): CompanyPreview {
  const { company, outcome } = applyDraft(state, companyId, decision, config)
  const cap = capacity(company)
  const fin = finalCapacity(company, config)
  const f = outcome.finance
  return {
    treasuryLeft: company.treasury,
    plantMw: cap.plantMw,
    dcMw: cap.dcMw,
    links: cap.links,
    pendingPlantMw: fin.plantMw,
    pendingDcMw: fin.dcMw,
    pendingLinks: fin.links,
    debt: totalDebt(company),
    sharePrice: company.sharePrice,
    shares: company.shares,
    buildSpend: f.buildSpend,
    financeCash: round2(f.forcedSaleCash + outcome.forcedIssueCash + f.loanTaken - f.repaid + f.shareCash),
  }
}

/** Demand and total used of the last resolved round (start demand and nothing used before round 1). */
function lastPoolView(state: GameState, p: PoolId): { demand: number; used: number; rentDemand: number } {
  const s = state.history.at(-1)
  if (!s) return { demand: state.pools[p].demand, used: 0, rentDemand: 0 }
  return { demand: s.pools[p].demand, used: s.pools[p].used, rentDemand: s.pools[p].rentDemand }
}

/**
 * Share of a rent request rivals are likely to fill, from what they sold to the other datacenters pool
 * last round. A company's own sales never fill its own rent, so they are left out.
 */
export function rivalFillShare(state: GameState, rentMw: number, companyId?: string): number {
  const v = lastPoolView(state, 'otherDc')
  const own = companyId === undefined ? 0 : (state.pools.otherDc.lastUsed[companyId] ?? 0)
  const asked = Math.max(v.rentDemand, rentMw)
  return asked > 0 ? clamp(Math.max(0, v.used - own) / asked, 0, 1) : 0
}

export function projectRound(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Projection {
  const { company, draft } = applyDraft(state, companyId, decision, config)
  const cap = capacity(company)
  const alloc = clampAllocations(cap, draft.power, draft.compute, draft.rentMw)
  const offer: Record<PoolId, number> = {
    citizens: alloc.power.town,
    otherDc: alloc.power.otherDc,
    cloud: alloc.compute.cloud,
    btc: alloc.compute.btc,
    ai: alloc.compute.ai,
  }
  const usedByPool = zeroPools()
  const revenueByPool = zeroPools()
  const marginPerMw = zeroPools()
  for (const p of POOLS) {
    const last = lastPoolView(state, p)
    const mine = state.pools[p].lastUsed[companyId] ?? 0
    usedByPool[p] = Math.min(offer[p], mine + Math.max(0, last.demand - last.used))
    revenueByPool[p] = round2(usedByPool[p] * config.rate[p])
    marginPerMw[p] = round2(config.rate[p] - config.cost.ownPower)
  }
  const revenue = round2(POOLS.reduce((s, p) => s + revenueByPool[p], 0))
  const computeUsed = COMPUTE_POOLS.reduce((s, p) => s + usedByPool[p], 0)
  const ownPowerUsed = usedByPool.citizens + usedByPool.otherDc + clamp(computeUsed - alloc.rentMw, 0, alloc.power.internal)
  const fill = rivalFillShare(state, alloc.rentMw, companyId)
  const costs = {
    power: round2(config.cost.ownPower * ownPowerUsed),
    rent: round2(alloc.rentMw * (fill * config.cost.rentRival + (1 - fill) * config.cost.rentMarket)),
    maintenance: round2(config.maintenanceRate * company.buildings.reduce((s, b) => s + (b.status === 'building' ? 0 : b.pricePaid), 0)),
    interest: round2(company.loans.reduce((s, l) => s + loanInterest(l.principal, l.annualRate), 0)),
  }
  const online = cap.plantMw + cap.dcMw
  return {
    revenueByPool,
    usedByPool,
    revenue,
    costs,
    profit: round2(revenue - costs.power - costs.rent - costs.maintenance - costs.interest),
    idle: online > 0 ? clamp(1 - (ownPowerUsed + computeUsed) / online, 0, 1) : 0,
    marginPerMw,
  }
}

/** Annual rate a new loan would get now: 12% - 8% × stability score (+4 points under stress). */
export function loanRate(state: GameState, companyId: string, config: Config = defaultConfig): number {
  return companyLoanRate(companyById(state, companyId), config)
}

export function riskView(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): RiskView {
  const original = companyById(state, companyId)
  const { company, outcome } = applyDraft(state, companyId, decision, config)
  const last = original.history.at(-1)
  const w = revenueWeights(last?.revenueByPool)
  const seenGrowth = POOLS.reduce((s, p) => s + w[p] * state.pools[p].growth, 0)
  const estRevenue = round2((last?.revenue ?? 0) * (1 + seenGrowth))
  const interestNextRound = round2(company.loans.reduce((s, l) => s + loanInterest(l.principal, l.annualRate), 0))
  const dueNow = company.loans
    .filter((l) => l.dueRound === state.round && !outcome.refinance.includes(l.id))
    .reduce((s, l) => s + l.principal, 0)
  const owed = interestNextRound + dueNow
  const share = estRevenue > 0 ? Math.min(1, owed / estRevenue) : owed > 0 ? 1 : 0
  // A refinanced loan's principal is not paid now: it rolls into a new loan due termRounds later.
  const dueOf = (l: Company['loans'][number]): number =>
    outcome.refinance.includes(l.id) ? state.round + config.loan.termRounds : l.dueRound
  let nextDue: RiskView['nextDue'] = null
  for (const l of company.loans) {
    const due = dueOf(l)
    if (!nextDue || due < nextDue.round) nextDue = { round: due, principal: 0 }
  }
  if (nextDue) {
    const round = nextDue.round
    nextDue.principal = round2(company.loans.filter((l) => dueOf(l) === round).reduce((s, l) => s + l.principal, 0))
  }
  return {
    annualRate: companyLoanRate(original, config),
    estRevenue,
    interestNextRound,
    debtCostShare: share,
    marketCapDrag: round2(totalDebt(company) * debtDragFactor(share, config.debt.dragSteepness)),
    nextDue,
  }
}

/** Last round's revenue split per building id (plants: power sales, datacenters: compute), for the coin effects. */
export function revenueByBuilding(state: GameState, companyId: string, config: Config = defaultConfig): Record<string, number> {
  const company = companyById(state, companyId)
  const last = company.history.at(-1)
  const out: Record<string, number> = {}
  if (!last) return out
  const finishedNow = new Set(last.completed)
  // MW a building delivered during that round. One that finished at its end was either a new
  // order (delivered nothing) or an upgrade (still ran at small size).
  const delivered = (b: Building): number => {
    if (b.status === 'building') return 0
    if (!finishedNow.has(b.id)) return b.mw
    const newOrder = b.builtRound + buildingSpec(config, b.kind, b.size).rounds - 1 === last.round
    return newOrder ? 0 : buildingSpec(config, b.kind, 'small').mw
  }
  const split = (kind: Building['kind'], amount: number): void => {
    const list = company.buildings.filter((b) => b.kind === kind)
    const weights = list.map(delivered)
    const total = weights.reduce((a, b) => a + b, 0)
    list.forEach((b, i) => {
      out[b.id] = total > 0 ? round2((amount * weights[i]) / total) : 0
    })
  }
  split('plant', last.revenueByPool.citizens + last.revenueByPool.otherDc)
  split('dc', last.revenueByPool.cloud + last.revenueByPool.btc + last.revenueByPool.ai)
  return out
}
