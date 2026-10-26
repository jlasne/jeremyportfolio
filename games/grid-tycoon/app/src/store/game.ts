// The game session: which screen is up, the engine state, whose company is "me", and the phase of
// the round. Solo resolves locally (bots + resolveRound); multiplayer hands decisions to the
// network bridge that src/net registers, and receives states through setRemote.

import { create } from 'zustand'
import { botDecision, companyById, createSoloGame, defaultConfig, resolveRound, validateDecision } from '../engine'
import type { Config, Decision, GameState } from '../engine'
import { useDraft } from './draft'
import { clearSolo, loadSolo, saveSolo } from './save'
import { useUi } from './ui'
import { roundAnnouncement, resultAnnouncement } from './selectors'

export type Screen = 'title' | 'lobby' | 'game' | 'end'
export type Phase = 'decide' | 'waiting' | 'results'

export interface GameStore {
  screen: Screen
  mode: 'solo' | 'multi' | null
  config: Config
  state: GameState | null
  meId: string | null
  phase: Phase
  /** The state before the last resolution and after it, for the results sequence and map effects. */
  last: { before: GameState; after: GameState } | null
  startSolo(opts?: { seed?: number; name?: string }): void
  hasSave(): boolean
  resumeSolo(): boolean
  lockIn(): void
  finishResults(): void
  quitToTitle(): void
  setRemote(state: GameState, meId: string): void
  /** Opens the multiplayer waiting room (src/net fills it). */
  goToLobby(): void
}

/** What src/net plugs in so lockIn can submit in multiplayer without the store importing the network code. */
export interface NetBridge {
  submit(decision: Decision, round: number): void | Promise<void>
  leave?(): void
}

let net: NetBridge | null = null
export function setNetBridge(bridge: NetBridge | null): void {
  net = bridge
}

/** A readable 6-digit seed, easy to copy for a replay. */
export function randomSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000)
}

function humanId(state: GameState): string {
  return (state.companies.find((c) => !c.isBot) ?? state.companies[0]).id
}

/** Starts a decision phase: fresh draft from defaultDecision, per-phase UI cleared. */
function beginDecide(): void {
  useDraft.getState().reset()
  useUi.getState().resetPhase()
  const { state, meId } = useGame.getState()
  if (state && meId) useUi.getState().announce(roundAnnouncement(state, meId))
}

export const useGame = create<GameStore>()((set, get) => ({
  screen: 'title',
  mode: null,
  config: defaultConfig,
  state: null,
  meId: null,
  phase: 'decide',
  last: null,

  startSolo: (opts = {}) => {
    const seed = opts.seed != null && Number.isFinite(opts.seed) ? Math.floor(Math.abs(opts.seed)) : randomSeed()
    const name = (opts.name ?? '').trim().slice(0, 28)
    const state = createSoloGame({ seed, playerName: name || 'You' }, get().config)
    const meId = humanId(state)
    saveSolo(state, meId)
    set({ screen: 'game', mode: 'solo', state, meId, phase: 'decide', last: null })
    useUi.getState().close()
    useUi.getState().maybeStartTutorial()
    beginDecide()
  },

  hasSave: () => {
    const save = loadSolo()
    return !!save && !save.state.finished
  },

  resumeSolo: () => {
    const save = loadSolo()
    if (!save) return false
    set({ mode: 'solo', state: save.state, meId: save.meId, last: null, phase: save.state.finished ? 'results' : 'decide', screen: save.state.finished ? 'end' : 'game' })
    useUi.getState().close()
    if (!save.state.finished) beginDecide()
    return true
  },

  lockIn: () => {
    const { state, meId, config, phase, mode } = get()
    if (!state || !meId || phase !== 'decide' || state.finished) return
    const me = companyById(state, meId)
    const decision = useDraft.getState().decision
    if (!me.bankrupt && !validateDecision(state, meId, decision, config).ok) return

    if (mode === 'multi') {
      if (!net) return
      set({ phase: 'waiting' })
      void Promise.resolve(net.submit(decision, state.round)).catch(() => set({ phase: 'decide' }))
      return
    }

    const decisions: Record<string, Decision> = {}
    if (!me.bankrupt) decisions[meId] = decision
    for (const c of state.companies) if (c.isBot && !c.bankrupt) decisions[c.id] = botDecision(state, c.id, config)
    const after = resolveRound(state, decisions, config)
    saveSolo(after, meId)
    set({ state: after, last: { before: state, after }, phase: 'results' })
    useDraft.getState().reset()
    useUi.getState().announce(resultAnnouncement(state, after, meId))
  },

  finishResults: () => {
    const { state } = get()
    if (!state) return
    if (state.finished) {
      set({ screen: 'end', phase: 'results' })
      return
    }
    set({ phase: 'decide' })
    beginDecide()
  },

  quitToTitle: () => {
    if (get().mode === 'multi') net?.leave?.()
    useUi.getState().close()
    useUi.getState().resetPhase()
    set({ screen: 'title', mode: null, state: null, meId: null, last: null, phase: 'decide' })
  },

  setRemote: (state, meId) => {
    const prev = get().state
    const advanced = !!prev && get().mode === 'multi' && state.round > prev.round
    if (advanced && prev) {
      set({ mode: 'multi', screen: 'game', state, meId, last: { before: prev, after: state }, phase: 'results' })
      useDraft.getState().reset()
      useUi.getState().announce(resultAnnouncement(prev, state, meId))
      return
    }
    const fresh = !prev || prev.round !== state.round || get().mode !== 'multi'
    set({ mode: 'multi', screen: state.finished ? 'end' : 'game', state, meId, phase: fresh ? 'decide' : get().phase })
    if (fresh && !state.finished) beginDecide()
  },

  goToLobby: () => set({ screen: 'lobby', mode: 'multi' }),
}))

/** Removes the solo save (used by "New game" when the player wants a clean slate). */
export function discardSoloSave(): void {
  clearSolo()
}
