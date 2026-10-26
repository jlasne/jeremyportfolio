// Warning chips for the draft (never pop-ups): short label, one-sentence detail.

import { capacity, companyById } from './assets'
import { defaultConfig } from './config'
import { MW_EPSILON } from './constants'
import { finite, round2 } from './money'
import { applyDraft, projectRound } from './projection'
import type { Config, Decision, GameState, Warning } from './types'

const pct = (x: number): string => `${Math.round(x * 100)}%`
const mw = (x: number): string => `${round2(x)} MW`

export function warnings(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Warning[] {
  const out: Warning[] = []
  const original = companyById(state, companyId)
  if (original.bankrupt || state.finished) return out
  const { company, draft, outcome } = applyDraft(state, companyId, decision, config)
  const cap = capacity(company)
  const internal = finite(draft.power.internal)
  const town = finite(draft.power.town)
  const rent = finite(draft.rentMw)
  const compute = finite(draft.compute.cloud) + finite(draft.compute.btc) + finite(draft.compute.ai)

  if (company.treasury < 0) {
    out.push({
      code: 'treasury_negative',
      level: 'critical',
      label: `Treasury ${round2(company.treasury)}`,
      detail:
        original.treasury < 0
          ? 'Losing round: sell buildings until the treasury is back to 0 (each returns 30% of its price paid).'
          : 'These orders spend more than the treasury holds; remove a build or raise cash first.',
    })
  }

  if (town > MW_EPSILON && cap.links.town <= 0) {
    out.push({ code: 'no_town_link', level: 'critical', label: 'No town link', detail: 'Selling power to citizens needs a town link; buy one in the Build panel (ready next round).' })
  }
  const short: string[] = []
  if (internal > cap.links.internal + MW_EPSILON) short.push(`internal ${mw(cap.links.internal)} for ${mw(internal)}`)
  if (cap.links.town > 0 && town > cap.links.town + MW_EPSILON) short.push(`town ${mw(cap.links.town)} for ${mw(town)}`)
  if (short.length > 0) {
    out.push({ code: 'link_short', level: 'warn', label: 'Link short', detail: `A link carries less than you assigned: ${short.join(', ')}. Extra MW will not flow.` })
  }

  if (rent > cap.links.import + MW_EPSILON) {
    out.push({
      code: 'rent_over_import',
      level: 'warn',
      label: 'Rent > import',
      detail: `You rent ${mw(rent)} but the import link carries ${mw(cap.links.import)}; buy import link MW first.`,
    })
  }

  const powered = Math.min(cap.dcMw, internal + rent)
  if (compute > powered + MW_EPSILON) {
    const why = cap.dcMw < internal + rent ? `your datacenters hold ${mw(cap.dcMw)}` : `only ${mw(internal + rent)} of power reaches them`
    out.push({ code: 'compute_unpowered', level: 'warn', label: 'Compute unpowered', detail: `You offer ${mw(compute)} of compute but ${why}.` })
  }

  const projection = projectRound(state, companyId, decision, config)
  if (projection.idle > config.stock.idleFree) {
    out.push({
      code: 'idle_high',
      level: 'warn',
      label: `Idle ${pct(projection.idle)}`,
      detail: `About ${pct(projection.idle)} of your capacity would sit idle; above ${pct(config.stock.idleFree)} the stock pays an idle penalty.`,
    })
  }

  // A loan the draft refinances is no longer due: its principal rolls into a new loan termRounds away.
  const soon = company.loans
    .filter((l) => l.dueRound <= state.round + 2 && !outcome.refinance.includes(l.id))
    .sort((a, b) => a.dueRound - b.dueRound)
  if (soon.length > 0) {
    const first = soon[0]
    const total = round2(soon.filter((l) => l.dueRound === first.dueRound).reduce((s, l) => s + l.principal, 0))
    const when = first.dueRound <= state.round ? 'this round' : `in round ${first.dueRound}`
    out.push({
      code: 'loan_due_soon',
      level: first.dueRound <= state.round ? 'warn' : 'info',
      label: first.dueRound <= state.round ? 'Loan due now' : `Loan due R${first.dueRound}`,
      detail: `${total} of principal is due ${when}; repay it, refinance it at its due round, or keep the cash.`,
    })
  }
  return out
}
