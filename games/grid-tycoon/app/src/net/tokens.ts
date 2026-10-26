// Seat tokens per room, kept in localStorage under gt.net.v1 so a reload or a dropped connection
// can rejoin the same seat. Every storage access is wrapped: private windows and blocked storage
// fall back to memory for the session.

const KEY = 'gt.net.v1'
/** Entries older than this are dropped (rooms are deleted after 2 days idle). */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

export interface SavedSeat {
  code: string
  seat: number
  token: string
  name: string
  savedAt: number
}

interface Stored {
  v: 1
  rooms: Record<string, SavedSeat>
  /** The room most recently joined, for a "resume" button. */
  last: string | null
}

let memory: Stored = { v: 1, rooms: {}, last: null }

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(): Stored {
  const ls = storage()
  if (!ls) return memory
  try {
    const raw = ls.getItem(KEY)
    if (!raw) return memory
    const parsed = JSON.parse(raw) as Partial<Stored>
    if (parsed && parsed.v === 1 && typeof parsed.rooms === 'object' && parsed.rooms) {
      memory = { v: 1, rooms: parsed.rooms, last: typeof parsed.last === 'string' ? parsed.last : null }
    }
  } catch {
    // Corrupt or unreadable: keep what memory has.
  }
  return memory
}

function write(next: Stored): void {
  const cutoff = Date.now() - MAX_AGE_MS
  for (const [code, seat] of Object.entries(next.rooms)) if (!seat || seat.savedAt < cutoff) delete next.rooms[code]
  if (next.last && !next.rooms[next.last]) next.last = null
  memory = next
  const ls = storage()
  if (!ls) return
  try {
    ls.setItem(KEY, JSON.stringify(next))
  } catch {
    // Quota or blocked: memory still holds it for this session.
  }
}

export function savedSeat(code: string): SavedSeat | null {
  const s = read().rooms[code]
  return s && typeof s.token === 'string' && typeof s.seat === 'number' ? s : null
}

export function saveSeat(seat: Omit<SavedSeat, 'savedAt'>): void {
  const cur = read()
  write({ ...cur, rooms: { ...cur.rooms, [seat.code]: { ...seat, savedAt: Date.now() } }, last: seat.code })
}

export function forgetSeat(code: string): void {
  const cur = read()
  const rooms = { ...cur.rooms }
  delete rooms[code]
  write({ ...cur, rooms, last: cur.last === code ? null : cur.last })
}

/** The last room this browser held a seat in, if its token is still saved. */
export function lastSeat(): SavedSeat | null {
  const cur = read()
  return cur.last ? savedSeat(cur.last) : null
}
