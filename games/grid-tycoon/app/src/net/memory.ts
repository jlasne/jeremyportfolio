// An in-memory room server: the real room logic (supabase/functions/grid-tycoon/rooms.ts) over a
// Map-backed storage, with change events standing in for Supabase Realtime. Tests use it, and the
// app can use it to drive the lobby and the round timer with no Supabase project:
//
//   const { createMemoryBackend } = await import('./net/memory')
//   useBackend(createMemoryBackend().backend)
//
// Keep it out of static imports of the app: it pulls in the engine and the room logic.

import * as engineApi from '../engine'
import type { Config, Decision, GameState } from '../engine'
import {
  createRoomService,
  type DecisionRow,
  type PlayerPatch,
  type PlayerRow,
  type RoomEngine,
  type RoomExpect,
  type RoomPatch,
  type RoomRow,
  type RoomStorage,
} from '../../../supabase/functions/grid-tycoon/rooms'
import type { Backend, PresenceEntry, WireResponse } from './types'

export interface MemoryStorage extends RoomStorage<GameState, Decision> {
  /** Change feed, like Realtime postgres_changes on gt_rooms and gt_players. */
  listen(code: string, onRoom: (room: RoomRow<GameState>) => void, onPlayer: (p: PlayerRow) => void): () => void
  /** Direct access for tests (copies). */
  dump(): { rooms: RoomRow<GameState>[]; players: PlayerRow[]; secrets: { code: string; seat: number; tokenHash: string }[]; decisions: number }
  /** Test hook: rewrite a stored room in place. */
  poke(code: string, mutate: (room: RoomRow<GameState>) => void): void
  /** Test hook: rewrite a stored player in place. */
  pokePlayer(code: string, seat: number, mutate: (p: PlayerRow) => void): void
  /** Everything stored, as plain JSON-safe data (the local test server persists it across reloads). */
  snapshot(): MemorySnapshot
  /** Replaces everything stored with a snapshot. Emits no change events. */
  restore(snapshot: MemorySnapshot): void
}

/** The full content of a memory storage. */
export interface MemorySnapshot {
  v: 1
  rooms: RoomRow<GameState>[]
  players: PlayerRow[]
  secrets: { code: string; seat: number; tokenHash: string }[]
  decisions: { code: string; round: number; seat: number; decision: Decision }[]
}

const clone = <T>(x: T): T => structuredClone(x)
/**
 * Every operation yields, so concurrent calls interleave the way network calls would. Microtasks,
 * not timers: fake timers in tests must not stretch one request over seconds of fake time.
 */
const tickOnce = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

export function createMemoryStorage(now: () => number = () => Date.now()): MemoryStorage {
  const rooms = new Map<string, RoomRow<GameState>>()
  const players = new Map<string, PlayerRow>()
  const secrets = new Map<string, string>()
  const decisions = new Map<string, Decision>()
  const listeners = new Set<{ code: string; onRoom: (r: RoomRow<GameState>) => void; onPlayer: (p: PlayerRow) => void }>()

  const pk = (code: string, seat: number): string => `${code}/${seat}`
  const dk = (code: string, round: number, seat: number): string => `${code}/${round}/${seat}`

  function emitRoom(room: RoomRow<GameState>): void {
    for (const l of listeners) if (l.code === room.code) queueMicrotask(() => l.onRoom(clone(room)))
  }
  function emitPlayer(p: PlayerRow): void {
    for (const l of listeners) if (l.code === p.roomCode) queueMicrotask(() => l.onPlayer(clone(p)))
  }
  function removeRoom(code: string): void {
    rooms.delete(code)
    for (const map of [players, secrets, decisions] as Map<string, unknown>[]) {
      for (const k of [...map.keys()]) if (k.startsWith(`${code}/`)) map.delete(k)
    }
  }

  return {
    async deleteRoomsIdleSince(cutoff) {
      await tickOnce()
      for (const r of [...rooms.values()]) if (r.updatedAt < cutoff) removeRoom(r.code)
    },
    async insertRoom(room) {
      await tickOnce()
      if (rooms.has(room.code)) return false
      rooms.set(room.code, clone(room))
      emitRoom(room)
      return true
    },
    async getRoom(code) {
      await tickOnce()
      const r = rooms.get(code)
      return r ? clone(r) : null
    },
    async updateRoom(code, patch: RoomPatch<GameState>, expect: RoomExpect = {}) {
      await tickOnce()
      const r = rooms.get(code)
      if (!r) return false
      if (expect.round !== undefined && r.round !== expect.round) return false
      if (expect.status !== undefined && r.status !== expect.status) return false
      Object.assign(r, clone(patch), { updatedAt: now() })
      emitRoom(r)
      return true
    },
    async listPlayers(code) {
      await tickOnce()
      return [...players.values()].filter((p) => p.roomCode === code).sort((a, b) => a.seat - b.seat).map(clone)
    },
    async insertPlayer(p) {
      await tickOnce()
      if (!rooms.has(p.roomCode) || players.has(pk(p.roomCode, p.seat))) return false
      players.set(pk(p.roomCode, p.seat), clone(p))
      emitPlayer(p)
      return true
    },
    async upsertPlayer(p) {
      await tickOnce()
      if (!rooms.has(p.roomCode)) return
      players.set(pk(p.roomCode, p.seat), clone(p))
      emitPlayer(p)
    },
    async updatePlayer(code, seat, patch: PlayerPatch) {
      await tickOnce()
      const p = players.get(pk(code, seat))
      if (!p) return
      Object.assign(p, clone(patch))
      emitPlayer(p)
    },
    async claimSeat(code, seat, name, t, awayBefore) {
      await tickOnce()
      const p = players.get(pk(code, seat))
      if (!p || p.isBot || p.lastSeen >= awayBefore) return false
      Object.assign(p, { name, lastSeen: t })
      emitPlayer(p)
      return true
    },
    async deletePlayer(code, seat) {
      await tickOnce()
      players.delete(pk(code, seat))
      secrets.delete(pk(code, seat))
    },
    async seatForTokenHash(code, tokenHash) {
      await tickOnce()
      for (const [k, h] of secrets) if (h === tokenHash && k.startsWith(`${code}/`)) return Number(k.slice(code.length + 1))
      return null
    },
    async setSecret(code, seat, tokenHash) {
      await tickOnce()
      if (players.has(pk(code, seat))) secrets.set(pk(code, seat), tokenHash)
    },
    async putDecision(code, round, seat, decision) {
      await tickOnce()
      decisions.set(dk(code, round, seat), clone(decision))
    },
    async listDecisions(code, round): Promise<DecisionRow<Decision>[]> {
      await tickOnce()
      const prefix = `${code}/${round}/`
      return [...decisions.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, d]) => ({ seat: Number(k.slice(prefix.length)), decision: clone(d) }))
    },
    listen(code, onRoom, onPlayer) {
      const l = { code, onRoom, onPlayer }
      listeners.add(l)
      return () => listeners.delete(l)
    },
    dump() {
      return {
        rooms: [...rooms.values()].map(clone),
        players: [...players.values()].map(clone),
        secrets: [...secrets.entries()].map(([k, tokenHash]) => {
          const [code, seat] = k.split('/')
          return { code, seat: Number(seat), tokenHash }
        }),
        decisions: decisions.size,
      }
    },
    poke(code, mutate) {
      const r = rooms.get(code)
      if (r) mutate(r)
    },
    pokePlayer(code, seat, mutate) {
      const p = players.get(pk(code, seat))
      if (p) mutate(p)
    },
    snapshot() {
      return {
        v: 1,
        rooms: [...rooms.values()].map(clone),
        players: [...players.values()].map(clone),
        secrets: [...secrets.entries()].map(([k, tokenHash]) => {
          const [code, seat] = k.split('/')
          return { code, seat: Number(seat), tokenHash }
        }),
        decisions: [...decisions.entries()].map(([k, decision]) => {
          const [code, round, seat] = k.split('/')
          return { code, round: Number(round), seat: Number(seat), decision: clone(decision) }
        }),
      }
    },
    restore(snap) {
      rooms.clear()
      players.clear()
      secrets.clear()
      decisions.clear()
      if (!snap || snap.v !== 1) return
      for (const r of snap.rooms ?? []) rooms.set(r.code, clone(r))
      for (const p of snap.players ?? []) players.set(pk(p.roomCode, p.seat), clone(p))
      for (const x of snap.secrets ?? []) secrets.set(pk(x.code, x.seat), x.tokenHash)
      for (const d of snap.decisions ?? []) decisions.set(dk(d.code, d.round, d.seat), clone(d.decision))
    },
  }
}

/** The real engine, shaped for the room service. `config` lets tests play short games. */
export function engineForRooms(config: Config = engineApi.defaultConfig): RoomEngine<GameState, Decision> {
  return {
    createGame: (opts) => engineApi.createGame(opts, config),
    resolveRound: (s, d) => engineApi.resolveRound(s, d, config),
    validateDecision: (s, id, d) => engineApi.validateDecision(s, id, d, config),
    defaultDecision: (s, id) => engineApi.defaultDecision(s, id, config),
    botDecision: (s, id) => engineApi.botDecision(s, id, config),
    botNames: engineApi.BOT_NAMES,
    roundTimerSeconds: config.multiplayer.roundTimer,
  }
}

export interface MemoryServer {
  backend: Backend
  storage: MemoryStorage
  service: ReturnType<typeof createRoomService<GameState, Decision>>
}

/** A full offline room server and a Backend for src/net/client.ts to talk to. */
export function createMemoryBackend(opts: { config?: Config; now?: () => number; snapshot?: MemorySnapshot | null } = {}): MemoryServer {
  const now = opts.now ?? (() => Date.now())
  const storage = createMemoryStorage(now)
  if (opts.snapshot) storage.restore(opts.snapshot)
  const service = createRoomService<GameState, Decision>({ storage, engine: engineForRooms(opts.config), now })
  const presence = new Map<string, Set<{ me: PresenceEntry | null; notify: (e: PresenceEntry[]) => void }>>()

  function presenceOf(code: string): PresenceEntry[] {
    const set = presence.get(code)
    return set ? [...set].flatMap((s) => (s.me ? [s.me] : [])).sort((a, b) => a.seat - b.seat) : []
  }
  function broadcastPresence(code: string): void {
    const entries = presenceOf(code)
    for (const s of presence.get(code) ?? []) queueMicrotask(() => s.notify(entries))
  }

  const backend: Backend = {
    async call(action, body) {
      // Round-trip through JSON like the network does, so nothing shares object identity.
      const res = await service.handle(JSON.parse(JSON.stringify({ ...body, action })))
      return JSON.parse(JSON.stringify(res.body)) as WireResponse
    },
    subscribe(code, handlers, me) {
      const stop = storage.listen(code, (r) => handlers.onRoom(r), (p) => handlers.onPlayer(p))
      const entry = { me: me ? { ...me } : null, notify: handlers.onPresence }
      const set = presence.get(code) ?? new Set()
      set.add(entry)
      presence.set(code, set)
      queueMicrotask(() => handlers.onStatus('live'))
      broadcastPresence(code)
      return () => {
        stop()
        set.delete(entry)
        broadcastPresence(code)
        handlers.onStatus('closed')
      }
    },
  }
  return { backend, storage, service }
}
