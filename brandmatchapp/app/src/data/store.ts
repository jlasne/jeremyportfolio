import type {
  Account,
  Campaign,
  Creator,
  CreatorPost,
  Deal,
  Evaluation,
  GateSet,
  Lead,
  LeadEvent,
  LeadStatus,
  Member,
  QuotaEntry,
  QuotaPeriod,
  Subscription,
  Topup,
  DailyDelivery,
  FeasibilityRun,
} from '../types'
import { account, members, subscription, topups } from '../mock/account'
import { campaigns } from '../mock/campaigns'
import { gateSets } from '../mock/gates'
import { creators, posts } from '../mock/creators'
import {
  claims,
  dailyDeliveries,
  deals,
  evaluations,
  feasibilityRuns,
  leadEvents,
  leads,
  quotaEntries,
  quotaPeriod,
} from '../mock/pipeline'

// The only place state lives, client side. Seeded from the mock folder, and
// shaped exactly like the client API's response so swapping the seed for a
// fetch changes this file and nothing else.
//
// Nothing here carries a production cost, an analysed volume or a fair use
// figure. Those live in mock/ops.ts and are read by the admin screen alone.

export interface State {
  /** False means the sample account below. True means a real account. */
  live: boolean
  account: Account
  members: Member[]
  subscription: Subscription
  topups: Topup[]
  quotaEntries: QuotaEntry[]
  quotaPeriod: QuotaPeriod
  campaigns: Campaign[]
  gateSets: GateSet[]
  creators: Creator[]
  posts: CreatorPost[]
  evaluations: Evaluation[]
  claims: { creatorId: string; accountId: string; campaignId: string; claimedAt: string }[]
  leads: Lead[]
  leadEvents: LeadEvent[]
  deals: Deal[]
  dailyDeliveries: DailyDelivery[]
  feasibilityRuns: FeasibilityRun[]
}

function seed(): State {
  return {
    live: false,
    account,
    members,
    subscription,
    topups,
    quotaEntries,
    quotaPeriod,
    campaigns,
    gateSets,
    creators,
    posts,
    evaluations,
    claims,
    leads,
    leadEvents,
    deals,
    dailyDeliveries,
    feasibilityRuns,
  }
}

let state: State | null = null
let version = 0
const listeners = new Set<() => void>()

export function getVersion(): number {
  return version
}

export function getState(): State {
  if (!state) state = seed()
  return state
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const current = getState()
  const next = typeof patch === 'function' ? patch(current) : patch
  state = { ...current, ...next }
  version++
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The one click. Moves a lead and appends the event in the same write, because
 * the event is the record and the field on the lead is only a cache of it.
 */
export function moveLead(leadId: string, to: LeadStatus, by = 'mem_1'): void {
  setState((s) => {
    const lead = s.leads.find((l) => l.id === leadId)
    if (!lead || lead.status === to) return {}
    const at = new Date().toISOString()
    const event: LeadEvent = {
      id: `lev_${leadId}_${s.leadEvents.length}`,
      leadId,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      from: lead.status,
      to,
      by,
      at,
    }
    return {
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, status: to, statusAt: at } : l)),
      leadEvents: [...s.leadEvents, event],
    }
  })
}

/** A signed lead gets an amount. Kept separate: one lead can sign twice. */
export function recordDeal(leadId: string, amountCents: number, note?: string): void {
  setState((s) => {
    const lead = s.leads.find((l) => l.id === leadId)
    if (!lead) return {}
    const deal: Deal = {
      id: `dea_${leadId}_${s.deals.length}`,
      leadId,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      amountCents,
      currency: 'EUR',
      signedAt: new Date().toISOString(),
      note,
    }
    return { deals: [...s.deals, deal] }
  })
}

/**
 * Swaps the sample account for a real one. Called on boot when a key is in
 * localStorage. A failure is not fatal: the app keeps the sample data and says
 * so, which is what a visitor without a key sees anyway.
 */
export async function hydrate(): Promise<boolean> {
  const { isLive } = await import('../lib/api')
  if (!isLive()) return false
  try {
    const { fetchAll } = await import('./remote')
    const loaded = await fetchAll()
    setState({ live: true, ...loaded, topups: [], quotaEntries: [], posts: [], claims: [] })
    return true
  } catch (e) {
    console.warn('brandmatch: staying on the sample account.', e)
    return false
  }
}

export function resetState(): void {
  state = null
  getState()
  version++
  listeners.forEach((l) => l())
}
