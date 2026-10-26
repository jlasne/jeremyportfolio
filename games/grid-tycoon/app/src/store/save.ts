// Local storage. Every access is wrapped: private windows, full quotas and disabled storage must
// never break the game, they only lose persistence.

import type { GameState } from '../engine'

export const KEYS = {
  solo: 'gt.solo.v1',
  settings: 'gt.settings.v1',
  tutorial: 'gt.tutorial.v1',
  net: 'gt.net.v1',
} as const

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // storage unavailable: nothing to remove
  }
}

export interface SoloSave {
  v: 1
  state: GameState
  meId: string
  savedAt: number
}

function isSoloSave(x: unknown): x is SoloSave {
  if (!x || typeof x !== 'object') return false
  const s = x as Partial<SoloSave>
  const state = s.state as Partial<GameState> | undefined
  return (
    s.v === 1 &&
    typeof s.meId === 'string' &&
    !!state &&
    state.version === 1 &&
    typeof state.round === 'number' &&
    Array.isArray(state.companies) &&
    state.companies.some((c) => c && c.id === s.meId)
  )
}

export function loadSolo(): SoloSave | null {
  const raw = readJson<unknown>(KEYS.solo)
  return isSoloSave(raw) ? raw : null
}

export function saveSolo(state: GameState, meId: string): boolean {
  const save: SoloSave = { v: 1, state, meId, savedAt: Date.now() }
  return writeJson(KEYS.solo, save)
}

export function clearSolo(): void {
  removeKey(KEYS.solo)
}
