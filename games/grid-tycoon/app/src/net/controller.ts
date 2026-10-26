// Multiplayer controller: the glue between the room client (./client), the session store
// (./session) and the game store. It hosts, joins and rejoins rooms, follows the room live, maps
// each server state into useGame.setRemote (which plays the results sequence when a round
// resolves), registers the network bridge so Lock in submits, and turns failures into chips.
//
// Local test mode: `?mp=local` installs the in-memory room server shared across this browser's
// tabs (./local, loaded on demand so it never ships in the solo bundle). `&timer=30` shortens the
// round timer there. Production (no Supabase configured, no ?mp=local) stays offline and loads none
// of it.

import { useGame, setNetBridge } from '../store/game'
import type { Decision } from '../engine'
import {
  NetError,
  companyIdForSeat,
  createRoom,
  inviteUrl,
  joinRoom,
  netBridge,
  setSeatStorage,
  startGame,
  subscribeRoom,
  useBackend,
  type RoomSubscription,
} from './client'
import type { LocalServer } from './local'
import { INITIAL_SESSION, useNet, type NetProblemKind } from './session'
import type { NetFailure, PlayerView, RoomView } from './types'
import { isMeLocked } from './view'

// ---------------------------------------------------------------------------------------------
// URL flags

function currentSearch(): string {
  return typeof location === 'undefined' ? '' : location.search
}

/** `?mp=local` asks for the local test server. */
export function localModeRequested(search: string = currentSearch()): boolean {
  try {
    return new URLSearchParams(search).get('mp') === 'local'
  } catch {
    return false
  }
}

/** `&timer=30`: seconds per round on the local test server (5 to 600), if given. */
export function localTimerFromUrl(search: string = currentSearch()): number | undefined {
  try {
    const raw = new URLSearchParams(search).get('timer')
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? Math.min(600, Math.max(5, Math.round(n))) : undefined
  } catch {
    return undefined
  }
}

/** Puts `?room=CODE` in the address bar while in a room (a reload then offers Rejoin), keeping other flags. */
function setUrlRoom(code: string | null): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return
  try {
    const url = new URL(location.href)
    if (code) url.searchParams.set('room', code)
    else url.searchParams.delete('room')
    if (url.href !== location.href) history.replaceState(history.state, '', url)
  } catch {
    // Sandboxed frames can refuse replaceState; the room still works.
  }
}

/** The invite link for a room. In local test mode it carries the flags so the link opens on the same local server. */
export function inviteLink(code: string): string {
  const url = inviteUrl(code)
  const local = useNet.getState().local
  if (!local) return url
  const timer = localTimerFromUrl()
  return `${url}&mp=local${timer ? `&timer=${timer}` : ''}`
}

// ---------------------------------------------------------------------------------------------
// Setup

let initPromise: Promise<void> | null = null
let local: LocalServer | null = null

/** Installs the local test server when the URL asks for it. Idempotent; resolves when ready. */
export function initNet(): Promise<void> {
  initPromise ??= (async () => {
    if (localModeRequested()) {
      try {
        const mod = await import('./local')
        // Each tab is its own player on the local server: seat tokens per tab (they survive a reload).
        try {
          setSeatStorage(sessionStorage)
        } catch {
          setSeatStorage(null)
        }
        local = mod.startLocalServer({ timerSeconds: localTimerFromUrl() })
        useBackend(local.backend)
        useNet.setState({ local: { timerSeconds: local.timerSeconds, role: local.role() } })
      } catch {
        // Could not load: stay offline.
      }
    }
    useNet.setState({ ready: true })
  })()
  return initPromise
}

/** Which role this tab plays for the local test server (null outside local mode). */
export function localRole(): 'pending' | 'host' | 'proxy' | null {
  return local ? local.role() : null
}

// ---------------------------------------------------------------------------------------------
// Problems (shown as chips)

function setProblem(kind: NetProblemKind, message: string): void {
  useNet.setState({ problem: { kind, message } })
}

function clearProblem(...kinds: NetProblemKind[]): void {
  const p = useNet.getState().problem
  if (p && (kinds.length === 0 || kinds.includes(p.kind))) useNet.setState({ problem: null })
}

// ---------------------------------------------------------------------------------------------
// Room session

let sub: RoomSubscription | null = null
let lastApplied: { round: number; updatedAt: number } | null = null
/** After entering a room mid-game: if the server already holds this seat's lock, show "waiting". */
let restorePending = false

function closeSub(): void {
  const s = sub
  sub = null
  s?.close()
}

/** Re-shows "waiting" after a reload when this seat had already locked the current round. */
function maybeRestoreLock(): void {
  if (!restorePending) return
  const { room, players, seat } = useNet.getState()
  if (!room || room.status !== 'playing' || !room.state || !players.some((p) => p.seat === seat)) return
  restorePending = false
  const game = useGame.getState()
  if (game.mode === 'multi' && game.phase === 'decide' && isMeLocked(room, players, seat)) useGame.setState({ phase: 'waiting' })
}

/** Maps one room update into the stores. */
export function applyRoom(room: RoomView): void {
  const { code, seat } = useNet.getState()
  if (room.code !== code || seat === null) return
  useNet.setState({ room })
  const game = useGame.getState()
  if (game.mode !== 'multi') return
  if (room.status === 'lobby') {
    if (game.screen !== 'lobby') game.goToLobby()
    return
  }
  if (!room.state) return
  if (lastApplied && lastApplied.round === room.round && lastApplied.updatedAt === room.updatedAt) {
    maybeRestoreLock()
    return
  }
  const advanced = !!game.state && room.state.round > game.state.round
  lastApplied = { round: room.round, updatedAt: room.updatedAt }
  game.setRemote(room.state, companyIdForSeat(seat))
  if (advanced) clearProblem('submit')
  maybeRestoreLock()
}

function applyPlayers(players: PlayerView[]): void {
  useNet.setState({ players })
  maybeRestoreLock()
}

function failureText(f: NetFailure): string {
  return f.message || 'Something went wrong.'
}

function enter(code: string, seat: number, snap: { room: RoomView; players: PlayerView[] }): void {
  closeSub()
  lastApplied = null
  restorePending = true
  useNet.setState({ code, seat, room: snap.room, players: snap.players, presence: [], status: 'connecting', problem: null })

  const bridge = netBridge(code)
  setNetBridge({
    async submit(decision: Decision, round: number) {
      try {
        await bridge.submit(decision, round)
        clearProblem('submit')
      } catch (err) {
        const f = err instanceof NetError ? err.failure : null
        // The round resolved while the lock was in flight: the new state is (or will be) here.
        if (f?.error === 'wrong_round') {
          void sub?.refresh()
          if ((useGame.getState().state?.round ?? 0) > round) return
        }
        if (f?.error === 'invalid_token') setProblem('seat_lost', 'This browser no longer holds a seat in the room.')
        else setProblem('submit', f ? failureText(f) : 'Could not reach the game server.')
        throw err
      }
    },
    leave: () => leaveRoom({ fromStore: true }),
  })
  setUrlRoom(code)

  const game = useGame.getState()
  if (snap.room.status === 'lobby' || !snap.room.state) {
    if (game.screen !== 'lobby' || game.mode !== 'multi') game.goToLobby()
  } else {
    // Straight into a running game (rejoin): the store needs mode 'multi' before setRemote.
    if (game.mode !== 'multi') useGame.setState({ mode: 'multi', state: null, last: null })
    applyRoom(snap.room)
  }

  sub = subscribeRoom(code, applyRoom, applyPlayers, {
    onPresence: (presence) => useNet.setState({ presence }),
    onStatus: (status) => {
      if (useNet.getState().code !== code) return
      useNet.setState({ status })
      if (status === 'live') clearProblem('network')
    },
    onSeatLost: () => setProblem('seat_lost', 'Someone took over your seat while you were away.'),
    onError: (f) => {
      if (f.error === 'room_not_found') setProblem('room_gone', 'This room no longer exists.')
      else if (f.error === 'network') setProblem('network', 'Connection trouble. Retrying…')
    },
  })
}

/** Leaves the room view (the seat stays yours: Rejoin from the title screen). */
export function leaveRoom(opts: { fromStore?: boolean } = {}): void {
  closeSub()
  setNetBridge(null)
  lastApplied = null
  restorePending = false
  const { local: localInfo, ready } = useNet.getState()
  useNet.setState({ ...INITIAL_SESSION, local: localInfo, ready })
  setUrlRoom(null)
  if (!opts.fromStore) useGame.getState().quitToTitle()
}

// ---------------------------------------------------------------------------------------------
// Actions for the screens. Each returns null on success or the failure to show.

export async function hostGame(opts: { name: string; seats: number; fillBots: boolean }): Promise<NetFailure | null> {
  await initNet()
  const res = await createRoom(opts)
  if (!res.ok) return res
  enter(res.code, res.seat, res)
  return null
}

export async function joinGame(opts: { code: string; name: string }): Promise<NetFailure | null> {
  await initNet()
  const res = await joinRoom(opts)
  if (!res.ok) return res
  enter(res.code, res.seat, res)
  return null
}

/** Rejoins the seat this browser holds a token for. */
export async function rejoinGame(code: string): Promise<NetFailure | null> {
  await initNet()
  const res = await joinRoom({ code })
  if (!res.ok) return res
  enter(res.code, res.seat, res)
  return null
}

/** Host only: starts the game (empty seats fill with bots when the room says so). */
export async function startHostedGame(): Promise<NetFailure | null> {
  const { code } = useNet.getState()
  if (!code) return { ok: false, error: 'no_token', message: 'You are not in a room.' }
  const res = await startGame(code)
  if (!res.ok) return res
  applyPlayers(res.players)
  applyRoom(res.room)
  return null
}

/** Back to editing after Lock in. The locked decision stands on the server until the next Lock in replaces it. */
export function unlockToEdit(): void {
  const game = useGame.getState()
  if (game.mode !== 'multi' || game.phase !== 'waiting') return
  restorePending = false
  useGame.setState({ phase: 'decide' })
}

/** Local test mode only: seats a simulated human (auto: locks every round; idle: never locks). */
export async function addTestPlayer(auto: boolean): Promise<string | null> {
  const { code } = useNet.getState()
  if (!local || !code) return 'Test players need the local test server (?mp=local).'
  const res = await local.addTestPlayer(code, auto)
  if (!res.ok) return res.message
  void sub?.refresh()
  return null
}
