// A bot's read of each pool, from public information only: last rounds' demand and total used
// (the round summaries), pool growth (shown after each round), and its own results.

import { COMPUTE_POOLS, MW_EPSILON, POOLS } from './constants'
import type { Company, Config, GameState, LinkUse, PoolId } from './types'

/** In a full pool where I was not rationed, rivals likely offered a bit more than they sold. */
const SATURATED_OVEROFFER = 1.25
/** Chunks per plan: enough resolution for small companies, bounded work for big ones. */
const PLAN_CHUNKS = 24
const PLAN_MAX_STEPS = 400
/** Below this weighted margin per MW a chunk is not worth placing on purpose. */
const PLAN_MIN_VALUE = 0.01

export interface PoolModel {
  /** What the incumbent rule keeps for this company if it offers at least that much. */
  reserve: number
  /** MW left for spare offers once every incumbent keeps its reserve. */
  open: number
  /** Rivals' estimated spare offers competing for the open MW. */
  othersSpare: number
}

/** Expected used MW for an offer of x, under the allocation rule with the estimated rivals. */
export function expectedUsed(m: PoolModel, x: number): number {
  if (x <= m.reserve) return x
  const spare = x - m.reserve
  const competing = m.othersSpare + spare
  const won = competing <= m.open ? spare : (m.open * spare) / competing
  return m.reserve + won
}

/** Pool models `horizon` rounds ahead. */
export function poolModels(state: GameState, company: Company, horizon: number, config: Config): Record<PoolId, PoolModel> {
  const s = config.incumbentShare
  const last = state.history.at(-1)
  const before = state.history.at(-2)
  const mine = company.history.at(-1)
  const minePrev = company.history.at(-2)
  const active = Math.max(1, state.companies.filter((c) => !c.bankrupt).length)
  const out = {} as Record<PoolId, PoolModel>

  for (const p of POOLS) {
    const pool = state.pools[p]
    // Growth seen last round, pulled half way to the expectation the market formed: a bot does not chase one lucky round.
    const g = (pool.growth + pool.expectedGrowth) / 2
    const ahead = Math.pow(1 + g, horizon)
    const demandLast = last ? last.pools[p].demand : pool.demand
    const demandNext = demandLast * ahead
    const totalUsed = last ? last.pools[p].used : 0
    const myUsed = mine ? mine.used[p] : 0
    const othersUsed = Math.max(0, totalUsed - myUsed)
    const reserve = s * myUsed
    const open = Math.max(0, demandNext - s * othersUsed - reserve)

    let othersSpare: number
    if (!last || !mine) {
      // Before any result: assume every rival takes an equal share.
      othersSpare = (demandNext * (active - 1)) / active
    } else {
      // Rebuild what rivals offered last round from public totals and my own fill, then grow it.
      const totalBefore = before ? before.pools[p].used : 0
      const myBefore = minePrev ? minePrev.used[p] : 0
      const othersReserveLast = Math.min(othersUsed, s * Math.max(0, totalBefore - myBefore))
      const openLast = Math.max(0, demandLast - s * totalBefore)
      const myReserveLast = Math.min(mine.offered[p], s * myBefore)
      const mySpareLast = mine.offered[p] - myReserveLast
      const myOpenLast = Math.max(0, myUsed - myReserveLast)
      let othersOffered: number
      if (mySpareLast > MW_EPSILON && myOpenLast < mySpareLast - MW_EPSILON) {
        // I was rationed: fill = open / total spare, so the total spare follows from my own fill.
        const fill = myOpenLast / mySpareLast
        const totalSpare = fill > MW_EPSILON ? openLast / fill : openLast + demandLast
        othersOffered = othersReserveLast + Math.max(0, totalSpare - mySpareLast)
      } else if (totalUsed < demandLast - MW_EPSILON) {
        // Unserved demand: rivals got everything they offered.
        othersOffered = othersUsed
      } else {
        othersOffered = othersUsed * SATURATED_OVEROFFER
      }
      othersSpare = Math.max(0, othersOffered * ahead - s * othersUsed)
    }
    out[p] = { reserve, open, othersSpare }
  }
  return out
}

export interface Resources {
  plant: number
  dc: number
  links: Record<LinkUse, number>
}

export interface Plan {
  offers: Record<PoolId, number>
  internal: number
  rentMw: number
  /** Expected used MW per pool and expected operating margin (revenue - power - rent). */
  used: Record<PoolId, number>
  margin: number
  idle: number
  /** Link MW the plan routes through each link. */
  linkUse: Record<LinkUse, number>
}

export interface PlanInput {
  models: Record<PoolId, PoolModel>
  res: Resources
  weights: Record<PoolId, number>
  rents: boolean
  rentCost: number
  /** Offer leftover capacity too (it costs nothing and may catch upside). Off when sizing builds. */
  fillLeftover: boolean
  config: Config
}

/** Splits capacity across pools greedily, MW chunk by MW chunk, toward the best weighted marginal margin. */
export function planAllocation(input: PlanInput): Plan {
  const { models, res, weights, config } = input
  const own = config.cost.ownPower
  const offers: Record<PoolId, number> = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }
  let plant = res.plant
  let dc = res.dc
  let internalLeft = res.links.internal
  let townLeft = res.links.town
  let importLeft = input.rents ? res.links.import : 0
  let internal = 0
  let rent = 0
  const step = Math.max(1, (res.plant + res.dc) / PLAN_CHUNKS)

  // Expected used at the current offer, kept per pool so each chunk costs one evaluation.
  const at: Record<PoolId, number> = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }
  for (const p of POOLS) at[p] = expectedUsed(models[p], 0)
  const gain = (p: PoolId, s: number): number => expectedUsed(models[p], offers[p] + s) - at[p]

  for (let guard = 0; guard < PLAN_MAX_STEPS; guard++) {
    let best = 0
    let pick: { p: PoolId; s: number; via: 'own' | 'rent' | 'town' | 'otherDc' } | null = null
    for (const p of COMPUTE_POOLS) {
      const sOwn = Math.min(step, dc, plant, internalLeft)
      if (sOwn > MW_EPSILON) {
        const v = (weights[p] * (config.rate[p] - own) * gain(p, sOwn)) / sOwn
        if (v > best) {
          best = v
          pick = { p, s: sOwn, via: 'own' }
        }
      }
      const sRent = Math.min(step, dc, importLeft)
      if (sRent > MW_EPSILON) {
        const v = (weights[p] * config.rate[p] * gain(p, sRent)) / sRent - input.rentCost
        if (v > best) {
          best = v
          pick = { p, s: sRent, via: 'rent' }
        }
      }
    }
    const sTown = Math.min(step, plant, townLeft)
    if (sTown > MW_EPSILON) {
      const v = (weights.citizens * (config.rate.citizens - own) * gain('citizens', sTown)) / sTown
      if (v > best) {
        best = v
        pick = { p: 'citizens', s: sTown, via: 'town' }
      }
    }
    const sOther = Math.min(step, plant)
    if (sOther > MW_EPSILON) {
      const v = (weights.otherDc * (config.rate.otherDc - own) * gain('otherDc', sOther)) / sOther
      if (v > best) {
        best = v
        pick = { p: 'otherDc', s: sOther, via: 'otherDc' }
      }
    }
    if (!pick || best < PLAN_MIN_VALUE) break
    offers[pick.p] += pick.s
    at[pick.p] = expectedUsed(models[pick.p], offers[pick.p])
    if (pick.via === 'own') {
      dc -= pick.s
      plant -= pick.s
      internalLeft -= pick.s
      internal += pick.s
    } else if (pick.via === 'rent') {
      dc -= pick.s
      importLeft -= pick.s
      rent += pick.s
    } else if (pick.via === 'town') {
      plant -= pick.s
      townLeft -= pick.s
    } else {
      plant -= pick.s
    }
  }

  if (input.fillLeftover) {
    const top = [...COMPUTE_POOLS].sort((a, b) => weights[b] * config.rate[b] - weights[a] * config.rate[a])[0]
    const extra = Math.min(dc, plant, internalLeft)
    if (extra > MW_EPSILON) {
      offers[top] += extra
      internal += extra
      plant -= extra
    }
    if (plant > MW_EPSILON) {
      const toTown = weights.citizens > weights.otherDc ? Math.min(plant, townLeft) : 0
      offers.citizens += toTown
      offers.otherDc += plant - toTown
      plant = 0
    }
  }

  const linkUse: Record<LinkUse, number> = { internal, town: offers.citizens, import: rent }
  const used: Record<PoolId, number> = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }
  let revenue = 0
  for (const p of POOLS) {
    used[p] = expectedUsed(models[p], offers[p])
    revenue += used[p] * config.rate[p]
  }
  const computeUsed = used.cloud + used.btc + used.ai
  const ownUsed = used.citizens + used.otherDc + Math.min(internal, Math.max(0, computeUsed - rent))
  const margin = revenue - own * ownUsed - input.rentCost * rent
  const online = res.plant + res.dc
  const idle = online > 0 ? Math.max(0, 1 - (ownUsed + computeUsed) / online) : 0
  return { offers, internal, rentMw: rent, used, margin, idle, linkUse }
}
