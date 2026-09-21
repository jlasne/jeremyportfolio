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
  TemplateId,

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
  SAMPLE_TAGS,
} from '../mock/pipeline'
import type { Proposal } from './propose'
import { describeChanges } from './tuning'
import { simulate, type Lever, type SimResult } from './simulate'
import { loosens, type Door } from './pool'

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
  /**
   * Every tag the account has made, in the order they made them. Kept beside
   * the leads and not derived from them, so a tag can exist before anything
   * carries it and survives the last lead losing it.
   */
  tags: string[]
  /**
   * How much was looked at, day by day, and how much of it qualified. Empty
   * on the sample, which counts its own evaluations instead; filled from the
   * server on a real account, where most of what we scored never became a
   * lead and so is not in this browser at all.
   */
  activity: import('./index').ActivityDay[]
  /** Status changes the client made. Null means work it out locally. */
  crmUpdates: number | null
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
    // The sample arrives filed the way an account files itself after a month
    // of use. An empty account starts with none and makes its own.
    tags: SAMPLE_TAGS,
    activity: [],
    crmUpdates: null,
  }
}

/**
 * Sends a change to the server when this browser is on a real account.
 *
 * The screen has already moved: every mutation below writes to the local
 * state first and calls this afterwards, so the list never waits on a
 * network. A failure is swallowed on purpose, because the alternative is a
 * row that silently jumps back under the cursor; the next load reads the
 * server and the truth wins then.
 *
 * On the sample account this does nothing at all, and the sample is what a
 * visitor without a key is looking at.
 */
function push(send: (api: typeof import('../lib/api').api) => Promise<unknown>): void {
  void import('../lib/api').then(({ api, isLive }) => {
    if (!isLive()) return
    send(api).catch((e) => console.warn('brandmatch: that change did not reach the server.', e))
  })
}

/**
 * The whole brief, after a change to any part of it.
 *
 * The server takes the two answers and the handles together, so a change to
 * one of them sends all three. Reading them back out of the state rather than
 * passing them in keeps the four callers honest: whatever the screen shows is
 * what the server is told.
 */
function pushBrief(campaignId: string): void {
  push((api) => {
    const campaign = getState().campaigns.find((c) => c.id === campaignId)
    if (!campaign) return Promise.resolve()
    return api.patchCampaign(campaignId, {
      brief: {
        audience: campaign.brief.audience,
        offer: campaign.brief.offer,
        ...(campaign.brief.seeds?.length ? { seeds: campaign.brief.seeds } : {}),
      },
    })
  })
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
  push((api) => api.moveLead(leadId, to, lostReason))
}

/**
 * Undoes the last status change on a lead. People click the wrong row, and a
 * list built for one click needs one click back out of it.
 */
export function undoMove(leadId: string): void {
  let undone = false
  setState((s) => {
    const events = s.leadEvents.filter((e) => e.leadId === leadId).sort((a, b) => a.at.localeCompare(b.at))
    const last = events[events.length - 1]
    // The delivery event is the lead existing at all. There is no undoing that.
    if (!last || !last.from) return {}
    undone = true
    return {
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, status: last.from!, statusAt: last.at } : l)),
      leadEvents: s.leadEvents.filter((e) => e.id !== last.id),
    }
  })
  if (undone) push((api) => api.undoLead(leadId))
}

/**
 * Any move that lets more people through is written down as a door.
 *
 * The rules in force when the first one opened are kept whole, and every lead
 * handed over afterwards is measured against them. Without this the widening
 * is invisible: the list looks the same and the reply rate simply drifts.
 */
function noteDoor(s: State, campaignId: string, id: string, label: string, niches?: Niche[]): Campaign[] {
  const at = new Date().toISOString()
  return s.campaigns.map((c) => {
    if (c.id !== campaignId) return c
    const from = c.widened ?? { fromGateSetId: c.gateSetId, fromNiches: c.extracted.niches, doors: [] }
    return {
      ...c,
      widened: { ...from, doors: [...from.doors, { id, label, openedAt: at }] },
      ...(niches ? { extracted: { ...c.extracted, niches } } : {}),
      updatedAt: at,
    }
  })
}

/**
 * The niche list is the client's. Adding, renaming, switching one off or giving
 * it its own numbers all land here, and all of them change who gets found.
 *
 * Switching one back on is a widening like any other, so it is written down.
 */
export function setNiches(campaignId: string, niches: Niche[]): void {
  const now = new Date().toISOString()
  // The niches are the search queries. A change that stays in this browser
  // changes nothing about what gets looked for tonight.
  push((api) => api.patchCampaign(campaignId, { niches }))
  setState((s) => {
    const campaign = s.campaigns.find((c) => c.id === campaignId)
    if (!campaign) return {}
    const before = new Set(campaign.extracted.niches.filter((n) => n.enabled).map((n) => n.id))
    const added = niches.filter((n) => n.enabled && !before.has(n.id))
    if (added.length) {
      return {
        campaigns: noteDoor(
          s,
          campaignId,
          `niche_${added[0].id}`,
          `Niches: ${added.map((n) => n.label).join(', ')} switched on`,
          niches,
        ),
      }
    }
    return {
      campaigns: s.campaigns.map((c) =>
        c.id === campaignId ? { ...c, extracted: { ...c.extracted, niches }, updatedAt: now } : c,
      ),
    }
  })
}

/**
 * Takes one of the ways out. It writes a gate version like any other edit, so
 * the history says what was opened and when, and the leads that follow carry
 * the mark.
 */
export function openDoor(campaignId: string, door: Door): void {
  const s = getState()
  const campaign = s.campaigns.find((c) => c.id === campaignId)
  const gates = s.gateSets.find((g) => g.id === campaign?.gateSetId)
  if (!campaign || !gates) return
  setState((st) => ({ campaigns: noteDoor(st, campaignId, door.id, door.label, door.next.niches) }))
  // A door that only turns a slice back on has no numbers to write.
  if (JSON.stringify(door.next.hard) === JSON.stringify(gates.hard)) return
  saveGateSet(
    campaignId,
    {
      hard: door.next.hard,
      knockouts: gates.knockouts,
      criteria: gates.criteria,
      passScore: gates.passScore,
      preset: 'custom',
    },
    'mem_1',
    true,
  )
}

/**
 * Puts the first rules back. The leads already handed over keep their mark,
 * because they did arrive under the wider rules and pretending otherwise would
 * rewrite the client's own history.
 */
export function closeDoors(campaignId: string): void {
  const s = getState()
  const campaign = s.campaigns.find((c) => c.id === campaignId)
  const first = campaign?.widened ? s.gateSets.find((g) => g.id === campaign.widened!.fromGateSetId) : null
  if (!campaign?.widened || !first) return
  const niches = campaign.widened.fromNiches
  const at = new Date().toISOString()
  setState((st) => ({
    campaigns: st.campaigns.map((c) =>
      c.id === campaignId
        ? { ...c, widened: undefined, extracted: { ...c.extracted, niches }, updatedAt: at }
        : c,
    ),
  }))
  saveGateSet(
    campaignId,
    {
      hard: first.hard,
      knockouts: first.knockouts,
      criteria: first.criteria,
      passScore: first.passScore,
      preset: first.preset,
    },
    'mem_1',
    true,
  )
}

/** A tag as it is stored: trimmed, one space between words, lower case. */
export function cleanTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 24).toLowerCase()
}

/** Makes a tag that nothing carries yet, so it can be filed against later. */
export function createTag(raw: string): void {
  const tag = cleanTag(raw)
  if (!tag) return
  setState((s) => (s.tags.includes(tag) ? {} : { tags: [...s.tags, tag] }))
}

/** Puts a tag on a lead, making it first if it is new. */
export function tagLead(leadId: string, raw: string): void {
  const tag = cleanTag(raw)
  if (!tag) return
  setState((s) => ({
    tags: s.tags.includes(tag) ? s.tags : [...s.tags, tag],
    leads: s.leads.map((l) =>
      l.id === leadId && !(l.tags ?? []).includes(tag) ? { ...l, tags: [...(l.tags ?? []), tag] } : l,
    ),
  }))
  push((api) => api.tagLead(leadId, { add: [tag] }))
}

export function untagLead(leadId: string, tag: string): void {
  setState((s) => ({
    leads: s.leads.map((l) => (l.id === leadId ? { ...l, tags: (l.tags ?? []).filter((t) => t !== tag) } : l)),
  }))
  push((api) => api.tagLead(leadId, { remove: [tag] }))
}

/** Renames a tag everywhere at once. A tag is one thing, in one place. */
export function renameTag(from: string, raw: string): void {
  const to = cleanTag(raw)
  if (!to || to === from) return
  for (const l of getState().leads) {
    if (!(l.tags ?? []).includes(from)) continue
    push((api) => api.tagLead(l.id, { add: [to], remove: [from] }))
  }
  setState((s) => ({
    tags: [...new Set(s.tags.map((t) => (t === from ? to : t)))],
    leads: s.leads.map((l) =>
      (l.tags ?? []).includes(from) ? { ...l, tags: [...new Set((l.tags ?? []).map((t) => (t === from ? to : t)))] } : l,
    ),
  }))
}

/** Deletes a tag, and takes it off every lead carrying it. */
export function deleteTag(tag: string): void {
  for (const l of getState().leads) {
    if ((l.tags ?? []).includes(tag)) push((api) => api.tagLead(l.id, { remove: [tag] }))
  }
  setState((s) => ({
    tags: s.tags.filter((t) => t !== tag),
    leads: s.leads.map((l) => ((l.tags ?? []).includes(tag) ? { ...l, tags: (l.tags ?? []).filter((t) => t !== tag) } : l)),
  }))
}

/** Kept across campaigns. A plain flag: it says nothing about the deal. */
export function toggleSaved(leadId: string): void {
  let saved = false
  setState((s) => {
    saved = !s.leads.find((l) => l.id === leadId)?.saved
    return { leads: s.leads.map((l) => (l.id === leadId ? { ...l, saved } : l)) }
  })
  push((api) => api.markLead(leadId, { saved }))
}

export function setNote(leadId: string, note: string): void {
  setState((s) => ({
    leads: s.leads.map((l) => (l.id === leadId ? { ...l, note } : l)),
  }))
  push((api) => api.markLead(leadId, { note }))
}

/** A signed lead gets an amount. Kept separate: one lead can sign twice. */
export function recordDeal(leadId: string, amountCents: number, note?: string): void {
  push((api) => api.recordDeal(leadId, amountCents, note))
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
/**
 * A campaign, on the server when there is one.
 *
 * The ids come from the server, because everything written afterwards, the
 * rules, the niches, the handles, addresses the campaign by id. A local id
 * would make every one of those calls answer 404 while the screen looked
 * perfectly correct: the campaign would live in one browser and the pipeline
 * would never hear about it.
 *
 * On the sample the ids are made here, as they always were.
 */
export async function createCampaign(brief: CampaignBrief, proposal: Proposal, name: string): Promise<string> {
  const now = new Date().toISOString()
  let id = `cmp_${Math.random().toString(36).slice(2, 9)}`
  let gateSetId = `gate_${id}_v1`

  const { api, isLive } = await import('../lib/api')
  if (isLive()) {
    const made = await api.createCampaign({
      name,
      audience: brief.audience,
      offer: brief.offer,
      ...(brief.seeds?.length ? { seeds: brief.seeds } : {}),
    })
    id = made.campaign.id
    gateSetId = `${id}_v1`
    // The rules and the readings, in the order the server stores them.
    await api.patchCampaign(id, {
      status: 'live',
      extracted: {
        countries: proposal.countries,
        languages: proposal.languages,
        templateId: proposal.templateId,
      },
      niches: proposal.niches,
    })
    await api.saveGates(id, {
      templateId: proposal.templateId,
      hard: proposal.hard,
      knockouts: proposal.knockouts,
      criteria: proposal.criteria,
      passScore: proposal.passScore,
      preset: 'balanced',
      changes: ['Proposed from the brief'],
    })
  }

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
  /** True when the caller has already written the door down. */
  noted = false,
): void {
  const now = new Date().toISOString()
  let live = false
  let templateId: TemplateId | undefined
  setState((s) => {
    const campaign = s.campaigns.find((c) => c.id === campaignId)
    const current = s.gateSets.find((g) => g.id === campaign?.gateSetId)
    if (!campaign || !current) return {}
    live = campaign.status === 'live'
    templateId = current.templateId
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
    // An edit that lets more people through is a door, wherever it was made.
    // The editor and the two screens that offer a way out all land here, so
    // the mark on a lead does not depend on which screen the client used.
    const opened =
      !noted &&
      loosens(
        { hard: current.hard, passScore: current.passScore, niches: campaign.extracted.niches },
        { hard: draft.hard, passScore: draft.passScore, niches: campaign.extracted.niches },
      )
    const campaigns = opened
      ? noteDoor(s, campaignId, `v${version}`, next.changes.slice(0, 2).join(', ') || 'Rules widened')
      : s.campaigns
    return {
      gateSets: [...s.gateSets, next],
      campaigns: campaigns.map((c) => (c.id === campaignId ? { ...c, gateSetId: id, updatedAt: now } : c)),
    }
  })
  push((api) => api.saveGates(campaignId, {
    templateId,
    hard: draft.hard,
    knockouts: draft.knockouts,
    criteria: draft.criteria,
    passScore: draft.passScore,
    preset: draft.preset,
    by,
  }))
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
  // The server runs the same walk over the real pool. On a live account its
  // answer is the one worth keeping, and it is the one the next load reads.
  push((api) => api.feasibility(campaignId))
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

/** The split of the day between campaigns. Null means share whatever is left. */
export function setDailyCap(campaignId: string, cap: number | null): void {
  setState((s) => ({
    campaigns: s.campaigns.map((c) =>
      c.id === campaignId
        ? { ...c, dailyCap: cap === null ? null : Math.max(0, Math.round(cap)), updatedAt: new Date().toISOString() }
        : c,
    ),
  }))
  push((api) => api.patchCampaign(campaignId, { dailyCap: cap }))
}

/**
 * More handles, from the client, after the campaign started. The highest
 * value input there is, and the one way of searching that only the client
 * can refill.
 */
export function addSeeds(campaignId: string, handles: string[]): void {
  setState((s) => ({
    campaigns: s.campaigns.map((c) => {
      if (c.id !== campaignId) return c
      const had = new Set(c.brief.seeds ?? [])
      const fresh = handles.map((h) => h.replace(/^@/, '').trim().toLowerCase()).filter((h) => h && !had.has(h))
      if (!fresh.length) return c
      return { ...c, brief: { ...c.brief, seeds: [...(c.brief.seeds ?? []), ...fresh] }, updatedAt: new Date().toISOString() }
    }),
  }))
  // The handles are what the neighbour search walks out from, so they belong
  // on the server before tonight, not in this tab.
  pushBrief(campaignId)
}

/** Drops a handle the client gave us. Nothing else about the campaign moves. */
export function removeSeed(campaignId: string, handle: string): void {
  setState((s) => ({
    campaigns: s.campaigns.map((c) =>
      c.id === campaignId
        ? { ...c, brief: { ...c.brief, seeds: (c.brief.seeds ?? []).filter((h) => h !== handle) }, updatedAt: new Date().toISOString() }
        : c,
    ),
  }))
  pushBrief(campaignId)
}

/**
 * The two answers, rewritten. Kept word for word, and never used to rewrite
 * the rules behind the client's back: an edit here suggests, the client saves.
 */
export function setBrief(campaignId: string, patch: { audience?: string; offer?: string }): void {
  setState((s) => ({
    campaigns: s.campaigns.map((c) =>
      c.id === campaignId
        ? { ...c, brief: { ...c.brief, ...patch, writtenAt: new Date().toISOString() }, updatedAt: new Date().toISOString() }
        : c,
    ),
  }))
  pushBrief(campaignId)
}

/**
 * What we read out of the brief, corrected by the person who wrote it.
 *
 * The countries and the library were a machine's reading of two sentences, and
 * a machine's reading is the thing most worth being able to fix. Niches are not
 * here: they carry their own numbers and are edited with the rules.
 */
export function setExtracted(
  campaignId: string,
  patch: { countries?: string[]; languages?: string[]; templateId?: TemplateId },
): void {
  setState((s) => ({
    campaigns: s.campaigns.map((c) =>
      c.id === campaignId
        ? { ...c, extracted: { ...c.extracted, ...patch, extractedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() }
        : c,
    ),
  }))
  push((api) => {
    const campaign = getState().campaigns.find((c) => c.id === campaignId)
    return api.patchCampaign(campaignId, {
      extracted: {
        countries: campaign?.extracted.countries ?? [],
        languages: campaign?.extracted.languages ?? [],
        templateId: campaign?.extracted.templateId,
      },
    })
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
    setState({
      live: true, ...loaded, topups: [], quotaEntries: [], claims: [],
      tags: loaded.tags ?? [], activity: loaded.activity ?? [], crmUpdates: loaded.crmUpdates ?? null,
    })
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
