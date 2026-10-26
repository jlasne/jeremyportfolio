// The UI helpers of DESIGN 2.5 and the small utilities of the public API.

import { describe, expect, it } from 'vitest'
import {
  buildCost,
  createRng,
  createSoloGame,
  defaultDecision,
  emptyDecision,
  findFreeTile,
  loanRate,
  plotRows,
  previewCompany,
  projectRound,
  rankCompanies,
  resolveRound,
  revenueByBuilding,
  riskView,
  round2,
  seasonOf,
  upgradeCost,
  warnings,
} from './index'
import { addLink, company, decision, edit, game } from './test/helpers'

describe('createSoloGame', () => {
  it('seats the player and the three bot styles with the same start kit', () => {
    const s = createSoloGame({ seed: 3, playerName: 'Ada' })
    expect(s.companies.map((c) => [c.id, c.name, c.isBot, c.bot])).toEqual([
      ['you', 'Ada', false, null],
      ['volta', 'Volta Utility', true, 'volta'],
      ['nimbus', 'Nimbus Compute', true, 'nimbus'],
      ['hashfield', 'Hashfield Mining', true, 'hashfield'],
    ])
    for (const c of s.companies) {
      expect(c).toMatchObject({ treasury: 30, shares: 10, businessValue: 100, marketCap: 100, sharePrice: 10 })
      expect(c.buildings.map((b) => [b.kind, b.size, b.tile, b.pricePaid, b.status])).toEqual([
        ['plant', 'small', [0, 0], 10, 'online'],
        ['dc', 'small', [1, 0], 12, 'online'],
      ])
      expect(c.links).toEqual([expect.objectContaining({ use: 'internal', mw: 2, roundsLeft: 0 })])
    }
    expect(s.pools.citizens.demand).toBe(16)
    expect(s.pools.ai).toEqual({ demand: 8, growth: 0.06, expectedGrowth: 0.06, lastUsed: {} })
    expect(s).toMatchObject({ round: 1, rounds: 40, finished: false, version: 1, seed: 3 })
  })
})

describe('createRng', () => {
  it('is mulberry32: the same seed gives the same stream, and a stored state resumes it', () => {
    const a = createRng(7)
    const b = createRng(7)
    const xs = [a.next(), a.next(), a.normal()]
    expect([b.next(), b.next(), b.normal()]).toEqual(xs)
    const resumed = createRng(a.state())
    expect(resumed.next()).toBe(a.next())
    for (let i = 0; i < 1000; i++) {
      const u = a.next()
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
    }
  })

  it('draws standard normals', () => {
    const r = createRng(99)
    const n = 20000
    let sum = 0
    let sq = 0
    for (let i = 0; i < n; i++) {
      const z = r.normal()
      sum += z
      sq += z * z
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.03)
    expect(Math.abs(sq / n - 1)).toBeLessThan(0.05)
  })
})

describe('defaultDecision', () => {
  it('round 1: everything on the internal link, compute on AI', () => {
    const s = game(['a'])
    expect(defaultDecision(s, 'a')).toEqual(decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))))
  })

  it('later rounds repeat last round allocations, without builds or finance', () => {
    const s = edit(game(['a']), 'a', (c) => addLink(c, 'town', 2))
    const d = decision((x) => {
      x.power.town = 1
      x.power.internal = 1
      x.compute.cloud = 1
      x.builds.push({ kind: 'plant', size: 'small' })
      x.loans.take = 5
    })
    const next = resolveRound(s, { a: d })
    const def = defaultDecision(next, 'a')
    expect(def.power).toEqual({ internal: 1, town: 1, otherDc: 0 })
    expect(def.compute).toEqual({ cloud: 1, btc: 0, ai: 0 })
    expect(def.builds).toEqual([])
    expect(def.loans.take).toBe(0)
  })

  it('a bankrupt company gets the empty decision', () => {
    expect(defaultDecision(edit(game(['a']), 'a', (c) => (c.bankrupt = true)), 'a')).toEqual(emptyDecision())
  })
})

describe('previewCompany', () => {
  it('shows treasury, capacities and pending capacity after the draft', () => {
    const s = game(['a'])
    const p = previewCompany(
      s,
      'a',
      decision((d) => {
        d.loans.take = 20
        d.builds.push({ kind: 'plant', size: 'big' }, { kind: 'link', use: 'town', mw: 4 })
      }),
    )
    expect(p.treasuryLeft).toBe(30 + 20 - 40 - 4)
    expect(p.buildSpend).toBe(44)
    expect(p.financeCash).toBe(20)
    expect(p.debt).toBe(20)
    expect(p.plantMw).toBe(2)
    expect(p.pendingPlantMw).toBe(12)
    expect(p.links).toEqual({ internal: 2, town: 0, import: 0 })
    expect(p.pendingLinks).toEqual({ internal: 2, town: 4, import: 0 })
  })

  it('does not touch the state', () => {
    const s = game(['a'])
    const before = JSON.stringify(s)
    previewCompany(s, 'a', decision((d) => d.builds.push({ kind: 'dc', size: 'small' })))
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('projectRound', () => {
  it('projects the 5.16 of the starting check for 2 MW on AI', () => {
    const s = createSoloGame({ seed: 1, playerName: 'P' })
    const p = projectRound(s, 'you', defaultDecision(s, 'you'))
    expect(p.profit).toBe(5.16)
    expect(p.usedByPool.ai).toBe(2)
    expect(p.idle).toBe(0)
    expect(p.marginPerMw).toEqual({ citizens: 0.6, otherDc: 0.9, cloud: 1.6, btc: 1.2, ai: 2.8 })
  })

  it('uses last round demand: no more than the unserved part plus what the company used', () => {
    let s = createSoloGame({ seed: 2, playerName: 'P' })
    s = resolveRound(s, {})
    const last = s.history[0].pools.cloud
    const p = projectRound(s, 'you', decision((d) => ((d.power.internal = 2), (d.compute.cloud = 2))))
    const mine = s.pools.cloud.lastUsed.you ?? 0
    expect(p.usedByPool.cloud).toBeCloseTo(Math.min(2, mine + Math.max(0, last.demand - last.used)), 10)
  })

  it('counts interest on a new loan', () => {
    const s = game(['a'])
    const p = projectRound(s, 'a', decision((d) => ((d.loans.take = 40), (d.power.internal = 2), (d.compute.ai = 2))))
    expect(p.costs.interest).toBe(round2((40 * 0.12) / 4))
  })
})

describe('warnings', () => {
  it('flags each problem of a draft as a chip', () => {
    const s = edit(game(['a']), 'a', (c) => c.loans.push({ id: 'n1', principal: 10, annualRate: 0.1, dueRound: 2, takenRound: -5 }))
    const w = warnings(
      s,
      'a',
      decision((d) => {
        d.power.internal = 3
        d.power.town = 1
        d.rentMw = 2
        d.compute.ai = 6
        d.builds.push({ kind: 'plant', size: 'big' })
      }),
    )
    const codes = w.map((x) => x.code)
    expect(codes).toEqual(expect.arrayContaining(['treasury_negative', 'no_town_link', 'link_short', 'rent_over_import', 'compute_unpowered', 'loan_due_soon']))
    for (const x of w) {
      expect(x.label.length).toBeGreaterThan(0)
      expect(x.label.length).toBeLessThanOrEqual(20)
      expect(x.detail.length).toBeGreaterThan(10)
    }
  })

  it('warns about idle capacity above 20%', () => {
    const s = game(['a'])
    const w = warnings(s, 'a', decision((d) => ((d.power.internal = 1), (d.compute.ai = 1))))
    expect(w.find((x) => x.code === 'idle_high')?.label).toBe('Idle 50%')
  })

  it('stays quiet for the round 1 default', () => {
    const s = game(['a'])
    expect(warnings(s, 'a', defaultDecision(s, 'a'))).toEqual([])
  })
})

describe('loans', () => {
  it('loanRate is 12% before any revenue, and cheaper with stable clients', () => {
    const s = game(['a'])
    expect(loanRate(s, 'a')).toBe(0.12)
    const cit = edit(resolveRound(s, {}), 'a', (c) => {
      c.history[0].revenueByPool = { citizens: 5, otherDc: 0, cloud: 5, btc: 0, ai: 0 }
      c.history[0].profit = 1
    })
    expect(loanRate(cit, 'a')).toBe(0.048)
    const btc = edit(cit, 'a', (c) => (c.history[0].revenueByPool = { citizens: 0, otherDc: 0, cloud: 0, btc: 4, ai: 0 }))
    expect(loanRate(btc, 'a')).toBe(0.112)
    const stressed = edit(btc, 'a', (c) => (c.history[0].profit = -1))
    expect(loanRate(stressed, 'a')).toBe(0.152)
  })

  it('riskView shows interest, debt cost share, market cap drag and the next due date', () => {
    let s = createSoloGame({ seed: 1, playerName: 'P' })
    s = resolveRound(s, {})
    const v = riskView(s, 'you', decision((d) => (d.loans.take = 40)))
    const rate = loanRate(s, 'you')
    expect(v.annualRate).toBe(rate)
    expect(v.interestNextRound).toBe(round2((40 * rate) / 4))
    expect(v.nextDue).toEqual({ round: s.round + 7, principal: 40 })
    expect(v.estRevenue).toBeGreaterThan(0)
    expect(v.debtCostShare).toBeCloseTo(v.interestNextRound / v.estRevenue, 10)
    expect(v.marketCapDrag).toBeGreaterThan(0)
    expect(riskView(s, 'you', decision()).nextDue).toBeNull()
  })
})

describe('revenueByBuilding', () => {
  it('splits power revenue over plants and compute revenue over datacenters', () => {
    let s = game(['a'])
    s = resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2), d.builds.push({ kind: 'plant', size: 'small' }))) })
    const r = revenueByBuilding(s, 'a')
    const c = company(s, 'a')
    const dc = c.buildings.find((b) => b.kind === 'dc')!
    expect(r[dc.id]).toBe(6.4)
    // The plant that just finished earned nothing yet.
    const fresh = c.buildings.find((b) => b.builtRound === 1)!
    expect(r[fresh.id]).toBe(0)
    expect(revenueByBuilding(game(['a']), 'a')).toEqual({})
  })
})

describe('small helpers', () => {
  it('seasonOf maps rounds 1..4 to spring, summer, autumn, winter, then repeats', () => {
    expect([1, 2, 3, 4, 5, 8, 40].map(seasonOf)).toEqual([0, 1, 2, 3, 0, 3, 3])
  })

  it('findFreeTile and plotRows walk the plot row by row, 4 lots per row', () => {
    const c = company(game(['a']), 'a')
    expect(findFreeTile(c)).toEqual([2, 0])
    expect(findFreeTile(c, [[2, 0], [3, 0]])).toEqual([0, 1])
    expect(plotRows(c)).toBe(2)
    expect(plotRows(c, [[1, 3]])).toBe(5)
  })

  it('build and upgrade costs come from the config', () => {
    expect(buildCost({ kind: 'plant', size: 'big' })).toBe(40)
    expect(buildCost({ kind: 'dc', size: 'small' })).toBe(12)
    expect(buildCost({ kind: 'link', use: 'town', mw: 5 })).toBe(5)
    const c = company(game(['a']), 'a')
    expect(upgradeCost(c.buildings[0])).toBe(46)
    expect(upgradeCost(c.buildings[1])).toBe(58)
  })

  it('round2 rounds half away from zero and absorbs float noise', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(-1.005)).toBe(-1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(-0.001)).toBe(0)
    expect(Object.is(round2(-0.001), -0)).toBe(false)
  })

  it('rankCompanies sorts by price, bankrupt last', () => {
    const s = edit(edit(game(['a', 'b', 'c']), 'b', (c) => (c.sharePrice = 50)), 'a', (c) => ((c.bankrupt = true), (c.sharePrice = 99)))
    expect(rankCompanies(s)).toEqual(['b', 'c', 'a'])
  })
})
