// The three bot styles of SPEC.md. Deterministic, no RNG, public information only: the round
// summaries, pool growth, and the bot's own company. Every output goes through sanitize.

import { buildCost, canUpgrade, capacity, finalCapacity, findCompany, freeLots, landCost, ownedRows, totalDebt } from './assets'
import { buildingSpec, defaultConfig, nextSize, upgradeSpec } from './config'
import { LINK_USES, MW_EPSILON, POOLS } from './constants'
import { emptyDecision } from './decision'
import { defaultDecision } from './defaults'
import { planAllocation, poolModels, type Plan, type PoolModel, type Resources } from './market'
import { round2 } from './money'
import { currentPrice } from './phase'
import { rivalFillShare } from './projection'
import { sanitizeDecision } from './sanitize'
import type { BotStyle, BuildingKind, BuildSize, Company, Config, Decision, GameState, LinkUse, PoolId } from './types'

interface Style {
  /** The clients of SPEC.md's bot table. Builds are sized for these pools only. */
  sells: PoolId[]
  /**
   * Multiplies each pool's margin when the bot splits MW: its taste in clients. Pools outside `sells`
   * sit below every pool in it, so they only take capacity the bot's own clients leave idle.
   */
  weights: Record<PoolId, number>
  /** Multiplies the return of each kind of build: what it likes to build. */
  kindBias: Record<BuildingKind, number>
  /** Multiplies the return of a big build: how much it prefers fewer, larger buildings. */
  bigBias: number
  sizes: BuildSize[]
  rents: boolean
  /** Rounds of demand growth it looks past a build's completion when sizing it. */
  lookahead: number
  /** Minimum expected return per round on a build's cost. */
  minReturn: number
  finance: 'utility' | 'leverage' | 'equity'
  buysBack: boolean
}

const STYLES: Record<BotStyle, Style> = {
  volta: {
    sells: ['citizens', 'cloud', 'otherDc'],
    weights: { citizens: 1.8, otherDc: 1.3, cloud: 1.2, btc: 0.25, ai: 0.25 },
    kindBias: { plant: 1.3, dc: 0.9 },
    bigBias: 1.3,
    sizes: ['big', 'small'],
    rents: false,
    lookahead: 2,
    minReturn: 0.045,
    finance: 'utility',
    buysBack: false,
  },
  nimbus: {
    sells: ['ai', 'cloud'],
    weights: { citizens: 0.5, otherDc: 0.6, cloud: 1.15, btc: 0.55, ai: 1.4 },
    kindBias: { plant: 0.8, dc: 1.3 },
    bigBias: 1.15,
    sizes: ['big', 'small'],
    rents: true,
    lookahead: 3,
    minReturn: 0.05,
    finance: 'leverage',
    buysBack: true,
  },
  hashfield: {
    sells: ['btc', 'otherDc'],
    weights: { citizens: 0.5, otherDc: 1.3, cloud: 0.4, btc: 1.7, ai: 0.25 },
    kindBias: { plant: 1, dc: 1 },
    bigBias: 1,
    sizes: ['small'],
    rents: false,
    lookahead: 1,
    minReturn: 0.05,
    finance: 'equity',
    buysBack: true,
  },
}

/** Bot habits that are not balance rules (those come from config.bots). */
const HABITS = {
  /** At most this many build orders per round (a plant + datacenter pair counts as one). */
  maxBuildsPerRound: 4,
  /** Volta borrows at most once at a time, up to this share of its market cap. */
  utilityLoanShare: 0.15,
  /** Equity is issued only for builds returning at least this multiple of the style's minimum. */
  equityReturnMultiple: 1.5,
  /** No new equity in the last rounds: the dilution would not be earned back. */
  equityStopRounds: 8,
  /** In the last rounds the cash buffer shrinks to one round of costs. */
  endgameRounds: 5,
  /** A build must be online for at least this many rounds to be ordered. */
  minRoundsOnline: 2,
  /** How far a company's temperament moves its weights and thresholds (twins do not play alike). */
  temperament: 0.2,
}

interface BuildStep {
  kind: BuildingKind
  size: BuildSize
  /** Set for an upgrade of an existing building (one level up, no lot). */
  upgrade?: { id: string; mw: number; cost: number; rounds: number }
}

const stepMw = (s: BuildStep, config: Config): number => s.upgrade?.mw ?? buildingSpec(config, s.kind, s.size).mw
const stepCost = (s: BuildStep, config: Config): number => s.upgrade?.cost ?? buildingSpec(config, s.kind, s.size).cost
const stepRounds = (s: BuildStep, config: Config): number => s.upgrade?.rounds ?? buildingSpec(config, s.kind, s.size).rounds
const stepLots = (steps: BuildStep[]): number => steps.filter((s) => !s.upgrade).length

interface Candidate {
  steps: BuildStep[]
  cost: number
  gain: number
  score: number
}

const INF = Number.POSITIVE_INFINITY
const openLinks: Record<LinkUse, number> = { internal: INF, town: INF, import: INF }

/** A stable number in [-1, 1] from the company id: same company, same temperament, every game. */
function temperament(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return (h / 4294967295) * 2 - 1
}

function styleFor(company: Company): Style {
  const base = STYLES[company.bot ?? 'volta']
  const raw = temperament(company.id)
  const t = raw * HABITS.temperament
  const weights = { ...base.weights }
  // Lean toward or away from the compute pools and look further or nearer ahead, so two bots of one style still differ.
  for (const p of POOLS) weights[p] *= p === 'citizens' || p === 'otherDc' ? 1 - t : 1 + t
  return { ...base, weights, minReturn: base.minReturn * (1 + t), lookahead: Math.max(1, base.lookahead + Math.round(raw)) }
}

/** The weights a bot sizes its builds with: its own clients only, so it never builds for a pool off its style. */
function buildWeights(style: Style): Record<PoolId, number> {
  const w = { ...style.weights }
  for (const p of POOLS) if (!style.sells.includes(p)) w[p] = 0
  return w
}

function grow(res: Resources, steps: BuildStep[], config: Config): Resources {
  let { plant, dc } = res
  for (const s of steps) {
    const mw = stepMw(s, config)
    if (s.kind === 'plant') plant += mw
    else dc += mw
  }
  return { plant, dc, links: res.links }
}

export function botDecision(state: GameState, companyId: string, config: Config = defaultConfig): Decision {
  const company = findCompany(state, companyId)
  if (!company || company.bankrupt || state.finished) return emptyDecision()
  // A losing round: sanitize picks the cheapest forced sales, allocations repeat.
  if (company.treasury < 0) return defaultDecision(state, companyId, config)

  const style = styleFor(company)
  const d = emptyDecision()
  const rentCost = estimateRentCost(state, company, config)
  const modelCache = new Map<number, Record<PoolId, PoolModel>>()
  const sizing = buildWeights(style)
  const planWith = (weights: Record<PoolId, number>) => (h: number, res: Resources, fillLeftover: boolean): Plan => {
    let models = modelCache.get(h)
    if (!models) {
      models = poolModels(state, company, h, config)
      modelCache.set(h, models)
    }
    return planAllocation({ models, res, weights, rents: style.rents, rentCost, fillLeftover, config })
  }
  const plan = planWith(style.weights)
  const planBuild = planWith(sizing)

  // 1. This round's allocation, on what is online now.
  const cap = capacity(company)
  const now = plan(1, { plant: cap.plantMw, dc: cap.dcMw, links: cap.links }, true)
  d.power = { internal: now.internal, town: now.offers.citizens, otherDc: now.offers.otherDc }
  d.compute = { cloud: now.offers.cloud, btc: now.offers.btc, ai: now.offers.ai }
  d.rentMw = now.rentMw

  // 2. Due loans: refinance, unless a utility can pay them off and keep a cushion.
  const remaining = state.rounds - state.round
  const costs = lastCosts(company)
  const smallPair = buildingSpec(config, 'plant', 'small').cost + buildingSpec(config, 'dc', 'small').cost
  const buffer = costs + (remaining < HABITS.endgameRounds ? 0 : config.bots.buildTreasuryMultiple * smallPair)
  const due = company.loans.filter((l) => l.dueRound === state.round)
  const dueTotal = due.reduce((s, l) => s + l.principal, 0)
  const paysOff = style.finance === 'utility' && company.treasury - dueTotal >= buffer
  // Paid in the decision phase, not at step 7: no interest this round, and no principal due to spike the debt drag.
  if (paysOff) for (const l of due) d.loans.repay[l.id] = l.principal
  else d.loans.refinance = due.map((l) => l.id)
  let treasury = round2(company.treasury - (paysOff ? dueTotal : 0))
  let debt = round2(totalDebt(company) - (paysOff ? dueTotal : 0))

  // 3. Builds: the best return first, financed the style's way when the treasury is short.
  const fin = finalCapacity(company, config)
  let future: Resources = { plant: fin.plantMw, dc: fin.dcMw, links: fin.links }
  const multiple = config.bots.buildTreasuryMultiple
  const price = currentPrice(company)
  const shareCap = Math.floor(config.shares.maxChangePerRound * company.shares)
  const buybackCap = Math.floor(config.shares.maxBuybackPerRound * company.shares)
  // Land: lots left on the owned rows, and rows bought this round.
  const startRows = ownedRows(company, config)
  let lotsLeft = freeLots(company, startRows, [], config)
  let rowsBought = 0
  const upgradedNow = new Set<string>()
  const landFor = (lots: number): { rows: number; cost: number } => {
    const short = Math.max(0, lots - lotsLeft)
    const rows = Math.ceil(short / config.plot.lotsPerRow)
    return { rows, cost: rows > 0 ? landCost(startRows + rowsBought, rows, config) : 0 }
  }
  let issued = 0
  let built = 0

  // What the bot actually sold last round, against everything it will own once its orders finish.
  // The pool model only sees the bot's own growth, so when rivals build into the same demand this
  // measured idle is what keeps the whole market from overbuilding.
  const last = company.history.at(-1)
  const soldLast = last ? last.plantUsed + last.dcUsed : 0
  const pipelineIdle = (res: Resources): number => {
    const mw = res.plant + res.dc
    return last && mw > 0 ? Math.max(0, 1 - soldLast / mw) : 0
  }

  for (let n = 0; n < HABITS.maxBuildsPerRound; n++) {
    let chosen: Candidate | null = null
    const reach = treasury + loanRoom(style, company, debt, d.loans.take, config) + (style.finance === 'equity' ? (shareCap - issued) * price : 0)
    const crowded = pipelineIdle(future) > config.bots.maxIdle
    const ups = company.buildings.filter((b) => canUpgrade(b) && !upgradedNow.has(b.id))
    for (const c of candidates(style, future, remaining, planBuild, config, reach / multiple, crowded, ups, landFor)) {
      const needed = multiple * c.cost
      if (treasury < needed) {
        const raise = round2(needed - treasury)
        const equityOk =
          style.finance === 'equity' && remaining > HABITS.equityStopRounds && c.score >= style.minReturn * HABITS.equityReturnMultiple
        if (loanRoom(style, company, debt, d.loans.take, config) >= raise) {
          d.loans.take = round2(d.loans.take + raise)
          debt = round2(debt + raise)
          treasury = round2(treasury + raise)
        } else if (equityOk && price > 0 && (shareCap - issued) * price >= raise) {
          const count = Math.ceil(raise / price)
          issued += count
          treasury = round2(treasury + count * price)
        } else continue
      }
      chosen = c
      break
    }
    if (!chosen) break
    const land = landFor(stepLots(chosen.steps))
    if (land.rows > 0) {
      rowsBought += land.rows
      lotsLeft += land.rows * config.plot.lotsPerRow
      treasury = round2(treasury - land.cost)
    }
    for (const s of chosen.steps) {
      if (s.upgrade) {
        d.upgrades.push(s.upgrade.id)
        upgradedNow.add(s.upgrade.id)
      } else {
        d.builds.push({ kind: s.kind, size: s.size })
        lotsLeft--
      }
      treasury = round2(treasury - stepCost(s, config))
    }
    future = grow(future, chosen.steps, config)
    built++
  }
  if (issued > 0) d.shares = { mode: 'issue', count: issued }
  if (rowsBought > 0) d.landRows = rowsBought

  // 4. Links sized to what the plan will route through them, bought with the builds.
  const need = plan(1 + style.lookahead, { ...future, links: openLinks }, true).linkUse
  for (const use of LINK_USES) {
    const missing = Math.ceil(need[use] - future.links[use] - MW_EPSILON)
    const mw = Math.min(missing, Math.floor(treasury / Math.max(config.link.costPerMw, MW_EPSILON)))
    if (mw >= 1) {
      d.builds.push({ kind: 'link', use, mw })
      treasury = round2(treasury - buildCost({ kind: 'link', mw }, config))
    }
  }

  // 5. Idle cash: a utility pays debt down; the others buy back shares, since treasury does not count in market cap.
  if (built === 0 && issued === 0) {
    const spare = round2(treasury - buffer)
    if (style.finance === 'utility' && spare > 0) {
      let left = spare
      for (const loan of company.loans) {
        if (left <= 0 || (paysOff && loan.dueRound === state.round)) continue
        const amount = round2(Math.min(left, loan.principal))
        d.loans.repay[loan.id] = amount
        left = round2(left - amount)
      }
    } else if (style.buysBack && price > 0) {
      const room = round2(treasury - debt - buffer)
      const count = Math.min(buybackCap, Math.floor(Math.max(0, room) / price))
      if (count > 0) d.shares = { mode: 'buyback', count }
    }
  }

  return sanitizeDecision(state, companyId, d, config)
}

function candidates(
  style: Style,
  future: Resources,
  remaining: number,
  plan: (h: number, res: Resources, fillLeftover: boolean) => Plan,
  config: Config,
  maxCost = INF,
  crowded = false,
  upgradable: Company['buildings'] = [],
  landFor: (lots: number) => { rows: number; cost: number } = () => ({ rows: 0, cost: 0 }),
): Candidate[] {
  const options: BuildStep[][] = []
  for (const size of style.sizes) {
    options.push([{ kind: 'plant', size }], [{ kind: 'dc', size }], [{ kind: 'plant', size }, { kind: 'dc', size }])
  }
  // Upgrades: one per kind and level, the first such building (they are alike).
  const seen = new Set<string>()
  for (const b of upgradable) {
    const to = nextSize(b.size)
    const key = `${b.kind}-${b.size}`
    if (!to || seen.has(key)) continue
    seen.add(key)
    const spec = upgradeSpec(config, b.kind, b.size)
    const mw = buildingSpec(config, b.kind, to).mw - buildingSpec(config, b.kind, b.size).mw
    options.push([{ kind: b.kind, size: 'big', upgrade: { id: b.id, mw, cost: spec.cost, rounds: spec.rounds } }])
  }
  const bases = new Map<number, Plan>()
  const out: Candidate[] = []
  for (const steps of options) {
    const land = landFor(stepLots(steps))
    const buildPrice = steps.reduce((s, x) => s + stepCost(x, config), 0) + land.cost
    if (buildPrice > maxCost) continue
    const rounds = Math.max(...steps.map((s) => stepRounds(s, config)))
    const online = remaining - rounds + 1
    if (online < HABITS.minRoundsOnline) continue
    const h = rounds + style.lookahead
    let base = bases.get(h)
    if (!base) {
      base = plan(h, { ...future, links: openLinks }, false)
      bases.set(h, base)
    }
    const next = plan(h, grow({ ...future, links: openLinks }, steps, config), false)
    let linkMw = 0
    for (const use of LINK_USES) linkMw += Math.max(0, next.linkUse[use] - Math.max(base.linkUse[use], future.links[use]))
    const cost = buildPrice + linkMw * config.link.costPerMw
    const gain = next.margin - base.margin - config.maintenanceRate * buildPrice
    if (gain <= 0) continue
    // Late in the game a build has fewer rounds to earn its cost back; a style that can buy back
    // shares has a better use for that cash, one that cannot is better off building.
    const required = style.buysBack ? Math.max(style.minReturn, 1 / Math.max(1, online)) : style.minReturn
    const bias = (steps.reduce((s, x) => s + style.kindBias[x.kind], 0) / steps.length) * (steps[0].size === 'big' ? style.bigBias : 1)
    const score = (gain / cost) * bias
    // Crowded (measured idle too high): only a build that puts idle MW to work, such as a datacenter for idle plants.
    const idleOk = crowded ? next.idle < base.idle - MW_EPSILON : next.idle <= config.bots.maxIdle || next.idle < base.idle - MW_EPSILON
    if (score >= required && idleOk) out.push({ steps, cost, gain, score })
  }
  return out.sort((a, b) => b.score - a.score)
}

function loanRoom(style: Style, company: Company, debt: number, takenNow: number, config: Config): number {
  if (style.finance === 'leverage') return Math.max(0, config.bots.nimbusDebtToMarketCap * company.marketCap - debt)
  if (style.finance === 'utility') return company.loans.length === 0 && takenNow === 0 ? HABITS.utilityLoanShare * company.marketCap : 0
  return 0
}

/** Expected price per rented MW: rivals' rate for the share they filled last round, the market's for the rest. */
function estimateRentCost(state: GameState, company: Company, config: Config): number {
  const last = company.history.at(-1)
  const share = last && last.rent.requested > 0 ? last.rent.fromRivals / last.rent.requested : rivalFillShare(state, 0, company.id)
  return share * config.cost.rentRival + (1 - share) * config.cost.rentMarket
}

function lastCosts(company: Company): number {
  const last = company.history.at(-1)
  if (!last) return 0
  return last.costs.power + last.costs.rent + last.costs.maintenance + last.costs.interest
}
