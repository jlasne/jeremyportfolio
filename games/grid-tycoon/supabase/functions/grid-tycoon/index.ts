// grid-tycoon edge function: HTTP + CORS around the pure room logic in rooms.ts, with storage in
// Postgres through supabase-js and the service role (the only writer; RLS keeps clients read-only).
// Deployed with verify_jwt off: seats are authorized by their own tokens (see rooms.ts).
//
// Files to deploy: index.ts (entrypoint), rooms.ts, engine.js (built by app/scripts/build-edge.mjs).

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as bundled from './engine.js'
import {
  createRoomService,
  playerFromDb,
  playerPatchToDb,
  playerToDb,
  roomFromDb,
  roomPatchToDb,
  roomToDb,
  type DbPlayer,
  type DbRoom,
  type EngineState,
  type RoomEngine,
  type RoomStorage,
  type WireDecision,
} from './rooms.ts'

const MAX_BODY_BYTES = 64 * 1024

const ALLOWED_ORIGINS = new Set(['https://www.jeremylasne.com', 'https://jeremylasne.com'])
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

// engine.js is plain JS built from src/engine/index.ts; this is the slice of its API used here, with
// the engine's real signatures (the default config argument is the bundled balance.json).
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

function postgresStorage(): RoomStorage<EngineState, WireDecision> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('grid-tycoon: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const fail = (what: string, error: { message: string } | null): void => {
    if (error) throw new Error(`grid-tycoon: ${what}: ${error.message}`)
  }
  const isConflict = (error: { code?: string } | null): boolean => error?.code === '23505'

  return {
    async deleteRoomsIdleSince(cutoff) {
      const { error } = await db.from('gt_rooms').delete().lt('updated_at', new Date(cutoff).toISOString())
      fail('cleanup', error)
    },
    async insertRoom(room) {
      const { error } = await db.from('gt_rooms').insert(roomToDb(room))
      if (isConflict(error)) return false
      fail('insert room', error)
      return true
    },
    async getRoom(code) {
      const { data, error } = await db.from('gt_rooms').select('*').eq('code', code).maybeSingle()
      fail('get room', error)
      return data ? roomFromDb<EngineState>(data as DbRoom) : null
    },
    async updateRoom(code, patch, expect = {}) {
      // The compare-and-set that makes resolution run once: `where round = $expected`.
      let q = db.from('gt_rooms').update(roomPatchToDb(patch)).eq('code', code)
      if (expect.round !== undefined) q = q.eq('round', expect.round)
      if (expect.status !== undefined) q = q.eq('status', expect.status)
      const { data, error } = await q.select('code')
      fail('update room', error)
      return (data?.length ?? 0) > 0
    },
    async listPlayers(code) {
      const { data, error } = await db.from('gt_players').select('room_code, seat, company_id, name, is_bot, locked_round, last_seen').eq('room_code', code).order('seat')
      fail('list players', error)
      return ((data ?? []) as DbPlayer[]).map(playerFromDb)
    },
    async insertPlayer(player) {
      const { error } = await db.from('gt_players').insert(playerToDb(player))
      if (isConflict(error)) return false
      fail('insert player', error)
      return true
    },
    async upsertPlayer(player) {
      const { error } = await db.from('gt_players').upsert(playerToDb(player), { onConflict: 'room_code,seat' })
      fail('upsert player', error)
    },
    async updatePlayer(code, seat, patch) {
      const { error } = await db.from('gt_players').update(playerPatchToDb(patch)).eq('room_code', code).eq('seat', seat)
      fail('update player', error)
    },
    async claimSeat(code, seat, name, now, awayBefore) {
      const { data, error } = await db
        .from('gt_players')
        .update(playerPatchToDb({ name, lastSeen: now }))
        .eq('room_code', code)
        .eq('seat', seat)
        .eq('is_bot', false)
        .lt('last_seen', new Date(awayBefore).toISOString())
        .select('seat')
      fail('claim seat', error)
      return (data?.length ?? 0) > 0
    },
    async deletePlayer(code, seat) {
      const { error } = await db.from('gt_players').delete().eq('room_code', code).eq('seat', seat)
      fail('delete player', error)
    },
    async seatForTokenHash(code, tokenHash) {
      const { data, error } = await db.from('gt_secrets').select('seat').eq('room_code', code).eq('token_hash', tokenHash).maybeSingle()
      fail('find seat', error)
      return data ? Number((data as { seat: number }).seat) : null
    },
    async setSecret(code, seat, tokenHash) {
      const { error } = await db.from('gt_secrets').upsert({ room_code: code, seat, token_hash: tokenHash }, { onConflict: 'room_code,seat' })
      fail('set secret', error)
    },
    async putDecision(code, round, seat, decision) {
      const { error } = await db.from('gt_decisions').upsert({ room_code: code, round, seat, decision }, { onConflict: 'room_code,round,seat' })
      fail('put decision', error)
    },
    async listDecisions(code, round) {
      const { data, error } = await db.from('gt_decisions').select('seat, decision').eq('room_code', code).eq('round', round)
      fail('list decisions', error)
      return ((data ?? []) as { seat: number; decision: WireDecision }[]).map((r) => ({ seat: Number(r.seat), decision: r.decision }))
    },
  }
}

let rooms: ReturnType<typeof createRoomService<EngineState, WireDecision>> | null = null

/** Built on the first request, so a missing env var answers server_error (and logs) instead of failing the boot. */
function service(): ReturnType<typeof createRoomService<EngineState, WireDecision>> {
  rooms ??= createRoomService<EngineState, WireDecision>({ storage: postgresStorage(), engine })
  return rooms
}

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && (ALLOWED_ORIGINS.has(origin) || DEV_ORIGIN.test(origin))) h['Access-Control-Allow-Origin'] = origin
  return h
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'bad_request', message: 'POST a JSON body.', now: Date.now() }, origin)

  const length = Number(req.headers.get('content-length') ?? '0')
  if (length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'bad_request', message: 'Request too large.', now: Date.now() }, origin)
  let body: unknown
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'bad_request', message: 'Request too large.', now: Date.now() }, origin)
    body = JSON.parse(text)
  } catch {
    return json(400, { ok: false, error: 'bad_request', message: 'The body is not valid JSON.', now: Date.now() }, origin)
  }

  let svc: ReturnType<typeof service>
  try {
    svc = service()
  } catch (err) {
    console.error(err)
    return json(500, { ok: false, error: 'server_error', message: 'The game server is not configured.', now: Date.now() }, origin)
  }
  const res = await svc.handle(body)
  return json(res.status, res.body, origin)
})
