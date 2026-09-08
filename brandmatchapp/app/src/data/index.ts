import type { Brief, BriefAnswer, Creator, FilterKey, Filters, FollowUpQuestion, Post, SavedList, Settings, Signal } from '../types'
import { defaultFilters } from '../mock/filters'
import { followUpQuestions } from '../mock/questions'
import { timezones as mockTimezones } from '../mock/settings'
import { toCsv } from '../lib/csv'
import { absolute, isNewToday, withinDays } from '../lib/format'
import { getState, resetState, setState } from './store'

// Every screen reads and writes through these functions.
// They work on the in memory store today and will call the real source later.

// Feed --------------------------------------------------------------------

export interface FeedItem {
  creator: Creator
  totalStars: number
  latestSignal: Signal | null
  isNew: boolean
  isSaved: boolean
  isRejected: boolean
}

function latestSignal(c: Creator): Signal | null {
  return c.signals.length ? c.signals[0] : null
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

function toItem(c: Creator, now: Date): FeedItem {
  const s = getState()
  return {
    creator: c,
    totalStars: c.intent.stars + c.match.stars,
    latestSignal: latestSignal(c),
    isNew: isNewToday(c.firstSeenAt, now),
    isSaved: s.lists.some((l) => l.creatorIds.includes(c.id)),
    isRejected: s.rejections.some((r) => r.creatorId === c.id),
  }
}

function sortFeed(a: FeedItem, b: FeedItem): number {
  if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars
  if (b.creator.intent.stars !== a.creator.intent.stars) return b.creator.intent.stars - a.creator.intent.stars
  const ad = a.latestSignal?.date ?? ''
  const bd = b.latestSignal?.date ?? ''
  if (ad !== bd) return bd.localeCompare(ad)
  return b.creator.followers - a.creator.followers
}

/** The feed: visible creators, filtered, sorted best first. Rejected creators never return. */
export function getFeed(filters: Filters = getState().filters, now = new Date()): FeedItem[] {
  const s = getState()
  const rejected = new Set(s.rejections.map((r) => r.creatorId))
  return s.creators
    .filter((c) => !rejected.has(c.id) && passes(c, filters, now))
    .map((c) => toItem(c, now))
    .sort(sortFeed)
}

export function getNewTodayCount(filters?: Filters): number {
  return getFeed(filters).filter((i) => i.isNew).length
}

export interface FilterDiagnosis {
  key: FilterKey
  label: string
  /** How many creators come back if this one filter goes to its default. */
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

// One creator --------------------------------------------------------------

export function getCreator(id: string): Creator | null {
  return getState().creators.find((c) => c.id === id) ?? null
}

export function getCreatorItem(id: string): FeedItem | null {
  const c = getCreator(id)
  return c ? toItem(c, new Date()) : null
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
    if (current.includes(clean)) return {}
    return { tags: { ...s.tags, [creatorId]: [...current, clean] } }
  })
}

export function removeTag(creatorId: string, label: string): void {
  setState((s) => ({ tags: { ...s.tags, [creatorId]: (s.tags[creatorId] ?? []).filter((t) => t !== label) } }))
}

export function getAllTags(): string[] {
  return Array.from(new Set(Object.values(getState().tags).flat())).sort()
}

// Reject -----------------------------------------------------------------------

export function reject(creatorId: string): void {
  setState((s) => (s.rejections.some((r) => r.creatorId === creatorId) ? {} : { rejections: [...s.rejections, { creatorId, date: new Date().toISOString() }] }))
}

export function isRejected(creatorId: string): boolean {
  return getState().rejections.some((r) => r.creatorId === creatorId)
}

export function getRejected(): FeedItem[] {
  const now = new Date()
  return getState()
    .rejections.map((r) => getCreator(r.creatorId))
    .filter((c): c is Creator => c !== null)
    .map((c) => toItem(c, now))
}

// Export -----------------------------------------------------------------------

export function exportCsv(creatorIds: string[]): string {
  const rows = creatorIds
    .map((id) => getCreatorItem(id))
    .filter((i): i is FeedItem => i !== null)
    .map(({ creator: c, latestSignal: sig }) => ({
      name: c.name,
      handle: c.handle,
      url: `https://instagram.com/${c.handle}`,
      intent_stars: c.intent.stars,
      match_stars: c.match.stars,
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
  setState({ brief: b })
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
  setState({ brief: null, settings: { ...getState().settings, onboarded: false } })
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
