import type { LeadStatus } from '../types'

// The pipeline, in six words. A status change is one click from the list and
// never more than one, so this file has to answer "what is the next click"
// without any screen thinking about it.
//
// These values are strategic: they and the deal amounts are what will feed the
// scoring loop and a price benchmark later. They are stored as an append only
// event, never as a field someone overwrites.

export const STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'call', 'signed', 'lost']

/** The forward walk. `lost` is a side exit, not a step. */
export const WALK: LeadStatus[] = ['new', 'contacted', 'replied', 'call', 'signed']

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  call: 'Call booked',
  signed: 'Signed',
  lost: 'Lost',
}

/** What the one click does next. Null when the lead is at the end of the walk. */
export function nextStatus(status: LeadStatus): LeadStatus | null {
  if (status === 'signed' || status === 'lost') return null
  const at = WALK.indexOf(status)
  return WALK[at + 1] ?? null
}

/** The verb on the button, so the list reads as an action and not a state. */
export function nextLabel(status: LeadStatus): string | null {
  const next = nextStatus(status)
  if (!next) return null
  return { contacted: 'Mark contacted', replied: 'Mark replied', call: 'Book call', signed: 'Mark signed' }[
    next as 'contacted' | 'replied' | 'call' | 'signed'
  ]
}

/** Where a status sits on the walk, for the funnel on the dashboard. */
export function rank(status: LeadStatus): number {
  return status === 'lost' ? -1 : WALK.indexOf(status)
}
