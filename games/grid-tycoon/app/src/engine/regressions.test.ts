// Regressions found in the final engine review. One test per fix, named after what was wrong.

import { describe, expect, it } from 'vitest'
import {
  botDecision,
  createGame,
  createSoloGame,
  defaultDecision,
  POOLS,
  previewCompany,
  resolveRound,
  warnings,
  type BotStyle,
  type GameState,
  type PoolId,
} from './index'
import { addOnline, decision, edit, game } from './test/helpers'

function play(s: GameState, rounds = Infinity): GameState {
  for (let i = 0; i < rounds && !s.finished; i++) s = resolveRound(s, {})
  return s
}

function botGame(seed: number, styles: BotStyle[]): GameState {
  return createGame({ seed, companies: styles.map((bot, i) => ({ id: `${bot}${i}`, name: bot, isBot: true, bot })) })
}

/** Share of a company's revenue over a whole game that came from the given pools. */
function share(s: GameState, id: string, pools: PoolId[]): number {
  const c = s.companies.find((x) => x.id === id)!
  let total = 0
  let part = 0
  for (const r of c.history) {
    for (const p of POOLS) total += r.revenueByPool[p]
    for (const p of pools) part += r.revenueByPool[p]
  }
  return total > 0 ? part / total : 0
}

describe('bots sell to the clients of the SPEC bot table', () => {
  // Before the fix every style sized builds on its best weighted margin, and AI's 2.8 per MW won:
  // Volta took 44% and Hashfield 38% of their revenue from AI, a pool neither lists.
  const games = [1, 2, 3, 4, 5, 6].map((seed) => play(botGame(seed, ['volta', 'nimbus', 'hashfield', 'volta'])))
  const off: Record<BotStyle, PoolId[]> = {
    volta: ['btc', 'ai'],
    nimbus: ['citizens', 'otherDc', 'btc'],
    hashfield: ['citizens', 'cloud', 'ai'],
  }

  it('Volta (citizens, cloud, rivals), Nimbus (AI then cloud), Hashfield (bitcoin then rivals) earn little off their list', () => {
    const mean = (id: string, style: BotStyle): number => games.reduce((a, s) => a + share(s, id, off[style]), 0) / games.length
    expect(mean('volta0', 'volta')).toBeLessThan(0.1)
    expect(mean('volta3', 'volta')).toBeLessThan(0.1)
    expect(mean('nimbus1', 'nimbus')).toBeLessThan(0.1)
    expect(mean('hashfield2', 'hashfield')).toBeLessThan(0.2)
  })

  it('and still play competently: no bankruptcy, no losing round, every style ends above its start price', () => {
    for (const s of games) {
      for (const c of s.companies) {
        expect(c.bankrupt).toBe(false)
        expect(c.history.every((r) => r.finance.forcedSold.length === 0)).toBe(true)
        expect(c.sharePrice).toBeGreaterThan(10)
      }
    }
  })
})

describe('Volta pays a due loan off in the decision phase', () => {
  // Before the fix Volta let the loan fall due: it paid one more round of interest and the principal
  // counted in c, so the debt drag spiked in the very round it chose to be prudent.
  it('repays it early (no refinance, nothing due at step 7, no interest on it this round)', () => {
    let s = play(createSoloGame({ seed: 2, playerName: 'P' }), 6)
    s = edit(s, 'volta', (c) => {
      c.treasury = 500
      c.loans = [{ id: 'L', principal: 20, annualRate: 0.1, dueRound: s.round, takenRound: s.round - 7 }]
    })
    const d = botDecision(s, 'volta')
    expect(d.loans.repay.L).toBe(20)
    expect(d.loans.refinance).toEqual([])
    const after = resolveRound(s, { volta: d })
    const r = after.companies.find((c) => c.id === 'volta')!.history.at(-1)!
    expect(r.principalRepaid).toBe(0)
    expect(r.finance.repaid).toBeGreaterThanOrEqual(20)
    expect(r.costs.interest).toBe(0)
    expect(r.stock.c).toBe(0)
  })
})

describe('warning chips', () => {
  it('a loan the draft refinances is no longer "due now"', () => {
    const s = edit(game(['you']), 'you', (c) => c.loans.push({ id: 'L', principal: 5, annualRate: 0.1, dueRound: 1, takenRound: -6 }))
    const keep = defaultDecision(s, 'you')
    expect(warnings(s, 'you', keep).map((w) => w.code)).toContain('loan_due_soon')
    const rolled = { ...keep, loans: { ...keep.loans, refinance: ['L'] } }
    expect(warnings(s, 'you', rolled).map((w) => w.code)).not.toContain('loan_due_soon')
  })

  it('in a losing round the negative-treasury chip asks for forced sales, not for fewer builds', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = -5))
    const chip = warnings(s, 'you', decision()).find((w) => w.code === 'treasury_negative')!
    expect(chip.detail).toMatch(/Losing round/)
    const spend = warnings(game(['you']), 'you', decision((d) => (d.builds = [{ kind: 'plant', size: 'big' }]))).find((w) => w.code === 'treasury_negative')!
    expect(spend.detail).not.toMatch(/Losing round/)
  })
})

describe('previewCompany.financeCash', () => {
  // Before the fix the uncapped share issue of a losing round with nothing left to sell moved the
  // treasury but was missing from financeCash, so treasuryLeft != treasury + financeCash - buildSpend.
  it('counts the forced share issue: treasuryLeft = treasury + financeCash - buildSpend', () => {
    const empty = edit(game(['you']), 'you', (c) => ((c.buildings = []), (c.treasury = -25)))
    const p = previewCompany(empty, 'you', decision())
    expect(p.shares).toBe(13)
    expect(p.treasuryLeft).toBeGreaterThanOrEqual(0)
    expect(p.financeCash).toBe(30)
    expect(p.treasuryLeft).toBeCloseTo(-25 + p.financeCash - p.buildSpend, 2)

    const rich = edit(game(['you']), 'you', (c) => ((c.treasury = -4), addOnline(c, 'plant', 'small')))
    const sold = defaultDecision(rich, 'you')
    const q = previewCompany(rich, 'you', { ...sold, loans: { ...sold.loans, take: 7 }, builds: [{ kind: 'link', use: 'town', mw: 2 }] })
    expect(q.treasuryLeft).toBeCloseTo(-4 + q.financeCash - q.buildSpend, 2)
  })
})
