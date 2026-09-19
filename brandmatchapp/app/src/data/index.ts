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
  Reach,
  Subscription,
  Verdict,
} from '../types'
import { indexOfCreator, postsFor } from '../mock/creators'
import { fitPercent } from '../lib/format'
import { survey, type FirstRules, type Survey } from './pool'
import { getState, getVersion } from './store'
import { rank, WALK } from './status'

// Every read a screen makes goes through here. One rule holds for the whole
// file: it only ever touches the client store, which carries no cost, no
// analysed volume and no fair use figure. A screen cannot leak what it cannot
// reach.

export function getAccount(): Account {
  return getState().account
}

/** Which account is loaded and how many leads it holds. Changes on a swap or a delivery, never on a click. */
export function getAccountShape(): { live: boolean; leadCount: number } {
  const s = getState()
  return { live: s.live, leadCount: s.leads.length }
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

/**
 * The posts a creator's numbers were measured from, regenerated on demand.
 * Holding every post for every profile would be a hundred thousand objects
 * nobody looks at.
 */
export function getPosts(creatorId: string) {
  const at = indexOfCreator.get(creatorId)
  return at === undefined ? [] : postsFor(at)
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

// ---------------------------------------------------------------------------
// How much room is left, and the ways out of it
// ---------------------------------------------------------------------------

let surveyCache: { version: number; id: string; out: Survey } | null = null

/**
 * How much room a campaign has left, with every way out priced.
 *
 * Held against the store version because answering it means running the whole
 * sample once per way out, and three screens ask for it.
 */
export function getSurvey(campaignId: string): Survey | null {
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  if (!campaign || !gates) return null
  const version = getVersion()
  if (surveyCache && surveyCache.version === version && surveyCache.id === campaignId) return surveyCache.out
  const delivered = getState().leads.filter((l) => l.campaignId === campaignId).length
  const tier = getSubscription().tier
  const out = survey(campaign, gates, delivered, campaign.dailyCap ?? tier, tier)
  surveyCache = { version, id: campaignId, out }
  return out
}

/** The rules a campaign agreed to before it opened anything, when it has. */
export function getFirstRules(campaignId: string): FirstRules | null {
  const campaign = getCampaign(campaignId)
  if (!campaign?.widened) return null
  const gates = getState().gateSets.find((g) => g.id === campaign.widened!.fromGateSetId)
  return gates ? { gates, niches: campaign.widened.fromNiches } : null
}

export type LeadSort = 'fit' | 'newest' | 'status'

export interface LeadQuery {
  campaignId?: string | null
  status?: LeadStatus | null
  search?: string
  /** Only people this big or bigger. */
  followersMin?: number | null
  followersMax?: number | null
  /** Only people who scored this share or better, in percent of the ceiling. */
  fitMin?: number | null
  fitMax?: number | null
  /** Views on a typical post, counted from their last twelve. */
  viewsMin?: number | null
  viewsMax?: number | null
  /** How often they post. */
  postsMin?: number | null
  /** Only people whose email is on their profile. */
  withEmail?: boolean
  /** Handed over inside this many days. */
  addedWithinDays?: number | null
  /** Carrying any one of these tags. */
  tags?: string[]
  savedOnly?: boolean
  /** Inside the rules you started with, or past them. */
  reach?: Reach | null
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
    .filter((r) => (query.reach ? (r.lead.reach ?? 'core') === query.reach : true))
    .filter((r) => (query.followersMin ? r.creator.followers >= query.followersMin : true))
    .filter((r) => (query.followersMax ? r.creator.followers <= query.followersMax : true))
    .filter((r) => (query.fitMin ? fitOf(r) >= query.fitMin : true))
    .filter((r) => (query.fitMax != null ? fitOf(r) <= query.fitMax : true))
    .filter((r) => (query.viewsMin ? (r.creator.medianViews ?? 0) >= query.viewsMin : true))
    .filter((r) => (query.viewsMax != null ? (r.creator.medianViews ?? 0) <= query.viewsMax : true))
    .filter((r) => (query.postsMin ? (r.creator.postsPerMonth ?? 0) >= query.postsMin : true))
    .filter((r) => (query.withEmail ? Boolean(r.creator.email) : true))
    .filter((r) =>
      query.addedWithinDays
        ? Date.now() - new Date(r.lead.deliveredAt).getTime() <= query.addedWithinDays * 86_400_000
        : true,
    )
    .filter((r) => (query.tags?.length ? (r.lead.tags ?? []).some((t) => query.tags!.includes(t)) : true))
    .filter((r) =>
      term
        ? r.creator.handle.toLowerCase().includes(term) || r.creator.name.toLowerCase().includes(term)
        : true,
    )
    .sort((a, b) => {
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

/** The score as a share of its own ceiling, which is what the filter reads. */
export function fitOf(row: LeadRow): number {
  return fitPercent(row.lead.score, row.evaluation.criteriaScores.length * 2 || 14)
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

/**
 * The account's tags, with how many leads carry each one.
 *
 * Read from the tag list and not from the leads, so a tag made and not yet
 * used still appears. A tag nothing carries is a tag you are about to use.
 */
export function getTags(): { name: string; count: number }[] {
  const s = getState()
  const count = new Map<string, number>()
  for (const l of s.leads) for (const t of l.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1)
  return s.tags.map((name) => ({ name, count: count.get(name) ?? 0 }))
}
