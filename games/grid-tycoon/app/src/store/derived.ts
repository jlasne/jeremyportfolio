// Everything the decision UI computes from (state, draft): validation, preview, projection,
// warnings and the loan risk view. One module-level cache so every component that calls
// useDerived() in the same render shares one engine pass.

import { previewCompany, projectRound, riskView, validateDecision, warnings } from '../engine'
import type { CompanyPreview, Config, Decision, GameState, Projection, RiskView, ValidationResult, Warning } from '../engine'
import { useDraft } from './draft'
import { useGame } from './game'

export interface Derived {
  validation: ValidationResult
  preview: CompanyPreview
  projection: Projection
  warnings: Warning[]
  risk: RiskView
}

let cache: { state: GameState; meId: string; decision: Decision; config: Config; value: Derived } | null = null

export function computeDerived(state: GameState, meId: string, decision: Decision, config: Config): Derived {
  if (cache && cache.state === state && cache.meId === meId && cache.decision === decision && cache.config === config) return cache.value
  const value: Derived = {
    validation: validateDecision(state, meId, decision, config),
    preview: previewCompany(state, meId, decision, config),
    projection: projectRound(state, meId, decision, config),
    warnings: warnings(state, meId, decision, config),
    risk: riskView(state, meId, decision, config),
  }
  cache = { state, meId, decision, config, value }
  return value
}

/**
 * Memoized on (state, decision). Only call it inside the game screen. While the screen is being
 * torn down (state already null) it returns the last value instead of throwing.
 */
export function useDerived(): Derived {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const decision = useDraft((s) => s.decision)
  if (state && meId) return computeDerived(state, meId, decision, config)
  if (cache) return cache.value
  throw new Error('useDerived() needs a running game')
}
