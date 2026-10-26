import { describe, expect, it } from 'vitest'
import { capacity, createSoloGame, defaultConfig, resolveRound, type GameState } from './index'
import { addLink, addOnline, company, decision, edit, game } from './test/helpers'

const keepAi = decision((d) => ((d.power.internal = 2), (d.compute.ai = 2)))

function rounds(s: GameState, n: number, decisions = {}): GameState {
  for (let i = 0; i < n; i++) s = resolveRound(s, decisions)
  return s
}

describe('build timers', () => {
  it('a small plant ordered in round 1 is online in round 2', () => {
    const s = resolveRound(game(['a']), { a: decision((d) => d.builds.push({ kind: 'plant', size: 'small', tile: [2, 0] })) })
    const b = company(s, 'a').buildings.find((x) => x.tile[0] === 2)!
    expect(b).toMatchObject({ status: 'online', mw: 2, roundsLeft: 0, builtRound: 1, pricePaid: 10 })
    expect(company(s, 'a').history[0].completed).toContain(b.id)
    expect(capacity(company(s, 'a')).plantMw).toBe(4)
  })

  it('a big datacenter ordered in round 1 is online in round 4, and pays no maintenance while building', () => {
    const rich = edit(game(['a']), 'a', (c) => (c.treasury = 80))
    let s = resolveRound(rich, { a: decision((d) => d.builds.push({ kind: 'dc', size: 'big' })) })
    const id = company(s, 'a').buildings.at(-1)!.id
    expect(company(s, 'a').history[0].costs.maintenance).toBe(0.44)
    for (let round = 2; round <= 3; round++) {
      expect(company(s, 'a').buildings.at(-1)).toMatchObject({ status: 'building', mw: 0 })
      expect(capacity(company(s, 'a')).dcMw).toBe(2)
      s = resolveRound(s, {})
    }
    expect(company(s, 'a').buildings.at(-1)).toMatchObject({ id, status: 'online', mw: 10, size: 'big' })
    expect(capacity(company(s, 'a')).dcMw).toBe(12)
    expect(s.round).toBe(4)
  })

  it('an upgrade keeps the small plant at 2 MW for 4 rounds, then it delivers 10 MW', () => {
    const start = edit(game(['a']), 'a', (c) => (c.treasury = 60))
    const plant = company(start, 'a').buildings.find((b) => b.kind === 'plant')!
    let s = resolveRound(start, { a: decision((d) => ((d.upgrades = [plant.id]), (d.power.internal = 2), (d.compute.ai = 2))) })
    expect(company(s, 'a').treasury).toBe(Math.round((60 - 46 + company(s, 'a').history[0].profit) * 100) / 100)
    for (let round = 1; round <= 4; round++) {
      const b = company(s, 'a').buildings.find((x) => x.id === plant.id)!
      if (round < 4) expect(b).toMatchObject({ status: 'upgrading', mw: 2, size: 'small', pricePaid: 56 })
      expect(company(s, 'a').history[round - 1].plantMw).toBe(2)
      // The upgrade cost is in price paid from the order on, so maintenance includes it.
      expect(company(s, 'a').history[round - 1].costs.maintenance).toBe(round2(0.02 * (56 + 12)))
      if (round < 4) s = resolveRound(s, { a: keepAi })
    }
    const done = company(s, 'a').buildings.find((x) => x.id === plant.id)!
    expect(done).toMatchObject({ status: 'online', size: 'big', mw: 10, roundsLeft: 0 })
    expect(s.round).toBe(5)
  })

  it('a link bought in round 1 carries MW from round 2', () => {
    const s = resolveRound(game(['a']), { a: decision((d) => d.builds.push({ kind: 'link', use: 'town', mw: 3 })) })
    expect(capacity(company(s, 'a')).links.town).toBe(3)
    expect(company(s, 'a').history[0].finance.buildSpend).toBe(3)
  })
})

const round2 = (x: number): number => Math.round(x * 100) / 100

describe('rent matching', () => {
  function rentGame(rent: number): GameState {
    let s = game(['seller', 'renter'])
    s = edit(s, 'seller', (c) => addOnline(c, 'plant', 'small'))
    s = edit(s, 'renter', (c) => {
      addOnline(c, 'dc', 'big')
      addLink(c, 'import', 10)
    })
    return resolveRound(s, {
      seller: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2), (d.power.otherDc = 2))),
      renter: decision((d) => ((d.power.internal = 2), (d.rentMw = rent), (d.compute.cloud = 2 + rent))),
    })
  }

  it('rivals fill rent first at the rival rate', () => {
    const r = company(rentGame(1), 'renter').history[0]
    // The seller sold 2 MW to the other datacenters pool, which covers the 1 MW request.
    expect(r.rent).toEqual({ requested: 1, fromRivals: 1, fromMarket: 0 })
    expect(r.costs.rent).toBe(defaultConfig.cost.rentRival)
  })

  it('the market fills what rivals cannot, at the market rate', () => {
    const s = rentGame(6)
    const seller = company(s, 'seller').history[0]
    const r = company(s, 'renter').history[0]
    expect(seller.used.otherDc).toBe(2)
    expect(r.rent.fromRivals).toBeCloseTo(2, 10)
    expect(r.rent.fromMarket).toBeCloseTo(4, 10)
    expect(r.costs.rent).toBe(round2(2 * 1.3 + 4 * 1.6))
    // Rented MW is delivered in full, so the datacenter runs on 2 own + 6 rented MW.
    expect(r.dcUsed).toBeGreaterThan(2)
    expect(s.history[0].pools.otherDc.rentDemand).toBe(6)
  })

  it('rent is a contract: paid on every MW requested even when compute goes unused', () => {
    const s = edit(game(['a']), 'a', (c) => addLink(c, 'import', 4))
    const after = resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.rentMw = 4), (d.compute.ai = 2))) })
    const r = company(after, 'a').history[0]
    expect(r.costs.rent).toBe(round2(4 * 1.6))
    // The 2 MW of AI ran on rented power, so own plant power was not consumed.
    expect(r.costs.power).toBe(0)
  })
})

describe('resolution', () => {
  it('is pure: the input state is never modified', () => {
    const s = rounds(createSoloGame({ seed: 5, playerName: 'P' }), 6)
    const before = JSON.stringify(s)
    resolveRound(s, {})
    resolveRound(s, { you: decision((d) => d.builds.push({ kind: 'plant', size: 'big' })) })
    expect(JSON.stringify(s)).toBe(before)
  })

  it('the round advances to 41 and the game finishes after round 40; a finished game does not move', () => {
    const s = rounds(game(['a', 'b']), 40)
    expect(s.round).toBe(41)
    expect(s.finished).toBe(true)
    expect(s.history).toHaveLength(40)
    expect(resolveRound(s, {})).toEqual(s)
  })

  it('the stock breakdown adds up to the price move, within rounding', () => {
    const s = rounds(createSoloGame({ seed: 11, playerName: 'P' }), 30)
    for (const c of s.companies) {
      for (const r of c.history) {
        const p = r.stock.parts
        const sum = p.revenueGrowth + Object.values(p.demandMiss).reduce((a, b) => a + b, 0) + p.idle + p.fundamentals + p.debtDrag + p.shares
        expect(Math.abs(r.stock.priceBefore + sum - r.stock.priceAfter)).toBeLessThan(0.1)
      }
    }
  })

  it('a losing round with nothing left to sell issues shares at the current price', () => {
    let s = game(['a'])
    s = edit(s, 'a', (c) => {
      c.treasury = -20
    })
    const ids = company(s, 'a').buildings.map((b) => b.id)
    s = resolveRound(s, { a: decision((d) => (d.forcedSales = ids)) })
    const r = company(s, 'a').history[0]
    // 3 + 3.6 back from the sales, 13.4 short at a price of 10: 2 new shares.
    expect(r.finance.forcedSaleCash).toBe(6.6)
    expect(r.finance.forcedSharesIssued).toBe(2)
    expect(company(s, 'a').shares).toBe(12)
    expect(company(s, 'a').buildings).toEqual([])
  })

  it('a company whose market cap hits the floor goes bankrupt and frees its MW', () => {
    let s = game(['a', 'b'])
    s = resolveRound(s, {})
    s = edit(s, 'a', (c) => {
      c.loans.push({ id: 'big', principal: 10000, annualRate: 0.12, dueRound: s.round, takenRound: s.round - 7 })
    })
    s = resolveRound(s, {})
    const a = company(s, 'a')
    expect(a.bankrupt).toBe(true)
    expect(a.marketCap).toBe(defaultConfig.marketCap.floor)
    expect(a.history.at(-1)!.bankrupt).toBe(true)
    for (const pool of Object.values(s.pools)) expect(pool.lastUsed.a).toBeUndefined()
    expect(s.history.at(-1)!.ranking.at(-1)).toBe('a')
    const later = resolveRound(s, {})
    expect(company(later, 'a').history).toHaveLength(a.history.length)
    // The due principal still left the treasury: the company is out, deep in the red.
    expect(company(later, 'a').treasury).toBeLessThan(-9000)
  })
})
