import { capacity, findCompany } from './assets'
import { defaultConfig } from './config'
import { emptyDecision } from './decision'
import { sanitizeDecision } from './sanitize'
import type { Config, Decision, GameState } from './types'

/**
 * Last round's allocations (power, compute, rent), no builds, no finance, sanitized to this round's
 * capacity. In a losing round it also picks the forced sales. Round 1: everything on the internal
 * link, compute on AI.
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
    const cap = capacity(company)
    const internal = Math.min(cap.plantMw, cap.links.internal)
    d.power.internal = internal
    d.compute.ai = Math.min(cap.dcMw, internal)
  }
  return sanitizeDecision(state, companyId, d, config)
}
