// UI-only state: which panel is open, the selected building, a build card being dragged,
// persisted settings, the tutorial step, and the polite live-region message.

import { create } from 'zustand'
import type { BuildOrder } from '../engine'
import { KEYS, readJson, writeJson } from './save'

export type PanelId = 'finance' | 'build' | 'allocate' | 'market'
/** Spec order: Finance, Build, Allocate, Market. Keys 1-4 follow it. */
export const PANELS: PanelId[] = ['finance', 'build', 'allocate', 'market']

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  music: boolean
  sfx: boolean
  reducedMotion: 'system' | 'on' | 'off'
  tutorial: boolean
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', music: true, sfx: true, reducedMotion: 'system', tutorial: true }

export const TUTORIAL_STEPS = 5

function loadSettings(): Settings {
  const raw = readJson<Partial<Settings>>(KEYS.settings) ?? {}
  const s = { ...DEFAULT_SETTINGS }
  if (raw.theme === 'system' || raw.theme === 'light' || raw.theme === 'dark') s.theme = raw.theme
  if (typeof raw.music === 'boolean') s.music = raw.music
  if (typeof raw.sfx === 'boolean') s.sfx = raw.sfx
  if (raw.reducedMotion === 'system' || raw.reducedMotion === 'on' || raw.reducedMotion === 'off') s.reducedMotion = raw.reducedMotion
  if (typeof raw.tutorial === 'boolean') s.tutorial = raw.tutorial
  return s
}

function tutorialDone(): boolean {
  return readJson<{ done?: boolean }>(KEYS.tutorial)?.done === true
}

export interface UiStore {
  panel: PanelId | null
  selected: string | null
  drag: { order: BuildOrder } | null
  settings: Settings
  tutorialStep: number | null
  settingsOpen: boolean
  /** Forced sale confirmed for this decision phase: the regular panels come back. */
  forcedSaleConfirmed: boolean
  /** Latest polite announcement; `liveId` changes on every call so a repeat is read again. */
  liveMessage: string
  liveId: number

  open(p: PanelId): void
  close(): void
  toggle(p: PanelId): void
  select(id: string | null): void
  setDrag(d: { order: BuildOrder } | null): void
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void
  advanceTutorial(): void
  skipTutorial(): void
  /** Starts the tutorial at step 0 if it is on and has not been finished before. */
  maybeStartTutorial(): void
  replayTutorial(): void
  setSettingsOpen(open: boolean): void
  confirmForcedSale(v: boolean): void
  announce(msg: string): void
  /** Clears per-phase UI (selection, drag, forced sale confirmation) at a new decision phase. */
  resetPhase(): void
}

export const useUi = create<UiStore>()((set, get) => ({
  panel: null,
  selected: null,
  drag: null,
  settings: loadSettings(),
  tutorialStep: null,
  settingsOpen: false,
  forcedSaleConfirmed: false,
  liveMessage: '',
  liveId: 0,

  open: (p) => set({ panel: p }),
  close: () => set({ panel: null }),
  toggle: (p) => set({ panel: get().panel === p ? null : p }),
  select: (id) => set({ selected: id }),
  setDrag: (d) => set({ drag: d }),
  setSetting: (k, v) => {
    const settings = { ...get().settings, [k]: v }
    writeJson(KEYS.settings, settings)
    set({ settings })
  },
  advanceTutorial: () => {
    const step = get().tutorialStep
    if (step == null) return
    if (step + 1 >= TUTORIAL_STEPS) {
      writeJson(KEYS.tutorial, { done: true })
      set({ tutorialStep: null })
    } else set({ tutorialStep: step + 1 })
  },
  skipTutorial: () => {
    writeJson(KEYS.tutorial, { done: true })
    set({ tutorialStep: null })
  },
  maybeStartTutorial: () => {
    if (get().settings.tutorial && !tutorialDone()) set({ tutorialStep: 0 })
    else set({ tutorialStep: null })
  },
  replayTutorial: () => {
    writeJson(KEYS.tutorial, { done: false })
    get().setSetting('tutorial', true)
    set({ tutorialStep: 0 })
  },
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  confirmForcedSale: (v) => set({ forcedSaleConfirmed: v }),
  announce: (msg) => set({ liveMessage: msg, liveId: get().liveId + 1 }),
  resetPhase: () => set({ selected: null, drag: null, forcedSaleConfirmed: false }),
}))
