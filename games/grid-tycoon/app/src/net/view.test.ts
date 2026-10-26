// Pure multiplayer view rules: countdown text and levels, seat rows, the start plan, who has
// locked in, and the room code field.

import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import { ROOM_CODE_ALPHABET } from './client'
import type { PlayerView, RoomView } from './types'
import {
  CRITICAL_MS,
  WARN_MS,
  cleanCodeInput,
  clockAnnouncement,
  clockLevel,
  clockText,
  describePlan,
  formatClock,
  isMeLocked,
  lockSummary,
  seatRows,
  startPlan,
  waitingText,
} from './view'

const NOW = 1_700_000_000_000

function player(seat: number, over: Partial<PlayerView> = {}): PlayerView {
  return { roomCode: 'ABCDEF', seat, companyId: `p${seat}`, name: `P${seat}`, isBot: false, lockedRound: 0, lastSeen: NOW, ...over }
}

function room(over: Partial<RoomView> = {}): RoomView {
  return { code: 'ABCDEF', seed: 1, status: 'lobby', hostSeat: 0, round: 0, deadline: null, seats: 4, fillBots: true, state: null, createdAt: NOW, updatedAt: NOW, ...over }
}

describe('countdown', () => {
  it('formats m:ss, rounding up so 0:00 means time is up', () => {
    expect(formatClock(180_000)).toBe('3:00')
    expect(formatClock(161_000)).toBe('2:41')
    expect(formatClock(28_400)).toBe('0:29')
    expect(formatClock(28_000)).toBe('0:28')
    expect(formatClock(1)).toBe('0:01')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-5_000)).toBe('0:00')
    expect(formatClock(Number.NaN)).toBe('0:00')
  })

  it('is calm, then amber under 30 s, red under 10 s, over at 0', () => {
    expect(clockLevel(WARN_MS + 1)).toBe('calm')
    expect(clockLevel(WARN_MS)).toBe('warn')
    expect(clockLevel(CRITICAL_MS + 1)).toBe('warn')
    expect(clockLevel(CRITICAL_MS)).toBe('critical')
    expect(clockLevel(1)).toBe('critical')
    expect(clockLevel(0)).toBe('over')
    expect(clockLevel(-1)).toBe('over')
  })

  it('always says it in words', () => {
    expect(clockText(28_000)).toBe('0:28 left')
    expect(clockText(0)).toBe("Time's up")
  })

  it('announces crossing 30 s and 10 s once', () => {
    expect(clockAnnouncement(31_000, 30_000)).toMatch(/30 seconds/)
    expect(clockAnnouncement(30_000, 29_000)).toBeNull()
    expect(clockAnnouncement(10_500, 9_500)).toMatch(/10 seconds/)
    expect(clockAnnouncement(9_500, 8_500)).toBeNull()
    expect(clockAnnouncement(1_000, 0)).toBeNull()
    // A jump straight past 30 s into the last 10 announces the 10.
    expect(clockAnnouncement(40_000, 5_000)).toMatch(/10 seconds/)
  })
})

describe('lobby seats', () => {
  it('lists every seat with you, host, bot, presence and open seats', () => {
    const players = [player(0, { name: 'Ada' }), player(2, { name: 'Cleo', lastSeen: NOW - 120_000 }), player(1, { name: 'Volta', isBot: true })]
    const rows = seatRows(room({ seats: 4 }), players, [{ seat: 0, name: 'Ada' }], 0, NOW)
    expect(rows.map((r) => r.name)).toEqual(['Ada', 'Volta', 'Cleo', null])
    expect(rows[0]).toMatchObject({ isMe: true, isHost: true, presence: 'here' })
    expect(rows[1]).toMatchObject({ isBot: true, presence: 'bot' })
    expect(rows[2]).toMatchObject({ isMe: false, presence: 'away' })
    expect(rows[3]).toMatchObject({ presence: 'open', color: 3 })
  })

  it('falls back to last seen before presence arrives', () => {
    const rows = seatRows(room({ seats: 2 }), [player(0), player(1, { lastSeen: NOW - 5_000 })], [], 0, NOW)
    expect(rows[1].presence).toBe('here')
  })
})

describe('start plan', () => {
  it('fills empty seats with bots when the room says so', () => {
    const plan = startPlan(room({ seats: 4, fillBots: true }), [player(0), player(1)])
    expect(plan).toMatchObject({ humans: 2, bots: 2, total: 4, canStart: true, reason: null })
    expect(describePlan(plan)).toBe('2 players and 2 bots')
  })

  it('needs two companies without bots', () => {
    const alone = startPlan(room({ seats: 4, fillBots: false }), [player(0)])
    expect(alone.canStart).toBe(false)
    expect(alone.reason).toMatch(/second player/)
    const two = startPlan(room({ seats: 4, fillBots: false }), [player(0), player(3)])
    expect(two).toMatchObject({ total: 2, bots: 0, canStart: true })
    expect(describePlan(two)).toBe('2 players')
    expect(describePlan({ humans: 1, bots: 1 })).toBe('1 player and 1 bot')
  })

  it('cannot start twice', () => {
    expect(startPlan(room({ status: 'playing' }), [player(0), player(1)]).canStart).toBe(false)
  })
})

describe('lock summary', () => {
  const state = createGame({
    seed: 7,
    companies: [
      { id: 'p0', name: 'Ada', isBot: false },
      { id: 'p1', name: 'Volta Utility', isBot: true, bot: 'volta' },
      { id: 'p2', name: 'Bao', isBot: false },
      { id: 'p3', name: 'Cleo', isBot: false },
    ],
  })

  it('counts humans only, me included, and who the others are waiting on', () => {
    const r = room({ status: 'playing', round: 1 })
    const players = [player(0, { name: 'Ada', lockedRound: 1 }), player(1, { isBot: true }), player(2, { name: 'Bao' }), player(3, { name: 'Cleo', lockedRound: 1 })]
    const s = lockSummary(state, r, players, 0)
    expect(s.entries.map((e) => [e.name, e.locked, e.isMe])).toEqual([
      ['Ada', true, true],
      ['Bao', false, false],
      ['Cleo', true, false],
    ])
    expect(s).toMatchObject({ locked: 2, total: 3, waitingOn: 1 })
    expect(waitingText(s)).toBe('Waiting for Bao')
  })

  it('a lock from an earlier round does not count', () => {
    const r = room({ status: 'playing', round: 2 })
    const s = lockSummary(state, r, [player(0, { lockedRound: 1 }), player(2, { lockedRound: 1 }), player(3)], 0)
    expect(s.locked).toBe(0)
    expect(waitingText(s)).toBe('Waiting for 2 players')
  })

  it('leaves bankrupt companies out', () => {
    const broke = { ...state, companies: state.companies.map((c) => (c.id === 'p3' ? { ...c, bankrupt: true } : c)) }
    const s = lockSummary(broke, room({ status: 'playing', round: 1 }), [player(0, { lockedRound: 1 }), player(2, { lockedRound: 1 })], 0)
    expect(s).toMatchObject({ locked: 2, total: 2, waitingOn: 0 })
    expect(waitingText(s)).toMatch(/Resolving/)
  })

  it('is empty without a state', () => {
    expect(lockSummary(null, null, [], null)).toEqual({ entries: [], locked: 0, total: 0, waitingOn: 0 })
  })

  it('knows when this seat already locked the current round (rejoin)', () => {
    const r = room({ status: 'playing', round: 3 })
    expect(isMeLocked(r, [player(1, { lockedRound: 3 })], 1)).toBe(true)
    expect(isMeLocked(r, [player(1, { lockedRound: 2 })], 1)).toBe(false)
    expect(isMeLocked(room({ round: 3 }), [player(1, { lockedRound: 3 })], 1)).toBe(false)
    expect(isMeLocked(r, [player(1, { lockedRound: 3 })], null)).toBe(false)
  })
})

describe('room code field', () => {
  it('uppercases, drops letters outside the alphabet and stops at 6', () => {
    expect(cleanCodeInput('abc', ROOM_CODE_ALPHABET)).toBe('ABC')
    expect(cleanCodeInput('a b-c1', ROOM_CODE_ALPHABET)).toBe('ABC')
    expect(cleanCodeInput('IOxyz', ROOM_CODE_ALPHABET)).toBe('XYZ')
    expect(cleanCodeInput('abcdefgh', ROOM_CODE_ALPHABET)).toBe('ABCDEF')
  })
})
