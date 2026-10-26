// Realtime delivers raw table rows (snake_case, timestamptz strings). These turn them into the
// same RoomView / PlayerView the edge function returns. Mirrors roomFromDb / playerFromDb in
// supabase/functions/grid-tycoon/rooms.ts (a test keeps the two in step).

import type { GameState } from '../engine'
import type { PlayerView, RoomStatus, RoomView } from './types'

const STATUSES: RoomStatus[] = ['lobby', 'playing', 'finished']

function time(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x !== 'string') return null
  const t = Date.parse(x)
  return Number.isFinite(t) ? t : null
}

function int(x: unknown): number | null {
  const n = typeof x === 'string' ? Number(x) : x
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** A gt_rooms row, or null if it does not look like one. `state` is undefined when Realtime left it out. */
export function roomFromRow(row: unknown): (Omit<RoomView, 'state'> & { state: GameState | null | undefined }) | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const status = STATUSES.find((s) => s === r.status)
  const seed = int(r.seed)
  const hostSeat = int(r.host_seat)
  const round = int(r.round)
  const seats = int(r.seats)
  const createdAt = time(r.created_at)
  const updatedAt = time(r.updated_at)
  if (typeof r.code !== 'string' || !status || seed === null || hostSeat === null || round === null || seats === null || createdAt === null || updatedAt === null) {
    return null
  }
  const state = 'state' in r ? (r.state === null ? null : typeof r.state === 'object' ? (r.state as GameState) : undefined) : undefined
  return {
    code: r.code,
    seed,
    status,
    hostSeat,
    round,
    deadline: r.deadline === null || r.deadline === undefined ? null : time(r.deadline),
    seats,
    fillBots: r.fill_bots === true,
    state,
    createdAt,
    updatedAt,
  }
}

export function playerFromRow(row: unknown): PlayerView | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const seat = int(r.seat)
  const lockedRound = int(r.locked_round)
  const lastSeen = time(r.last_seen)
  if (typeof r.room_code !== 'string' || seat === null || typeof r.company_id !== 'string' || typeof r.name !== 'string' || lockedRound === null || lastSeen === null) {
    return null
  }
  return { roomCode: r.room_code, seat, companyId: r.company_id, name: r.name, isBot: r.is_bot === true, lockedRound, lastSeen }
}
