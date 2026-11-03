// The commitment rule: compute sold to a pool is a contract. From one round to the next an offer can
// grow freely but drop by at most commitment.maxDropPerRound (50%) of last round's. Rent is free.
// The floors shrink only when the company physically cannot meet them (fewer datacenters online,
// less plant or internal link MW): then they scale down together.

import { capacity, findCompany } from './assets'
import { defaultConfig } from './config'
import { COMPUTE_POOLS } from './constants'
import type { Capacity } from './assets'
import type { ComputePool, Company, Config, GameState } from './types'

export interface Floors {
  compute: Record<ComputePool, number>
  rentMw: number
}

export function zeroFloors(): Floors {
  return { compute: { cloud: 0, btc: 0, ai: 0 }, rentMw: 0 }
}

/** Floors from the last decision, fitted to a capacity (after forced sales). */
export function floorsFor(company: Company, cap: Capacity, config: Config = defaultConfig): Floors {
  const out = zeroFloors()
  const last = company.lastDecision
  if (!last) return out
  const keep = 1 - config.commitment.maxDropPerRound
  // Floors are floored to 0.01 MW so a sanitized decision at the floor always validates.
  const f = (x: number): number => Math.floor(Math.max(0, x) * keep * 100 + 1e-9) / 100
  // Rent carries no floor; the compute floors fit what the company can power with its own plants.
  const powered = Math.min(cap.dcMw, Math.min(cap.links.internal, cap.plantMw))
  let sum = 0
  for (const p of COMPUTE_POOLS) {
    out.compute[p] = f(last.compute[p])
    sum += out.compute[p]
  }
  if (sum > powered) {
    const scale = sum > 0 ? Math.max(0, powered) / sum : 0
    for (const p of COMPUTE_POOLS) out.compute[p] = Math.floor(out.compute[p] * scale * 100 + 1e-9) / 100
  }
  return out
}

export function commitmentFloors(state: GameState, companyId: string, config: Config = defaultConfig): Floors {
  const company = findCompany(state, companyId)
  if (!company || company.bankrupt || state.finished) return zeroFloors()
  return floorsFor(company, capacity(company), config)
}
