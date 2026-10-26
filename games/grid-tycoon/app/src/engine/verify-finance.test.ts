// Adversarial verification of the stock price and finance rules (SPEC "Stock price", "Debt and
// shares"; DESIGN 2.2 and 2.3 step 5-9). Expected values are computed by hand in the comments.

import { describe, expect, it } from 'vitest'
import {
  createSoloGame,
  defaultConfig,
  defaultDecision,
  loanRate,
  resolveRound,
  sanitizeDecision,
  stockReturn,
  validateDecision,
  type Decision,
  type GameState,
  type RoundResult,
} from './index'
import { addLink, company, decision, edit, game, tuned } from './test/helpers'

const round2 = (x: number): number => Math.round(x * 100) / 100
const f = (c: number): number => (Math.exp(3 * c) - 1) / (Math.exp(3) - 1)
const ai2 = (change: (d: Decision) => void = () => {}): Decision =>
  decision((d) => {
    d.power.internal = 2
    d.compute.ai = 2
    change(d)
  })
const last = (s: GameState, id = 'a'): RoundResult => company(s, id).history.at(-1)!
const partsSum = (r: RoundResult): number => {
  const p = r.stock.parts
  return p.revenueGrowth + Object.values(p.demandMiss).reduce((a, b) => a + b, 0) + p.idle + p.fundamentals + p.debtDrag + p.shares
}
const codes = (s: GameState, d: Decision, id = 'a'): string[] => validateDecision(s, id, d).errors.map((e) => e.code)

/** mulberry32, local to the test so the driver below is deterministic. */
function localRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('market return r (SPEC Stock price step 1, DESIGN 2.3.9)', () => {
  const flat = { growth: { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }, expected: { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 } }
  const none = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }

  it('revenue growth: half the clamped growth; round 1 gives 0; from 0 revenue gives +30%', () => {
    expect(stockReturn({ ...flat, revenue: 12, prevRevenue: 10, weights: none, idle: 0 }).r).toBeCloseTo(0.1, 12)
    expect(stockReturn({ ...flat, revenue: 50, prevRevenue: 10, weights: none, idle: 0 }).r).toBeCloseTo(0.15, 12)
    expect(stockReturn({ ...flat, revenue: 1, prevRevenue: 10, weights: none, idle: 0 }).r).toBeCloseTo(-0.15, 12)
    expect(stockReturn({ ...flat, revenue: 10, prevRevenue: null, weights: none, idle: 0 }).r).toBe(0)
    expect(stockReturn({ ...flat, revenue: 5, prevRevenue: 0, weights: none, idle: 0 }).r).toBeCloseTo(0.15, 12)
    expect(stockReturn({ ...flat, revenue: 0, prevRevenue: 0, weights: none, idle: 0 }).r).toBe(0)
  })

  it('idle penalty is continuous: 1% per 10 points above 20%', () => {
    const at = (idle: number): number => stockReturn({ ...flat, revenue: 1, prevRevenue: 1, weights: none, idle }).r
    expect(at(0.2)).toBe(0)
    expect(at(0.1)).toBe(0)
    expect(at(0.25)).toBeCloseTo(-0.005, 12)
    expect(at(0.34)).toBeCloseTo(-0.014, 12)
    expect(at(1)).toBeCloseTo(-0.08, 12)
  })

  it('in resolution, weights come from LAST round revenue and dRev is clamped (hand computed over 2 rounds)', () => {
    // Round 1: 2 MW to citizens through a town link, datacenter unused.
    //   revenue 2.0, power 0.8, maintenance 0.44 -> profit 0.76.
    //   idle = 1 - (2 + 0) / 4 = 0.5 -> P_idle = 3%. Round 1: dRev 0, weights 0 -> r = -0.03.
    //   FV = 20 x 0.76 + 0.3 x 22 = 21.8. BV = 0.85 x 100 x 0.97 + 0.15 x 21.8 = 82.45 + 3.27 = 85.72.
    let s = edit(game(['a']), 'a', (c) => addLink(c, 'town', 2))
    s = resolveRound(s, { a: decision((d) => (d.power.town = 2)) })
    const r1 = last(s)
    expect(r1.used.citizens).toBe(2)
    expect(r1.profit).toBe(0.76)
    expect(r1.idle).toBeCloseTo(0.5, 12)
    expect(r1.stock.r).toBeCloseTo(-0.03, 12)
    expect(r1.stock.fv).toBe(21.8)
    expect(r1.businessValue).toBe(85.72)
    expect(r1.sharePrice).toBe(8.57)

    // Round 2: 2 MW on AI. revenue 6.4, profit 6.4 - 0.8 - 0.44 = 5.16.
    //   dRev = (6.4 - 2) / 2 = 220% -> clamped 30% -> 0.15. Weights from round 1: 100% citizens.
    //   r = 0.15 + (g_cit - E_cit). FV = 20 x (0.76 + 5.16) / 2 + 6.6 = 65.8.
    s = resolveRound(s, { a: ai2() })
    const r2 = last(s)
    expect(r2.used.ai).toBe(2)
    expect(r2.profit).toBe(5.16)
    const miss = s.pools.citizens.growth - s.pools.citizens.expectedGrowth
    expect(r2.stock.rParts.revenueGrowth).toBeCloseTo(0.15, 12)
    expect(r2.stock.rParts.demandMiss.citizens).toBeCloseTo(miss, 12)
    expect(r2.stock.rParts.demandMiss.ai).toBe(0)
    expect(r2.stock.r).toBeCloseTo(0.15 + miss, 12)
    expect(r2.stock.fv).toBe(65.8)
    expect(r2.businessValue).toBe(round2(0.85 * 85.72 * (1 + 0.15 + miss) + 0.15 * 65.8))
  })
})

describe('business value and debt drag (SPEC Stock price steps 2-3, DESIGN 2.3.9)', () => {
  it('round 1 then a round with a new loan: FV, BV, c, f(c), market cap and price by hand', () => {
    // Round 1: the 5.16 start check. r = 0 (round 1, no idle). FV = 20 x 5.16 + 0.3 x 22 = 109.8.
    //   BV = 85 + 16.47 = 101.47, MC 101.47, price 10.147 -> 10.15.
    let s = resolveRound(game(['a']), { a: ai2() })
    const r1 = last(s)
    expect(r1.stock.r).toBe(0)
    expect(r1.stock.fv).toBe(109.8)
    expect(r1.businessValue).toBe(101.47)
    expect(r1.marketCap).toBe(101.47)
    expect(r1.sharePrice).toBe(10.15)

    // Round 2: take 20. Rate from round 1 weights (100% AI, stability 0.3): 12% - 8% x 0.3 = 9.6%.
    //   Interest 20 x 9.6% / 4 = 0.48, charged in the take round. profit = 6.4 - 0.8 - 0.44 - 0.48 = 4.68.
    //   FV = 20 x (5.16 + 4.68) / 2 + 6.6 = 105. c = 0.48 / 6.4 = 0.075, drag = 20 x f(0.075) = 0.26.
    expect(loanRate(s, 'a')).toBeCloseTo(0.096, 12)
    s = resolveRound(s, { a: ai2((d) => (d.loans.take = 20)) })
    const r2 = last(s)
    expect(company(s, 'a').loans[0]).toMatchObject({ principal: 20, annualRate: 0.096, takenRound: 2, dueRound: 9 })
    expect(r2.costs.interest).toBe(0.48)
    expect(r2.profit).toBe(4.68)
    expect(r2.stock.fv).toBe(105)
    const miss = s.pools.ai.growth - s.pools.ai.expectedGrowth
    expect(r2.stock.r).toBeCloseTo(miss, 12)
    const bv = round2(0.85 * 101.47 * (1 + miss) + 0.15 * 105)
    expect(r2.businessValue).toBe(bv)
    expect(r2.stock.debt).toBe(20)
    expect(r2.stock.c).toBeCloseTo(0.075, 12)
    expect(r2.stock.fc).toBeCloseTo(f(0.075), 12)
    expect(r2.stock.debtDragMoney).toBe(0.26)
    expect(r2.marketCap).toBe(round2(bv - 0.26))
    expect(r2.sharePrice).toBe(round2(round2(bv - 0.26) / 10))
    expect(r2.treasury).toBe(round2(r1.treasury + 20 + 4.68))
  })

  it('FV counts 30% of every building price paid, under construction and upgrades included, links excluded', () => {
    // Order a small plant (10) and upgrade the datacenter (+58): book = 10 + 70 + 10 = 90.
    let s = edit(game(['a']), 'a', (c) => (c.treasury = 100))
    s = resolveRound(s, {
      a: ai2((d) => {
        d.upgrades.push(company(s, 'a').buildings[1].id)
        d.builds.push({ kind: 'plant', size: 'small' }, { kind: 'link', use: 'town', mw: 5 })
      }),
    })
    const r = last(s)
    // Maintenance: 2% of online + upgrading price paid = 0.02 x (10 + 70) = 1.6. Profit = 6.4 - 0.8 - 1.6 = 4.
    expect(r.costs.maintenance).toBe(1.6)
    expect(r.profit).toBe(4)
    expect(r.stock.fv).toBe(round2(20 * 4 + 0.3 * 90))
  })

  it('in a due round, debt is measured before the principal is paid and the principal counts in c', () => {
    // Round 2, a 20 loan at 8% due now. Interest 0.4 + principal 20 over revenue 6.4 -> c = 1, f = 1.
    // debt = 20 (before payment), drag = 20, the market cap loses all 20.
    let s = resolveRound(game(['a']), { a: ai2() })
    s = edit(s, 'a', (c) => c.loans.push({ id: 'L', principal: 20, annualRate: 0.08, dueRound: 2, takenRound: -5 }))
    const before = company(s, 'a')
    const after = resolveRound(s, { a: ai2() })
    const r = last(after)
    expect(r.costs.interest).toBe(0.4)
    expect(r.principalRepaid).toBe(20)
    expect(r.stock.debt).toBe(20)
    expect(r.stock.c).toBe(1)
    expect(r.stock.fc).toBeCloseTo(1, 12)
    expect(r.stock.debtDragMoney).toBe(20)
    expect(r.marketCap).toBe(round2(r.businessValue - 20))
    expect(r.treasury).toBe(round2(before.treasury + r.profit - 20))
    expect(company(after, 'a').loans).toEqual([])
    // Next round the debt is gone and so is the drag: the debtDrag part gives the 20 back.
    const next = last(resolveRound(after, { a: ai2() }))
    expect(next.stock.debt).toBe(0)
    expect(next.stock.parts.debtDrag).toBe(2)
  })

  it('revenue 0 with something due gives c = 1; nothing due gives c = 0', () => {
    let s = edit(game(['a']), 'a', (c) => c.loans.push({ id: 'L', principal: 40, annualRate: 0.12, dueRound: 5, takenRound: -2 }))
    s = resolveRound(s, { a: decision() })
    expect(last(s).revenue).toBe(0)
    expect(last(s).stock.c).toBe(1)
    expect(last(s).stock.debtDragMoney).toBe(40)
    const noDebt = resolveRound(game(['a']), { a: decision() })
    expect(last(noDebt).stock.c).toBe(0)
  })
})

describe('loans (SPEC Debt and shares, DESIGN 2.2.2-2.2.4)', () => {
  /** A state at round 3 whose last round revenue split is the given one. */
  function withLastRevenue(split: Partial<RoundResult['revenueByPool']>, profit = 1, treasury = 30): GameState {
    let s = resolveRound(game(['a']), { a: ai2() })
    s = resolveRound(s, { a: ai2() })
    return edit(s, 'a', (c) => {
      c.history[0].revenueByPool = { citizens: 0, otherDc: 0, cloud: 0, btc: 10, ai: 0 }
      c.history[1].revenueByPool = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0, ...split }
      c.history[1].profit = profit
      c.treasury = treasury
    })
  }

  it('the rate uses the stability weights of last round revenue: 4.8% for 50/50 citizens and cloud, 11.2% for bitcoin', () => {
    expect(loanRate(game(['a']), 'a')).toBe(0.12)
    expect(loanRate(withLastRevenue({ citizens: 3, cloud: 3 }), 'a')).toBeCloseTo(0.048, 12)
    expect(loanRate(withLastRevenue({ btc: 5 }), 'a')).toBeCloseTo(0.112, 12)
    // +4 points under stress, once, whichever triggers it.
    expect(loanRate(withLastRevenue({ citizens: 3, cloud: 3 }, -1), 'a')).toBeCloseTo(0.088, 12)
    expect(loanRate(withLastRevenue({ citizens: 3, cloud: 3 }, 1, -1), 'a')).toBeCloseTo(0.088, 12)
    expect(loanRate(withLastRevenue({ citizens: 3, cloud: 3 }, -1, -1), 'a')).toBeCloseTo(0.088, 12)
    // The loan taken in resolution gets exactly that rate.
    const s = resolveRound(withLastRevenue({ citizens: 3, cloud: 3 }), { a: ai2((d) => (d.loans.take = 10)) })
    expect(company(s, 'a').loans[0].annualRate).toBeCloseTo(0.048, 12)
  })

  it('the rate is fixed at take: later rounds with other clients do not change it', () => {
    let s = resolveRound(withLastRevenue({ citizens: 3, cloud: 3 }), { a: ai2((d) => (d.loans.take = 40)) })
    for (let i = 0; i < 3; i++) s = resolveRound(s, { a: ai2() })
    const loan = company(s, 'a').loans[0]
    expect(loanRate(s, 'a')).toBeCloseTo(0.096, 12)
    expect(loan.annualRate).toBeCloseTo(0.048, 12)
    // 40 x 4.8% / 4 = 0.48 every round.
    expect(company(s, 'a').history.slice(-4).map((r) => r.costs.interest)).toEqual([0.48, 0.48, 0.48, 0.48])
  })

  it('early repayment is partial, cuts this round interest, and repaying all of it removes the loan', () => {
    const s = edit(game(['a']), 'a', (c) => c.loans.push({ id: 'L', principal: 20, annualRate: 0.08, dueRound: 6, takenRound: -1 }))
    const part = resolveRound(s, { a: ai2((d) => (d.loans.repay.L = 5)) })
    expect(company(part, 'a').loans[0].principal).toBe(15)
    expect(last(part).finance.repaid).toBe(5)
    expect(last(part).costs.interest).toBe(0.3)
    expect(last(part).stock.debt).toBe(15)
    expect(last(part).treasury).toBe(round2(30 - 5 + last(part).profit))
    const all = resolveRound(s, { a: ai2((d) => (d.loans.repay.L = 20)) })
    expect(company(all, 'a').loans).toEqual([])
    expect(last(all).costs.interest).toBe(0)
    expect(codes(s, ai2((d) => (d.loans.repay.L = 21)))).toContain('repay_over_principal')
    expect(codes(s, ai2((d) => (d.loans.repay.L = 31)))).toContain('repay_over_principal')
    const poor = edit(s, 'a', (c) => (c.treasury = 4))
    expect(codes(poor, ai2((d) => (d.loans.repay.L = 5)))).toContain('over_treasury')
  })

  it('refinance at the due round: this round interest is paid, the principal rolls at the current rate, due 8 rounds later', () => {
    // Round 2 rate is 9.6% (round 1 was 100% AI). The old loan at 8% pays 0.4 now; the new one 20 x 9.6% / 4 = 0.48.
    let s = resolveRound(game(['a']), { a: ai2() })
    s = edit(s, 'a', (c) => c.loans.push({ id: 'L', principal: 20, annualRate: 0.08, dueRound: 2, takenRound: -5 }))
    const d = ai2((x) => x.loans.refinance.push('L'))
    expect(validateDecision(s, 'a', d).ok).toBe(true)
    const t0 = company(s, 'a').treasury
    s = resolveRound(s, { a: d })
    const r = last(s)
    expect(r.costs.interest).toBe(0.4)
    expect(r.refinanced).toBe(20)
    expect(r.principalRepaid).toBe(0)
    expect(r.treasury).toBe(round2(t0 + r.profit))
    // Debt still counts, but the rolled principal is not due: c = 0.4 / 6.4.
    expect(r.stock.debt).toBe(20)
    expect(r.stock.c).toBeCloseTo(0.0625, 12)
    expect(r.stock.debtDragMoney).toBe(round2(20 * f(0.0625)))
    const loans = company(s, 'a').loans
    expect(loans).toHaveLength(1)
    expect(loans[0]).toMatchObject({ principal: 20, dueRound: 10 })
    expect(loans[0].annualRate).toBeCloseTo(0.096, 12)
    // The new loan charges 8 rounds of interest (3..10) and its principal at round 10.
    for (let i = 3; i <= 11; i++) s = resolveRound(s, { a: ai2() })
    const h = company(s, 'a').history
    expect(h.slice(2, 10).map((x) => x.costs.interest)).toEqual(Array(8).fill(0.48))
    expect(h[9].principalRepaid).toBe(20)
    expect(h[10].costs.interest).toBe(0)
  })

  it('refinance is only for a loan due this round, and never runs from a negative treasury, even if resolution is handed one', () => {
    const s = edit(game(['a']), 'a', (c) => c.loans.push({ id: 'L', principal: 20, annualRate: 0.08, dueRound: 2, takenRound: -5 }))
    expect(codes(s, ai2((d) => d.loans.refinance.push('L')))).toContain('refinance_not_due')
    const losing = edit(s, 'a', (c) => {
      c.treasury = -1
      c.loans[0].dueRound = 1
    })
    const raw = ai2((d) => {
      d.loans.refinance.push('L')
      d.forcedSales = [company(losing, 'a').buildings[0].id]
    })
    expect(codes(losing, raw)).toContain('refinance_negative_treasury')
    const r = last(resolveRound(losing, { a: raw }))
    expect(r.refinanced).toBe(0)
    expect(r.principalRepaid).toBe(20)
  })
})

describe('shares (SPEC Debt and shares, DESIGN 2.2.5)', () => {
  it('cap is 20% of current shares, whole numbers only', () => {
    const s = game(['a'])
    expect(codes(s, decision((d) => (d.shares = { mode: 'issue', count: 3 })))).toContain('shares_over_cap')
    expect(codes(s, decision((d) => (d.shares = { mode: 'issue', count: 1.5 })))).toContain('not_integer')
    expect(validateDecision(s, 'a', decision((d) => (d.shares = { mode: 'issue', count: 2 }))).ok).toBe(true)
    const fourteen = edit(s, 'a', (c) => ((c.shares = 14), (c.sharePrice = round2(c.marketCap / 14))))
    expect(codes(fourteen, decision((d) => (d.shares = { mode: 'issue', count: 3 })))).toContain('shares_over_cap')
  })

  it('buyback cash cannot exceed treasury minus total debt, counted after this round loan', () => {
    // Treasury 30 + new loan 10 = 40; debt 15 + 10 = 25; room 15. 2 shares at 10 = 20 > 15, 1 share = 10 fits.
    const s = edit(game(['a']), 'a', (c) => c.loans.push({ id: 'L', principal: 15, annualRate: 0.08, dueRound: 6, takenRound: -1 }))
    const two = decision((d) => ((d.loans.take = 10), (d.shares = { mode: 'buyback', count: 2 })))
    expect(codes(s, two)).toContain('buyback_over_cash')
    expect(sanitizeDecision(s, 'a', two).shares).toEqual({ mode: 'buyback', count: 1 })
    const one = decision((d) => ((d.loans.take = 10), (d.shares = { mode: 'buyback', count: 1 })))
    expect(validateDecision(s, 'a', one).ok).toBe(true)
    const r = last(resolveRound(s, { a: one }))
    expect(r.finance.shareCash).toBe(-10)
    expect(r.shares).toBe(9)
  })

  it('the share effect of an issue appears in the breakdown and the price falls with market cap unchanged', () => {
    const s = resolveRound(game(['a']), { a: ai2((d) => (d.shares = { mode: 'issue', count: 2 })) })
    const r = last(s)
    expect(r.finance.shareCash).toBe(20)
    expect(r.shares).toBe(12)
    // Market cap is the same as without the issue: issuing moves cash, not value.
    const plain = last(resolveRound(game(['a']), { a: ai2() }))
    expect(r.marketCap).toBe(plain.marketCap)
    expect(r.sharePrice).toBe(round2(plain.marketCap / 12))
  })
})

describe('losing round (SPEC Losing round and bankruptcy, DESIGN 2.2.1)', () => {
  it('a forced sale returns 30% of the price paid, upgrade included', () => {
    // An upgrading small plant: 10 + 46 = 56 paid, sells for 16.8.
    const s = edit(game(['a']), 'a', (c) => {
      c.treasury = -10
      const p = c.buildings[0]
      p.status = 'upgrading'
      p.roundsLeft = 2
      p.pricePaid = 56
    })
    const plant = company(s, 'a').buildings[0].id
    const r = last(resolveRound(s, { a: decision((d) => (d.forcedSales = [plant])) }))
    expect(r.finance.forcedSaleCash).toBe(16.8)
    expect(r.finance.forcedSold).toEqual([plant])
  })

  it('with no building left, shares are issued at the current price past the 20% cap', () => {
    // -100 + 3 + 3.6 = -93.4 -> ceil(9.34) = 10 shares at 10 = +100 -> 6.6, shares 20 (cap would be 2).
    const s = edit(game(['a']), 'a', (c) => (c.treasury = -100))
    const ids = company(s, 'a').buildings.map((b) => b.id)
    const after = resolveRound(s, { a: decision((d) => (d.forcedSales = ids)) })
    const r = last(after)
    expect(r.finance.forcedSharesIssued).toBe(10)
    expect(r.shares).toBe(20)
    expect(r.treasury).toBe(6.6)
    // The market cap does not move from the issue: price before 10, the share part is 100/20 - 100/10 = -5.
    expect(r.stock.parts.shares).toBe(-5)
  })

  it('a decision that validates in a losing round never leaves the decision phase below 0 (forced issue, then a voluntary issue and builds)', () => {
    // DESIGN 2.2.6: treasury must stay >= 0 after all decision-phase effects.
    // Sell both buildings: -20 + 6.6 = -13.4 -> 2 forced shares at 10 -> treasury 6.6, 12 shares, price 8.33.
    // A voluntary issue of 2 (cap floor(20% x 12) = 2) is then priced at the current price 8.33 (16.66),
    // so the treasury is 23.26: builds worth 26 do not fit, builds worth 22 do.
    // The company has no building online, so profit is 0 and the end treasury is the phase treasury.
    const s = edit(game(['a']), 'a', (c) => (c.treasury = -20))
    const ids = company(s, 'a').buildings.map((b) => b.id)
    const d = decision((x) => {
      x.forcedSales = ids
      x.shares = { mode: 'issue', count: 2 }
      x.builds.push({ kind: 'plant', size: 'small' }, { kind: 'dc', size: 'small' }, { kind: 'link', use: 'internal', mw: 4 })
    })
    expect(validateDecision(s, 'a', d).errors.map((e) => e.code)).toEqual(['over_treasury'])
    const r = last(resolveRound(s, { a: d }))
    expect(r.profit).toBe(0)
    expect(r.treasury).toBeGreaterThanOrEqual(0)

    const fits = decision((x) => {
      x.forcedSales = ids
      x.shares = { mode: 'issue', count: 2 }
      x.builds.push({ kind: 'plant', size: 'small' }, { kind: 'dc', size: 'small' })
    })
    expect(validateDecision(s, 'a', fits).ok).toBe(true)
    const r2 = last(resolveRound(s, { a: fits }))
    expect(r2.finance.forcedSharesIssued).toBe(2)
    expect(r2.finance.shareCash).toBe(16.66)
    expect(r2.treasury).toBe(1.26)
  })

  it('market cap at the floor makes the company bankrupt', () => {
    let s = resolveRound(game(['a', 'b']), {})
    s = edit(s, 'a', (c) => c.loans.push({ id: 'big', principal: 5000, annualRate: 0.12, dueRound: s.round, takenRound: s.round - 7 }))
    const after = resolveRound(s, {})
    expect(company(after, 'a').marketCap).toBe(defaultConfig.marketCap.floor)
    expect(company(after, 'a').bankrupt).toBe(true)
  })
})

describe('stock breakdown (SPEC Smart helpers, DESIGN 2.3.9)', () => {
  it('the parts add up to the price move within rounding, under random loans, refinances, repayments, issues and buybacks', () => {
    // 10 rounded parts plus 2 rounded prices: 0.06 is the rounding budget.
    let worst = 0
    for (let seed = 1; seed <= 12; seed++) {
      const rnd = localRng(seed * 97)
      let s = createSoloGame({ seed, playerName: 'P' })
      while (!s.finished) {
        const d = defaultDecision(s, 'you')
        const x = rnd()
        if (x < 0.2) d.loans.take = Math.round(rnd() * 60)
        else if (x < 0.35) d.shares = { mode: 'issue', count: 2 }
        else if (x < 0.5) d.shares = { mode: 'buyback', count: 2 }
        for (const l of company(s, 'you').loans) {
          if (l.dueRound === s.round && rnd() < 0.5) d.loans.refinance.push(l.id)
          else if (rnd() < 0.1) d.loans.repay[l.id] = round2(l.principal * rnd())
        }
        s = resolveRound(s, { you: d })
      }
      // The bankrupt round (market cap at the floor) has its own test below.
      for (const c of s.companies) {
        for (const r of c.history) if (!r.bankrupt) worst = Math.max(worst, Math.abs(r.stock.priceBefore + partsSum(r) - r.stock.priceAfter))
      }
    }
    expect(worst).toBeLessThan(0.06)
  })

  it('the parts add up to the price move in the round the market cap hits the floor', () => {
    // DESIGN 2.3.9: "They sum to priceAfter - priceBefore within rounding", no exception for the floor.
    // Here the drag is 5000 money but the market cap can only fall to 0.01: the debtDrag part says
    // -500 per share for a price that drops by about 10.
    let s = resolveRound(game(['a', 'b']), {})
    s = edit(s, 'a', (c) => c.loans.push({ id: 'big', principal: 5000, annualRate: 0.12, dueRound: s.round, takenRound: s.round - 7 }))
    const r = last(resolveRound(s, {}))
    expect(r.bankrupt).toBe(true)
    expect(Math.abs(r.stock.priceBefore + partsSum(r) - r.stock.priceAfter)).toBeLessThan(0.06)
  })
})

describe('config robustness', () => {
  it('FV uses exactly profitWindow rounds when profitWindow is 1', () => {
    // DESIGN 2.3.9: FV uses the mean profit of the last profitWindow rounds incl. this one.
    // With profitWindow 1, history.slice(-(1 - 1)) = slice(-0) = slice(0) = the whole history.
    const config = tuned((c) => (c.stock.profitWindow = 1))
    let s = resolveRound(game(['a'], 1, config), { a: ai2() }, config)
    s = edit(s, 'a', (c) => (c.history[0].profit = 100))
    s = resolveRound(s, { a: ai2() }, config)
    const r = last(s)
    expect(r.profit).toBe(5.16)
    expect(r.stock.fv).toBe(round2(20 * 5.16 + 0.3 * 22))
  })
})

describe('money rounding (SPEC Rules for the codebase, DESIGN 2.3)', () => {
  it('every money value in the stock and finance results is in cents', () => {
    const cents = (x: number): boolean => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6
    let s = createSoloGame({ seed: 3, playerName: 'P' })
    const rnd = localRng(5)
    while (!s.finished) {
      const d = defaultDecision(s, 'you')
      if (rnd() < 0.3) d.loans.take = round2(rnd() * 37)
      if (rnd() < 0.2) d.shares = { mode: 'issue', count: 1 }
      s = resolveRound(s, { you: d })
    }
    for (const c of s.companies) {
      for (const r of c.history) {
        const st = r.stock
        const p = st.parts
        const values = [st.priceBefore, st.priceAfter, st.fv, st.bv, st.bvBefore, st.debt, st.debtDragMoney, st.marketCap]
        values.push(p.revenueGrowth, p.idle, p.fundamentals, p.debtDrag, p.shares, ...Object.values(p.demandMiss))
        values.push(r.costs.interest, r.principalRepaid, r.refinanced, r.finance.loanTaken, r.finance.shareCash, r.treasury)
        for (const v of values) expect(cents(v), `${c.id} round ${r.round}: ${v}`).toBe(true)
      }
      for (const l of c.loans) expect(cents(l.principal)).toBe(true)
    }
  })
})
