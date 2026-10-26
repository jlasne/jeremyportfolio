// The multiplayer client against the in-memory room server: token storage, clock offset, live
// room updates, the deadline tick and the Realtime row mapping.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDecision, emptyDecision } from '../engine'
import type { GameState } from '../engine'
import {
  ROOM_CODE_ALPHABET as SERVER_ALPHABET,
  normalizeRoomCode as serverNormalize,
  playerToDb,
  roomToDb,
} from '../../../supabase/functions/grid-tycoon/rooms'
import { resetClock } from './clock'
import {
  ROOM_CODE_ALPHABET,
  companyIdForSeat,
  createRoom,
  getState,
  isOnline,
  joinRoom,
  msLeft,
  NetError,
  netBridge,
  normalizeRoomCode,
  roomCodeFromUrl,
  savedSeat,
  serverNow,
  startGame,
  submitDecision,
  subscribeRoom,
  useBackend,
} from './client'
import { createMemoryBackend } from './memory'
import { playerFromRow, roomFromRow } from './rows'
import type { Backend, PlayerView, PresenceEntry, RoomView } from './types'

class MemoryLocalStorage {
  data = new Map<string, string>()
  getItem(k: string): string | null {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v)
  }
  removeItem(k: string): void {
    this.data.delete(k)
  }
}

let ls: MemoryLocalStorage
beforeEach(() => {
  ls = new MemoryLocalStorage()
  vi.stubGlobal('localStorage', ls)
  resetClock()
})
afterEach(() => {
  useBackend(null)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Waits for queued microtasks and zero-delay timers (the memory server yields with setTimeout 0). */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

describe('net client: offline', () => {
  it('is offline with no config and no backend', async () => {
    expect(isOnline()).toBe(false)
    const res = await createRoom({ name: 'Ada', seats: 2, fillBots: true })
    expect(res).toMatchObject({ ok: false, error: 'offline' })
  })
})

describe('net client: actions', () => {
  it('creates a room and stores the seat token under gt.net.v1', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    expect(isOnline()).toBe(true)
    const res = await createRoom({ name: 'Ada', seats: 3, fillBots: true })
    if (!res.ok) throw new Error(res.message)
    expect(res.code).toHaveLength(6)
    expect(savedSeat(res.code)).toMatchObject({ seat: 0, token: res.token, name: 'Ada' })
    const stored = JSON.parse(ls.getItem('gt.net.v1') ?? '{}')
    expect(stored.rooms[res.code].token).toBe(res.token)
    expect(stored.last).toBe(res.code)
    expect('now' in res).toBe(false)
  })

  it('rejoins with the saved token, and joins fresh when that token went stale', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await server.service.create({ name: 'Host', seats: 4 })
    const first = await joinRoom({ code: host.code.toLowerCase(), name: 'Bob' })
    if (!first.ok) throw new Error(first.message)
    expect(first.seat).toBe(1)
    const again = await joinRoom({ code: host.code })
    expect(again).toMatchObject({ ok: true, seat: 1, rejoined: true })

    ls.setItem('gt.net.v1', JSON.stringify({ v: 1, rooms: { [host.code]: { code: host.code, seat: 3, token: 'B'.repeat(43), name: 'Bob', savedAt: Date.now() } }, last: host.code }))
    const fresh = await joinRoom({ code: host.code, name: 'Bob' })
    expect(fresh).toMatchObject({ ok: true, seat: 2, rejoined: false })
    expect(savedSeat(host.code)?.seat).toBe(2)

    expect(await joinRoom({ code: 'IOIOIO', name: 'x' })).toMatchObject({ ok: false, error: 'invalid_code' })
  })

  it('needs a saved seat to start or lock', async () => {
    useBackend(createMemoryBackend().backend)
    expect(await startGame('ABCDEF')).toMatchObject({ ok: false, error: 'no_token' })
    expect(await submitDecision('ABCDEF', 1, emptyDecision())).toMatchObject({ ok: false, error: 'no_token' })
  })

  it('returns validation issues and the current round on failures', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await createRoom({ name: 'Ada', seats: 2, fillBots: true })
    if (!host.ok) throw new Error(host.message)
    const started = await startGame(host.code)
    if (!started.ok) throw new Error(started.message)
    const state = started.room.state as GameState
    const bad = defaultDecision(state, 'p0')
    bad.shares = { mode: 'issue', count: 7 }
    const res = await submitDecision(host.code, 1, bad)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('invalid_decision')
    expect(res.issues?.map((i) => i.code)).toContain('shares_over_cap')
    expect(await submitDecision(host.code, 5, defaultDecision(state, 'p0'))).toMatchObject({ ok: false, error: 'wrong_round', round: 1 })
    // Alone with a bot, locking resolves at once.
    const ok = await submitDecision(host.code, 1, defaultDecision(state, 'p0'))
    expect(ok).toMatchObject({ ok: true, resolved: true })
  })

  it('netBridge rejects failed submits for the store', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await createRoom({ name: 'Ada', seats: 2, fillBots: false })
    if (!host.ok) throw new Error(host.message)
    await server.service.join({ code: host.code, name: 'Bob' })
    const started = await startGame(host.code)
    if (!started.ok) throw new Error(started.message)
    const bridge = netBridge(host.code)
    await expect(bridge.submit(emptyDecision(), 7)).rejects.toBeInstanceOf(NetError)
    await expect(bridge.submit(defaultDecision(started.room.state as GameState, 'p0'), 1)).resolves.toBeUndefined()
  })

  it('tracks the server clock offset', async () => {
    const server = createMemoryBackend({ now: () => Date.now() + 50_000 })
    useBackend(server.backend)
    await createRoom({ name: 'Ada', seats: 2, fillBots: true })
    expect(Math.abs(serverNow() - (Date.now() + 50_000))).toBeLessThan(1_000)
    expect(msLeft({ status: 'playing', deadline: Date.now() + 50_000 + 10_000 })).toBeGreaterThan(8_000)
    expect(msLeft({ status: 'lobby', deadline: null })).toBe(0)
  })
})

describe('net client: subscribeRoom', () => {
  it('follows the lobby, the start and presence', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await createRoom({ name: 'Ada', seats: 3, fillBots: true })
    if (!host.ok) throw new Error(host.message)
    const rooms: RoomView[] = []
    const lists: PlayerView[][] = []
    const presence: PresenceEntry[][] = []
    const sub = subscribeRoom(host.code, (r) => rooms.push(r), (p) => lists.push(p), { onPresence: (e) => presence.push(e) })
    await settle()
    expect(sub.room?.status).toBe('lobby')
    expect(presence.at(-1)).toEqual([{ seat: 0, name: 'Ada' }])

    await server.service.join({ code: host.code, name: 'Bob' })
    await settle()
    expect(lists.at(-1)?.map((p) => p.name)).toEqual(['Ada', 'Bob'])

    await startGame(host.code)
    await settle()
    const room = rooms.at(-1)!
    expect(room.status).toBe('playing')
    expect(room.state?.companies.map((c) => c.id)).toEqual(['p0', 'p1', 'p2'])
    expect(sub.players.map((p) => p.isBot)).toEqual([false, false, true])

    // A lock that does not resolve answers without the state; the subscription keeps its copy.
    const lock = await submitDecision(host.code, 1, defaultDecision(room.state as GameState, 'p0'))
    expect(lock).toMatchObject({ ok: true, resolved: false })
    await settle()
    expect(sub.room?.state?.round).toBe(1)
    expect(sub.players.find((p) => p.seat === 0)?.lockedRound).toBe(1)
    expect(companyIdForSeat(host.seat)).toBe('p0')
    sub.close()
  })

  it('ticks the server once the deadline passes, so an idle round still resolves', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await createRoom({ name: 'Ada', seats: 2, fillBots: true })
    if (!host.ok) throw new Error(host.message)
    await startGame(host.code)

    vi.useFakeTimers()
    const rooms: RoomView[] = []
    const sub = subscribeRoom(host.code, (r) => rooms.push(r), () => {})
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sub.room?.round).toBe(1)
    await vi.advanceTimersByTimeAsync(170_000)
    expect(sub.room?.round).toBe(1)
    // Token hashing (WebCrypto) is real async work, so fake time drifts a little per request:
    // step until the watcher's tick lands rather than asserting an exact second.
    let waited = 0
    while (sub.room?.round === 1 && waited < 60_000) {
      await vi.advanceTimersByTimeAsync(1_000)
      waited += 1_000
    }
    expect(sub.room?.round).toBe(2)
    expect(sub.room?.state?.round).toBe(2)
    expect(rooms.filter((r) => r.round === 2).length).toBeGreaterThan(0)
    sub.close()
  })

  it('reports a lost seat when another player claims it', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await createRoom({ name: 'Ada', seats: 2, fillBots: false })
    if (!host.ok) throw new Error(host.message)
    await server.service.join({ code: host.code, name: 'Bob' })
    await startGame(host.code)

    vi.useFakeTimers()
    const lost = vi.fn()
    const sub = subscribeRoom(host.code, () => {}, () => {}, { onSeatLost: lost })
    await vi.advanceTimersByTimeAsync(1_000)
    // Ada's browser keeps pinging, so her seat is never claimable...
    await vi.advanceTimersByTimeAsync(65_000)
    await expect(server.service.join({ code: host.code, name: 'Cy' })).resolves.toMatchObject({ seat: 1, claimed: true })
    // ...until someone takes it anyway (forced here), and the next heartbeat notices.
    server.storage.pokePlayer(host.code, 0, (p) => (p.lastSeen = 0))
    await server.service.join({ code: host.code, name: 'Dee' })
    await vi.advanceTimersByTimeAsync(21_000)
    expect(lost).toHaveBeenCalled()
    expect(savedSeat(host.code)).toBeNull()
    sub.close()
  })

  it('refetches when a Realtime push arrives without the state', async () => {
    const server = createMemoryBackend()
    // Strip `state` from every push, like Realtime does above its payload limit.
    const lossy: Backend = {
      call: server.backend.call,
      subscribe: (code, h, me) => server.backend.subscribe(code, { ...h, onRoom: (r) => h.onRoom({ ...r, state: undefined }) }, me),
    }
    useBackend(lossy)
    const host = await createRoom({ name: 'Ada', seats: 2, fillBots: true })
    if (!host.ok) throw new Error(host.message)
    const rooms: RoomView[] = []
    const sub = subscribeRoom(host.code, (r) => rooms.push(r), () => {})
    await settle()
    await server.service.start({ code: host.code, token: host.token })
    await settle()
    expect(rooms.at(-1)?.status).toBe('playing')
    expect(rooms.at(-1)?.state?.round).toBe(1)
    sub.close()
  })

  it('getState returns the room and seats', async () => {
    const server = createMemoryBackend()
    useBackend(server.backend)
    const host = await createRoom({ name: 'Ada', seats: 2, fillBots: true })
    if (!host.ok) throw new Error(host.message)
    expect(await getState(host.code)).toMatchObject({ ok: true, seat: null, room: { code: host.code, status: 'lobby' } })
  })
})

describe('net client: helpers', () => {
  it('maps Realtime rows exactly like the server stores them', () => {
    const room = {
      code: 'ABCDEF',
      seed: 123456,
      status: 'playing' as const,
      hostSeat: 0,
      round: 3,
      deadline: Date.UTC(2026, 9, 26, 12, 3),
      seats: 4,
      fillBots: true,
      state: { round: 3 } as unknown as GameState,
      createdAt: Date.UTC(2026, 9, 26, 12),
      updatedAt: Date.UTC(2026, 9, 26, 12, 1),
    }
    expect(roomFromRow(JSON.parse(JSON.stringify(roomToDb(room))))).toEqual(room)
    // Postgres bigint can arrive as a string.
    expect(roomFromRow({ ...roomToDb(room), seed: '123456' })?.seed).toBe(123456)
    const { state: _omit, ...withoutState } = roomToDb(room)
    void _omit
    expect(roomFromRow(withoutState)?.state).toBeUndefined()
    expect(roomFromRow({ code: 'ABCDEF' })).toBeNull()
    const player = { roomCode: 'ABCDEF', seat: 2, companyId: 'p2', name: 'Bob', isBot: false, lockedRound: 3, lastSeen: Date.UTC(2026, 9, 26, 12, 2) }
    expect(playerFromRow(JSON.parse(JSON.stringify(playerToDb(player))))).toEqual(player)
    expect(playerFromRow({})).toBeNull()
  })

  it('reads codes like the server', () => {
    expect(ROOM_CODE_ALPHABET).toBe(SERVER_ALPHABET)
    for (const input of ['abcdef', ' QWERTY ', 'ABCDEO', 'ABC', 'ABCDEFG', 'ab-def']) expect(normalizeRoomCode(input)).toBe(serverNormalize(input))
    expect(roomCodeFromUrl('?room=xyzabc')).toBe('XYZABC')
    expect(roomCodeFromUrl('?room=bad')).toBeNull()
    expect(roomCodeFromUrl('')).toBeNull()
  })
})
