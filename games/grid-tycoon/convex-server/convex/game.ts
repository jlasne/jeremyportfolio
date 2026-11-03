// Grid Tycoon rooms on Convex: the pure room logic of supabase/functions/grid-tycoon/rooms.ts with a
// Convex storage adapter. Every request runs inside one mutation, so it is a single serializable
// transaction: the round compare-and-set of rooms.ts holds by construction.
//
// - handle: one room action (create, join, start, lock, tick, state, ping), called by the HTTP door.
// - watch: the live room head and its players, for the browser's reactive subscription (no state:
//   the client fetches it with `state` when the round changes, it can be a few hundred KB).
// - scheduledTick: resolves a round at its deadline even when nobody is online.

import { v } from 'convex/values'
import { internalMutation, query, type MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import * as bundled from '../../supabase/functions/grid-tycoon/engine.js'
import {
  createRoomService,
  type EngineState,
  type PlayerRow,
  type RoomEngine,
  type RoomRow,
  type RoomStorage,
  type WireDecision,
} from '../../supabase/functions/grid-tycoon/rooms'

interface EngineBundle {
  createGame(opts: Parameters<RoomEngine['createGame']>[0]): EngineState
  resolveRound(state: EngineState, decisions: Record<string, WireDecision>): EngineState
  validateDecision(state: EngineState, companyId: string, decision: WireDecision): ReturnType<RoomEngine['validateDecision']>
  defaultDecision(state: EngineState, companyId: string): WireDecision
  botDecision(state: EngineState, companyId: string): WireDecision
  BOT_NAMES: RoomEngine['botNames']
  defaultConfig: { multiplayer: { roundTimer: number } }
}
const api = bundled as unknown as EngineBundle

const engine: RoomEngine<EngineState, WireDecision> = {
  createGame: (opts) => api.createGame(opts),
  resolveRound: (state, decisions) => api.resolveRound(state, decisions),
  validateDecision: (state, id, decision) => api.validateDecision(state, id, decision),
  defaultDecision: (state, id) => api.defaultDecision(state, id),
  botDecision: (state, id) => api.botDecision(state, id),
  botNames: api.BOT_NAMES,
  roundTimerSeconds: api.defaultConfig.multiplayer.roundTimer,
}

/** Rooms deleted per cleanup, so one request never does unbounded work. */
const CLEANUP_BATCH = 10

function roomFromDoc(d: Doc<'rooms'>): RoomRow<EngineState> {
  return {
    code: d.code,
    seed: d.seed,
    status: d.status as RoomRow['status'],
    hostSeat: d.hostSeat,
    round: d.round,
    deadline: d.deadline,
    seats: d.seats,
    fillBots: d.fillBots,
    state: d.state ? (JSON.parse(d.state) as EngineState) : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

function playerFromDoc(d: Doc<'players'>): PlayerRow {
  return { roomCode: d.roomCode, seat: d.seat, companyId: d.companyId, name: d.name, isBot: d.isBot, lockedRound: d.lockedRound, lastSeen: d.lastSeen }
}

function convexStorage(ctx: MutationCtx): RoomStorage<EngineState, WireDecision> {
  const db = ctx.db
  const roomDoc = (code: string) => db.query('rooms').withIndex('by_code', (q) => q.eq('code', code)).unique()
  const playerDoc = (code: string, seat: number) =>
    db
      .query('players')
      .withIndex('by_room_seat', (q) => q.eq('roomCode', code).eq('seat', seat))
      .unique()

  async function deleteRoom(code: string, id: Doc<'rooms'>['_id']): Promise<void> {
    for (const p of await db.query('players').withIndex('by_room_seat', (q) => q.eq('roomCode', code)).collect()) await db.delete(p._id)
    for (const s of await db.query('secrets').withIndex('by_room_seat', (q) => q.eq('roomCode', code)).collect()) await db.delete(s._id)
    for (const d of await db.query('decisions').withIndex('by_room_round_seat', (q) => q.eq('roomCode', code)).collect()) await db.delete(d._id)
    await db.delete(id)
  }

  return {
    async deleteRoomsIdleSince(cutoff) {
      const old = await db
        .query('rooms')
        .withIndex('by_updated', (q) => q.lt('updatedAt', cutoff))
        .take(CLEANUP_BATCH)
      for (const r of old) await deleteRoom(r.code, r._id)
    },
    async insertRoom(room) {
      if (await roomDoc(room.code)) return false
      await db.insert('rooms', { ...room, state: room.state === null ? null : JSON.stringify(room.state) })
      return true
    },
    async getRoom(code) {
      const d = await roomDoc(code)
      return d ? roomFromDoc(d) : null
    },
    async updateRoom(code, patch, expect = {}) {
      const d = await roomDoc(code)
      if (!d) return false
      if (expect.round !== undefined && d.round !== expect.round) return false
      if (expect.status !== undefined && d.status !== expect.status) return false
      const next: Partial<Doc<'rooms'>> = { updatedAt: Date.now() }
      if (patch.status !== undefined) next.status = patch.status
      if (patch.round !== undefined) next.round = patch.round
      if (patch.deadline !== undefined) next.deadline = patch.deadline
      if (patch.seed !== undefined) next.seed = patch.seed
      if (patch.state !== undefined) next.state = patch.state === null ? null : JSON.stringify(patch.state)
      await db.patch(d._id, next)
      return true
    },
    async listPlayers(code) {
      const rows = await db.query('players').withIndex('by_room_seat', (q) => q.eq('roomCode', code)).collect()
      return rows.map(playerFromDoc)
    },
    async insertPlayer(player) {
      if (await playerDoc(player.roomCode, player.seat)) return false
      await db.insert('players', player)
      return true
    },
    async upsertPlayer(player) {
      const d = await playerDoc(player.roomCode, player.seat)
      if (d) await db.replace(d._id, player)
      else await db.insert('players', player)
    },
    async updatePlayer(code, seat, patch) {
      const d = await playerDoc(code, seat)
      if (d) await db.patch(d._id, patch)
    },
    async claimSeat(code, seat, name, now, awayBefore) {
      const d = await playerDoc(code, seat)
      if (!d || d.isBot || d.lastSeen >= awayBefore) return false
      await db.patch(d._id, { name, lastSeen: now })
      return true
    },
    async deletePlayer(code, seat) {
      const d = await playerDoc(code, seat)
      if (d) await db.delete(d._id)
    },
    async seatForTokenHash(code, tokenHash) {
      const d = await db
        .query('secrets')
        .withIndex('by_room_hash', (q) => q.eq('roomCode', code).eq('tokenHash', tokenHash))
        .first()
      return d ? d.seat : null
    },
    async setSecret(code, seat, tokenHash) {
      const d = await db
        .query('secrets')
        .withIndex('by_room_seat', (q) => q.eq('roomCode', code).eq('seat', seat))
        .unique()
      if (d) await db.patch(d._id, { tokenHash })
      else await db.insert('secrets', { roomCode: code, seat, tokenHash })
    },
    async putDecision(code, round, seat, decision) {
      const d = await db
        .query('decisions')
        .withIndex('by_room_round_seat', (q) => q.eq('roomCode', code).eq('round', round).eq('seat', seat))
        .unique()
      const json = JSON.stringify(decision)
      if (d) await db.patch(d._id, { decision: json })
      else await db.insert('decisions', { roomCode: code, round, seat, decision: json })
    },
    async listDecisions(code, round) {
      const rows = await db
        .query('decisions')
        .withIndex('by_room_round_seat', (q) => q.eq('roomCode', code).eq('round', round))
        .collect()
      return rows.map((r) => ({ seat: r.seat, decision: JSON.parse(r.decision) as WireDecision }))
    },
  }
}

/** Random bytes from the HTTP action (real entropy), handed out in order; Math.random only as a fallback. */
function entropyPool(hex: string): (n: number) => Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16)
  let at = 0
  return (n) => {
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) out[i] = at < bytes.length ? bytes[at++] : Math.floor(Math.random() * 256)
    return out
  }
}

async function run(ctx: MutationCtx, body: unknown, entropy: string): Promise<string> {
  const code = typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string' ? (body as { code: string }).code.toUpperCase() : null
  const before = code ? await ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', code)).unique() : null
  const svc = createRoomService<EngineState, WireDecision>({ storage: convexStorage(ctx), engine, randomBytes: entropyPool(entropy) })
  const res = await svc.handle(body)

  // A new deadline (start, or a round resolved): resolve it on time even if every browser is closed.
  const resCode = (res.body as { code?: unknown; room?: { code?: unknown } }).room?.code ?? (res.body as { code?: unknown }).code
  const roomCode = typeof resCode === 'string' ? resCode : code
  if (roomCode) {
    const after = await ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', roomCode)).unique()
    if (after && after.status === 'playing' && after.deadline !== null && after.deadline !== (before?.deadline ?? null)) {
      await ctx.scheduler.runAt(after.deadline + 1000, internal.game.scheduledTick, { code: roomCode, round: after.round })
    }
  }
  return JSON.stringify(res)
}

export const handle = internalMutation({
  args: { body: v.string(), entropy: v.string() },
  handler: async (ctx, { body, entropy }) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      return JSON.stringify({ status: 400, body: { ok: false, error: 'bad_request', message: 'The body is not valid JSON.', now: Date.now() } })
    }
    return run(ctx, parsed, entropy)
  },
})

export const scheduledTick = internalMutation({
  args: { code: v.string(), round: v.number() },
  handler: async (ctx, { code, round }) => {
    const room = await ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', code)).unique()
    if (!room || room.status !== 'playing' || room.round !== round) return
    await run(ctx, { action: 'tick', code }, '')
  },
})

/** The room head (no state) and its players, pushed to subscribed browsers on every change. */
export const watch = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .unique()
    if (!room) return null
    const players = await ctx.db
      .query('players')
      .withIndex('by_room_seat', (q) => q.eq('roomCode', room.code))
      .collect()
    const { state, _id, _creationTime, ...head } = room
    void _id
    void _creationTime
    return { room: { ...head, stateRound: state ? head.round : null }, players: players.map(playerFromDoc) }
  },
})
