import type {
  Account,
  Campaign,
  CampaignBrief,
  Creator,
  Deal,
  Evaluation,
  GateSet,
  HardRules,
  Lead,
  LeadEvent,
  CreatorClaim,
  Criterion,
  Knockout,
  LeadStatus,
  LostReason,
  Member,
  Niche,
  PresetId,
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
import { creators } from '../mock/creators'
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
import { describeChanges } from './tuning'
import { simulate, type Lever, type SimResult } from './simulate'

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
  evaluations: Evaluation[]
  claims: CreatorClaim[]
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
export function moveLead(leadId: string, to: LeadStatus, by = 'mem_1', lostReason?: LostReason): void {
  setState((s) => {
    const lead = s.leads.find((l) => l.id === leadId)
    if (!lead || (lead.status === to && !lostReason)) return {}
    const at = new Date().toISOString()
    const event: LeadEvent = {
      id: `lev_${leadId}_${s.leadEvents.length}`,
      leadId,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      from: lead.status,
      to,
      by,
      note: lostReason,
      at,
    }
    return {
      leads: s.leads.map((l) =>
        l.id === leadId ? { ...l, status: to, statusAt: at, lostReason: to === 'lost' ? lostReason : undefined } : l,
      ),
      leadEvents: [...s.leadEvents, event],
    }
  })
}

/**
 * Undoes the last status change on a lead. People click the wrong row, and a
 * list built for one click needs one click back out of it.
 */
export function undoMove(leadId: string): void {
  setState((s) => {
    const events = s.leadEvents.filter((e) => e.leadId === leadId).sort((a, b) => a.at.localeCompare(b.at))
    const last = events[events.length - 1]
    // The delivery event is the lead existing at all. There is no undoing that.
    if (!last || !last.from) return {}
    return {
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, status: last.from!, statusAt: last.at } : l)),
      leadEvents: s.leadEvents.filter((e) => e.id !== last.id),
    }
  })
}

/**
 * The niche list is the client's. Adding, renaming, switching one off or giving
 * it its own numbers all land here, and all of them change who gets found.
 */
export function setNiches(campaignId: string, niches: Niche[]): void {
  const now = new Date().toISOString()
  setState((s) => ({
    campaigns: s.campaigns.map((c) =>
      c.id === campaignId ? { ...c, extracted: { ...c.extracted, niches }, updatedAt: now } : c,
    ),
  }))
}

/** Kept across campaigns. A plain flag: it says nothing about the deal. */
export function toggleSaved(leadId: string): void {
  setState((s) => ({
    leads: s.leads.map((l) => (l.id === leadId ? { ...l, saved: !l.saved } : l)),
  }))
}

export function setNote(leadId: string, note: string): void {
  setState((s) => ({
    leads: s.leads.map((l) => (l.id === leadId ? { ...l, note } : l)),
  }))
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
          niches: proposal.niches,
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
        preset: 'balanced',
        by: 'system',
        changes: ['Proposed from the brief'],
        createdAt: now,
      },
    ],
  }))
  return id
}

/**
 * An edit writes the next version, it never overwrites one. The change lines
 * come with it, so the history reads as sentences rather than as a diff.
 *
 * A live campaign is re-tested straight away: rules that changed and a
 * feasibility figure from the old rules would be worse than no figure at all.
 */
export function saveGateSet(
  campaignId: string,
  draft: { hard: HardRules; knockouts: Knockout[]; criteria: Criterion[]; passScore: number; preset: PresetId },
  by = 'mem_1',
): void {
  const now = new Date().toISOString()
  let live = false
  setState((s) => {
    const campaign = s.campaigns.find((c) => c.id === campaignId)
    const current = s.gateSets.find((g) => g.id === campaign?.gateSetId)
    if (!campaign || !current) return {}
    live = campaign.status === 'live'
    const version = s.gateSets
      .filter((g) => g.campaignId === campaignId)
      .reduce((top, g) => Math.max(top, g.version), 0) + 1
    const id = `${campaignId}_v${version}`
    const next: GateSet = {
      id,
      campaignId,
      accountId: campaign.accountId,
      version,
      origin: 'edited',
      templateId: current.templateId,
      hard: draft.hard,
      knockouts: draft.knockouts,
      criteria: draft.criteria,
      passScore: draft.passScore,
      preset: draft.preset,
      by,
      changes: describeChanges(
        { hard: current.hard, passScore: current.passScore, knockouts: current.knockouts },
        { hard: draft.hard, passScore: draft.passScore, knockouts: draft.knockouts },
        { before: current.criteria, after: draft.criteria },
      ),
      createdAt: now,
    }
    return {
      gateSets: [...s.gateSets, next],
      campaigns: s.campaigns.map((c) => (c.id === campaignId ? { ...c, gateSetId: id, updatedAt: now } : c)),
    }
  })
  if (live) runFeasibility(campaignId)
}

/**
 * Runs a campaign's current gates over the pool and writes the funnel.
 *
 * The sample stand in for the backend's feasibility run, so the shape it writes
 * is the shape the API will return. What it writes is a survival count per gate
 * and an estimate a day. What it does not write, anywhere, is what reading the
 * sample would cost.
 */
export function runFeasibility(campaignId: string, precomputed?: SimResult): void {
  setState((s) => {
    const campaign = s.campaigns.find((c) => c.id === campaignId)
    const gates = s.gateSets.find((g) => g.id === campaign?.gateSetId)
    if (!campaign || !gates) return {}
    // The screen runs the scan while it animates, so the result is handed back
    // rather than computed twice.
    const out = precomputed ?? simulate(gates, campaign.extracted.niches, s.subscription.tier)
    const run: FeasibilityRun = {
      id: `fea_${gates.id}_${s.feasibilityRuns.length}`,
      campaignId,
      gateSetId: gates.id,
      gateSetVersion: gates.version,
      sampleSize: out.funnel.scanned,
      passedHard: out.funnel.pastHard,
      inNiche: out.funnel.inNiche,
      passedKnockouts: out.funnel.pastKnockouts,
      qualified: out.funnel.qualified,
      blame: out.blame,
      scoreHistogram: out.histogram,
      estimatedPerDay: out.estimatedPerDay,
      ranAt: new Date().toISOString(),
    }
    return { feasibilityRuns: [...s.feasibilityRuns, run] }
  })
}

/**
 * Takes a suggestion from the simulator. It writes a gate version like any
 * other edit, so the history says the client loosened a threshold and says by
 * how much, and then re-tests.
 */
export function applyLever(campaignId: string, lever: Lever): void {
  const s = getState()
  const campaign = s.campaigns.find((c) => c.id === campaignId)
  const gates = s.gateSets.find((g) => g.id === campaign?.gateSetId)
  if (!campaign || !gates) return
  saveGateSet(
    campaignId,
    {
      hard: lever.next.hard,
      knockouts: gates.knockouts,
      criteria: gates.criteria,
      passScore: lever.next.passScore,
      preset: 'custom',
    },
    'mem_1',
  )
}

/**
 * The client keeps their criteria and takes the smaller flow. The cap is what
 * makes that honest: the campaign stops promising a number it cannot reach.
 */
export function acceptVolume(campaignId: string, perDay: number): void {
  setState((s) => ({
    campaigns: s.campaigns.map((c) =>
      c.id === campaignId ? { ...c, dailyCap: Math.max(1, perDay), updatedAt: new Date().toISOString() } : c,
    ),
  }))
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
    setState({ live: true, ...loaded, topups: [], quotaEntries: [], claims: [] })
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
