// Pure helpers that turn room data into what the lobby and the top bar show: the countdown text
// and level, the seat list, who has locked in, and whether the host can start. No React, no
// stores, no clock reads (callers pass `now`), so every rule here is unit-tested.

import type { GameState } from '../engine'
import type { PlayerView, PresenceEntry, RoomView } from './types'

// ---------------------------------------------------------------------------------------------
// Countdown

export type ClockLevel = 'calm' | 'warn' | 'critical' | 'over'

/** Amber under this many ms, red under CRITICAL_MS. */
export const WARN_MS = 30_000
export const CRITICAL_MS = 10_000

/** "2:41" from milliseconds left, rounding up so the clock shows 0:00 only when time is up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function clockLevel(ms: number): ClockLevel {
  if (!(ms > 0)) return 'over'
  if (ms <= CRITICAL_MS) return 'critical'
  if (ms <= WARN_MS) return 'warn'
  return 'calm'
}

/** The words next to the icon: "2:41 left", or "Time's up" once the deadline has passed. */
export function clockText(ms: number): string {
  return clockLevel(ms) === 'over' ? "Time's up" : `${formatClock(ms)} left`
}

/** A spoken announcement when the countdown crosses 30 s or 10 s (null otherwise). */
export function clockAnnouncement(prevMs: number, ms: number): string | null {
  if (prevMs > WARN_MS && ms <= WARN_MS && ms > CRITICAL_MS) return '30 seconds left in this round.'
  if (prevMs > CRITICAL_MS && ms <= CRITICAL_MS && ms > 0) return '10 seconds left in this round.'
  return null
}

// ---------------------------------------------------------------------------------------------
// Seats (lobby)

export type SeatPresence = 'here' | 'away' | 'bot' | 'open'

export interface SeatRow {
  seat: number
  /** Empty seat: null. */
  name: string | null
  isMe: boolean
  isHost: boolean
  isBot: boolean
  presence: SeatPresence
  /** CSS company colour index (seat order, as the engine assigns colours at start). */
  color: number
}

/**
 * One row per seat of the room. A human is "here" while Realtime presence lists them (or, before
 * presence arrives, when the server heard from them in the last minute), else "away".
 */
export function seatRows(
  room: Pick<RoomView, 'seats' | 'hostSeat'>,
  players: PlayerView[],
  presence: PresenceEntry[],
  mySeat: number | null,
  now: number,
  awayMs = 60_000,
): SeatRow[] {
  const bySeat = new Map(players.map((p) => [p.seat, p]))
  const present = new Set(presence.map((p) => p.seat))
  const count = Math.max(room.seats, ...players.map((p) => p.seat + 1))
  const rows: SeatRow[] = []
  for (let seat = 0; seat < count; seat++) {
    const p = bySeat.get(seat)
    if (!p) {
      rows.push({ seat, name: null, isMe: false, isHost: false, isBot: false, presence: 'open', color: seat })
      continue
    }
    const here = present.has(seat) || seat === mySeat || (presence.length === 0 && now - p.lastSeen < awayMs)
    rows.push({
      seat,
      name: p.name,
      isMe: seat === mySeat,
      isHost: seat === room.hostSeat,
      isBot: p.isBot,
      presence: p.isBot ? 'bot' : here ? 'here' : 'away',
      color: seat,
    })
  }
  return rows
}

export interface StartPlan {
  humans: number
  bots: number
  total: number
  canStart: boolean
  /** Why Start is disabled (null when it is enabled). */
  reason: string | null
}

/** What Start would do: the server fills empty seats with bots when the host chose so. */
export function startPlan(room: Pick<RoomView, 'seats' | 'fillBots' | 'status'>, players: PlayerView[]): StartPlan {
  const humans = players.filter((p) => !p.isBot).length
  const total = room.fillBots ? Math.max(room.seats, humans) : humans
  const bots = total - humans
  if (room.status !== 'lobby') return { humans, bots, total, canStart: false, reason: 'The game has started.' }
  if (total < 2) return { humans, bots, total, canStart: false, reason: 'Waiting for a second player.' }
  return { humans, bots, total, canStart: true, reason: null }
}

/** "2 players and 2 bots". */
export function describePlan(plan: Pick<StartPlan, 'humans' | 'bots'>): string {
  const h = `${plan.humans} ${plan.humans === 1 ? 'player' : 'players'}`
  if (plan.bots === 0) return h
  return `${h} and ${plan.bots} ${plan.bots === 1 ? 'bot' : 'bots'}`
}

// ---------------------------------------------------------------------------------------------
// Lock-in status (in game)

export interface LockEntry {
  seat: number
  companyId: string
  name: string
  locked: boolean
  isMe: boolean
  bankrupt: boolean
  color: number
}

export interface LockSummary {
  /** Every human company still in the race, in seat order. */
  entries: LockEntry[]
  locked: number
  total: number
  /** Other players (not me) who have not locked yet. */
  waitingOn: number
}

/** Who has locked in for the room's current round (humans only: bots decide at resolution). */
export function lockSummary(state: GameState | null, room: Pick<RoomView, 'round'> | null, players: PlayerView[], mySeat: number | null): LockSummary {
  if (!state || !room) return { entries: [], locked: 0, total: 0, waitingOn: 0 }
  const bySeat = new Map(players.map((p) => [p.seat, p]))
  const entries: LockEntry[] = []
  for (const c of state.companies) {
    if (c.isBot) continue
    const seat = Number(c.id.replace(/^p/, ''))
    const p = Number.isInteger(seat) ? bySeat.get(seat) : undefined
    entries.push({
      seat,
      companyId: c.id,
      name: p?.name ?? c.name,
      locked: !!p && p.lockedRound === room.round,
      isMe: seat === mySeat,
      bankrupt: c.bankrupt,
      color: c.color,
    })
  }
  const active = entries.filter((e) => !e.bankrupt)
  const locked = active.filter((e) => e.locked).length
  const waitingOn = active.filter((e) => !e.locked && !e.isMe).length
  return { entries: active, locked, total: active.length, waitingOn }
}

/** "Waiting for 2 players" / "Waiting for Ada" / "Resolving the round…". */
export function waitingText(summary: LockSummary): string {
  const others = summary.entries.filter((e) => !e.locked && !e.isMe)
  if (others.length === 0) return 'Resolving the round…'
  if (others.length === 1) return `Waiting for ${others[0].name}`
  return `Waiting for ${others.length} players`
}

/** True when this seat already has a decision locked for the room's current round (after a rejoin). */
export function isMeLocked(room: Pick<RoomView, 'round' | 'status'> | null, players: PlayerView[], mySeat: number | null): boolean {
  if (!room || room.status !== 'playing' || mySeat === null) return false
  const me = players.find((p) => p.seat === mySeat)
  return !!me && me.lockedRound === room.round
}

// ---------------------------------------------------------------------------------------------
// Input

/** Same alphabet as the server (no I, no O): the code field drops anything else as you type. */
export function cleanCodeInput(raw: string, alphabet: string): string {
  let out = ''
  for (const ch of raw.toUpperCase()) if (alphabet.includes(ch) && out.length < 6) out += ch
  return out
}
