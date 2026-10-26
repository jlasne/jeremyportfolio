// The multiplayer controller end to end on the in-memory room server: host, a second human, start,
// lock in / unlock / re-lock, the round resolving into the results sequence (useGame.last), rejoin
// after leaving (still locked → "waiting"), timer expiry with a missing player, and the store
// state after leaving.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDecision } from '../engine'
import type { GameState } from '../engine'
import { useGame } from '../store/game'
import { resetClock } from './clock'
import { tick, useBackend } from './client'
import { hostGame, leaveRoom, localModeRequested, localTimerFromUrl, rejoinGame, startHostedGame, unlockToEdit } from './controller'
import { createMemoryBackend, type MemoryServer } from './memory'
import { useNet } from './session'

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

async function waitFor(check: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 5))
  }
}

let clock = 0
let server: MemoryServer

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryLocalStorage())
  resetClock()
  clock = Date.now()
  server = createMemoryBackend({ now: () => clock })
  useBackend(server.backend)
})

afterEach(() => {
  if (useNet.getState().code) leaveRoom()
  useBackend(null)
  vi.unstubAllGlobals()
})

async function roomWithTwoHumans(): Promise<{ code: string; baoToken: string }> {
  expect(await hostGame({ name: 'Ada', seats: 3, fillBots: true })).toBeNull()
  const code = useNet.getState().code!
  const bao = await server.service.join({ code, name: 'Bao' })
  await waitFor(() => useNet.getState().players.length === 2)
  return { code, baoToken: bao.token }
}

async function storedState(code: string): Promise<GameState> {
  const room = await server.storage.getRoom(code)
  return room!.state as GameState
}

describe('multiplayer controller', () => {
  it('hosts into the lobby, starts, locks, resolves into the results sequence', async () => {
    const { code, baoToken } = await roomWithTwoHumans()
    expect(useGame.getState()).toMatchObject({ screen: 'lobby', mode: 'multi' })
    expect(useNet.getState()).toMatchObject({ seat: 0, room: { status: 'lobby', seats: 3 } })

    expect(await startHostedGame()).toBeNull()
    expect(useGame.getState()).toMatchObject({ screen: 'game', mode: 'multi', meId: 'p0', phase: 'decide' })
    const s1 = useGame.getState().state!
    expect(s1.round).toBe(1)
    expect(s1.companies.map((c) => [c.name, c.isBot])).toEqual([
      ['Ada', false],
      ['Bao', false],
      ['Volta Utility', true],
    ])

    // Lock in → waiting; the server records the lock.
    useGame.getState().lockIn()
    expect(useGame.getState().phase).toBe('waiting')
    await waitFor(() => useNet.getState().players.find((p) => p.seat === 0)?.lockedRound === 1)

    // Unlock to edit, then re-lock (replaces the decision server-side).
    unlockToEdit()
    expect(useGame.getState().phase).toBe('decide')
    useGame.getState().lockIn()
    expect(useGame.getState().phase).toBe('waiting')

    // The other human locks: the round resolves and the results play for the new state.
    await server.service.lock({ code, token: baoToken, round: 1, decision: defaultDecision(s1, 'p1') })
    await waitFor(() => useGame.getState().phase === 'results')
    const { last, state } = useGame.getState()
    expect(last?.before.round).toBe(1)
    expect(last?.after.round).toBe(2)
    expect(state?.round).toBe(2)

    useGame.getState().finishResults()
    expect(useGame.getState()).toMatchObject({ phase: 'decide', screen: 'game' })
  })

  it('rejoins a running game and shows "waiting" when this seat already locked', async () => {
    const { code } = await roomWithTwoHumans()
    await startHostedGame()
    useGame.getState().lockIn()
    await waitFor(() => useNet.getState().players.find((p) => p.seat === 0)?.lockedRound === 1)

    leaveRoom()
    expect(useGame.getState()).toMatchObject({ screen: 'title', mode: null, state: null })
    expect(useNet.getState().code).toBeNull()

    expect(await rejoinGame(code)).toBeNull()
    expect(useGame.getState()).toMatchObject({ screen: 'game', mode: 'multi', meId: 'p0', phase: 'waiting' })
    expect(useNet.getState().seat).toBe(0)
  })

  it('a missed timer resolves on tick: the missing player repeats last round', async () => {
    const { code } = await roomWithTwoHumans()
    await startHostedGame()
    useGame.getState().lockIn()
    await waitFor(() => useNet.getState().players.find((p) => p.seat === 0)?.lockedRound === 1)

    // Before the deadline a tick does nothing.
    const early = await tick(code)
    expect(early.ok && early.resolved).toBe(false)

    const deadline = useNet.getState().room!.deadline!
    clock = deadline + 1
    const late = await tick(code)
    expect(late.ok && late.resolved).toBe(true)
    await waitFor(() => useGame.getState().phase === 'results')
    expect(useGame.getState().state?.round).toBe(2)
    const after = await storedState(code)
    // Bao never locked: no builds, last round's (default) allocations.
    const bao = after.companies.find((c) => c.id === 'p1')
    expect(bao?.lastDecision).toBeTruthy()
    expect(bao?.lastDecision?.builds).toEqual([])
  })

  it('leaving from the game menu goes back to the title and stops following the room', async () => {
    await roomWithTwoHumans()
    await startHostedGame()
    useGame.getState().quitToTitle()
    expect(useGame.getState().screen).toBe('title')
    expect(useNet.getState()).toMatchObject({ code: null, seat: null, room: null })
  })

  it('reads the local test flags from the URL', () => {
    expect(localModeRequested('?mp=local')).toBe(true)
    expect(localModeRequested('?room=ABCDEF')).toBe(false)
    expect(localTimerFromUrl('?mp=local&timer=30')).toBe(30)
    expect(localTimerFromUrl('?timer=1')).toBe(5)
    expect(localTimerFromUrl('?timer=x')).toBeUndefined()
    expect(localTimerFromUrl('')).toBeUndefined()
  })
})
