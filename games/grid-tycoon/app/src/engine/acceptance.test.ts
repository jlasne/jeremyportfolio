// The acceptance tests of SPEC.md, one named test each.

import { describe, expect, it } from 'vitest'
import {
  allocatePool,
  createSoloGame,
  debtDragFactor,
  defaultConfig,
  previewCompany,
  resolveRound,
  sanitizeDecision,
  sellValue,
  stockReturn,
  validateDecision,
  type GameState,
} from './index'
import { addLink, company, decision, edit, game, tuned } from './test/helpers'

describe('SPEC acceptance tests', () => {
  it('the allocation example returns used MW of 6, 5 and 3', () => {
    const r = allocatePool(14, { you: 8, a: 6, c: 6 }, { you: 5, a: 5, c: 0 }, 0.8)
    expect(r.reserved).toEqual({ you: 4, a: 4, c: 0 })
    expect(r.open.you).toBeCloseTo(2, 10)
    expect(r.open.a).toBeCloseTo(1, 10)
    expect(r.open.c).toBeCloseTo(3, 10)
    expect(r.used.you).toBeCloseTo(6, 10)
    expect(r.used.a).toBeCloseTo(5, 10)
    expect(r.used.c).toBeCloseTo(3, 10)
    expect(r.idle.you).toBeCloseTo(2, 10)
    expect(r.idle.a).toBeCloseTo(1, 10)
    expect(r.idle.c).toBeCloseTo(3, 10)
  })

  it('when a pool shrinks below the reserved total, every reserve scales by the same factor', () => {
    const lastUsed = { a: 10, b: 5, c: 2.5 }
    const offers = { a: 12, b: 4, c: 6 }
    // Reserves before scaling: 8, 4, 2 = 14 against a demand of 7.
    const r = allocatePool(7, offers, lastUsed, 0.8)
    expect(r.used.a / 8).toBeCloseTo(0.5, 10)
    expect(r.used.b / 4).toBeCloseTo(0.5, 10)
    expect(r.used.c / 2).toBeCloseTo(0.5, 10)
    expect(r.used.a + r.used.b + r.used.c).toBeCloseTo(7, 10)
    expect(r.open).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('the stock example returns -2.8% for A and -0.6% for B', () => {
    const growth = { citizens: 0, otherDc: 0, cloud: 0.035, btc: 0, ai: 0.02 }
    const expected = { citizens: 0, otherDc: 0, cloud: 0.03, btc: 0, ai: 0.07 }
    const flat = { revenue: 50, prevRevenue: 50, growth, expected, idle: 0 }
    const a = stockReturn({ ...flat, weights: { citizens: 0, otherDc: 0, cloud: 0.4, btc: 0, ai: 0.6 } })
    const b = stockReturn({ ...flat, weights: { citizens: 0, otherDc: 0, cloud: 0.8, btc: 0, ai: 0.2 } })
    expect(a.r).toBeCloseTo(-0.028, 12)
    expect(b.r).toBeCloseTo(-0.006, 12)
    expect(a.revenueGrowth).toBe(0)
    expect(a.idle).toBe(0)
  })

  it('debt drag f(c) returns 2%, 8%, 18%, 52% and 100% at c of 0.1, 0.3, 0.5, 0.8 and 1.0, within 1 point', () => {
    const k = defaultConfig.debt.dragSteepness
    const table: [number, number][] = [
      [0.1, 0.02],
      [0.3, 0.08],
      [0.5, 0.18],
      [0.8, 0.52],
      [1.0, 1.0],
    ]
    for (const [c, f] of table) expect(Math.abs(debtDragFactor(c, k) - f)).toBeLessThanOrEqual(0.01)
  })

  it('issuing 2 of 10 shares at a market cap of 100 gives a price of 8.33 and +20 cash; buying back 2 gives 12.50 and -20', () => {
    const s = game(['a'])
    expect(company(s, 'a').marketCap).toBe(100)
    expect(company(s, 'a').shares).toBe(10)
    const issue = previewCompany(s, 'a', decision((d) => (d.shares = { mode: 'issue', count: 2 })))
    expect(issue.sharePrice).toBe(8.33)
    expect(issue.shares).toBe(12)
    expect(issue.financeCash).toBe(20)
    expect(issue.treasuryLeft).toBe(50)
    const buyback = previewCompany(s, 'a', decision((d) => (d.shares = { mode: 'buyback', count: 2 })))
    expect(buyback.sharePrice).toBe(12.5)
    expect(buyback.shares).toBe(8)
    expect(buyback.financeCash).toBe(-20)
    expect(buyback.treasuryLeft).toBe(10)
    // Resolution applies the same cash move, and the stock breakdown shows the share effect.
    const after = resolveRound(s, { a: decision((d) => (d.shares = { mode: 'issue', count: 2 })) })
    const r = company(after, 'a').history[0]
    expect(r.finance.shareCash).toBe(20)
    expect(r.stock.parts.shares).toBe(-1.67)
  })

  it('issue and buyback in the same round is rejected by validateDecision', () => {
    const s = game(['a'])
    const both = { ...decision(), shares: { mode: 'issue', count: 2, buyback: 2 } }
    const res = validateDecision(s, 'a', both as never)
    expect(res.ok).toBe(false)
    expect(res.errors.map((e) => e.code)).toContain('issue_and_buyback')
    const named = validateDecision(s, 'a', { ...decision(), shares: { mode: 'both', count: 2 } } as never)
    expect(named.errors.map((e) => e.code)).toContain('issue_and_buyback')
    const listed = validateDecision(s, 'a', { ...decision(), shares: { mode: ['issue', 'buyback'], count: 2 } } as never)
    expect(listed.errors.map((e) => e.code)).toContain('issue_and_buyback')
    expect(sanitizeDecision(s, 'a', both as never).shares).toEqual({ mode: 'none', count: 0 })
  })

  it('a loan of 20 at 8% a year charges 0.40 per round and 20 at its due round', () => {
    // On round 1 there is no revenue yet, so the rate is the base rate: set it to 8%.
    const config = tuned((c) => (c.loan.baseRate = 0.08))
    let s = game(['a'], 1, config)
    s = resolveRound(s, { a: decision((d) => ((d.loans.take = 20), (d.power.internal = 2), (d.compute.ai = 2))) }, config)
    const loan = company(s, 'a').loans[0]
    expect(loan).toMatchObject({ principal: 20, annualRate: 0.08, takenRound: 1, dueRound: 8 })
    for (let round = 2; round <= 9; round++) s = resolveRound(s, {}, config)
    const h = company(s, 'a').history
    for (let round = 1; round <= 8; round++) expect(h[round - 1].costs.interest).toBe(0.4)
    expect(h.slice(0, 7).every((r) => r.principalRepaid === 0)).toBe(true)
    expect(h[7].principalRepaid).toBe(20)
    expect(h[8].costs.interest).toBe(0)
    expect(company(s, 'a').loans).toEqual([])
    // The principal leaves the treasury on top of the round's profit.
    expect(h[7].treasury).toBe(Math.round((h[6].treasury + h[7].profit - 20) * 100) / 100)
  })

  it('refinance is refused when the treasury is below 0', () => {
    const s = edit(game(['a']), 'a', (c) => {
      c.treasury = -5
      c.loans.push({ id: 'n9', principal: 20, annualRate: 0.1, dueRound: 1, takenRound: -6 })
    })
    const d = decision((x) => (x.loans.refinance = ['n9']))
    const res = validateDecision(s, 'a', d)
    expect(res.errors.map((e) => e.code)).toContain('refinance_negative_treasury')
    expect(sanitizeDecision(s, 'a', d).loans.refinance).toEqual([])
    // With a non-negative treasury the same refinance is accepted and rolls the loan.
    const ok = edit(s, 'a', (c) => (c.treasury = 5))
    expect(validateDecision(ok, 'a', d).ok).toBe(true)
    const after = resolveRound(ok, { a: d })
    expect(company(after, 'a').history[0].refinanced).toBe(20)
    expect(company(after, 'a').loans).toHaveLength(1)
    expect(company(after, 'a').loans[0]).toMatchObject({ principal: 20, dueRound: 1 + defaultConfig.loan.termRounds })
  })

  it('selling a small plant returns 3.0', () => {
    const s = game(['a'])
    const plant = company(s, 'a').buildings.find((b) => b.kind === 'plant')!
    expect(sellValue(plant)).toBe(3)
    const losing = edit(s, 'a', (c) => (c.treasury = -2))
    const after = resolveRound(losing, { a: decision((d) => (d.forcedSales = [plant.id])) })
    const r = company(after, 'a').history[0]
    expect(r.finance.forcedSold).toEqual([plant.id])
    expect(r.finance.forcedSaleCash).toBe(3)
  })

  it('selling to citizens without a town link is rejected', () => {
    const s = game(['a'])
    const d = decision((x) => (x.power.town = 2))
    const res = validateDecision(s, 'a', d)
    expect(res.ok).toBe(false)
    expect(res.errors.map((e) => e.code)).toContain('no_town_link')
    // With a town link the same order is fine.
    const linked = edit(s, 'a', (c) => addLink(c, 'town', 2))
    expect(validateDecision(linked, 'a', d).ok).toBe(true)
  })

  it('same seed and same decisions give identical states after 40 rounds', () => {
    const play = (): GameState => {
      let s = createSoloGame({ seed: 42, playerName: 'Ada' })
      while (!s.finished) {
        const human = decision((d) => {
          d.power.internal = 2
          d.compute.ai = 2
          if (s.round % 5 === 1) d.builds.push({ kind: 'plant', size: 'small' }, { kind: 'dc', size: 'small' }, { kind: 'link', use: 'internal', mw: 2 })
        })
        s = resolveRound(s, { you: human })
      }
      return s
    }
    const a = play()
    const b = play()
    expect(a.round).toBe(41)
    expect(a.finished).toBe(true)
    expect(b).toEqual(a)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('round 1 with the default start gives 5.16 profit for a company putting 2 MW on AI', () => {
    // One company, so demand cannot be the limit (AI demand starts at 2 MW and grows).
    let s = game(['solo'], 3)
    const d = decision((x) => ((x.power.internal = 2), (x.compute.ai = 2)))
    expect(validateDecision(s, 'solo', d).ok).toBe(true)
    s = resolveRound(s, { solo: d })
    const r = company(s, 'solo').history[0]
    expect(s.history[0].pools.ai.demand).toBeGreaterThanOrEqual(2)
    expect(r.used.ai).toBe(2)
    expect(r.revenue).toBe(6.4)
    expect(r.costs).toEqual({ power: 0.8, rent: 0, maintenance: 0.44, interest: 0 })
    expect(r.profit).toBe(5.16)
    expect(r.treasury).toBe(35.16)
  })
})
