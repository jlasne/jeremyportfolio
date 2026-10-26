// The multiplayer room rules (supabase/functions/grid-tycoon/rooms.ts) against the real engine and
// the in-memory storage. The edge function runs the same code over Postgres.

import { describe, expect, it } from 'vitest'
import { defaultConfig, defaultDecision, emptyDecision } from '../engine'
import type { Config, Decision, GameState } from '../engine'
import {
  AWAY_MS,
  ROOM_CODE_ALPHABET,
  ROOM_TTL_MS,
  cleanName,
  createRoomService,
  hashToken,
  normalizeRoomCode,
  parseDecision,
  type RoomResponse,
} from '../../../supabase/functions/grid-tycoon/rooms'
import { createMemoryStorage, engineForRooms } from './memory'

const T0 = Date.UTC(2026, 9, 26, 12, 0, 0)
const TIMER = defaultConfig.multiplayer.roundTimer * 1000

function setup(config: Config = defaultConfig) {
  let t = T0
  const clock = { now: () => t, advance: (ms: number) => (t += ms), set: (ms: number) => (t = ms) }
  const storage = createMemoryStorage(clock.now)
  const engine = engineForRooms(config)
  const rooms = createRoomService<GameState, Decision>({ storage, engine, now: clock.now })
  return { clock, storage, rooms, engine }
}

async function rejects(p: Promise<unknown>, code: string): Promise<void> {
  await expect(p).rejects.toMatchObject({ code })
}

/** A room with a host and `others` more humans, not started. */
async function lobby(env: ReturnType<typeof setup>, opts: { seats?: number; fillBots?: boolean; others?: number } = {}) {
  const host = await env.rooms.create({ name: 'Ada', seats: opts.seats ?? 4, fillBots: opts.fillBots ?? true })
  const guests = []
  for (let i = 0; i < (opts.others ?? 1); i++) guests.push(await env.rooms.join({ code: host.code, name: `Guest ${i + 1}` }))
  return { code: host.code, host, guests }
}

async function started(env: ReturnType<typeof setup>, opts: { seats?: number; fillBots?: boolean; others?: number } = {}) {
  const l = await lobby(env, opts)
  const s = await env.rooms.start({ code: l.code, token: l.host.token })
  return { ...l, state: s.room.state as GameState }
}

function aiDecision(state: GameState, companyId: string): Decision {
  return defaultDecision(state, companyId)
}

describe('rooms: helpers', () => {
  it('normalizes codes and names', () => {
    expect(normalizeRoomCode(' abcdef ')).toBe('ABCDEF')
    expect(normalizeRoomCode('ABCDEI')).toBeNull() // I is not in the alphabet
    expect(normalizeRoomCode('ABCDE0')).toBeNull()
    expect(normalizeRoomCode('ABCDEFG')).toBeNull()
    expect(normalizeRoomCode(42)).toBeNull()
    expect(cleanName('  Grace   Hopper  ')).toBe('Grace Hopper')
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(20))
    expect(cleanName('a\u0000b\nc')).toBe('abc')
    expect(cleanName('   ')).toBeNull()
    expect(cleanName(7)).toBeNull()
  })

  it('accepts an engine decision and rejects malformed ones', () => {
    const d = emptyDecision()
    d.builds.push({ kind: 'plant', size: 'small', tile: [2, 0] })
    d.loans.repay = { n4: 3 }
    const parsed = parseDecision(JSON.parse(JSON.stringify(d)))
    // The wire mirror must stay assignable to the engine's Decision.
    const asDecision: Decision | null = parsed
    expect(asDecision).toEqual(d)
    expect(parseDecision(null)).toBeNull()
    expect(parseDecision({ ...d, power: { internal: 'lots' } })).toBeNull()
    expect(parseDecision({ ...d, compute: { ai: Infinity } })).toBeNull()
    expect(parseDecision({ ...d, builds: [{ kind: 'castle' }] })).toBeNull()
    expect(parseDecision({ ...d, builds: [{ kind: 'plant', tile: [0.5, 1] }] })).toBeNull()
    expect(parseDecision({ ...d, shares: { mode: 'both', count: 1 } })).toBeNull()
    expect(parseDecision({ ...d, upgrades: Array.from({ length: 100 }, (_, i) => `b${i}`) })).toBeNull()
    // Unknown fields are dropped, missing optional parts default to nothing.
    expect(parseDecision({ power: d.power, compute: d.compute, extra: 1 })).toEqual(emptyDecision())
  })
})

describe('rooms: create and join', () => {
  it('creates a room with a 6-letter code and a hashed host token', async () => {
    const env = setup()
    const r = await env.rooms.create({ name: '  Ada Lovelace the Great Engineer ', seats: 3, fillBots: false })
    expect(r.code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`))
    expect(r.code).not.toMatch(/[IO]/)
    expect(r.seat).toBe(0)
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(r.room).toMatchObject({ status: 'lobby', seats: 3, fillBots: false, hostSeat: 0, round: 0, deadline: null, state: null })
    expect(r.players).toEqual([expect.objectContaining({ seat: 0, name: 'Ada Lovelace the Gre', isBot: false, companyId: 'p0' })])
    const dump = env.storage.dump()
    expect(dump.secrets).toEqual([{ code: r.code, seat: 0, tokenHash: await hashToken(r.token) }])
    expect(JSON.stringify(dump)).not.toContain(r.token)
  })

  it('trims names to 20 characters', async () => {
    const env = setup()
    const r = await env.rooms.create({ name: 'Ada Lovelace the Great Engineer', seats: 2 })
    expect(r.players[0].name).toBe('Ada Lovelace the Gre')
    expect(r.players[0].name.length).toBe(20)
  })

  it('validates create input', async () => {
    const env = setup()
    await rejects(env.rooms.create({ name: 'A', seats: 1 }), 'invalid_seats')
    await rejects(env.rooms.create({ name: 'A', seats: 7 }), 'invalid_seats')
    await rejects(env.rooms.create({ name: 'A', seats: 2.5 }), 'invalid_seats')
    await rejects(env.rooms.create({ name: 'A', seats: '4' }), 'invalid_seats')
    await rejects(env.rooms.create({ name: '  ', seats: 4 }), 'invalid_name')
    await rejects(env.rooms.create({ name: 'A', seats: 4, fillBots: 'yes' }), 'bad_request')
  })

  it('joins the next free seat and refuses a full room', async () => {
    const env = setup()
    const host = await env.rooms.create({ name: 'Ada', seats: 2 })
    const b = await env.rooms.join({ code: host.code.toLowerCase(), name: 'Bob' })
    expect(b.seat).toBe(1)
    expect(b.rejoined).toBe(false)
    expect(b.players.map((p) => p.name)).toEqual(['Ada', 'Bob'])
    await rejects(env.rooms.join({ code: host.code, name: 'Cy' }), 'room_full')
    await rejects(env.rooms.join({ code: 'ZZZZZZ', name: 'Cy' }), 'room_not_found')
    await rejects(env.rooms.join({ code: 'NOPE', name: 'Cy' }), 'invalid_code')
  })

  it('concurrent joins get distinct seats', async () => {
    const env = setup()
    const host = await env.rooms.create({ name: 'Ada', seats: 6 })
    const joins = await Promise.all(['B', 'C', 'D', 'E', 'F'].map((name) => env.rooms.join({ code: host.code, name })))
    expect(joins.map((j) => j.seat).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('rejoins with a token without taking a new seat', async () => {
    const env = setup()
    const { code, guests } = await lobby(env)
    const again = await env.rooms.join({ code, token: guests[0].token })
    expect(again).toMatchObject({ seat: 1, rejoined: true, token: guests[0].token })
    expect(again.players).toHaveLength(2)
  })

  it('rejects invalid tokens everywhere', async () => {
    const env = setup()
    const a = await lobby(env)
    const b = await lobby(env)
    const forged = 'A'.repeat(43)
    await rejects(env.rooms.join({ code: a.code, token: forged }), 'invalid_token')
    await rejects(env.rooms.join({ code: a.code, token: 'short' }), 'invalid_token')
    // A token only works in its own room.
    await rejects(env.rooms.start({ code: a.code, token: b.host.token }), 'invalid_token')
    await rejects(env.rooms.ping({ code: a.code, token: forged }), 'invalid_token')
    await rejects(env.rooms.state({ code: a.code, token: forged }), 'invalid_token')
    await env.rooms.start({ code: a.code, token: a.host.token })
    await rejects(env.rooms.lock({ code: a.code, token: forged, round: 1, decision: emptyDecision() }), 'invalid_token')
    await rejects(env.rooms.lock({ code: a.code, token: undefined, round: 1, decision: emptyDecision() }), 'invalid_token')
  })

  it('deletes rooms idle for more than 2 days when a room is created', async () => {
    const env = setup()
    const old = await lobby(env)
    env.clock.advance(ROOM_TTL_MS + 1000)
    const fresh = await env.rooms.create({ name: 'New', seats: 2 })
    const dump = env.storage.dump()
    expect(dump.rooms.map((r) => r.code)).toEqual([fresh.code])
    expect(dump.players.every((p) => p.roomCode === fresh.code)).toBe(true)
    expect(dump.secrets.every((s) => s.code === fresh.code)).toBe(true)
    await rejects(env.rooms.join({ code: old.code, name: 'Late' }), 'room_not_found')
  })
})

describe('rooms: start', () => {
  it('only the host starts; bots fill the empty seats', async () => {
    const env = setup()
    const { code, host, guests } = await lobby(env, { seats: 5 })
    await rejects(env.rooms.start({ code, token: guests[0].token }), 'not_host')
    const s = await env.rooms.start({ code, token: host.token })
    const state = s.room.state as GameState
    expect(s.room.status).toBe('playing')
    expect(s.room.round).toBe(1)
    expect(s.room.deadline).toBe(T0 + TIMER)
    expect(s.room.seed).toBeGreaterThanOrEqual(100000)
    expect(state.seed).toBe(s.room.seed)
    expect(state.companies.map((c) => [c.id, c.name, c.isBot, c.bot])).toEqual([
      ['p0', 'Ada', false, null],
      ['p1', 'Guest 1', false, null],
      ['p2', 'Volta Utility', true, 'volta'],
      ['p3', 'Nimbus Compute', true, 'nimbus'],
      ['p4', 'Hashfield Mining', true, 'hashfield'],
    ])
    // Demand scales with the 5 companies.
    expect(state.pools.citizens.demand).toBe(defaultConfig.pool.startPerCompany.citizens * 5)
    expect(s.players.map((p) => [p.seat, p.isBot])).toEqual([
      [0, false],
      [1, false],
      [2, true],
      [3, true],
      [4, true],
    ])
    await rejects(env.rooms.start({ code, token: host.token }), 'not_in_lobby')
    await rejects(env.rooms.join({ code, name: 'Late' }), 'no_free_seat')
  })

  it('without bots, the companies are the humans and a lone host cannot start', async () => {
    const env = setup()
    const solo = await env.rooms.create({ name: 'Ada', seats: 4, fillBots: false })
    await rejects(env.rooms.start({ code: solo.code, token: solo.token }), 'not_enough_players')
    const { state } = await started(env, { seats: 4, fillBots: false, others: 2 })
    expect(state.companies.map((c) => c.isBot)).toEqual([false, false, false])
  })

  it('names a second lap of bots', async () => {
    const env = setup()
    const host = await env.rooms.create({ name: 'Ada', seats: 6 })
    const s = await env.rooms.start({ code: host.code, token: host.token })
    expect((s.room.state as GameState).companies.map((c) => c.name)).toEqual(['Ada', 'Volta Utility', 'Nimbus Compute', 'Hashfield Mining', 'Volta Utility 2', 'Nimbus Compute 2'])
  })

  it('seeds differ between rooms', async () => {
    const env = setup()
    const seeds = new Set<number>()
    for (let i = 0; i < 5; i++) seeds.add((await started(env, { seats: 2, others: 0 })).state.seed)
    expect(seeds.size).toBeGreaterThan(1)
  })
})

describe('rooms: lock and resolve', () => {
  it('validates the round and the decision', async () => {
    const env = setup()
    const { code, host, state } = await started(env)
    await rejects(env.rooms.lock({ code, token: host.token, round: 2, decision: emptyDecision() }), 'wrong_round')
    await rejects(env.rooms.lock({ code, token: host.token, round: 1, decision: { power: 'all' } }), 'invalid_decision')
    const bad = aiDecision(state, 'p0')
    bad.shares = { mode: 'buyback', count: 99 }
    const err = await env.rooms.lock({ code, token: host.token, round: 1, decision: bad }).catch((e) => e)
    expect(err.code).toBe('invalid_decision')
    expect(err.issues.map((i: { code: string }) => i.code)).toContain('shares_over_cap')
  })

  it('resolves once when every human has locked, with bots deciding by their rules', async () => {
    const env = setup()
    const { code, host, guests, state } = await started(env, { seats: 4 })
    const mine = aiDecision(state, 'p0')
    mine.loans.take = 20
    const first = await env.rooms.lock({ code, token: host.token, round: 1, decision: mine })
    expect(first.resolved).toBe(false)
    expect(first.room.round).toBe(1)
    // Nothing resolved: the large state is left out of the answer.
    expect(first.room.state).toBeUndefined()
    expect('state' in JSON.parse(JSON.stringify(first.room))).toBe(false)
    expect(first.players.find((p) => p.seat === 0)?.lockedRound).toBe(1)

    env.clock.advance(5000)
    const second = await env.rooms.lock({ code, token: guests[0].token, round: 1, decision: aiDecision(state, 'p1') })
    expect(second.resolved).toBe(true)
    expect(second.room.round).toBe(2)
    expect(second.room.deadline).toBe(T0 + 5000 + TIMER)
    const after = second.room.state as GameState
    expect(after.history).toHaveLength(1)
    expect(after.companies[0].loans).toHaveLength(1)
    expect(after.companies[0].loans[0].principal).toBe(20)
    // Bots played: every company has a round result.
    expect(after.companies.every((c) => c.history.length === 1)).toBe(true)
    await rejects(env.rooms.lock({ code, token: host.token, round: 1, decision: mine }), 'wrong_round')
  })

  it('a re-lock before resolution replaces the earlier decision', async () => {
    const env = setup()
    const { code, host, guests, state } = await started(env)
    const a = aiDecision(state, 'p0')
    a.loans.take = 10
    await env.rooms.lock({ code, token: host.token, round: 1, decision: a })
    a.loans.take = 15
    await env.rooms.lock({ code, token: host.token, round: 1, decision: a })
    const r = await env.rooms.lock({ code, token: guests[0].token, round: 1, decision: aiDecision(state, 'p1') })
    expect((r.room.state as GameState).companies[0].loans[0].principal).toBe(15)
  })

  it('concurrent last locks resolve the round exactly once', async () => {
    const env = setup()
    const { code, host, guests, state } = await started(env, { seats: 3, others: 2 })
    const results = await Promise.all([host, ...guests].map((g, i) => env.rooms.lock({ code, token: g.token, round: 1, decision: aiDecision(state, `p${i}`) })))
    const room = (await env.rooms.state({ code })).room
    expect(room.round).toBe(2)
    expect((room.state as GameState).history).toHaveLength(1)
    expect(results.filter((r) => r.resolved).length).toBeLessThanOrEqual(1)
    expect(results.some((r) => r.room.round === 2)).toBe(true)
  })

  it('tick does nothing before the deadline', async () => {
    const env = setup()
    const { code } = await started(env)
    env.clock.advance(TIMER - 1)
    const t = await env.rooms.tick({ code })
    expect(t.resolved).toBe(false)
    expect(t.room.round).toBe(1)
    expect(t.room.state).toBeUndefined()
  })

  it('tick after the deadline resolves with defaults for missing humans', async () => {
    const env = setup()
    const { code, host, state } = await started(env)
    const mine = aiDecision(state, 'p0')
    mine.builds.push({ kind: 'plant', size: 'small' })
    await env.rooms.lock({ code, token: host.token, round: 1, decision: mine })
    env.clock.advance(TIMER)
    const t = await env.rooms.tick({ code })
    expect(t.resolved).toBe(true)
    const after = t.room.state as GameState
    expect(after.round).toBe(2)
    // The host's build went through; the absent guest repeated the default allocations with nothing else.
    expect(after.companies[0].buildings).toHaveLength(3)
    const guest = after.companies[1]
    const expected = defaultDecision(state, 'p1')
    expect(guest.lastDecision?.power).toEqual(expected.power)
    expect(guest.lastDecision?.compute).toEqual(expected.compute)
    expect(guest.lastDecision?.builds).toEqual([])
    expect(guest.lastDecision?.loans.take).toBe(0)
    expect(guest.buildings).toHaveLength(2)
  })

  it('concurrent ticks after the deadline resolve once', async () => {
    const env = setup()
    const { code } = await started(env)
    env.clock.advance(TIMER + 1)
    const ticks = await Promise.all([1, 2, 3, 4].map(() => env.rooms.tick({ code })))
    expect(ticks.filter((t) => t.resolved)).toHaveLength(1)
    const room = (await env.rooms.state({ code })).room
    expect(room.round).toBe(2)
    expect((room.state as GameState).history).toHaveLength(1)
  })

  it('a tick racing the last lock still resolves once', async () => {
    const env = setup()
    const { code, host, state } = await started(env, { others: 0 })
    env.clock.advance(TIMER)
    const [lock, tick] = await Promise.all([env.rooms.lock({ code, token: host.token, round: 1, decision: aiDecision(state, 'p0') }), env.rooms.tick({ code })])
    expect(Number(lock.resolved) + Number(tick.resolved)).toBe(1)
    expect(((await env.rooms.state({ code })).room.state as GameState).history).toHaveLength(1)
  })

  it('finishes after the last round', async () => {
    const short = { ...defaultConfig, rounds: 3 }
    const env = setup(short)
    const { code, host, guests } = await started(env)
    for (let round = 1; round <= 3; round++) {
      const s = (await env.rooms.state({ code })).room.state as GameState
      await env.rooms.lock({ code, token: host.token, round, decision: aiDecision(s, 'p0') })
      await env.rooms.lock({ code, token: guests[0].token, round, decision: aiDecision(s, 'p1') })
    }
    const end = (await env.rooms.state({ code })).room
    expect(end).toMatchObject({ status: 'finished', round: 4, deadline: null })
    expect((end.state as GameState).finished).toBe(true)
    await rejects(env.rooms.lock({ code, token: host.token, round: 4, decision: emptyDecision() }), 'not_playing')
    env.clock.advance(TIMER * 2)
    expect((await env.rooms.tick({ code })).resolved).toBe(false)
    await rejects(env.rooms.join({ code, name: 'Late' }), 'room_finished')
    // A player can still reopen the final state.
    expect((await env.rooms.join({ code, token: guests[0].token })).rejoined).toBe(true)
  })

  it('plays the game out when no human is left in it', async () => {
    const env = setup({ ...defaultConfig, rounds: 6 })
    const { code, guests } = await started(env)
    env.storage.poke(code, (r) => {
      r.state!.companies.find((x) => x.id === 'p1')!.bankrupt = true
    })
    await rejects(env.rooms.lock({ code, token: guests[0].token, round: 1, decision: emptyDecision() }), 'bankrupt')
    env.storage.poke(code, (r) => {
      r.state!.companies.find((x) => x.id === 'p0')!.bankrupt = true
    })
    env.clock.advance(TIMER)
    const t = await env.rooms.tick({ code })
    expect(t.resolved).toBe(true)
    expect(t.room.status).toBe('finished')
    expect((t.room.state as GameState).history).toHaveLength(6)
  })

  it('rejects locks before the start', async () => {
    const env = setup()
    const l = await lobby(env)
    await rejects(env.rooms.lock({ code: l.code, token: l.host.token, round: 0, decision: emptyDecision() }), 'not_playing')
  })
})

describe('rooms: rejoin after start', () => {
  it('a new name claims the seat of a player away for more than 60 s', async () => {
    const env = setup()
    const { code, host, guests } = await started(env, { seats: 3, others: 1 })
    env.clock.advance(AWAY_MS - 1000)
    await env.rooms.ping({ code, token: host.token })
    await rejects(env.rooms.join({ code, name: 'Newcomer' }), 'no_free_seat')
    env.clock.advance(2000)
    const claim = await env.rooms.join({ code, name: 'Newcomer' })
    expect(claim).toMatchObject({ seat: 1, claimed: true, rejoined: false })
    expect(claim.players.find((p) => p.seat === 1)?.name).toBe('Newcomer')
    // The previous token no longer holds the seat; the new one does.
    await rejects(env.rooms.ping({ code, token: guests[0].token }), 'invalid_token')
    expect((await env.rooms.ping({ code, token: claim.token })).seat).toBe(1)
    // Bots are never claimable.
    env.clock.advance(AWAY_MS * 2)
    await env.rooms.ping({ code, token: claim.token })
    const hostClaim = await env.rooms.join({ code, name: 'Third' })
    expect(hostClaim.seat).toBe(0)
  })

  it('a dropped player rejoins its seat with its token and continues', async () => {
    const env = setup()
    const { code, guests, state } = await started(env)
    env.clock.advance(AWAY_MS * 3)
    const back = await env.rooms.join({ code, token: guests[0].token })
    expect(back).toMatchObject({ seat: 1, rejoined: true })
    const lock = await env.rooms.lock({ code, token: guests[0].token, round: 1, decision: aiDecision(state, 'p1') })
    expect(lock.players.find((p) => p.seat === 1)?.lockedRound).toBe(1)
  })
})

describe('rooms: handle', () => {
  it('wraps results with ok and the server time', async () => {
    const env = setup()
    const res = await env.rooms.handle({ action: 'create', name: 'Ada', seats: 2 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, now: T0, seat: 0 })
  })

  it('maps errors to status codes', async () => {
    const env = setup()
    const cases: [unknown, number, string][] = [
      [null, 400, 'bad_request'],
      ['create', 400, 'bad_request'],
      [{ action: 'explode' }, 400, 'unknown_action'],
      [{ action: 'toString' }, 400, 'unknown_action'],
      [{ action: 'state', code: 'ZZZZZZ' }, 404, 'room_not_found'],
      [{ action: 'create', name: 'A', seats: 9 }, 400, 'invalid_seats'],
    ]
    for (const [body, status, error] of cases) {
      const res = await env.rooms.handle(body)
      expect(res.status).toBe(status)
      expect(res.body as RoomResponse<object>).toMatchObject({ ok: false, error, now: T0 })
    }
  })

  it('never leaks a stack on unexpected errors', async () => {
    const env = setup()
    const broken = createRoomService<GameState, Decision>({
      storage: { ...env.storage, getRoom: () => Promise.reject(new Error('db down')) },
      engine: env.engine,
      now: env.clock.now,
    })
    const original = console.error
    console.error = () => {}
    try {
      const res = await broken.handle({ action: 'state', code: 'ABCDEF' })
      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ ok: false, error: 'server_error' })
      expect(JSON.stringify(res.body)).not.toContain('db down')
    } finally {
      console.error = original
    }
  })
})
