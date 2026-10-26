// The local test server across "tabs": two instances in one process share a BroadcastChannel and
// a fake Web Locks manager. The first hosts, the second proxies calls and subscriptions, a test
// player locks by itself, and when the host goes away the proxy takes over from the persisted
// snapshot.

import { afterEach, describe, expect, it } from 'vitest'
import { defaultDecision } from '../engine'
import type { GameState } from '../engine'
import { startLocalServer, type LocalServer } from './local'
import type { ConnectionStatus, PlayerView, PresenceEntry, RoomView } from './types'

class FakeLocks {
  private held = new Set<string>()
  private queue = new Map<string, (() => void)[]>()
  async request(name: string, a: unknown, b?: unknown): Promise<unknown> {
    const opts = (typeof a === 'function' ? {} : a) as { ifAvailable?: boolean }
    const cb = (typeof a === 'function' ? a : b) as (lock: { name: string } | null) => Promise<unknown>
    if (this.held.has(name)) {
      if (opts.ifAvailable) return cb(null)
      await new Promise<void>((resolve) => this.queue.set(name, [...(this.queue.get(name) ?? []), resolve]))
    }
    this.held.add(name)
    try {
      return await cb({ name })
    } finally {
      this.held.delete(name)
      const next = this.queue.get(name)?.shift()
      next?.()
    }
  }
}

class MemoryStorage {
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

async function waitFor(check: () => boolean, ms = 6000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

const servers: LocalServer[] = []
afterEach(() => {
  for (const s of servers.splice(0)) s.close()
})

describe('local test server across tabs', () => {
  it('hosts in one tab, proxies another, plays a test player and hands over', async () => {
    const locks = new FakeLocks() as unknown as LockManager
    const storage = new MemoryStorage() as unknown as Storage
    const opts = { locks, storage, channelName: `gt-test-${Math.random()}`, storageKey: 'gt.localserver.test', timerSeconds: 30 }

    const a = startLocalServer(opts)
    servers.push(a)
    await waitFor(() => a.role() === 'host')
    const b = startLocalServer(opts)
    servers.push(b)
    await waitFor(() => b.role() === 'proxy')
    expect(a.timerSeconds).toBe(30)

    // A call from the proxy tab runs on the host.
    const created = await b.backend.call('create', { name: 'Ada', seats: 2, fillBots: false })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const code = created.code as string
    const token = created.token as string

    // A subscription from the proxy tab gets pushes and presence.
    let room: RoomView | null = null
    const players = new Map<number, PlayerView>()
    let presence: PresenceEntry[] = []
    const statuses: ConnectionStatus[] = []
    b.backend.subscribe(
      code,
      {
        onRoom: (r) => void (room = r as RoomView),
        onPlayer: (p) => void players.set(p.seat, p),
        onPresence: (e) => void (presence = e),
        onStatus: (s) => void statuses.push(s),
      },
      { seat: 0, name: 'Ada' },
    )
    await waitFor(() => statuses.includes('live') && presence.some((p) => p.seat === 0))

    // A test player (auto) joins through the proxy and shows up as present.
    const added = await b.addTestPlayer(code, true)
    expect(added).toMatchObject({ ok: true, seat: 1 })
    await waitFor(() => players.has(1) && presence.some((p) => p.seat === 1))

    // Start: the test player locks round 1 by itself; Ada's lock resolves it.
    const started = await b.backend.call('start', { code, token })
    expect(started.ok).toBe(true)
    await waitFor(() => players.get(1)?.lockedRound === 1)
    const state = (started as unknown as { room: { state: GameState } }).room.state
    const locked = await b.backend.call('lock', { code, token, round: 1, decision: defaultDecision(state, 'p0') })
    expect(locked).toMatchObject({ ok: true, resolved: true })
    await waitFor(() => (room as RoomView | null)?.round === 2)

    // The host tab closes: the proxy takes over from the persisted rooms.
    a.close()
    await waitFor(() => b.role() === 'host')
    const after = await b.backend.call('state', { code })
    expect(after).toMatchObject({ ok: true, room: { round: 2, status: 'playing' } })
    // The test player keeps playing on the new host.
    await waitFor(() => players.get(1)?.lockedRound === 2)
  }, 20_000)

  it('hosts alone without Web Locks', async () => {
    const s = startLocalServer({ locks: null, storage: null, channelName: `gt-test-${Math.random()}` })
    servers.push(s)
    expect(s.role()).toBe('host')
    expect(s.timerSeconds).toBe(180)
    const res = await s.backend.call('create', { name: 'Solo', seats: 2, fillBots: true })
    expect(res.ok).toBe(true)
  })
})
