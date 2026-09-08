import type {
  Agent, Brief, BriefAnswer, Creator, DailyStat, FilterKey, Filters, FollowUpQuestion, Post, SavedList, Score, Settings, Signal, Stars,
} from '../types'
import { defaultFilters } from '../mock/filters'
import { followUpQuestions } from '../mock/questions'
import { timezones as mockTimezones } from '../mock/settings'
import { toCsv } from '../lib/csv'
import { absolute, isNewToday, withinDays } from '../lib/format'
import { CRITERIA, latestSignal, scoreOf } from './score'
import { getState, resetState, setState } from './store'

// Every screen reads and writes through these functions.
// They work on the in memory store today and will call the real source later.

export { CRITERIA, scoreOf } from './score'

// Feed --------------------------------------------------------------------

export interface Lead {
  creator: Creator
  score: Score
  latestSignal: Signal | null
  isNew: boolean
  isSaved: boolean
  isRejected: boolean
  agent: Agent | null
}

/** 2 or 3 stars. The leads worth a message today. */
export function isHigh(score: Score): boolean {
  return score.stars >= 2
}

function passes(c: Creator, f: Filters, now: Date): boolean {
  if (c.followers < f.followersMin || c.followers > f.followersMax) return false
  if (c.engagementRate < f.engagementMin) return false
  if (f.reelViewsMin !== null && c.medianReelViews < f.reelViewsMin) return false
  if (f.emailInBio === 'yes' && !c.email) return false
  if (!withinDays(c.lastPostAt, f.lastPostWithin, now)) return false
  if (c.postsPerMonth < f.postsPerMonthMin) return false
  if (f.countries.length && !f.countries.includes(c.country)) return false
  if (f.languages.length && !f.languages.includes(c.language)) return false
  return true
}

function toLead(c: Creator, now: Date): Lead {
  const s = getState()
  return {
    creator: c,
    score: scoreOf(c, now),
    latestSignal: latestSignal(c),
    isNew: isNewToday(c.firstSeenAt, now),
    isSaved: s.lists.some((l) => l.creatorIds.includes(c.id)),
    isRejected: s.rejections.some((r) => r.creatorId === c.id),
    agent: s.agents.find((a) => a.id === c.agentId) ?? null,
  }
}

function sortLeads(a: Lead, b: Lead): number {
  if (b.score.stars !== a.score.stars) return b.score.stars - a.score.stars
  const ad = a.latestSignal?.date ?? ''
  const bd = b.latestSignal?.date ?? ''
  if (ad !== bd) return bd.localeCompare(ad)
  return b.creator.followers - a.creator.followers
}

/** Every lead ever gathered, rejected ones included. The dashboard counts from here. */
export function getAllLeads(now = new Date()): Lead[] {
  return getState().creators.map((c) => toLead(c, now)).sort(sortLeads)
}

/** The feed: visible leads, filtered, sorted best first. Rejected leads never return. */
export function getFeed(filters: Filters = getState().filters, now = new Date()): Lead[] {
  const s = getState()
  const rejected = new Set(s.rejections.map((r) => r.creatorId))
  return s.creators
    .filter((c) => !rejected.has(c.id) && passes(c, filters, now))
    .map((c) => toLead(c, now))
    .sort(sortLeads)
}

export interface FilterDiagnosis {
  key: FilterKey
  label: string
  /** How many leads come back if this one filter goes to its default. */
  restored: number
}

/** When nothing passes, find the filter cutting the most. */
export function diagnoseEmptyFeed(): FilterDiagnosis | null {
  const f = getState().filters
  const keys: { key: FilterKey; label: string }[] = [
    { key: 'followersMin', label: 'Followers minimum' },
    { key: 'followersMax', label: 'Followers maximum' },
    { key: 'engagementMin', label: 'Engagement rate minimum' },
    { key: 'reelViewsMin', label: 'Median reel views minimum' },
    { key: 'emailInBio', label: 'Email in bio' },
    { key: 'lastPostWithin', label: 'Last post' },
    { key: 'postsPerMonthMin', label: 'Posts per month minimum' },
    { key: 'countries', label: 'Country' },
    { key: 'languages', label: 'Language' },
  ]
  let best: FilterDiagnosis | null = null
  for (const k of keys) {
    const loosened = { ...f, [k.key]: defaultFilters[k.key] } as Filters
    if (k.key === 'lastPostWithin') loosened.lastPostWithin = 90
    const restored = getFeed(loosened).length
    if (restored > (best?.restored ?? 0)) best = { key: k.key, label: k.label, restored }
  }
  return best
}

// Dashboard ----------------------------------------------------------------

export interface Dashboard {
  /** Leads first seen in the last 24 hours. */
  today: number
  /** Leads at 2 or 3 stars, all time. */
  high: number
  /** Every lead gathered, all time. */
  total: number
  /** Profiles crawled today. */
  gatheredToday: number
  /** 14 days of crawl output, newest last. */
  daily: DailyStat[]
  /** How many leads sit at each star count. */
  byStars: Record<Stars, number>
  /** How many leads earned each criterion. */
  byCriterion: { key: string; label: string; means: string; count: number }[]
}

export function getDashboard(now = new Date()): Dashboard {
  const leads = getAllLeads(now)
  const daily = getState().daily
  const byStars: Record<Stars, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (const l of leads) byStars[l.score.stars]++
  const byCriterion = CRITERIA.map((c) => ({
    key: c.key,
    label: c.label,
    means: c.means,
    count: leads.filter((l) => l.score[c.key]).length,
  }))
  return {
    today: leads.filter((l) => l.isNew).length,
    high: leads.filter((l) => isHigh(l.score)).length,
    total: leads.length,
    gatheredToday: daily.length ? daily[daily.length - 1].gathered : 0,
    daily,
    byStars,
    byCriterion,
  }
}

// Agents -------------------------------------------------------------------

export function getAgents(): Agent[] {
  return getState().agents
}

export function getAgent(id: string): Agent | null {
  return getState().agents.find((a) => a.id === id) ?? null
}

export function updateAgent(id: string, patch: Partial<Agent>): void {
  setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
}

export function updateAgentFilters(id: string, patch: Partial<Filters>): void {
  setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, filters: { ...a.filters, ...patch } } : a)) }))
}

export function createAgent(name: string): Agent {
  const agent: Agent = {
    id: `a${Date.now()}`,
    name: name.trim() || 'Untitled agent',
    brief: { who: '', answers: [], summary: 'No brief yet.' },
    filters: { ...defaultFilters, countries: [], languages: [] },
    leadsPerDay: 20,
    runAt: '07:00',
    active: true,
    createdAt: new Date().toISOString(),
  }
  setState((s) => ({ agents: [...s.agents, agent] }))
  return agent
}

export function deleteAgent(id: string): void {
  setState((s) => ({ agents: s.agents.filter((a) => a.id !== id) }))
}

export interface Group {
  agent: Agent
  leads: Lead[]
  high: number
  today: number
}

/** Leads grouped by the agent that found them. */
export function getGroups(now = new Date()): Group[] {
  const leads = getAllLeads(now)
  return getState().agents.map((agent) => {
    const mine = leads.filter((l) => l.creator.agentId === agent.id)
    return {
      agent,
      leads: mine,
      high: mine.filter((l) => isHigh(l.score)).length,
      today: mine.filter((l) => l.isNew).length,
    }
  })
}

// Contacts -----------------------------------------------------------------

/** Every lead with an email found. These are the ones a brand can reach today. */
export function getContacts(now = new Date()): Lead[] {
  return getAllLeads(now).filter((l) => l.creator.email !== null && !l.isRejected)
}

// One creator --------------------------------------------------------------

export function getCreator(id: string): Creator | null {
  return getState().creators.find((c) => c.id === id) ?? null
}

export function getLead(id: string): Lead | null {
  const c = getCreator(id)
  return c ? toLead(c, new Date()) : null
}

export function getPosts(creatorId: string): Post[] {
  return getState().posts[creatorId] ?? []
}

// Lists -----------------------------------------------------------------------

export function getLists(): SavedList[] {
  return getState().lists
}

export function getList(id: string): SavedList | null {
  return getState().lists.find((l) => l.id === id) ?? null
}

export function createList(name: string): SavedList {
  const list: SavedList = { id: `l${Date.now()}`, name: name.trim() || 'Untitled list', creatorIds: [], createdAt: new Date().toISOString() }
  setState((s) => ({ lists: [...s.lists, list] }))
  return list
}

export function saveToList(creatorId: string, listId: string): void {
  setState((s) => ({
    lists: s.lists.map((l) => (l.id === listId && !l.creatorIds.includes(creatorId) ? { ...l, creatorIds: [...l.creatorIds, creatorId] } : l)),
  }))
}

export function removeFromList(creatorId: string, listId: string): void {
  setState((s) => ({
    lists: s.lists.map((l) => (l.id === listId ? { ...l, creatorIds: l.creatorIds.filter((id) => id !== creatorId) } : l)),
  }))
}

export function listsFor(creatorId: string): SavedList[] {
  return getState().lists.filter((l) => l.creatorIds.includes(creatorId))
}

// Notes and tags -----------------------------------------------------------

export function getNote(creatorId: string): string {
  return getState().notes[creatorId]?.text ?? ''
}

export function setNote(creatorId: string, text: string): void {
  setState((s) => {
    const notes = { ...s.notes }
    if (text.trim()) notes[creatorId] = { creatorId, text, updatedAt: new Date().toISOString() }
    else delete notes[creatorId]
    return { notes }
  })
}

export function getTags(creatorId: string): string[] {
  return getState().tags[creatorId] ?? []
}

export function addTag(creatorId: string, label: string): void {
  const clean = label.trim().toLowerCase()
  if (!clean) return
  setState((s) => {
    const current = s.tags[creatorId] ?? []
    const vocabulary = s.tagVocabulary.includes(clean) ? s.tagVocabulary : [...s.tagVocabulary, clean]
    if (current.includes(clean)) return { tagVocabulary: vocabulary }
    return { tags: { ...s.tags, [creatorId]: [...current, clean] }, tagVocabulary: vocabulary }
  })
}

export function removeTag(creatorId: string, label: string): void {
  setState((s) => ({ tags: { ...s.tags, [creatorId]: (s.tags[creatorId] ?? []).filter((t) => t !== label) } }))
}

export function toggleTag(creatorId: string, label: string): void {
  if (getTags(creatorId).includes(label)) removeTag(creatorId, label)
  else addTag(creatorId, label)
}

/** The labels offered when tagging. Free text adds to this list. */
export function getTagVocabulary(): string[] {
  return getState().tagVocabulary
}

export function addToVocabulary(label: string): void {
  const clean = label.trim().toLowerCase()
  if (!clean) return
  setState((s) => (s.tagVocabulary.includes(clean) ? {} : { tagVocabulary: [...s.tagVocabulary, clean] }))
}

export function removeFromVocabulary(label: string): void {
  setState((s) => ({
    tagVocabulary: s.tagVocabulary.filter((t) => t !== label),
    tags: Object.fromEntries(Object.entries(s.tags).map(([k, v]) => [k, v.filter((t) => t !== label)])),
  }))
}

export function countTagged(label: string): number {
  return Object.values(getState().tags).filter((list) => list.includes(label)).length
}

/** Tags in use, sorted. */
export function getUsedTags(): string[] {
  return Array.from(new Set(Object.values(getState().tags).flat())).sort()
}

// Reject -----------------------------------------------------------------------

export function reject(creatorId: string): void {
  setState((s) => (s.rejections.some((r) => r.creatorId === creatorId) ? {} : { rejections: [...s.rejections, { creatorId, date: new Date().toISOString() }] }))
}

export function unreject(creatorId: string): void {
  setState((s) => ({ rejections: s.rejections.filter((r) => r.creatorId !== creatorId) }))
}

export function isRejected(creatorId: string): boolean {
  return getState().rejections.some((r) => r.creatorId === creatorId)
}

// Export -----------------------------------------------------------------------

export function exportCsv(creatorIds: string[]): string {
  const rows = creatorIds
    .map((id) => getLead(id))
    .filter((l): l is Lead => l !== null)
    .map(({ creator: c, score, latestSignal: sig, agent }) => ({
      name: c.name,
      handle: c.handle,
      url: `https://instagram.com/${c.handle}`,
      stars: score.stars,
      niche: score.niche ? 'yes' : 'no',
      selling: c.sells || 'nothing',
      signal_fresh: score.intent ? 'yes' : 'no',
      why: score.why,
      signal: sig?.label ?? '',
      signal_date: sig ? absolute(sig.date) : '',
      followers: c.followers,
      engagement_rate: (c.engagementRate * 100).toFixed(1) + '%',
      median_reel_views: c.medianReelViews,
      posts_per_month: c.postsPerMonth,
      last_post: absolute(c.lastPostAt),
      country: c.country,
      language: c.language,
      email: c.email,
      bio: c.bio,
      agent: agent?.name ?? '',
      note: getNote(c.id),
      tags: getTags(c.id).join('; '),
      lists: listsFor(c.id).map((l) => l.name).join('; '),
      rejected: isRejected(c.id) ? 'yes' : 'no',
    }))
  return toCsv(rows)
}

// Brief and onboarding ------------------------------------------------

export function getBrief(): Brief | null {
  return getState().brief
}

/** The 3 follow up questions for a first answer. Fixed in the mock, generated for real later. */
export function getFollowUpQuestions(_who: string): FollowUpQuestion[] {
  return followUpQuestions
}

export function buildSummary(who: string, answers: BriefAnswer[]): string {
  const clean = who.trim().replace(/\.$/, '')
  const lead = clean.charAt(0).toLowerCase() + clean.slice(1)
  const parts = [lead]
  const get = (id: string) => answers.find((a) => a.questionId === id)?.value?.trim().toLowerCase()
  const sells = get('sells')
  const content = get('content')
  const audience = get('audience')
  const mentioned = (phrase: string) => phrase.split(/\s+/).some((w) => w.length > 3 && lead.includes(w))
  if (sells && sells !== 'anything' && !(/sell/.test(lead) && mentioned(sells))) {
    const article = /^(an?|the) /.test(sells) ? '' : /^[aeiou]/.test(sells) ? 'an ' : 'a '
    parts.push(`sell ${article}${sells}`)
  }
  if (content && !mentioned(content)) parts.push(`${content.replace(/ tutorials$/, '')} content`)
  if (audience && !mentioned(audience)) parts.push(`audience of ${audience}`)
  return `Looking for: ${parts.join(', ')}.`
}

export function setBrief(who: string, answers: BriefAnswer[]): Brief {
  const b: Brief = { who: who.trim(), answers, summary: buildSummary(who, answers) }
  setState((s) => ({ brief: b, agents: s.agents.map((a, i) => (i === 0 ? { ...a, brief: b } : a)) }))
  return b
}

// Filters ---------------------------------------------------------------------

export function getFilters(): Filters {
  return getState().filters
}

export function setFilters(patch: Partial<Filters>): void {
  setState((s) => ({ filters: { ...s.filters, ...patch } }))
}

export function resetFilter(key: FilterKey): void {
  const value = key === 'lastPostWithin' ? 90 : defaultFilters[key]
  setState((s) => ({ filters: { ...s.filters, [key]: value } }))
}

export function resetFilters(): void {
  setState({ filters: { ...defaultFilters, countries: [], languages: [] } })
}

export function getDefaultFilters(): Filters {
  return defaultFilters
}

// Settings -----------------------------------------------------------------------

export function getSettings(): Settings {
  return getState().settings
}

export function setSettings(patch: Partial<Settings>): void {
  setState((s) => ({ settings: { ...s.settings, ...patch } }))
}

export function getTimezones(): string[] {
  return mockTimezones
}

export function restartOnboarding(): void {
  resetState()
  setState((s) => ({ brief: null, settings: { ...s.settings, onboarded: false } }))
}

// First run -------------------------------------------------------------------

export interface CrawlProgress {
  found: number
  scored: number
  done: boolean
}

/**
 * The first batch. In the mock it fakes progress over about 8 seconds and ends with the feed ready.
 * The real version calls the crawl and reports the same progress shape.
 */
export function runFirstCrawl(onProgress: (p: CrawlProgress) => void): () => void {
  const target = 412
  const durationMs = 8_000
  const start = performance.now()
  let handle = 0
  const tick = () => {
    const t = Math.min(1, (performance.now() - start) / durationMs)
    const found = Math.round(target * Math.min(1, t * 1.35))
    const scored = Math.round(target * Math.max(0, Math.min(1, (t - 0.18) / 0.82)))
    const done = t >= 1
    onProgress({ found, scored: done ? target : scored, done })
    if (!done) handle = window.setTimeout(tick, 120)
    else setState((s) => ({ settings: { ...s.settings, onboarded: true } }))
  }
  tick()
  return () => window.clearTimeout(handle)
}
