// The local test server (?mp=local): the in-memory room server (./memory) shared by every tab of
// this browser, so two windows can play a real multiplayer game with no Supabase project.
//
// - One tab hosts the server: whoever holds the Web Lock `gt-local-server`. The others proxy their
//   calls and subscriptions to it over a BroadcastChannel. When the host tab closes or reloads,
//   the next tab in the lock queue takes over.
// - The host persists the whole server to localStorage after every change, so a reload (or a host
//   hand-over) picks the rooms up where they were.
// - Test players: simulated humans that the host plays. "auto" ones lock the default decision a
//   couple of seconds into every round; "idle" ones never lock (to see the timer run out).
//
// This module is only ever loaded with `await import('./local')`: it pulls in the engine and the
// room logic, which the production solo bundle must not carry.

import { defaultConfig, defaultDecision } from '../engine'
import type { Config, Decision, GameState } from '../engine'
import type { PlayerRow, RoomRow } from '../../../supabase/functions/grid-tycoon/rooms'
import { createMemoryBackend, type MemoryServer, type MemorySnapshot } from './memory'
import type { Backend, BackendHandlers, ConnectionStatus, PlayerView, PresenceEntry, RoomAction, WireResponse } from './types'

export type LocalRole = 'pending' | 'host' | 'proxy'

export interface TestPlayer {
  code: string
  seat: number
  token: string
  name: string
  /** True: locks the default decision every round. False: never locks (lets the timer run out). */
  auto: boolean
}

export interface LocalServer {
  backend: Backend
  role(): LocalRole
  /** Seconds per round on this server. */
  timerSeconds: number
  /** Seats a simulated human in the room's lobby (or claims an away seat once started). */
  addTestPlayer(code: string, auto: boolean): Promise<{ ok: true; seat: number; name: string } | { ok: false; message: string }>
  close(): void
}

interface Persisted {
  v: 1
  server: MemorySnapshot
  testPlayers: TestPlayer[]
}

type Msg =
  | { t: 'call'; id: string; from: string; action: RoomAction; body: Record<string, unknown> }
  | { t: 'reply'; id: string; to: string; res: WireResponse | null }
  | { t: 'sub'; sid: string; from: string; code: string; me: PresenceEntry | null }
  | { t: 'unsub'; sid: string }
  | { t: 'push'; sid: string; to: string; kind: 'room' | 'player' | 'presence' | 'status'; data: unknown }
  | { t: 'test'; id: string; from: string; code: string; auto: boolean }
  | { t: 'testReply'; id: string; to: string; res: { ok: true; seat: number; name: string } | { ok: false; message: string } }
  | { t: 'hello'; host: string }
  | { t: 'beat'; host: string }
  | { t: 'alive'; from: string }
  | { t: 'bye'; from: string }

export interface LocalServerOptions {
  /** Seconds per round (default balance.json's 180). */
  timerSeconds?: number
  channelName?: string
  storageKey?: string
  /** Web Locks (navigator.locks); without it this tab hosts its own server. Injectable for tests. */
  locks?: LockManager | null
  /** localStorage, injectable for tests. */
  storage?: Storage | null
  /** Milliseconds a proxied call waits for the host before it fails like a network error. */
  callTimeoutMs?: number
}

const LOCK_NAME = 'gt-local-server'
const BEAT_MS = 2_000
const HOST_SILENT_MS = 6_000
const PEER_SILENT_MS = 12_000
const PERSIST_DEBOUNCE_MS = 150
const TEST_LOCK_DELAY_MS: [number, number] = [1_200, 3_200]
const TEST_PING_MS = 15_000
/** Rooms untouched this long are not persisted any more. */
const KEEP_MS = 24 * 60 * 60 * 1000

const TEST_NAMES = ['Test Ada', 'Test Bao', 'Test Cleo', 'Test Dev', 'Test Eli', 'Test Fay']

function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function safeLocks(): LockManager | null {
  try {
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
  } catch {
    return null
  }
}

export function startLocalServer(opts: LocalServerOptions = {}): LocalServer {
  const timerSeconds = Math.max(5, Math.round(opts.timerSeconds ?? defaultConfig.multiplayer.roundTimer))
  const config: Config = { ...defaultConfig, multiplayer: { ...defaultConfig.multiplayer, roundTimer: timerSeconds } }
  const channelName = opts.channelName ?? 'gt-local-server'
  const storageKey = opts.storageKey ?? 'gt.localserver.v1'
  const store = opts.storage === undefined ? safeStorage() : opts.storage
  const locks = opts.locks === undefined ? safeLocks() : opts.locks
  const callTimeoutMs = opts.callTimeoutMs ?? 5_000
  const tabId = rid()
  const channel: BroadcastChannel | null = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName)

  let role: LocalRole = 'pending'
  /** Read through a function where an await may have changed it (TS narrows `role` otherwise). */
  const currentRole = (): LocalRole => role
  let server: MemoryServer | null = null
  let testPlayers: TestPlayer[] = []
  let closed = false
  let lastHostSignal = Date.now()
  let readyResolve: () => void = () => {}
  const ready = new Promise<void>((r) => (readyResolve = r))
  const timers: ReturnType<typeof setInterval>[] = []

  // ---- persistence (host) ---------------------------------------------------------------------

  function load(): Persisted | null {
    if (!store) return null
    try {
      const raw = store.getItem(storageKey)
      const parsed = raw ? (JSON.parse(raw) as Persisted) : null
      return parsed && parsed.v === 1 && parsed.server ? parsed : null
    } catch {
      return null
    }
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  function persistNow(): void {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = null
    if (!server || !store || role !== 'host') return
    const snap = server.storage.snapshot()
    const cutoff = Date.now() - KEEP_MS
    const keep = new Set(snap.rooms.filter((r) => r.updatedAt >= cutoff).map((r) => r.code))
    const data: Persisted = {
      v: 1,
      server: {
        v: 1,
        rooms: snap.rooms.filter((r) => keep.has(r.code)),
        players: snap.players.filter((p) => keep.has(p.roomCode)),
        secrets: snap.secrets.filter((s) => keep.has(s.code)),
        // Only the decisions of each room's current round matter.
        decisions: snap.decisions.filter((d) => keep.has(d.code) && snap.rooms.some((r) => r.code === d.code && r.round === d.round)),
      },
      testPlayers: testPlayers.filter((t) => keep.has(t.code)),
    }
    try {
      store.setItem(storageKey, JSON.stringify(data))
    } catch {
      // Quota: the server keeps running in memory, a reload loses it.
    }
  }
  function persistSoon(): void {
    if (persistTimer || role !== 'host') return
    persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS)
  }

  // ---- subscriptions --------------------------------------------------------------------------

  /** This tab's own subscriptions, re-opened on whichever transport is current. */
  interface LocalSub {
    sid: string
    code: string
    handlers: BackendHandlers
    me: PresenceEntry | null
    stop: (() => void) | null
  }
  const localSubs = new Map<string, LocalSub>()
  /** Subscriptions the host runs for other tabs. */
  const remoteSubs = new Map<string, { from: string; stop: () => void }>()
  const peerSeen = new Map<string, number>()

  function openLocal(sub: LocalSub): void {
    sub.stop?.()
    sub.stop = null
    if (role === 'host' && server) {
      sub.stop = server.backend.subscribe(sub.code, sub.handlers, sub.me)
    } else if (role === 'proxy') {
      sub.handlers.onStatus('connecting')
      post({ t: 'sub', sid: sub.sid, from: tabId, code: sub.code, me: sub.me })
      sub.stop = () => post({ t: 'unsub', sid: sub.sid })
    }
  }

  // ---- messaging ------------------------------------------------------------------------------

  const pendingCalls = new Map<string, { resolve: (r: WireResponse | null) => void; timer: ReturnType<typeof setTimeout> }>()
  const pendingTests = new Map<string, { resolve: (r: Awaited<ReturnType<LocalServer['addTestPlayer']>>) => void; timer: ReturnType<typeof setTimeout> }>()

  function post(msg: Msg): void {
    if (!channel || closed) return
    try {
      channel.postMessage(msg)
    } catch {
      // Channel closed.
    }
  }

  function stopRemote(sid: string): void {
    const r = remoteSubs.get(sid)
    if (!r) return
    remoteSubs.delete(sid)
    r.stop()
  }

  function onMessage(msg: Msg): void {
    if (closed) return
    if (role === 'host' && server) {
      switch (msg.t) {
        case 'call': {
          peerSeen.set(msg.from, Date.now())
          void hostCall(msg.action, msg.body).then((res) => post({ t: 'reply', id: msg.id, to: msg.from, res }))
          return
        }
        case 'sub': {
          peerSeen.set(msg.from, Date.now())
          stopRemote(msg.sid)
          const sid = msg.sid
          const to = msg.from
          const push = (kind: 'room' | 'player' | 'presence' | 'status', data: unknown): void => post({ t: 'push', sid, to, kind, data })
          const stop = server.backend.subscribe(
            msg.code,
            {
              onRoom: (r) => push('room', r),
              onPlayer: (p) => push('player', p),
              onPresence: (e) => push('presence', e),
              onStatus: (s) => push('status', s),
            },
            msg.me,
          )
          remoteSubs.set(sid, { from: to, stop })
          return
        }
        case 'unsub':
          stopRemote(msg.sid)
          return
        case 'test':
          peerSeen.set(msg.from, Date.now())
          void hostAddTestPlayer(msg.code, msg.auto).then((res) => post({ t: 'testReply', id: msg.id, to: msg.from, res }))
          return
        case 'alive':
          peerSeen.set(msg.from, Date.now())
          return
        case 'bye':
          for (const [sid, r] of [...remoteSubs]) if (r.from === msg.from) stopRemote(sid)
          peerSeen.delete(msg.from)
          return
        case 'hello':
          // Two hosts can only happen without Web Locks; the newer one wins nothing, ignore.
          return
        default:
          return
      }
    }
    if (role === 'proxy') {
      switch (msg.t) {
        case 'reply': {
          if (msg.to !== tabId) return
          const p = pendingCalls.get(msg.id)
          if (!p) return
          pendingCalls.delete(msg.id)
          clearTimeout(p.timer)
          lastHostSignal = Date.now()
          p.resolve(msg.res)
          return
        }
        case 'testReply': {
          if (msg.to !== tabId) return
          const p = pendingTests.get(msg.id)
          if (!p) return
          pendingTests.delete(msg.id)
          clearTimeout(p.timer)
          p.resolve(msg.res)
          return
        }
        case 'push': {
          if (msg.to !== tabId) return
          lastHostSignal = Date.now()
          const sub = localSubs.get(msg.sid)
          if (!sub) return
          if (msg.kind === 'room') sub.handlers.onRoom(msg.data as RoomRow<GameState>)
          else if (msg.kind === 'player') sub.handlers.onPlayer(msg.data as PlayerView)
          else if (msg.kind === 'presence') sub.handlers.onPresence(msg.data as PresenceEntry[])
          else if (msg.kind === 'status' && msg.data !== 'closed') sub.handlers.onStatus(msg.data as ConnectionStatus)
          return
        }
        case 'hello':
          // A new host: it knows nothing of our subscriptions yet.
          lastHostSignal = Date.now()
          for (const sub of localSubs.values()) openLocal(sub)
          return
        case 'beat':
          lastHostSignal = Date.now()
          return
        default:
          return
      }
    }
  }
  if (channel) channel.onmessage = (e: MessageEvent<Msg>) => onMessage(e.data)

  // ---- host side ------------------------------------------------------------------------------

  async function hostCall(action: RoomAction, body: Record<string, unknown>): Promise<WireResponse> {
    if (!server) throw new Error('local server not ready')
    const res = await server.backend.call(action, body)
    persistSoon()
    return res
  }

  /** Test player loops: lock (auto) once per round, keep their seat seen, show them as connected. */
  const testLoops = new Map<string, () => void>()
  const testKey = (t: TestPlayer): string => `${t.code}/${t.seat}`

  function runTestPlayer(t: TestPlayer): void {
    if (!server || testLoops.has(testKey(t))) return
    const srv = server
    let lockedFor = 0
    let lockTimer: ReturnType<typeof setTimeout> | null = null
    const consider = (room: RoomRow<GameState>): void => {
      if (!t.auto || room.status !== 'playing' || !room.state || lockedFor >= room.round || lockTimer) return
      const round = room.round
      const [lo, hi] = TEST_LOCK_DELAY_MS
      lockTimer = setTimeout(() => {
        lockTimer = null
        void (async () => {
          const cur = await srv.storage.getRoom(t.code)
          if (!cur || cur.round !== round || cur.status !== 'playing' || !cur.state) return
          const company = cur.state.companies.find((c) => c.id === `p${t.seat}`)
          if (!company || company.bankrupt) {
            lockedFor = round
            return
          }
          const decision: Decision = defaultDecision(cur.state, company.id, config)
          await hostCall('lock', { code: t.code, token: t.token, round, decision })
          lockedFor = round
        })()
      }, lo + Math.random() * (hi - lo))
    }
    const stopListen = srv.storage.listen(t.code, consider, () => {})
    const stopPresence = srv.backend.subscribe(
      t.code,
      { onRoom: () => {}, onPlayer: () => {}, onPresence: () => {}, onStatus: () => {} },
      { seat: t.seat, name: t.name },
    )
    const ping = setInterval(() => void hostCall('ping', { code: t.code, token: t.token }), TEST_PING_MS)
    void srv.storage.getRoom(t.code).then((r) => r && consider(r))
    testLoops.set(testKey(t), () => {
      stopListen()
      stopPresence()
      clearInterval(ping)
      if (lockTimer) clearTimeout(lockTimer)
    })
  }

  async function hostAddTestPlayer(code: string, auto: boolean): Promise<Awaited<ReturnType<LocalServer['addTestPlayer']>>> {
    if (!server) return { ok: false, message: 'The local server is not ready.' }
    const players = (await server.storage.listPlayers(code)) as PlayerRow[]
    const used = new Set(players.map((p) => p.name))
    const base = TEST_NAMES.find((n) => !used.has(n) && !used.has(`${n} (idle)`)) ?? `Test ${players.length + 1}`
    const name = auto ? base : `${base} (idle)`.slice(0, 20)
    const res = await hostCall('join', { code, name })
    if (!res.ok) return { ok: false, message: res.message }
    const seat = res.seat as number
    const token = res.token as string
    const t: TestPlayer = { code, seat, token, name, auto }
    testPlayers = [...testPlayers.filter((x) => testKey(x) !== testKey(t)), t]
    runTestPlayer(t)
    persistNow()
    return { ok: true, seat, name }
  }

  function becomeHost(): void {
    if (closed || role === 'host') return
    const saved = load()
    server = createMemoryBackend({ config, snapshot: saved?.server ?? null })
    testPlayers = saved?.testPlayers ?? []
    const wasProxy = role === 'proxy'
    role = 'host'
    // Calls in flight to the old host will never be answered.
    for (const [id, p] of pendingCalls) {
      clearTimeout(p.timer)
      p.resolve(null)
      pendingCalls.delete(id)
    }
    for (const t of testPlayers) runTestPlayer(t)
    for (const sub of localSubs.values()) openLocal(sub)
    post({ t: 'hello', host: tabId })
    if (wasProxy) persistNow()
    readyResolve()
  }

  function becomeProxy(): void {
    if (closed || role !== 'pending') return
    role = 'proxy'
    lastHostSignal = Date.now()
    for (const sub of localSubs.values()) openLocal(sub)
    readyResolve()
  }

  // ---- election -------------------------------------------------------------------------------

  if (!locks || !channel) {
    becomeHost()
  } else {
    const hold = (): Promise<void> =>
      new Promise<void>((resolve) => {
        const stop = setInterval(() => {
          if (closed) {
            clearInterval(stop)
            resolve()
          }
        }, 500)
      })
    void locks
      .request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (lock) {
          becomeHost()
          return hold()
        }
        becomeProxy()
        // Queue for the hand-over when the host tab goes away.
        void locks.request(LOCK_NAME, async () => {
          becomeHost()
          return hold()
        })
      })
      .catch(() => becomeHost())
  }

  // Host heartbeat and peer clean-up; proxy liveness and host-loss detection.
  timers.push(
    setInterval(() => {
      if (closed) return
      if (role === 'host') {
        post({ t: 'beat', host: tabId })
        const now = Date.now()
        for (const [sid, r] of [...remoteSubs]) {
          if (now - (peerSeen.get(r.from) ?? 0) > PEER_SILENT_MS) stopRemote(sid)
        }
      } else if (role === 'proxy') {
        post({ t: 'alive', from: tabId })
        if (Date.now() - lastHostSignal > HOST_SILENT_MS) for (const sub of localSubs.values()) sub.handlers.onStatus('reconnecting')
      }
    }, BEAT_MS),
  )

  const onHide = (): void => {
    if (role === 'host') persistNow()
    else post({ t: 'bye', from: tabId })
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onHide)

  // ---- the Backend --------------------------------------------------------------------------

  const backend: Backend = {
    async call(action, body) {
      await ready
      if (role === 'host') return hostCall(action, body)
      const id = rid()
      const res = await new Promise<WireResponse | null>((resolve) => {
        const timer = setTimeout(() => {
          pendingCalls.delete(id)
          resolve(null)
        }, callTimeoutMs)
        pendingCalls.set(id, { resolve, timer })
        post({ t: 'call', id, from: tabId, action, body })
      })
      // A hand-over while the call was out: this tab may be the host now.
      if (!res && currentRole() === 'host') return hostCall(action, body)
      if (!res) throw new Error('local server did not answer')
      return res
    },
    subscribe(code, handlers, me) {
      const sub: LocalSub = { sid: rid(), code, handlers, me: me ? { ...me } : null, stop: null }
      localSubs.set(sub.sid, sub)
      if (role !== 'pending') openLocal(sub)
      return () => {
        localSubs.delete(sub.sid)
        sub.stop?.()
        sub.stop = null
        handlers.onStatus('closed')
      }
    },
  }

  return {
    backend,
    role: () => role,
    timerSeconds,
    async addTestPlayer(code, auto) {
      await ready
      if (role === 'host') return hostAddTestPlayer(code, auto)
      const id = rid()
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingTests.delete(id)
          resolve({ ok: false, message: 'The local server did not answer.' })
        }, callTimeoutMs)
        pendingTests.set(id, { resolve, timer })
        post({ t: 'test', id, from: tabId, code, auto })
      })
    },
    close() {
      if (closed) return
      onHide()
      closed = true
      for (const t of timers) clearInterval(t)
      for (const stop of testLoops.values()) stop()
      testLoops.clear()
      for (const sid of [...remoteSubs.keys()]) stopRemote(sid)
      for (const sub of localSubs.values()) sub.stop?.()
      if (persistTimer) clearTimeout(persistTimer)
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onHide)
      channel?.close()
    },
  }
}
