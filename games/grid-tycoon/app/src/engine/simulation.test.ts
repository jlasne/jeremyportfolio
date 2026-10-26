// Whole games: determinism, numeric hygiene, and bots that play the game competently.

import { describe, expect, it } from 'vitest'
import { capacity, createGame, createSoloGame, rankCompanies, resolveRound, type BotStyle, type GameState } from './index'
import { hasNonFinite, isCents, moneyFields } from './test/helpers'

function botGame(seed: number, styles: BotStyle[] = ['volta', 'nimbus', 'hashfield', 'volta']): GameState {
  const ids = new Map<string, number>()
  let s = createGame({
    seed,
    companies: styles.map((bot) => {
      const n = (ids.get(bot) ?? 0) + 1
      ids.set(bot, n)
      return { id: n > 1 ? `${bot}${n}` : bot, name: bot, isBot: true, bot }
    }),
  })
  while (!s.finished) s = resolveRound(s, {})
  return s
}

describe('whole games', () => {
  const games = Array.from({ length: 50 }, (_, i) => botGame(i + 1))

  it('no NaN or Infinity anywhere after 40 rounds of bots, for 50 seeds', () => {
    for (const s of games) {
      expect(s.round).toBe(41)
      expect(hasNonFinite(s)).toBe(false)
    }
  })

  it('money is always at 2 decimals', () => {
    for (const s of games.slice(0, 20)) for (const x of moneyFields(s)) expect(isCents(x)).toBe(true)
  })

  it('same seed gives the same bot game; another seed gives another', () => {
    expect(botGame(7)).toEqual(games[6])
    expect(botGame(8).companies[0].sharePrice).not.toBe(games[6].companies[0].sharePrice)
  })

  it('demand stays inside the growth clamp and the pools never go negative', () => {
    for (const s of games.slice(0, 10)) {
      for (const h of s.history) {
        for (const p of Object.values(h.pools)) {
          expect(p.growth).toBeGreaterThanOrEqual(-0.1 - 1e-12)
          expect(p.growth).toBeLessThanOrEqual(0.2 + 1e-12)
          expect(p.used).toBeLessThanOrEqual(p.demand + 1e-6)
          expect(p.demand).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('bots', () => {
  const games = Array.from({ length: 20 }, (_, i) => botGame(i + 1))

  it('grow their company over 40 rounds', () => {
    for (const s of games) {
      for (const c of s.companies) {
        const cap = capacity(c)
        expect(cap.plantMw + cap.dcMw).toBeGreaterThanOrEqual(20)
        expect(c.history.at(-1)!.revenue).toBeGreaterThan(5 * c.history[0].revenue)
        expect(c.sharePrice).toBeGreaterThan(30)
      }
    }
  })

  it('never go bankrupt and never hit a losing round in these seeds', () => {
    for (const s of games) {
      for (const c of s.companies) {
        expect(c.bankrupt).toBe(false)
        expect(c.history.every((r) => r.finance.forcedSold.length === 0)).toBe(true)
      }
    }
  })

  it('buy the links they need: a town link for Volta, an internal link sized to their datacenters', () => {
    for (const s of games.slice(0, 5)) {
      const volta = s.companies.find((c) => c.id === 'volta')!
      expect(capacity(volta).links.town).toBeGreaterThan(0)
      for (const c of s.companies) expect(capacity(c).links.internal).toBeGreaterThanOrEqual(Math.min(capacity(c).dcMw, capacity(c).plantMw) * 0.5)
    }
  })

  it('play distinct styles: Volta sells to citizens, Hashfield to bitcoin mining, Nimbus to AI', () => {
    const mix = (id: string, pool: 'citizens' | 'btc' | 'ai'): number => {
      let share = 0
      for (const s of games) {
        const c = s.companies.find((x) => x.id === id)!
        const total = c.history.reduce((a, r) => a + r.revenue, 0)
        share += c.history.reduce((a, r) => a + r.revenueByPool[pool], 0) / total
      }
      return share / games.length
    }
    expect(mix('volta', 'citizens')).toBeGreaterThan(mix('nimbus', 'citizens'))
    expect(mix('hashfield', 'btc')).toBeGreaterThan(Math.max(mix('volta', 'btc'), mix('nimbus', 'btc')))
    expect(mix('nimbus', 'ai')).toBeGreaterThan(mix('hashfield', 'ai'))
  })

  it('finish with a spread of share prices', () => {
    for (const s of games) {
      const prices = s.companies.map((c) => c.sharePrice)
      expect(Math.max(...prices) / Math.min(...prices)).toBeGreaterThan(1.3)
    }
  })

  it('in solo, a human who copies the best bot keeps up with it', () => {
    let s = createSoloGame({ seed: 4, playerName: 'P' })
    s = { ...s, companies: s.companies.map((c) => (c.id === 'you' ? { ...c, isBot: true, bot: 'nimbus' as const } : c)) }
    while (!s.finished) s = resolveRound(s, {})
    expect(rankCompanies(s).indexOf('you')).toBeLessThanOrEqual(1)
  })
})

describe('speed', () => {
  it('resolves a round for 6 companies well under 2 ms (decisions given, and with bots deciding inside)', () => {
    const styles: BotStyle[] = ['volta', 'nimbus', 'hashfield', 'volta', 'nimbus', 'hashfield']
    const states: GameState[] = []
    let s = createGame({ seed: 3, companies: styles.map((bot, i) => ({ id: `${bot}${i}`, name: bot, isBot: true, bot })) })
    while (!s.finished) {
      states.push(s)
      s = resolveRound(s, {})
    }
    // The decisions each bot made, replayed as given decisions.
    const given = states.map((_, i) => Object.fromEntries((states[i + 1] ?? s).companies.map((c) => [c.id, c.lastDecision!])))
    const time = (run: () => void): number => {
      run()
      const t0 = performance.now()
      run()
      return (performance.now() - t0) / states.length
    }
    const plain = time(() => states.forEach((st, i) => resolveRound(st, given[i])))
    const withBots = time(() => states.forEach((st) => resolveRound(st, {})))
    // Generous bounds so a slow CI box does not flake; locally these are about 0.3 ms and 1 ms.
    expect(plain).toBeLessThan(2)
    expect(withBots).toBeLessThan(4)
  })
})
