import type {
  Account,
  Campaign,
  CampaignBrief,
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
import type { Proposal } from './propose'
import { built } from '../mock/creators'
import { judge } from '../mock/judge'
import { evaluate } from './gates'

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
 * A brief and its proposal become a campaign and its first gate version.
 * The version is written as `generated`, so the first edit becomes version 2
 * and the history says plainly which rules the client wrote and which we did.
 */
export function createCampaign(brief: CampaignBrief, proposal: Proposal, name: string): string {
  const now = new Date().toISOString()
  const id = `cmp_${Math.random().toString(36).slice(2, 9)}`
  const gateSetId = `gate_${id}_v1`
  setState((s) => ({
    campaigns: [
      ...s.campaigns,
      {
        id,
        accountId: s.account.id,
        name,
        status: 'live',
        dailyCap: null,
        brief,
        extracted: {
          countries: proposal.countries,
          languages: proposal.languages,
          templateId: proposal.templateId,
          extractedAt: now,
        },
        gateSetId,
        createdAt: now,
        updatedAt: now,
      },
    ],
    gateSets: [
      ...s.gateSets,
      {
        id: gateSetId,
        campaignId: id,
        accountId: s.account.id,
        version: 1,
        origin: 'generated',
        templateId: proposal.templateId,
        hard: proposal.hard,
        knockouts: proposal.knockouts,
        criteria: proposal.criteria,
        passScore: proposal.passScore,
        createdAt: now,
      },
    ],
  }))
  return id
}

/**
 * Runs a campaign's current gates over the pool and writes the distribution.
 *
 * The sample stand in for the backend's feasibility run. Same inputs, same
 * output shape: survival per gate, the score spread, and what the ratio turns
 * into over a day. No cost and no analysed volume, here or there.
 */
export function runFeasibility(campaignId: string): void {
  setState((s) => {
    const campaign = s.campaigns.find((c) => c.id === campaignId)
    const gates = s.gateSets.find((g) => g.id === campaign?.gateSetId)
    if (!campaign || !gates) return {}
    const now = Date.now()
    let passedHard = 0
    let passedKnockouts = 0
    const histogram = new Map<number, number>()
    built.forEach((b, index) => {
      const result = evaluate(b.creator, gates, judge(index, b.band, gates), now)
      if (result.verdict === 'hard_fail') return
      passedHard++
      if (result.verdict === 'knockout_fail') return
      passedKnockouts++
      histogram.set(result.score, (histogram.get(result.score) ?? 0) + 1)
    })
    const qualified = [...histogram.entries()]
      .filter(([score]) => score >= gates.passScore)
      .reduce((sum, [, count]) => sum + count, 0)
    const run: FeasibilityRun = {
      id: `fea_${gates.id}_${s.feasibilityRuns.length}`,
      campaignId,
      gateSetId: gates.id,
      gateSetVersion: gates.version,
      sampleSize: built.length,
      passedHard,
      passedKnockouts,
      // Every score from 0 to the ceiling, so the spread reads as a spread.
      scoreHistogram: Array.from({ length: gates.criteria.length * 2 + 1 }, (_, score) => ({
        score,
        count: histogram.get(score) ?? 0,
      })),
      estimatedPerDay: Math.round((qualified / Math.max(1, built.length)) * 900),
      ranAt: new Date().toISOString(),
    }
    return { feasibilityRuns: [...s.feasibilityRuns, run] }
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
