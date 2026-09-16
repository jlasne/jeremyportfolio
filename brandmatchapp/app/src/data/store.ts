import type { Campaign, Creator, DailyStat, Filters, Note, Post, Rejection, Settings } from '../types'
import { creators as mockCreators } from '../mock/creators'
import { campaigns as mockCampaigns } from '../mock/campaigns'
import { dailyStats as mockDaily } from '../mock/daily'
import { notes as mockNotes } from '../mock/notes'
import { tags as mockTags, tagVocabulary as mockVocabulary } from '../mock/tags'
import { rejections as mockRejections } from '../mock/rejections'
import { defaultFilters } from '../mock/filters'
import { settings as mockSettings } from '../mock/settings'
import { isLive } from '../lib/api'
import { STAGES } from './stages'

// The only place state lives. Seeded from the mock folder the first time
// something reads it, so a page that shows no data pays nothing: building a
// full account is the one slow thing here. Refresh resets it. When the real
// source arrives, `seed()` reads from it instead and nothing else changes.

export interface State {
  /** True once the real pool is loaded. False means the sample data below. */
  live: boolean
  creators: Creator[]
  /** Filled the first time a creator's panel opens. See getPosts. */
  posts: Record<string, Post[]>
  campaigns: Campaign[]
  daily: DailyStat[]
  notes: Record<string, Note>
  tags: Record<string, string[]>
  tagVocabulary: string[]
  rejections: Rejection[]
  /** Contacts the brand has finished with. */
  done: string[]
  filters: Filters
  settings: Settings
}

function seed(): State {
  return {
    live: false,
    creators: mockCreators,
    posts: {},
    campaigns: mockCampaigns.map((a) => ({ ...a, filters: { ...a.filters } })),
    daily: mockDaily,
    notes: Object.fromEntries(mockNotes.map((n) => [n.creatorId, n])),
    tags: Object.fromEntries(Object.entries(mockTags).map(([k, v]) => [k, [...v]])),
    tagVocabulary: [...STAGES, ...mockVocabulary.filter((t) => !(STAGES as readonly string[]).includes(t))],
    rejections: [...mockRejections],
    done: [],
    filters: { ...defaultFilters, countries: [], languages: [] },
    settings: { ...mockSettings },
  }
}

let state: State | null = null
/** Bumped on every write, so reads can cache what they derive from the store. */
let version = 0
const listeners = new Set<() => void>()

/** The current write count. Same number means the store has not moved. */
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
 * Swaps the sample data for the real pool. Called once on boot when a key is
 * in localStorage. A failure is not fatal: the app keeps the sample data and
 * says so, which is what a visitor without a key sees anyway.
 */
export async function hydrate(): Promise<boolean> {
  if (!isLive()) return false
  try {
    const { fetchAll } = await import('./remote')
    const remote = await fetchAll()
    setState({
      live: true,
      creators: remote.creators,
      posts: {},
      campaigns: remote.campaigns,
      daily: remote.daily,
      notes: remote.notes,
      tags: remote.tags,
      rejections: remote.rejections,
      done: remote.done,
      filters: remote.filters,
      tagVocabulary: [...new Set([...STAGES, ...Object.values(remote.tags).flat()])],
    })
    return true
  } catch (e) {
    console.warn('brandmatch: staying on sample data.', e)
    return false
  }
}

export function resetState(): void {
  state = null
  getState()
  version++
  listeners.forEach((l) => l())
}
