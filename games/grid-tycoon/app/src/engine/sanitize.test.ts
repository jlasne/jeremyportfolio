import { describe, expect, it } from 'vitest'
import { createRng, createSoloGame, defaultDecision, resolveRound, sanitizeDecision, validateDecision, type GameState } from './index'
import { company, decision, edit, game } from './test/helpers'

/** States to throw decisions at: a whole bot game, plus losing rounds, due loans and a bankrupt company. */
function states(): GameState[] {
  const out: GameState[] = []
  let s = createSoloGame({ seed: 9, playerName: 'P' })
  while (!s.finished) {
    out.push(s)
    s = resolveRound(s, {})
  }
  out.push(edit(out[12], 'you', (c) => (c.treasury = -35)))
  out.push(edit(out[20], 'you', (c) => (c.treasury = -1e6)))
  out.push(
    edit(out[5], 'you', (c) => {
      c.loans.push({ id: 'due', principal: 15, annualRate: 0.1, dueRound: out[5].round, takenRound: out[5].round - 7 })
      c.loans.push({ id: 'later', principal: 5, annualRate: 0.1, dueRound: out[5].round + 3, takenRound: out[5].round - 4 })
    }),
  )
  return out
}

describe('sanitizeDecision', () => {
  it('always returns a decision that validates (property test over random decisions)', () => {
    const rng = createRng(20261026)
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rng.next() * xs.length)]
    const mw = (): number => pick([0, 0, 1, 2, 3.7, 10, 55, -4, Number.NaN, Number.POSITIVE_INFINITY, rng.next() * 30])
    const all = states()
    let checked = 0
    for (let i = 0; i < 3000; i++) {
      const s = pick(all)
      const c = company(s, 'you')
      const ids = [...c.buildings.map((b) => b.id), ...c.loans.map((l) => l.id), 'ghost']
      const raw = {
        builds: Array.from({ length: Math.floor(rng.next() * 6) }, () => ({
          kind: pick(['plant', 'dc', 'link', 'tower']),
          size: pick(['small', 'big', 'huge', undefined]),
          use: pick(['internal', 'town', 'import', 'moon']),
          mw: mw(),
          tile: pick([undefined, [0, 0], [1, 2], [7, 0], [-1, 3], [2.5, 1], 'x']),
        })),
        upgrades: Array.from({ length: Math.floor(rng.next() * 3) }, () => pick(ids)),
        power: { internal: mw(), town: mw(), otherDc: mw() },
        compute: { cloud: mw(), btc: mw(), ai: mw() },
        rentMw: mw(),
        loans: {
          take: pick([0, 0, 5, 50, 1e5, -3, Number.NaN]),
          repay: Object.fromEntries(c.loans.concat([{ id: 'ghost' } as never]).map((l) => [l.id, pick([0, 1, 7.777, 1e9, -2])])),
          refinance: Array.from({ length: Math.floor(rng.next() * 3) }, () => pick(ids)),
        },
        shares: pick([
          { mode: 'none', count: 0 },
          { mode: 'issue', count: pick([1, 2, 5, 1.5, -1]) },
          { mode: 'buyback', count: pick([1, 2, 9]) },
          { mode: 'both', count: 1 },
          { mode: 'issue', count: 1, buyback: 1 },
        ]),
        forcedSales: Array.from({ length: Math.floor(rng.next() * 4) }, () => pick(ids)),
      }
      const clean = sanitizeDecision(s, 'you', raw as never)
      const res = validateDecision(s, 'you', clean)
      if (!res.ok) throw new Error(`round ${s.round}: ${JSON.stringify(res.errors)}\n${JSON.stringify(raw)}`)
      checked++
    }
    expect(checked).toBe(3000)
  })

  it('returns the empty decision for a bankrupt company or a finished game', () => {
    let s = createSoloGame({ seed: 9, playerName: 'P' })
    const junk = decision((x) => ((x.power.internal = 2), (x.loans.take = 5)))
    expect(sanitizeDecision(edit(s, 'you', (c) => (c.bankrupt = true)), 'you', junk)).toEqual(decision())
    while (!s.finished) s = resolveRound(s, {})
    expect(sanitizeDecision(s, 'you', junk)).toEqual(decision())
  })

  it('keeps a valid decision as it is', () => {
    const s = game(['a'])
    const d = decision((x) => {
      x.power.internal = 2
      x.compute.ai = 1.5
      x.compute.cloud = 0.5
      x.builds.push({ kind: 'plant', size: 'small', tile: [2, 0] }, { kind: 'link', use: 'internal', mw: 2 })
      x.loans.take = 10
    })
    expect(sanitizeDecision(s, 'a', d)).toEqual(d)
  })

  it('scales compute down proportionally to the powered MW', () => {
    const s = game(['a'])
    const clean = sanitizeDecision(s, 'a', decision((x) => ((x.power.internal = 2), (x.compute.ai = 3), (x.compute.cloud = 1))))
    expect(clean.compute.ai).toBeCloseTo(1.5, 2)
    expect(clean.compute.cloud).toBeCloseTo(0.5, 2)
    expect(clean.compute.ai + clean.compute.cloud).toBeLessThanOrEqual(2)
  })

  it('picks forced sales in a losing round, cheapest sell value first', () => {
    const s = edit(game(['a']), 'a', (c) => (c.treasury = -2))
    const plant = company(s, 'a').buildings.find((b) => b.kind === 'plant')!
    expect(sanitizeDecision(s, 'a', decision()).forcedSales).toEqual([plant.id])
    expect(defaultDecision(s, 'a').forcedSales).toEqual([plant.id])
  })

  it('drops builds the treasury cannot pay and moves a taken lot to a free one', () => {
    const s = game(['a'])
    const clean = sanitizeDecision(
      s,
      'a',
      decision((x) => x.builds.push({ kind: 'plant', size: 'big' }, { kind: 'dc', size: 'small', tile: [0, 0] })),
    )
    expect(clean.builds).toEqual([{ kind: 'dc', size: 'small', tile: [2, 0] }])
  })
})
