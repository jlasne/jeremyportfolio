import { capacity, findCompany } from './assets'
import { COMPUTE_POOLS } from './constants'
import { floorMw } from './money'
import { defaultConfig } from './config'
import { emptyDecision } from './decision'
import { sanitizeDecision } from './sanitize'
import type { Config, Decision, GameState } from './types'

/**
 * Last round's allocations (power, compute, rent), no builds, no finance, sanitized to this round's
 * capacity. In a losing round it also picks the forced sales. Round 1: everything on the internal
 * link, compute spread over cloud, bitcoin and AI by their demand.
 */
export function defaultDecision(state: GameState, companyId: string, config: Config = defaultConfig): Decision {
  const company = findCompany(state, companyId)
  const d = emptyDecision()
  if (!company || company.bankrupt || state.finished) return d
  const last = company.lastDecision
  if (last) {
    d.power = { ...last.power }
    d.compute = { ...last.compute }
    d.rentMw = last.rentMw
  } else {
    // Round 1: compute spread over the three pools in proportion to their demand, so the market starts full.
    const cap = capacity(company)
    const internal = Math.min(cap.plantMw, cap.links.internal)
    d.power.internal = internal
    const compute = Math.min(cap.dcMw, internal)
    const total = COMPUTE_POOLS.reduce((s, p) => s + state.pools[p].demand, 0)
    for (const p of COMPUTE_POOLS) d.compute[p] = total > 0 ? floorMw((compute * state.pools[p].demand) / total) : 0
  }
  return sanitizeDecision(state, companyId, d, config)
}
