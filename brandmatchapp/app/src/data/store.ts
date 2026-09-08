import type { Brief, Creator, Filters, Note, Post, Rejection, SavedList, Settings } from '../types'
import { creators as mockCreators } from '../mock/creators'
import { posts as mockPosts } from '../mock/posts'
import { lists as mockLists } from '../mock/lists'
import { notes as mockNotes } from '../mock/notes'
import { tags as mockTags } from '../mock/tags'
import { rejections as mockRejections } from '../mock/rejections'
import { brief as mockBrief } from '../mock/brief'
import { defaultFilters } from '../mock/filters'
import { settings as mockSettings } from '../mock/settings'

// The only place state lives. Seeded once from the mock folder. Refresh resets it.
// When the real source arrives, `seed()` reads from it instead and nothing else changes.

export interface State {
  creators: Creator[]
  posts: Record<string, Post[]>
  lists: SavedList[]
  notes: Record<string, Note>
  tags: Record<string, string[]>
  rejections: Rejection[]
  brief: Brief | null
  filters: Filters
  settings: Settings
}

function seed(): State {
  return {
    creators: mockCreators,
    posts: mockPosts,
    lists: mockLists.map((l) => ({ ...l, creatorIds: [...l.creatorIds] })),
    notes: Object.fromEntries(mockNotes.map((n) => [n.creatorId, n])),
    tags: Object.fromEntries(Object.entries(mockTags).map(([k, v]) => [k, [...v]])),
    rejections: [...mockRejections],
    brief: mockBrief,
    filters: { ...defaultFilters, countries: [...defaultFilters.countries], languages: [...defaultFilters.languages] },
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
