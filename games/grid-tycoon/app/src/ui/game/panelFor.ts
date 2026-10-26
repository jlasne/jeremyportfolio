// Which panel fixes a given validation field or warning, so chips and the lock-in reason can jump
// straight to it.

import type { ValidationIssue, WarningCode } from '../../engine'
import type { PanelId } from '../../store/ui'

export function panelForIssue(issue: ValidationIssue | undefined): PanelId | 'forced' | null {
  const f = issue?.field ?? ''
  if (f.startsWith('forcedSales')) return 'forced'
  if (f.startsWith('power') || f.startsWith('compute') || f.startsWith('rentMw')) return 'allocate'
  if (f.startsWith('builds') || f.startsWith('upgrades')) return 'build'
  if (f.startsWith('loans') || f.startsWith('shares')) return 'finance'
  return null
}

const WARNING_PANEL: Record<WarningCode, PanelId> = {
  idle_high: 'allocate',
  link_short: 'build',
  no_town_link: 'build',
  rent_over_import: 'build',
  compute_unpowered: 'allocate',
  loan_due_soon: 'finance',
  treasury_negative: 'build',
}

export function panelForWarning(code: WarningCode): PanelId {
  return WARNING_PANEL[code]
}
