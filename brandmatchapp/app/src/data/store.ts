import type { Agent, Brief, Creator, DailyStat, Filters, Note, Post, Rejection, Settings } from '../types'
import { creators as mockCreators } from '../mock/creators'
import { posts as mockPosts } from '../mock/posts'
import { agents as mockAgents } from '../mock/agents'
import { dailyStats as mockDaily } from '../mock/daily'
import { notes as mockNotes } from '../mock/notes'
import { tags as mockTags, tagVocabulary as mockVocabulary } from '../mock/tags'
import { rejections as mockRejections } from '../mock/rejections'
import { defaultFilters } from '../mock/filters'
import { settings as mockSettings } from '../mock/settings'

// The only place state lives. Seeded once from the mock folder. Refresh resets it.
// When the real source arrives, `seed()` reads from it instead and nothing else changes.

export interface State {
  creators: Creator[]
  posts: Record<string, Post[]>
  agents: Agent[]
  daily: DailyStat[]
  notes: Record<string, Note>
  tags: Record<string, string[]>
  tagVocabulary: string[]
  rejections: Rejection[]
  brief: Brief | null
  filters: Filters
  settings: Settings
}

function seed(): State {
  return {
    creators: mockCreators,
    posts: mockPosts,
    agents: mockAgents.map((a) => ({ ...a, filters: { ...a.filters } })),
    daily: mockDaily,
    notes: Object.fromEntries(mockNotes.map((n) => [n.creatorId, n])),
    tags: Object.fromEntries(Object.entries(mockTags).map(([k, v]) => [k, [...v]])),
    tagVocabulary: [...mockVocabulary],
    rejections: [...mockRejections],
    brief: mockAgents[0].brief,
    filters: { ...defaultFilters, countries: [], languages: [] },
    settings: { ...mockSettings },
  }
}

let state: State = seed()
const listeners = new Set<() => void>()

export function getState(): State {
  return state
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetState(): void {
  state = seed()
  listeners.forEach((l) => l())
}
