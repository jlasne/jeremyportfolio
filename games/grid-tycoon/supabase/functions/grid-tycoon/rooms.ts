// Grid Tycoon multiplayer rooms: pure logic behind the `grid-tycoon` edge function.
//
// No Deno, no Node, no database driver here. The engine and the storage are injected, so the same
// code runs in the Supabase edge function (engine.js bundle + Postgres adapter in index.ts), in
// Vitest (src/engine + in-memory storage) and in the app's offline room server (src/net/memory.ts).
// Only Web APIs that Deno, Node 20+ and browsers share are used (crypto, TextEncoder).
//
// Rules (SPEC "Multiplayer", DESIGN.md section 8):
// - A host creates a room with 2 to 6 seats; others join with the 6-letter code.
// - On start, empty seats fill with bots if the host chose so. Demand scales with the company count
//   because createGame sizes pools by the number of companies.
// - Every human locks a decision for the current round; the round resolves when every non-bankrupt
//   human has locked, or when anyone ticks after the deadline (missing humans repeat last round's
//   allocations with no builds or finance, bots play their rules).
// - Resolution is a compare-and-set on the round, so it runs exactly once per round.
// - Seat tokens are 32 random bytes, only their SHA-256 is stored.

// ---------------------------------------------------------------------------------------------
// Engine contract (structural, so the bundled engine.js and src/engine both fit)

export type BotStyle = 'volta' | 'nimbus' | 'hashfield'

export interface EngineCompany {
  id: string
  name: string
  isBot: boolean
  bankrupt: boolean
}

export interface EngineState {
  round: number
  rounds: number
  finished: boolean
  companies: EngineCompany[]
}

export interface EngineIssue {
  code: string
  message: string
  field?: string
}

export interface RoomEngine<S extends EngineState = EngineState, D = WireDecision> {
  createGame: (opts: { seed: number; companies: { id: string; name: string; isBot: boolean; bot?: BotStyle | null }[] }) => S
  resolveRound: (state: S, decisions: Record<string, D>) => S
  validateDecision: (state: S, companyId: string, decision: D) => { ok: boolean; errors: EngineIssue[] }
  defaultDecision: (state: S, companyId: string) => D
  botDecision: (state: S, companyId: string) => D
  botNames: Record<BotStyle, string>
  /** Seconds per round (balance.json multiplayer.roundTimer). */
  roundTimerSeconds: number
}

// ---------------------------------------------------------------------------------------------
// Rows and storage

export type RoomStatus = 'lobby' | 'playing' | 'finished'

/** A room as stored and as sent to clients. Times are epoch milliseconds. */
export interface RoomRow<S = EngineState> {
  code: string
  seed: number
  status: RoomStatus
  hostSeat: number
  /** 0 in the lobby, then the engine's round (1..rounds, rounds + 1 once finished). */
  round: number
  /** When the current round resolves on a tick; null outside play. */
  deadline: number | null
  seats: number
  fillBots: boolean
  state: S | null
  createdAt: number
  updatedAt: number
}

export interface PlayerRow {
  roomCode: string
  seat: number
  /** Engine company id for this seat (`p0`..`p5`). */
  companyId: string
  name: string
  isBot: boolean
  /** Last round this seat locked a decision for (0 = never). Locked now when equal to the room's round. */
  lockedRound: number
  lastSeen: number
}

export interface DecisionRow<D = WireDecision> {
  seat: number
  decision: D
}

/** Partial room update. `expect` makes it a compare-and-set: it applies only if the row still matches. */
export type RoomPatch<S> = Partial<Pick<RoomRow<S>, 'status' | 'round' | 'deadline' | 'state' | 'seed'>>
export type RoomExpect = Partial<Pick<RoomRow, 'status' | 'round'>>
export type PlayerPatch = Partial<Pick<PlayerRow, 'name' | 'lockedRound' | 'lastSeen'>>

export interface RoomStorage<S = EngineState, D = WireDecision> {
  /** Deletes rooms (and, by cascade, their players, secrets and decisions) not updated since `cutoff`. */
  deleteRoomsIdleSince(cutoff: number): Promise<void>
  /** False if the code is taken. */
  insertRoom(room: RoomRow<S>): Promise<boolean>
  getRoom(code: string): Promise<RoomRow<S> | null>
  /** True if a row was updated (false when `expect` did not match). Touches updatedAt. */
  updateRoom(code: string, patch: RoomPatch<S>, expect?: RoomExpect): Promise<boolean>
  listPlayers(code: string): Promise<PlayerRow[]>
  /** False if the seat is taken. */
  insertPlayer(player: PlayerRow): Promise<boolean>
  /** Insert or replace (bots filling seats at start). */
  upsertPlayer(player: PlayerRow): Promise<void>
  updatePlayer(code: string, seat: number, patch: PlayerPatch): Promise<void>
  /** Gives a human seat to a new name if it has not been seen since `awayBefore`. True if claimed. */
  claimSeat(code: string, seat: number, name: string, now: number, awayBefore: number): Promise<boolean>
  deletePlayer(code: string, seat: number): Promise<void>
  seatForTokenHash(code: string, tokenHash: string): Promise<number | null>
  /** Insert or replace the seat's token hash (a claim invalidates the previous token). */
  setSecret(code: string, seat: number, tokenHash: string): Promise<void>
  putDecision(code: string, round: number, seat: number, decision: D): Promise<void>
  listDecisions(code: string, round: number): Promise<DecisionRow<D>[]>
}

// ---------------------------------------------------------------------------------------------
// Wire types

export type RoomErrorCode =
  | 'bad_request'
  | 'unknown_action'
  | 'invalid_code'
  | 'invalid_name'
  | 'invalid_seats'
  | 'invalid_token'
  | 'invalid_decision'
  | 'room_not_found'
  | 'room_full'
  | 'room_started'
  | 'room_finished'
  | 'no_free_seat'
  | 'not_host'
  | 'not_in_lobby'
  | 'not_playing'
  | 'not_enough_players'
  | 'wrong_round'
  | 'bankrupt'
  | 'server_error'

export interface RoomFailure {
  ok: false
  error: RoomErrorCode
  message: string
  issues?: EngineIssue[]
  /** Set with wrong_round: the round the room is on. */
  round?: number
  now: number
}

export interface SeatGrant {
  code: string
  seat: number
  token: string
}

export interface RoomSnapshot<S = EngineState> {
  room: RoomRow<S>
  players: PlayerRow[]
}

/** A room without its (large) state: what lock and tick return when nothing resolved. */
export type RoomHead = Omit<RoomRow, 'state'> & { state?: undefined }

export interface RoomHeadSnapshot {
  room: RoomHead
  players: PlayerRow[]
}

export type CreateResult<S = EngineState> = SeatGrant & RoomSnapshot<S>
export type JoinResult<S = EngineState> = SeatGrant & RoomSnapshot<S> & { rejoined: boolean; claimed: boolean }
export type StartResult<S = EngineState> = RoomSnapshot<S>
/** The full state comes back only when this call resolved the round (Realtime carries it too). */
export type LockResult<S = EngineState> = (RoomSnapshot<S> | RoomHeadSnapshot) & { round: number; resolved: boolean }
export type TickResult<S = EngineState> = (RoomSnapshot<S> | RoomHeadSnapshot) & { resolved: boolean }
export type StateResult<S = EngineState> = RoomSnapshot<S> & { seat: number | null }
export interface PingResult {
  seat: number
}

export interface ActionResults<S = EngineState> {
  create: CreateResult<S>
  join: JoinResult<S>
  start: StartResult<S>
  lock: LockResult<S>
  tick: TickResult<S>
  state: StateResult<S>
  ping: PingResult
}
export type RoomAction = keyof ActionResults

export type RoomSuccess<T> = { ok: true; now: number } & T
export type RoomResponse<T> = RoomSuccess<T> | RoomFailure

/** Mirror of the engine's Decision, as accepted on the wire. */
export interface WireDecision {
  builds: { kind: 'plant' | 'dc' | 'link'; size?: 'small' | 'big'; use?: 'internal' | 'town' | 'import'; mw?: number; tile?: [number, number] }[]
  upgrades: string[]
  power: { internal: number; town: number; otherDc: number }
  compute: { cloud: number; btc: number; ai: number }
  rentMw: number
  loans: { take: number; repay: Record<string, number>; refinance: string[] }
  shares: { mode: 'none' | 'issue' | 'buyback'; count: number }
  forcedSales: string[]
}

// ---------------------------------------------------------------------------------------------
// Constants and small helpers

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 6
export const MIN_SEATS = 2
export const MAX_SEATS = 6
export const NAME_MAX = 20
/** A seat whose player has not been seen for this long can be claimed by a new name after start. */
export const AWAY_MS = 60_000
/** Rooms untouched this long are deleted the next time someone creates a room. */
export const ROOM_TTL_MS = 2 * 24 * 60 * 60 * 1000
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const ID_MAX = 32
const LIST_MAX = 64
const BOT_CYCLE: BotStyle[] = ['volta', 'nimbus', 'hashfield']

export class RoomError extends Error {
  readonly code: RoomErrorCode
  readonly status: number
  readonly issues?: EngineIssue[]
  readonly round?: number
  constructor(code: RoomErrorCode, status: number, message: string, extra: { issues?: EngineIssue[]; round?: number } = {}) {
    super(message)
    this.code = code
    this.status = status
    this.issues = extra.issues
    this.round = extra.round
  }
}

export function companyIdForSeat(seat: number): string {
  return `p${seat}`
}

/** Uppercases and trims a typed code; null unless it is 6 letters of the room alphabet. */
export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.trim().toUpperCase()
  if (code.length !== ROOM_CODE_LENGTH) return null
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null
  return code
}

/** Trims, drops control characters, collapses spaces, cuts to 20 characters; null when empty. */
export function cleanName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const name = Array.from(input.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim())
    .slice(0, NAME_MAX)
    .join('')
    .trim()
  return name.length > 0 ? name : null
}

export function isTokenShape(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token)
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------------------------
// Decision shape check. The engine validates the rules; this only makes sure the JSON has the
// shape the engine expects, so a malformed body is a clean 400 and never an engine crash.

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
function num(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}
function id(x: unknown): string | null {
  return typeof x === 'string' && x.length > 0 && x.length <= ID_MAX ? x : null
}
function idList(x: unknown): string[] | null {
  if (x === undefined) return []
  if (!Array.isArray(x) || x.length > LIST_MAX) return null
  const out: string[] = []
  for (const v of x) {
    const s = id(v)
    if (s === null) return null
    out.push(s)
  }
  return out
}
function numbers<K extends string>(x: unknown, keys: readonly K[]): Record<K, number> | null {
  if (!isRecord(x)) return null
  const out = {} as Record<K, number>
  for (const k of keys) {
    const v = x[k] === undefined ? 0 : num(x[k])
    if (v === null) return null
    out[k] = v
  }
  return out
}
function oneOf<T extends string>(x: unknown, values: readonly T[]): T | null {
  return typeof x === 'string' && (values as readonly string[]).includes(x) ? (x as T) : null
}

/** A copy of the decision with only known fields, or null if any field has the wrong shape. */
export function parseDecision(raw: unknown): WireDecision | null {
  if (!isRecord(raw)) return null
  const power = numbers(raw.power, ['internal', 'town', 'otherDc'] as const)
  const compute = numbers(raw.compute, ['cloud', 'btc', 'ai'] as const)
  const rentMw = raw.rentMw === undefined ? 0 : num(raw.rentMw)
  const upgrades = idList(raw.upgrades)
  const forcedSales = idList(raw.forcedSales)
  if (!power || !compute || rentMw === null || !upgrades || !forcedSales) return null

  const builds: WireDecision['builds'] = []
  const rawBuilds = raw.builds === undefined ? [] : raw.builds
  if (!Array.isArray(rawBuilds) || rawBuilds.length > LIST_MAX) return null
  for (const b of rawBuilds) {
    if (!isRecord(b)) return null
    const kind = oneOf(b.kind, ['plant', 'dc', 'link'] as const)
    if (!kind) return null
    const order: WireDecision['builds'][number] = { kind }
    if (b.size !== undefined) {
      const size = oneOf(b.size, ['small', 'big'] as const)
      if (!size) return null
      order.size = size
    }
    if (b.use !== undefined) {
      const use = oneOf(b.use, ['internal', 'town', 'import'] as const)
      if (!use) return null
      order.use = use
    }
    if (b.mw !== undefined) {
      const mw = num(b.mw)
      if (mw === null) return null
      order.mw = mw
    }
    if (b.tile !== undefined) {
      if (!Array.isArray(b.tile) || b.tile.length !== 2) return null
      const [c, r] = b.tile
      if (!Number.isInteger(c) || !Number.isInteger(r) || Math.abs(c) > 999 || Math.abs(r) > 999) return null
      order.tile = [c, r]
    }
    builds.push(order)
  }

  const loansRaw = raw.loans === undefined ? {} : raw.loans
  if (!isRecord(loansRaw)) return null
  const take = loansRaw.take === undefined ? 0 : num(loansRaw.take)
  const refinance = idList(loansRaw.refinance)
  const repayRaw = loansRaw.repay === undefined ? {} : loansRaw.repay
  if (take === null || !refinance || !isRecord(repayRaw)) return null
  const repayKeys = Object.keys(repayRaw)
  if (repayKeys.length > LIST_MAX) return null
  const repay: Record<string, number> = {}
  for (const k of repayKeys) {
    const v = num(repayRaw[k])
    if (id(k) === null || v === null) return null
    repay[k] = v
  }

  const sharesRaw = raw.shares === undefined ? { mode: 'none', count: 0 } : raw.shares
  if (!isRecord(sharesRaw)) return null
  const mode = oneOf(sharesRaw.mode, ['none', 'issue', 'buyback'] as const)
  const count = sharesRaw.count === undefined ? 0 : num(sharesRaw.count)
  if (!mode || count === null) return null

  return { builds, upgrades, power, compute, rentMw, loans: { take, repay, refinance }, shares: { mode, count }, forcedSales }
}

// ---------------------------------------------------------------------------------------------
// The service

export interface RoomServiceDeps<S extends EngineState, D> {
  storage: RoomStorage<S, D>
  engine: RoomEngine<S, D>
  /** Server clock in epoch ms. */
  now?: () => number
  /** Random bytes (tokens, codes, seeds). */
  randomBytes?: (n: number) => Uint8Array
}

export interface HandledResponse {
  status: number
  body: RoomResponse<object>
}

export type RoomService<S extends EngineState, D> = ReturnType<typeof createRoomService<S, D>>

export function createRoomService<S extends EngineState, D = WireDecision>(deps: RoomServiceDeps<S, D>) {
  const { storage, engine } = deps
  const now = deps.now ?? (() => Date.now())
  const randomBytes = deps.randomBytes ?? ((n: number) => crypto.getRandomValues(new Uint8Array(n)))
  const timerMs = Math.max(1, engine.roundTimerSeconds) * 1000

  function newToken(): string {
    return base64url(randomBytes(32))
  }

  function newCode(): string {
    // Rejection sampling keeps every letter equally likely (256 is not a multiple of 24).
    const limit = 256 - (256 % ROOM_CODE_ALPHABET.length)
    let code = ''
    while (code.length < ROOM_CODE_LENGTH) {
      for (const b of randomBytes(ROOM_CODE_LENGTH * 2)) {
        if (b < limit && code.length < ROOM_CODE_LENGTH) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]
      }
    }
    return code
  }

  /** A readable 6-digit seed like solo's, so a replay seed is easy to copy. */
  function newSeed(): number {
    const b = randomBytes(4)
    const u = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
    return 100000 + (u % 900000)
  }

  async function snapshot(code: string): Promise<RoomSnapshot<S>> {
    const [room, players] = await Promise.all([storage.getRoom(code), storage.listPlayers(code)])
    if (!room) throw new RoomError('room_not_found', 404, 'No room with that code.')
    return { room, players }
  }

  /** The snapshot, without the state unless asked: it is the bulk of the payload late in a game. */
  async function snapshotMaybeState(code: string, withState: boolean): Promise<RoomSnapshot<S> | RoomHeadSnapshot> {
    const snap = await snapshot(code)
    if (withState) return snap
    const { state: _state, ...head } = snap.room
    void _state
    return { room: head, players: snap.players }
  }

  async function requireRoom(code: string): Promise<RoomRow<S>> {
    const room = await storage.getRoom(code)
    if (!room) throw new RoomError('room_not_found', 404, 'No room with that code.')
    return room
  }

  function requireCode(input: unknown): string {
    const code = normalizeRoomCode(input)
    if (!code) throw new RoomError('invalid_code', 400, 'A room code is 6 letters.')
    return code
  }

  /** The seat a token belongs to in this room. */
  async function authenticate(code: string, token: unknown): Promise<number> {
    if (!isTokenShape(token)) throw new RoomError('invalid_token', 403, 'Missing or malformed seat token.')
    const seat = await storage.seatForTokenHash(code, await hashToken(token))
    if (seat === null) throw new RoomError('invalid_token', 403, 'This token does not hold a seat in this room.')
    return seat
  }

  async function grantSeat(code: string, seat: number): Promise<string> {
    const token = newToken()
    await storage.setSecret(code, seat, await hashToken(token))
    return token
  }

  function humanPlayer(seat: number, name: string, code: string, t: number): PlayerRow {
    return { roomCode: code, seat, companyId: companyIdForSeat(seat), name, isBot: false, lockedRound: 0, lastSeen: t }
  }

  // --- create ---------------------------------------------------------------------------------

  async function create(input: { name?: unknown; seats?: unknown; fillBots?: unknown }): Promise<CreateResult<S>> {
    const name = cleanName(input.name)
    if (!name) throw new RoomError('invalid_name', 400, 'Pick a name (1 to 20 characters).')
    const seats = input.seats === undefined ? 4 : input.seats
    if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
      throw new RoomError('invalid_seats', 400, `A room has ${MIN_SEATS} to ${MAX_SEATS} seats.`)
    }
    if (input.fillBots !== undefined && typeof input.fillBots !== 'boolean') throw new RoomError('bad_request', 400, 'fillBots must be true or false.')
    const fillBots = input.fillBots ?? true
    const t = now()

    // Lazy cleanup instead of a cron: old rooms go whenever a new one is made.
    try {
      await storage.deleteRoomsIdleSince(t - ROOM_TTL_MS)
    } catch {
      // Never block a new room on housekeeping.
    }

    let code: string | null = null
    for (let attempt = 0; attempt < 8 && !code; attempt++) {
      const candidate = newCode()
      const room: RoomRow<S> = { code: candidate, seed: 0, status: 'lobby', hostSeat: 0, round: 0, deadline: null, seats, fillBots, state: null, createdAt: t, updatedAt: t }
      if (await storage.insertRoom(room)) code = candidate
    }
    if (!code) throw new RoomError('server_error', 500, 'Could not find a free room code, try again.')

    await storage.insertPlayer(humanPlayer(0, name, code, t))
    const token = await grantSeat(code, 0)
    return { code, seat: 0, token, ...(await snapshot(code)) }
  }

  // --- join -----------------------------------------------------------------------------------

  async function join(input: { code?: unknown; name?: unknown; token?: unknown }): Promise<JoinResult<S>> {
    const code = requireCode(input.code)
    const room = await requireRoom(code)
    const t = now()

    if (input.token !== undefined && input.token !== null && input.token !== '') {
      const seat = await authenticate(code, input.token)
      await storage.updatePlayer(code, seat, { lastSeen: t })
      return { code, seat, token: input.token as string, rejoined: true, claimed: false, ...(await snapshot(code)) }
    }

    const name = cleanName(input.name)
    if (!name) throw new RoomError('invalid_name', 400, 'Pick a name (1 to 20 characters).')

    if (room.status === 'finished') throw new RoomError('room_finished', 409, 'This game is over.')

    if (room.status === 'playing') {
      // A dropped player's seat can be taken over once they have been away for a minute.
      const state = room.state
      const players = await storage.listPlayers(code)
      const away = players
        .filter((p) => !p.isBot && p.lastSeen < t - AWAY_MS)
        .map((p) => ({ p, bankrupt: state?.companies.find((c) => c.id === p.companyId)?.bankrupt ?? true }))
        .sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || a.p.lastSeen - b.p.lastSeen)
      for (const { p } of away) {
        if (await storage.claimSeat(code, p.seat, name, t, t - AWAY_MS)) {
          const token = await grantSeat(code, p.seat)
          return { code, seat: p.seat, token, rejoined: false, claimed: true, ...(await snapshot(code)) }
        }
      }
      throw new RoomError('no_free_seat', 409, 'The game has started and every seat is taken.')
    }

    // Lobby: the lowest free seat. Two joins racing for one seat: the insert loser tries the next.
    const players = await storage.listPlayers(code)
    const taken = new Set(players.map((p) => p.seat))
    for (let seat = 0; seat < room.seats; seat++) {
      if (taken.has(seat)) continue
      if (!(await storage.insertPlayer(humanPlayer(seat, name, code, t)))) continue
      const token = await grantSeat(code, seat)
      const after = await snapshot(code)
      // The host may have started between our read and our insert: that seat is not in the game.
      if (after.room.status !== 'lobby' && !after.room.state?.companies.some((c) => c.id === companyIdForSeat(seat) && !c.isBot)) {
        const mine = after.players.find((p) => p.seat === seat)
        if (mine && !mine.isBot && mine.name === name) await storage.deletePlayer(code, seat)
        throw new RoomError('room_started', 409, 'The game started before you could join.')
      }
      return { code, seat, token, rejoined: false, claimed: false, ...after }
    }
    throw new RoomError('room_full', 409, 'This room is full.')
  }

  // --- start ----------------------------------------------------------------------------------

  async function start(input: { code?: unknown; token?: unknown }): Promise<StartResult<S>> {
    const code = requireCode(input.code)
    const room = await requireRoom(code)
    const seat = await authenticate(code, input.token)
    if (seat !== room.hostSeat) throw new RoomError('not_host', 403, 'Only the host can start the game.')
    if (room.status !== 'lobby') throw new RoomError('not_in_lobby', 409, 'The game has already started.')

    const t = now()
    const humans = (await storage.listPlayers(code)).filter((p) => !p.isBot).sort((a, b) => a.seat - b.seat)
    const total = room.fillBots ? Math.max(room.seats, humans.length) : humans.length
    if (total < MIN_SEATS) throw new RoomError('not_enough_players', 409, `At least ${MIN_SEATS} companies are needed: wait for a player or fill seats with bots.`)

    const taken = new Set(humans.map((p) => p.seat))
    const bots: PlayerRow[] = []
    for (let s = 0, i = 0; bots.length < total - humans.length; s++) {
      if (taken.has(s)) continue
      const style = BOT_CYCLE[i % BOT_CYCLE.length]
      const lap = Math.floor(i / BOT_CYCLE.length)
      bots.push({ roomCode: code, seat: s, companyId: companyIdForSeat(s), name: lap === 0 ? engine.botNames[style] : `${engine.botNames[style]} ${lap + 1}`, isBot: true, lockedRound: 0, lastSeen: t })
      i++
    }
    const seats = [...humans, ...bots].sort((a, b) => a.seat - b.seat)
    const styleOf = (p: PlayerRow): BotStyle => BOT_CYCLE[bots.indexOf(p) % BOT_CYCLE.length]

    const seed = newSeed()
    const state = engine.createGame({
      seed,
      companies: seats.map((p) => ({ id: p.companyId, name: p.name, isBot: p.isBot, bot: p.isBot ? styleOf(p) : null })),
    })
    const ok = await storage.updateRoom(code, { status: 'playing', seed, round: state.round, state, deadline: t + timerMs }, { status: 'lobby' })
    if (!ok) throw new RoomError('not_in_lobby', 409, 'The game has already started.')
    for (const b of bots) await storage.upsertPlayer(b)
    await storage.updatePlayer(code, seat, { lastSeen: t })
    return snapshot(code)
  }

  // --- resolution -----------------------------------------------------------------------------

  function activeHumans(state: S): EngineCompany[] {
    return state.companies.filter((c) => !c.isBot && !c.bankrupt)
  }

  function decisionsFor(state: S, locked: Map<string, D>): Record<string, D> {
    const out: Record<string, D> = {}
    for (const c of state.companies) {
      if (c.bankrupt) continue
      out[c.id] = c.isBot ? engine.botDecision(state, c.id) : (locked.get(c.id) ?? engine.defaultDecision(state, c.id))
    }
    return out
  }

  /**
   * Resolves the room's current round from the stored decisions. Compare-and-set on the round:
   * of several concurrent callers exactly one writes; the others get false.
   */
  async function resolve(room: RoomRow<S>): Promise<boolean> {
    const state = room.state
    if (room.status !== 'playing' || !state || state.finished) return false
    const rows = await storage.listDecisions(room.code, room.round)
    const locked = new Map(rows.map((r) => [companyIdForSeat(r.seat), r.decision]))

    let next = engine.resolveRound(state, decisionsFor(state, locked))
    // With no human left in the race the rest is bots only: play it out now instead of making
    // everyone sit through the timers.
    while (!next.finished && activeHumans(next).length === 0) next = engine.resolveRound(next, decisionsFor(next, new Map()))

    const t = now()
    return storage.updateRoom(
      room.code,
      { state: next, round: next.round, status: next.finished ? 'finished' : 'playing', deadline: next.finished ? null : t + timerMs },
      { round: room.round, status: 'playing' },
    )
  }

  async function lock(input: { code?: unknown; token?: unknown; round?: unknown; decision?: unknown }): Promise<LockResult<S>> {
    const code = requireCode(input.code)
    const room = await requireRoom(code)
    const seat = await authenticate(code, input.token)
    if (room.status !== 'playing' || !room.state) throw new RoomError('not_playing', 409, room.status === 'finished' ? 'This game is over.' : 'The game has not started.')
    if (input.round !== room.round) throw new RoomError('wrong_round', 409, `The room is on round ${room.round}.`, { round: room.round })

    const state = room.state
    const company = state.companies.find((c) => c.id === companyIdForSeat(seat))
    if (!company || company.isBot) throw new RoomError('invalid_token', 403, 'This seat has no company in the game.')
    if (company.bankrupt) throw new RoomError('bankrupt', 409, 'Your company is bankrupt.')

    const parsed = parseDecision(input.decision)
    if (!parsed) throw new RoomError('invalid_decision', 400, 'The decision is malformed.')
    // The wire shape is the engine's Decision; D is that type in every real wiring.
    const decision = parsed as unknown as D
    let result: { ok: boolean; errors: EngineIssue[] }
    try {
      result = engine.validateDecision(state, company.id, decision)
    } catch {
      throw new RoomError('invalid_decision', 400, 'The decision could not be checked.')
    }
    if (!result.ok) throw new RoomError('invalid_decision', 422, result.errors[0]?.message ?? 'The decision breaks a rule.', { issues: result.errors })

    const t = now()
    // Re-locking before the round resolves replaces the earlier decision.
    await storage.putDecision(code, room.round, seat, decision)
    await storage.updatePlayer(code, seat, { lockedRound: room.round, lastSeen: t })

    const rows = await storage.listDecisions(code, room.round)
    const lockedIds = new Set(rows.map((r) => companyIdForSeat(r.seat)))
    const everyone = activeHumans(state).every((c) => lockedIds.has(c.id))
    const resolved = everyone ? await resolve(room) : false
    return { round: room.round, resolved, ...(await snapshotMaybeState(code, resolved)) }
  }

  async function tick(input: { code?: unknown; token?: unknown }): Promise<TickResult<S>> {
    const code = requireCode(input.code)
    const room = await requireRoom(code)
    const t = now()
    if (isTokenShape(input.token)) {
      const seat = await storage.seatForTokenHash(code, await hashToken(input.token))
      if (seat !== null) await storage.updatePlayer(code, seat, { lastSeen: t })
    }
    let resolved = false
    if (room.status === 'playing' && room.deadline !== null && t >= room.deadline) resolved = await resolve(room)
    return { resolved, ...(await snapshotMaybeState(code, resolved)) }
  }

  async function state(input: { code?: unknown; token?: unknown }): Promise<StateResult<S>> {
    const code = requireCode(input.code)
    const snap = await snapshot(code)
    let seat: number | null = null
    if (input.token !== undefined && input.token !== null) {
      seat = await authenticate(code, input.token)
      await storage.updatePlayer(code, seat, { lastSeen: now() })
    }
    return { seat, ...snap }
  }

  async function ping(input: { code?: unknown; token?: unknown }): Promise<PingResult> {
    const code = requireCode(input.code)
    await requireRoom(code)
    const seat = await authenticate(code, input.token)
    await storage.updatePlayer(code, seat, { lastSeen: now() })
    return { seat }
  }

  const actions: { [A in RoomAction]: (input: Record<string, unknown>) => Promise<ActionResults<S>[A]> } = { create, join, start, lock, tick, state, ping }

  /** One request: `{ action, ...input }` in, `{ ok, ..., now }` out with an HTTP status. Never throws. */
  async function handle(body: unknown): Promise<HandledResponse> {
    try {
      if (!isRecord(body)) throw new RoomError('bad_request', 400, 'Send a JSON object.')
      const action = body.action
      if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(actions, action)) {
        throw new RoomError('unknown_action', 400, 'Unknown action.')
      }
      const data = await actions[action as RoomAction](body)
      return { status: 200, body: { ok: true, ...data, now: now() } }
    } catch (err) {
      if (err instanceof RoomError) {
        const failure: RoomFailure = { ok: false, error: err.code, message: err.message, now: now() }
        if (err.issues) failure.issues = err.issues
        if (err.round !== undefined) failure.round = err.round
        return { status: err.status, body: failure }
      }
      console.error('grid-tycoon: unexpected error', err)
      return { status: 500, body: { ok: false, error: 'server_error', message: 'Something went wrong on the server.', now: now() } }
    }
  }

  return { create, join, start, lock, tick, state, ping, resolve, handle }
}

// ---------------------------------------------------------------------------------------------
// Database row mapping (snake_case, timestamptz strings), shared by the Postgres adapter and,
// mirrored in src/net/rows.ts, by the client reading Realtime payloads.

export interface DbRoom {
  code: string
  seed: number
  status: RoomStatus
  host_seat: number
  round: number
  deadline: string | null
  seats: number
  fill_bots: boolean
  state: unknown
  created_at: string
  updated_at: string
}

export interface DbPlayer {
  room_code: string
  seat: number
  company_id: string
  name: string
  is_bot: boolean
  locked_round: number
  last_seen: string
}

const iso = (ms: number): string => new Date(ms).toISOString()
const ms = (s: string): number => Date.parse(s)

export function roomToDb<S>(r: RoomRow<S>): DbRoom {
  return {
    code: r.code,
    seed: r.seed,
    status: r.status,
    host_seat: r.hostSeat,
    round: r.round,
    deadline: r.deadline === null ? null : iso(r.deadline),
    seats: r.seats,
    fill_bots: r.fillBots,
    state: r.state,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  }
}

export function roomPatchToDb<S>(p: RoomPatch<S>): Partial<DbRoom> {
  const out: Partial<DbRoom> = {}
  if (p.status !== undefined) out.status = p.status
  if (p.round !== undefined) out.round = p.round
  if (p.seed !== undefined) out.seed = p.seed
  if (p.state !== undefined) out.state = p.state
  if (p.deadline !== undefined) out.deadline = p.deadline === null ? null : iso(p.deadline)
  return out
}

export function roomFromDb<S>(r: DbRoom): RoomRow<S> {
  return {
    code: r.code,
    seed: Number(r.seed),
    status: r.status,
    hostSeat: r.host_seat,
    round: r.round,
    deadline: r.deadline === null ? null : ms(r.deadline),
    seats: r.seats,
    fillBots: r.fill_bots,
    state: (r.state ?? null) as S | null,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  }
}

export function playerToDb(p: PlayerRow): DbPlayer {
  return {
    room_code: p.roomCode,
    seat: p.seat,
    company_id: p.companyId,
    name: p.name,
    is_bot: p.isBot,
    locked_round: p.lockedRound,
    last_seen: iso(p.lastSeen),
  }
}

export function playerPatchToDb(p: PlayerPatch): Partial<DbPlayer> {
  const out: Partial<DbPlayer> = {}
  if (p.name !== undefined) out.name = p.name
  if (p.lockedRound !== undefined) out.locked_round = p.lockedRound
  if (p.lastSeen !== undefined) out.last_seen = iso(p.lastSeen)
  return out
}

export function playerFromDb(p: DbPlayer): PlayerRow {
  return {
    roomCode: p.room_code,
    seat: p.seat,
    companyId: p.company_id,
    name: p.name,
    isBot: p.is_bot,
    lockedRound: p.locked_round,
    lastSeen: ms(p.last_seen),
  }
}
