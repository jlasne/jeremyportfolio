import type { Agent, Brief, Creator, DailyStat, FilterKey, Filters, Level, Post, Score, Settings, Signal, Stars } from '../types'
import { defaultFilters } from '../mock/filters'
import { timezones as mockTimezones } from '../mock/settings'
import { toCsv } from '../lib/csv'
import { absolute, isNewToday, withinDays } from '../lib/format'
import { BUCKETS, CRITERIA, QUALIFIED_MIN, latestSignal, scoreOf } from './score'
import { getState, setState } from './store'

// Every screen reads and writes through these functions.
// They work on the in memory store today and will call the real source later.

export { BUCKETS, CRITERIA, QUALIFIED_MIN, scoreOf } from './score'

/** Roughly 1 lead in 10 comes back qualified, which is 2 stars or more. */
export const QUALIFIED_RATIO = 10

/** How many of a day's leads come back qualified. */
export function qualifiedFrom(leadsPerDay: number): number {
  return Math.round(leadsPerDay / QUALIFIED_RATIO)
}

// Contacts, the one list ---------------------------------------------------

export interface Contact {
  creator: Creator
  score: Score
  latestSignal: Signal | null
  isNew: boolean
  isRejected: boolean
  isDone: boolean
  agent: Agent | null
}

/** Above 1.5 stars. The contacts worth a message today. */
export function isHigh(score: Score): boolean {
  return score.stars > QUALIFIED_MIN
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

function toContact(c: Creator, now: Date): Contact {
  const s = getState()
  return {
    creator: c,
    score: scoreOf(c, now),
    latestSignal: latestSignal(c),
    isNew: isNewToday(c.firstSeenAt, now),
    isRejected: s.rejections.some((r) => r.creatorId === c.id),
    isDone: s.done.includes(c.id),
    agent: s.agents.find((a) => a.id === c.agentId) ?? null,
  }
}

function byScore(a: Contact, b: Contact): number {
  if (b.score.stars !== a.score.stars) return b.score.stars - a.score.stars
  const ad = a.latestSignal?.date ?? ''
  const bd = b.latestSignal?.date ?? ''
  if (ad !== bd) return bd.localeCompare(ad)
  return b.creator.followers - a.creator.followers
}

/** Everything gathered, rejected included. The dashboard counts from here. */
export function getAllContacts(now = new Date()): Contact[] {
  return getState().creators.map((c) => toContact(c, now)).sort(byScore)
}

export interface ContactQuery {
  /** Empty means every agent. */
  agentIds?: string[]
  tag?: string | null
  minStars?: number
  /** Criteria that must score above zero. */
  mustHave?: ('niche' | 'active' | 'intent')[]
  newOnly?: boolean
  /** Contacts you marked done: hide them, show only them, or show everything. */
  done?: 'hide' | 'only' | 'any'
}

/** The list. Filters cut the volume, the score sets the order. */
export function getContacts(q: ContactQuery = {}, now = new Date(), filters: Filters = getState().filters): Contact[] {
  const s = getState()
  const f = filters
  const rejected = new Set(s.rejections.map((r) => r.creatorId))
  return s.creators
    .filter((c) => !rejected.has(c.id) && passes(c, f, now))
    .map((c) => toContact(c, now))
    .filter((x) => !q.agentIds?.length || q.agentIds.includes(x.creator.agentId))
    .filter((x) => !q.tag || getTags(x.creator.id).includes(q.tag))
    .filter((x) => x.score.stars >= (q.minStars ?? 0))
    .filter((x) => (q.mustHave ?? []).every((k) => x.score[k] > 0))
    .filter((x) => !q.newOnly || x.isNew)
    .filter((x) => (q.done ?? 'hide') === 'any' || (q.done === 'only' ? x.isDone : !x.isDone))
    .sort(byScore)
}

export interface FilterDiagnosis {
  key: FilterKey
  label: string
  /** How many contacts come back if this one filter goes to its default. */
  restored: number
}

/** When nothing passes, find the filter cutting the most. */
export function diagnoseEmpty(): FilterDiagnosis | null {
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
    const restored = getContacts({}, new Date(), loosened).length
    if (restored > (best?.restored ?? 0)) best = { key: k.key, label: k.label, restored }
  }
  return best
}

// Dashboard ----------------------------------------------------------------

export interface Dashboard {
  today: number
  /** Contacts at 2 stars or more. */
  high: number
  total: number
  /** Yesterday's delivery, from the daily series. */
  leadsToday: number
  qualifiedToday: number
  daily: DailyStat[]
  buckets: { label: string; count: number }[]
  byCriterion: { key: string; label: string; full: number; half: number; note: string }[]
}

/** The 14 day series for one agent, or every agent added together. */
export function getDaily(agentId: string | null = null): DailyStat[] {
  const rows = getState().daily
  if (agentId) return rows.filter((r) => r.agentId === agentId)
  const byDate = new Map<string, DailyStat>()
  for (const r of rows) {
    const at = byDate.get(r.date)
    if (at) {
      at.leads += r.leads
      at.gathered += r.gathered
      at.qualified += r.qualified
    } else {
      byDate.set(r.date, { ...r, agentId: 'all' })
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function getDashboard(agentId: string | null = null, now = new Date()): Dashboard {
  const all = getAllContacts(now).filter((c) => !agentId || c.creator.agentId === agentId)
  const daily = getDaily(agentId)
  return {
    today: all.filter((c) => c.isNew).length,
    high: all.filter((c) => isHigh(c.score)).length,
    total: all.length,
    leadsToday: daily.length ? daily[daily.length - 1].leads : 0,
    qualifiedToday: daily.length ? daily[daily.length - 1].qualified : 0,
    daily,
    buckets: BUCKETS.map((b, i) => ({
      label: b.label,
      count: all.filter((c) => c.score.stars >= b.min && (i === 0 || c.score.stars < BUCKETS[i - 1].min)).length,
    })),
    byCriterion: CRITERIA.map((c) => ({
      key: c.key,
      label: c.label,
      note: c.full,
      full: all.filter((x) => x.score[c.key] === 1).length,
      half: all.filter((x) => x.score[c.key] === 0.5).length,
    })),
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

/**
 * What an AI writes after reading a brand's site. The real one calls a model,
 * this one builds the same shape so the screen behaves the same.
 */
export function audienceFromWebsite(website: string): string {
  const domain = website.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  const name = domain.split('.')[0] || 'your brand'
  const label = name.charAt(0).toUpperCase() + name.slice(1)
  return [
    `${label} sells to women who train with weights and want a plan they can follow at home or in a gym.`,
    'The creators who fit are coaches and teachers, not athletes chasing a podium.',
    'They film technique, they answer questions in their comments, and they already sell something of their own: a program, coaching, an ebook or an app.',
    'Their audience is mostly women between 25 and 45 who started lifting in the last two years.',
    'Between 10k and 500k followers, posting at least three times a month, in English.',
  ].join(' ')
}

export function createAgent(): Agent {
  const agent: Agent = {
    id: `a${Date.now()}`,
    name: '',
    website: '',
    brief: { who: '', answers: [], summary: 'No brief yet.' },
    filters: { ...defaultFilters, countries: [], languages: [] },
    leadsPerDay: 200,
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

/** How many contacts each agent found, and how many reach 2 stars. */
export function agentTally(id: string, now = new Date()): { found: number; high: number; today: number } {
  const mine = getAllContacts(now).filter((c) => c.creator.agentId === id)
  return { found: mine.length, high: mine.filter((c) => isHigh(c.score)).length, today: mine.filter((c) => c.isNew).length }
}

// One creator --------------------------------------------------------------

export function getCreator(id: string): Creator | null {
  return getState().creators.find((c) => c.id === id) ?? null
}

export function getContact(id: string): Contact | null {
  const c = getCreator(id)
  return c ? toContact(c, new Date()) : null
}

export function getPosts(creatorId: string): Post[] {
  return getState().posts[creatorId] ?? []
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

// Reject -----------------------------------------------------------------------

export function reject(creatorId: string): void {
  setState((s) => (s.rejections.some((r) => r.creatorId === creatorId) ? {} : { rejections: [...s.rejections, { creatorId, date: new Date().toISOString() }] }))
}

export function unreject(creatorId: string): void {
  setState((s) => ({ rejections: s.rejections.filter((r) => r.creatorId !== creatorId) }))
}

// Done ------------------------------------------------------------------------

export function toggleDone(creatorId: string): void {
  setState((s) => ({ done: s.done.includes(creatorId) ? s.done.filter((id) => id !== creatorId) : [...s.done, creatorId] }))
}

export function countDone(): number {
  return getState().done.length
}

export function isRejected(creatorId: string): boolean {
  return getState().rejections.some((r) => r.creatorId === creatorId)
}

// Export -----------------------------------------------------------------------

const LEVELS: Record<Level, string> = { 0: 'no', 0.5: 'half', 1: 'yes' }

export function exportCsv(creatorIds: string[]): string {
  const rows = creatorIds
    .map((id) => getContact(id))
    .filter((c): c is Contact => c !== null)
    .map(({ creator: c, score, latestSignal: sig, agent }) => ({
      name: c.name,
      handle: c.handle,
      url: `https://instagram.com/${c.handle}`,
      stars: score.stars,
      niche: LEVELS[c.niche],
      selling: LEVELS[score.active],
      signal_strength: LEVELS[score.intent],
      sells: c.sells,
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
      rejected: isRejected(c.id) ? 'yes' : 'no',
    }))
  return toCsv(rows)
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

// First run -------------------------------------------------------------------

export interface CrawlProgress {
  found: number
  scored: number
  done: boolean
}

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

export type { Stars }

// Brief ------------------------------------------------------------------------

/** The audience an agent looks for, in as many words as it takes. */
export function setAgentBrief(id: string, who: string): void {
  const clean = who.trim()
  const first = clean.split(/(?<=\.)\s/)[0] ?? clean
  const b: Brief = { who: clean, answers: [], summary: clean ? first : 'No audience yet.' }
  setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, brief: b } : a)) }))
}

/** Read the site, write the audience, name the agent. */
export function setAgentWebsite(id: string, website: string): void {
  setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, website } : a)) }))
}
