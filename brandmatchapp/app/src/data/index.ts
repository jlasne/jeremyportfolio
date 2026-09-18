import type {
  Account,
  Campaign,
  Creator,
  Deal,
  Evaluation,
  GateSet,
  Lead,
  LeadStatus,
  Member,
  QuotaPeriod,
  Subscription,
  Verdict,
} from '../types'
import { getState, getVersion } from './store'
import { rank, WALK } from './status'

// Every read a screen makes goes through here. One rule holds for the whole
// file: it only ever touches the client store, which carries no cost, no
// analysed volume and no fair use figure. A screen cannot leak what it cannot
// reach.

export function getAccount(): Account {
  return getState().account
}

export function getMembers(): Member[] {
  return getState().members
}

export function getSubscription(): Subscription {
  return getState().subscription
}

export function getQuota(): QuotaPeriod {
  return getState().quotaPeriod
}

export function getCampaigns(): Campaign[] {
  return getState().campaigns
}

export function getCampaign(id: string | null): Campaign | null {
  if (!id) return null
  return getState().campaigns.find((c) => c.id === id) ?? null
}

/** The version a campaign judges against today. */
export function getGateSet(campaignId: string): GateSet | null {
  const campaign = getCampaign(campaignId)
  if (!campaign) return null
  return getState().gateSets.find((g) => g.id === campaign.gateSetId) ?? null
}

/** Every version this campaign has had, newest first. */
export function getGateVersions(campaignId: string): GateSet[] {
  return getState()
    .gateSets.filter((g) => g.campaignId === campaignId)
    .sort((a, b) => b.version - a.version)
}

export function getCreator(id: string): Creator | null {
  return getState().creators.find((c) => c.id === id) ?? null
}

export function getPosts(creatorId: string) {
  return getState().posts.filter((p) => p.creatorId === creatorId)
}

/** One row of the lead flow: everything a list line and its panel need. */
export interface LeadRow {
  lead: Lead
  creator: Creator
  evaluation: Evaluation
  campaign: Campaign
  deal: Deal | null
}

let rowCache: { version: number; rows: LeadRow[] } | null = null

function allRows(): LeadRow[] {
  const version = getVersion()
  if (rowCache && rowCache.version === version) return rowCache.rows
  const s = getState()
  const creators = new Map(s.creators.map((c) => [c.id, c]))
  const evaluations = new Map(s.evaluations.map((e) => [e.id, e]))
  const campaigns = new Map(s.campaigns.map((c) => [c.id, c]))
  const deals = new Map(s.deals.map((d) => [d.leadId, d]))
  const rows = s.leads
    .map((lead) => {
      const creator = creators.get(lead.creatorId)
      const evaluation = evaluations.get(lead.evaluationId)
      const campaign = campaigns.get(lead.campaignId)
      if (!creator || !evaluation || !campaign) return null
      return { lead, creator, evaluation, campaign, deal: deals.get(lead.id) ?? null }
    })
    .filter((r): r is LeadRow => r !== null)
  rowCache = { version, rows }
  return rows
}

export type LeadSort = 'fit' | 'newest' | 'status'

export interface LeadQuery {
  campaignId?: string | null
  status?: LeadStatus | null
  search?: string
  /** Only people this big or bigger. */
  followersMin?: number | null
  /** Only people who scored this or better. */
  scoreMin?: number | null
  savedOnly?: boolean
  sort?: LeadSort
}

/**
 * The daily list.
 *
 * Best fit first, but people nobody has touched sit above people already
 * worked, because the question the screen answers is "who do I contact now".
 * A signed lead at 14 out of 14 at the top of the list every morning is noise.
 */
export function listLeads(query: LeadQuery = {}): LeadRow[] {
  const term = query.search?.trim().toLowerCase() ?? ''
  const sort = query.sort ?? 'fit'
  return allRows()
    .filter((r) => (query.campaignId ? r.lead.campaignId === query.campaignId : true))
    .filter((r) => (query.status ? r.lead.status === query.status : true))
    .filter((r) => (query.savedOnly ? Boolean(r.lead.saved) : true))
    .filter((r) => (query.followersMin ? r.creator.followers >= query.followersMin : true))
    .filter((r) => (query.scoreMin ? r.lead.score >= query.scoreMin : true))
    .filter((r) =>
      term
        ? r.creator.handle.toLowerCase().includes(term) || r.creator.name.toLowerCase().includes(term)
        : true,
    )
    .sort((a, b) => {
      // A re-measured person goes back to the top of any order, because the
      // numbers on their row just changed.
      const fresh = freshness(b) - freshness(a)
      if (fresh !== 0) return fresh
      if (sort === 'newest') return b.lead.deliveredAt.localeCompare(a.lead.deliveredAt)
      if (sort === 'status') {
        const step = rank(a.lead.status) - rank(b.lead.status)
        if (step !== 0) return step
        return b.lead.score - a.lead.score
      }
      const untouched = Number(a.lead.status !== 'new') - Number(b.lead.status !== 'new')
      if (untouched !== 0) return untouched
      if (b.lead.score !== a.lead.score) return b.lead.score - a.lead.score
      return b.lead.deliveredAt.localeCompare(a.lead.deliveredAt)
    })
}

function freshness(row: LeadRow): number {
  return row.lead.refreshedAt ? new Date(row.lead.refreshedAt).getTime() : 0
}

/** How many of today's leads have landed, against what the campaign may take. */
export function todayCount(campaignId?: string | null): { delivered: number; target: number } {
  const campaign = campaignId ? getCampaign(campaignId) : null
  return {
    delivered: deliveredToday(campaignId),
    target: campaign?.dailyCap ?? getSubscription().tier,
  }
}

export function getLeadRow(leadId: string): LeadRow | null {
  return allRows().find((r) => r.lead.id === leadId) ?? null
}

export function getLeadEvents(leadId: string) {
  return getState()
    .leadEvents.filter((e) => e.leadId === leadId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** Leads delivered today, the first number on the dashboard. */
export function deliveredToday(campaignId?: string | null): number {
  const today = new Date().toISOString().slice(0, 10)
  return getState().leads.filter(
    (l) => l.deliveredAt.slice(0, 10) === today && (campaignId ? l.campaignId === campaignId : true),
  ).length
}

export interface FunnelStep {
  status: LeadStatus
  count: number
}

/** How many leads have reached each step. Cumulative, so it reads as a funnel. */
export function getFunnel(campaignId?: string | null): FunnelStep[] {
  const leads = getState().leads.filter((l) => (campaignId ? l.campaignId === campaignId : true))
  return WALK.map((status) => ({
    status,
    count: leads.filter((l) => rank(l.status) >= rank(status)).length,
  }))
}

export function getLost(campaignId?: string | null): number {
  return getState().leads.filter(
    (l) => l.status === 'lost' && (campaignId ? l.campaignId === campaignId : true),
  ).length
}

/** Signed money, in cents. The only figure on the dashboard the client typed. */
export function getSigned(campaignId?: string | null): { count: number; amountCents: number } {
  const deals = getState().deals.filter((d) => (campaignId ? d.campaignId === campaignId : true))
  return { count: deals.length, amountCents: deals.reduce((sum, d) => sum + d.amountCents, 0) }
}

/**
 * Delivery day by day for the current billing month, summed over campaigns.
 * The month and not a rolling window, because the balance the client is reading
 * next to it runs to the end of the month too.
 */
export function getDelivery(campaignId?: string | null) {
  const from = getState().subscription.period + '-01'
  const rows = getState()
    .dailyDeliveries.filter((d) => (campaignId ? d.campaignId === campaignId : true))
    .filter((d) => d.date >= from)
  const byDate = new Map<string, { delivered: number; target: number }>()
  for (const row of rows) {
    const at = byDate.get(row.date) ?? { delivered: 0, target: 0 }
    byDate.set(row.date, { delivered: at.delivered + row.delivered, target: at.target + row.target })
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }))
}

/** The newest simulation for a campaign's current gate version. */
export function getFeasibility(campaignId: string) {
  const gates = getGateSet(campaignId)
  if (!gates) return null
  return (
    getState()
      .feasibilityRuns.filter((f) => f.gateSetId === gates.id)
      .sort((a, b) => b.ranAt.localeCompare(a.ranAt))[0] ?? null
  )
}

export const VERDICTS: Verdict[] = ['qualified', 'below_threshold', 'knockout_fail', 'off_niche', 'hard_fail']

export const VERDICT_LABEL: Record<Verdict, string> = {
  qualified: 'Became a lead',
  below_threshold: 'Under your pass mark',
  knockout_fail: 'Failed a deal breaker',
  off_niche: 'Not in a niche you want',
  hard_fail: 'Too small or too quiet',
}

/** Where profiles died, per campaign. The simulator and the gates editor read it. */
export function getVerdictCounts(campaignId: string): { verdict: Verdict; count: number }[] {
  const rows = getState().evaluations.filter((e) => e.campaignId === campaignId)
  return VERDICTS.map((verdict) => ({ verdict, count: rows.filter((e) => e.verdict === verdict).length }))
}
