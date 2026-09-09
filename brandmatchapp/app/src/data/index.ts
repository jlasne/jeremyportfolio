import type { Agent, Brief, BriefAnswer, Creator, DailyStat, FilterKey, Filters, FollowUpQuestion, Level, Post, Score, Settings, Signal, Stars } from '../types'
import { defaultFilters } from '../mock/filters'
import { followUpQuestions } from '../mock/questions'
import { timezones as mockTimezones } from '../mock/settings'
import { toCsv } from '../lib/csv'
import { absolute, isNewToday, withinDays } from '../lib/format'
import { BUCKETS, CRITERIA, latestSignal, scoreOf } from './score'
import { getState, resetState, setState } from './store'

// Every screen reads and writes through these functions.
// They work on the in memory store today and will call the real source later.

export { BUCKETS, CRITERIA, scoreOf } from './score'

// Contacts, the one list ---------------------------------------------------

export interface Contact {
  creator: Creator
  score: Score
  latestSignal: Signal | null
  isNew: boolean
  isRejected: boolean
  agent: Agent | null
}

/** 2 stars or more. The contacts worth a message today. */
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

function toContact(c: Creator, now: Date): Contact {
  const s = getState()
  return {
    creator: c,
    score: scoreOf(c, now),
    latestSignal: latestSignal(c),
    isNew: isNewToday(c.firstSeenAt, now),
    isRejected: s.rejections.some((r) => r.creatorId === c.id),
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
  agentId?: string | null
  tag?: string | null
  minStars?: number
  newOnly?: boolean
}

/** The list. Filters cut the volume, the score sets the order. */
export function getContacts(q: ContactQuery = {}, now = new Date()): Contact[] {
  const s = getState()
  const f = s.filters
  const rejected = new Set(s.rejections.map((r) => r.creatorId))
  return s.creators
    .filter((c) => !rejected.has(c.id) && passes(c, f, now))
    .map((c) => toContact(c, now))
    .filter((x) => !q.agentId || x.creator.agentId === q.agentId)
    .filter((x) => !q.tag || getTags(x.creator.id).includes(q.tag))
    .filter((x) => x.score.stars >= (q.minStars ?? 0))
    .filter((x) => !q.newOnly || x.isNew)
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
  const before = { ...f }
  let best: FilterDiagnosis | null = null
  for (const k of keys) {
    const loosened = { ...f, [k.key]: defaultFilters[k.key] } as Filters
    if (k.key === 'lastPostWithin') loosened.lastPostWithin = 90
    setState({ filters: loosened })
    const restored = getContacts().length
    if (restored > (best?.restored ?? 0)) best = { key: k.key, label: k.label, restored }
  }
  setState({ filters: before })
  return best
}

// Dashboard ----------------------------------------------------------------

export interface Dashboard {
  today: number
  /** Contacts at 2 stars or more. */
  high: number
  total: number
  gatheredToday: number
  daily: DailyStat[]
  buckets: { label: string; count: number }[]
  byCriterion: { key: string; label: string; full: number; half: number; note: string }[]
}

export function getDashboard(now = new Date()): Dashboard {
  const all = getAllContacts(now)
  const daily = getState().daily
  return {
    today: all.filter((c) => c.isNew).length,
    high: all.filter((c) => isHigh(c.score)).length,
    total: all.length,
    gatheredToday: daily.length ? daily[daily.length - 1].gathered : 0,
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

export function createAgent(): Agent {
  const agent: Agent = {
    id: `a${Date.now()}`,
    name: 'New agent',
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

// Brief and onboarding ------------------------------------------------

export function getBrief(): Brief | null {
  return getState().brief
}

export function getFollowUpQuestions(_who: string): FollowUpQuestion[] {
  return followUpQuestions
}

export function buildSummary(who: string, answers: BriefAnswer[]): string {
  const clean = who.trim().replace(/\.$/, '')
  if (!clean) return 'No brief yet.'
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

export function setAgentBrief(id: string, who: string, answers: BriefAnswer[]): void {
  const b: Brief = { who: who.trim(), answers, summary: buildSummary(who, answers) }
  setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, brief: b } : a)) }))
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
