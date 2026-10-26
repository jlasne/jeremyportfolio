// The multiplayer client: room actions against the grid-tycoon edge function, live room updates,
// presence, the server clock offset and seat tokens. No React and no store imports: the lobby and
// game screens call these and push states into the stores themselves.
//
// Typical flow (see supabase/README.md "For the UI"):
//   if (!isOnline()) show "multiplayer is offline"
//   const r = await createRoom({ name, seats: 4, fillBots: true })   // or joinRoom({ code, name })
//   const sub = subscribeRoom(r.code, onRoom, onPlayers, { onPresence, onStatus, onSeatLost })
//   onRoom: room.status === 'playing' && room.state → useGame.getState().setRemote(room.state, companyIdForSeat(seat))
//   lock in → submitDecision(code, room.round, decision)
//   countdown → msLeft(room)

import type { Decision } from '../engine'
import { clockOffset, noteServerTime, serverNow } from './clock'
import { isConfigured } from './config'
import { createSupabaseBackend } from './supabase'
import { forgetSeat, lastSeat, saveSeat, savedSeat, setSeatStorage, type SavedSeat } from './tokens'
import type {
  Backend,
  ConnectionStatus,
  CreateRoomResult,
  JoinRoomResult,
  NetFailure,
  NetResult,
  PingResult,
  PlayerView,
  PresenceEntry,
  RoomAction,
  RoomHead,
  RoomPush,
  RoomStateResult,
  RoomView,
  StartGameResult,
  SubmitResult,
  TickResult,
  WireResponse,
} from './types'

export { clockOffset, serverNow, savedSeat, forgetSeat, lastSeat, setSeatStorage }
export type { SavedSeat }

/** Same alphabet as the server: no I or O. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const MIN_SEATS = 2
export const MAX_SEATS = 6
export const NAME_MAX = 20
/** After start, a seat whose player has been away this long can be claimed by a new name. */
export const AWAY_MS = 60_000

/** Ask the server to resolve this long after the deadline (covers clock estimate error). */
const TICK_GRACE_MS = 1_500
/** Between two tick attempts for the same round. */
const TICK_RETRY_MS = 5_000
const HEARTBEAT_MS = 20_000
/** Poll the room this often while Realtime is not live, so nothing is missed while it reconnects. */
const FALLBACK_POLL_MS = 10_000
const WATCH_MS = 1_000

// ---------------------------------------------------------------------------------------------
// Backend selection

let override: Backend | null = null
let live: Backend | null = null

/**
 * Replaces the transport (tests, or the offline room server from ./memory). Pass null to go back
 * to Supabase (when configured).
 */
export function useBackend(backend: Backend | null): void {
  override = backend
}

function backend(): Backend | null {
  if (override) return override
  if (!isConfigured()) return null
  live ??= createSupabaseBackend()
  return live
}

/** False when no Supabase URL / key is configured (and no offline backend is installed). */
export function isOnline(): boolean {
  return backend() !== null
}

export const OFFLINE_MESSAGE = 'Multiplayer is offline for now.'

// ---------------------------------------------------------------------------------------------
// Small helpers for the screens

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  if (code.length !== 6) return null
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null
  return code
}

/** The engine company id that a seat plays (`meId` for the game store). */
export function companyIdForSeat(seat: number): string {
  return `p${seat}`
}

/** Milliseconds left in the current round on the server clock (0 when past or not playing). */
export function msLeft(room: Pick<RoomView, 'status' | 'deadline'> | null): number {
  if (!room || room.status !== 'playing' || room.deadline === null) return 0
  return Math.max(0, room.deadline - serverNow())
}

/** True when the seat has locked in for the room's current round. */
export function isLocked(player: PlayerView, room: Pick<RoomView, 'round'>): boolean {
  return player.lockedRound === room.round
}

/** True when the server has not heard from this human for a minute (their seat can be claimed). */
export function isAway(player: PlayerView): boolean {
  return !player.isBot && serverNow() - player.lastSeen > AWAY_MS
}

/** `https://www.jeremylasne.com/games/?room=ABCDEF` for the current origin and base. */
export function inviteUrl(code: string): string {
  const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'
  const origin = typeof location === 'undefined' ? 'https://www.jeremylasne.com' : location.origin
  return `${origin}${base}?room=${encodeURIComponent(code)}`
}

/** The room code of an invite link (`?room=ABCDEF`), if any. */
export function roomCodeFromUrl(search: string = typeof location === 'undefined' ? '' : location.search): string | null {
  try {
    const raw = new URLSearchParams(search).get('room')
    return raw ? normalizeRoomCode(raw) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Actions

function failure(error: NetFailure['error'], message: string): NetFailure {
  return { ok: false, error, message }
}

async function call<T>(action: RoomAction, body: Record<string, unknown>): Promise<NetResult<T>> {
  const b = backend()
  if (!b) return failure('offline', OFFLINE_MESSAGE)
  const sentAt = Date.now()
  let res: WireResponse
  try {
    res = await b.call(action, body)
  } catch {
    return failure('network', 'Could not reach the game server. Check your connection.')
  }
  if (typeof res.now === 'number') noteServerTime(res.now, sentAt, Date.now())
  if (!res.ok) {
    const out: NetFailure = { ok: false, error: res.error, message: res.message }
    if (Array.isArray(res.issues)) out.issues = res.issues as NetFailure['issues']
    if (typeof res.round === 'number') out.round = res.round
    return out
  }
  const data: Record<string, unknown> = { ...res }
  delete data.now
  return data as { ok: true } & T
}

function tokenFor(code: string): string | null {
  return savedSeat(code)?.token ?? null
}

export async function createRoom(opts: { name: string; seats: number; fillBots: boolean }): Promise<NetResult<CreateRoomResult>> {
  const res = await call<CreateRoomResult>('create', { name: opts.name, seats: opts.seats, fillBots: opts.fillBots })
  if (res.ok) saveSeat({ code: res.code, seat: res.seat, token: res.token, name: res.players.find((p) => p.seat === res.seat)?.name ?? opts.name })
  return res
}

/**
 * Joins a room, or rejoins this browser's seat when a token for the room is saved. A stale saved
 * token is forgotten and, if a name is given, the join is retried as a new player.
 */
export async function joinRoom(opts: { code: string; name?: string }): Promise<NetResult<JoinRoomResult>> {
  const code = normalizeRoomCode(opts.code)
  if (!code) return failure('invalid_code', 'A room code is 6 letters.')
  const saved = savedSeat(code)
  if (saved) {
    const res = await call<JoinRoomResult>('join', { code, token: saved.token })
    if (res.ok) {
      saveSeat({ code, seat: res.seat, token: res.token, name: res.players.find((p) => p.seat === res.seat)?.name ?? saved.name })
      return res
    }
    if (res.error !== 'invalid_token') return res
    forgetSeat(code)
    if (!opts.name) return res
  }
  const res = await call<JoinRoomResult>('join', { code, name: opts.name ?? '' })
  if (res.ok) saveSeat({ code, seat: res.seat, token: res.token, name: res.players.find((p) => p.seat === res.seat)?.name ?? opts.name ?? '' })
  return res
}

/** Host only. */
export async function startGame(code: string): Promise<NetResult<StartGameResult>> {
  const token = tokenFor(code)
  if (!token) return failure('no_token', 'You do not hold a seat in this room.')
  return call<StartGameResult>('start', { code, token })
}

/** Locks this seat's decision for `round` (the room's current round). Re-locking replaces it. */
export async function submitDecision(code: string, round: number, decision: Decision): Promise<NetResult<SubmitResult>> {
  const token = tokenFor(code)
  if (!token) return failure('no_token', 'You do not hold a seat in this room.')
  return call<SubmitResult>('lock', { code, token, round, decision })
}

/** Asks the server to resolve the round if its deadline has passed. Safe to call any time, by anyone. */
export async function tick(code: string): Promise<NetResult<TickResult>> {
  const token = tokenFor(code)
  return call<TickResult>('tick', token ? { code, token } : { code })
}

/** The room and its seats. */
export async function getState(code: string): Promise<NetResult<RoomStateResult>> {
  return call<RoomStateResult>('state', { code })
}

/** Tells the server this seat is still here (a seat away for 60 s can be claimed after start). */
export async function ping(code: string): Promise<NetResult<PingResult>> {
  const token = tokenFor(code)
  if (!token) return failure('no_token', 'You do not hold a seat in this room.')
  return call<PingResult>('ping', { code, token })
}

/** A failed action as an exception, for callers that want a rejecting promise. */
export class NetError extends Error {
  readonly failure: NetFailure
  constructor(failure: NetFailure) {
    super(failure.message)
    this.failure = failure
  }
}

/**
 * The shape src/store/game.ts `setNetBridge` takes: `submit` rejects on failure (the store then
 * reopens the decision phase). A bankrupt seat has nothing to lock, so that answer counts as done.
 */
export function netBridge(code: string, opts: { onLeave?: () => void } = {}): { submit(decision: Decision, round: number): Promise<void>; leave(): void } {
  return {
    async submit(decision, round) {
      const res = await submitDecision(code, round, decision)
      if (!res.ok && res.error !== 'bankrupt') throw new NetError(res)
    },
    leave() {
      opts.onLeave?.()
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Live room

export interface RoomSubscriptionOptions {
  /** Who is connected right now (Realtime presence). */
  onPresence?: (entries: PresenceEntry[]) => void
  onStatus?: (status: ConnectionStatus) => void
  /** This browser's token stopped working (someone claimed the seat after a long absence). */
  onSeatLost?: () => void
  /** A background request failed (for a discreet "reconnecting" hint; the subscription keeps trying). */
  onError?: (error: NetFailure) => void
}

export interface RoomSubscription {
  /** Latest known room (null until the first fetch lands). */
  readonly room: RoomView | null
  readonly players: PlayerView[]
  readonly presence: PresenceEntry[]
  readonly status: ConnectionStatus
  /** Refetches the room now (also done on reconnect, on tab focus and when the network returns). */
  refresh(): Promise<void>
  close(): void
}

/**
 * Follows one room: Realtime row changes (gt_rooms, gt_players filtered by code), presence on
 * gt:CODE tracking {seat, name} when this browser holds a seat, a heartbeat, and a tick once the
 * deadline passes on the server clock so a round never hangs even if every client sits idle.
 */
export function subscribeRoom(
  code: string,
  onRoom: (room: RoomView) => void,
  onPlayers: (players: PlayerView[]) => void,
  opts: RoomSubscriptionOptions = {},
): RoomSubscription {
  let room: RoomView | null = null
  const players = new Map<number, PlayerView>()
  let presence: PresenceEntry[] = []
  let status: ConnectionStatus = 'connecting'
  let closed = false
  let lastTickAt = 0
  let lastTickRound = -1
  let refreshing: Promise<void> | null = null
  const timers: ReturnType<typeof setInterval>[] = []

  const seat = savedSeat(code)
  const me: PresenceEntry | null = seat ? { seat: seat.seat, name: seat.name } : null

  const playerList = (): PlayerView[] => [...players.values()].sort((a, b) => a.seat - b.seat)
  const emitPlayers = (): void => {
    if (!closed) onPlayers(playerList())
  }

  /** Keeps the newest room; Realtime and fetches can arrive out of order. */
  function applyRoom(next: RoomView): void {
    if (closed) return
    if (room) {
      const older = next.round < room.round || (next.round === room.round && next.updatedAt < room.updatedAt)
      const same = next.updatedAt === room.updatedAt && next.round === room.round && next.status === room.status
      if (older || same) return
    }
    room = next
    onRoom(next)
  }

  function applySnapshot(snap: { room: RoomView | RoomHead; players: PlayerView[] }): void {
    if (snap.room.state !== undefined) applyRoom(snap.room as RoomView)
    else onPush({ ...snap.room, state: undefined })
    players.clear()
    for (const p of snap.players) players.set(p.seat, p)
    emitPlayers()
  }

  async function refresh(): Promise<void> {
    if (closed) return
    refreshing ??= (async () => {
      const res = await getState(code)
      if (res.ok) applySnapshot(res)
      else opts.onError?.(res)
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  /** A room change that may lack the state (Realtime above its payload limit, or a lite lock / tick answer). */
  function onPush(push: RoomPush): void {
    if (push.state !== undefined) {
      applyRoom(push as RoomView)
      return
    }
    // Same round as what we hold: only the metadata moved, keep our state. Otherwise fetch it.
    if (room && room.round === push.round && room.status === push.status) applyRoom({ ...push, state: room.state })
    else void refresh()
  }

  const b = backend()
  const stop = b
    ? b.subscribe(
        code,
        {
          onRoom: onPush,
          onPlayer: (p) => {
            players.set(p.seat, p)
            emitPlayers()
          },
          onPresence: (entries) => {
            presence = entries
            if (!closed) opts.onPresence?.(entries)
          },
          onStatus: (s) => {
            status = s
            if (closed && s !== 'closed') return
            opts.onStatus?.(s)
            // Catch whatever changed while the channel was down.
            if (s === 'live') void refresh()
          },
        },
        me,
      )
    : () => {}

  void refresh()

  // Deadline watch: whoever notices first asks the server to resolve.
  timers.push(
    setInterval(() => {
      if (!room || room.status !== 'playing' || room.deadline === null) return
      if (serverNow() < room.deadline + TICK_GRACE_MS) return
      const t = Date.now()
      if (lastTickRound === room.round && t - lastTickAt < TICK_RETRY_MS) return
      lastTickRound = room.round
      lastTickAt = t
      void tick(code).then((res) => {
        if (res.ok) applySnapshot(res)
        else opts.onError?.(res)
      })
    }, WATCH_MS),
  )

  if (me) {
    timers.push(
      setInterval(() => {
        if (room?.status === 'finished') return
        void ping(code).then((res) => {
          if (res.ok || closed) return
          if (res.error === 'invalid_token') {
            forgetSeat(code)
            opts.onSeatLost?.()
          } else opts.onError?.(res)
        })
      }, HEARTBEAT_MS),
    )
  }

  timers.push(
    setInterval(() => {
      if (status !== 'live') void refresh()
    }, FALLBACK_POLL_MS),
  )

  const wake = (): void => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
  }

  return {
    get room() {
      return room
    },
    get players() {
      return playerList()
    },
    get presence() {
      return presence
    },
    get status() {
      return status
    },
    refresh,
    close() {
      if (closed) return
      closed = true
      for (const t of timers) clearInterval(t)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', wake)
        document.removeEventListener('visibilitychange', wake)
      }
      stop()
    },
  }
}
