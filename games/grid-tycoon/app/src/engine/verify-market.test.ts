// Adversarial check of demand pools and money flows against SPEC.md and DESIGN.md 2.3.
// Hand-computed cases first, then an independent replay oracle over bot games: the oracle
// re-derives demand, allocation, rent, power cost, maintenance and timers from the rules
// alone (its own mulberry32, its own allocation) and compares every resolved round.

import { describe, expect, it } from 'vitest'
import {
  allocatePool,
  capacity,
  createGame,
  createSoloGame,
  defaultConfig,
  POOLS,
  resolveRound,
  type BotStyle,
  type Company,
  type Decision,
  type GameState,
  type PoolId,
} from './index'
import { addLink, addOnline, company, decision, edit, game } from './test/helpers'

const cfg = defaultConfig
const r2 = (x: number): number => Math.round(x * 100 * (1 + 4 * Number.EPSILON)) / 100

// ---------- independent reference implementations ----------

/** Reference mulberry32 (Tommy Ettinger's), written from the published algorithm. */
function refRng(seed: number): { next(): number; normal(): number; state(): number } {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    normal() {
      const u1 = 1 - next()
      const u2 = next()
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    },
    state: () => a >>> 0,
  }
}

/** SPEC "Allocation algorithm (per pool)", steps 1 to 4, written from the spec text. */
function refAllocate(D: number, O: Record<string, number>, U: Record<string, number>, share = 0.8): Record<string, number> {
  const ids = Object.keys(O)
  const R: Record<string, number> = {}
  let sumR = 0
  for (const id of ids) {
    R[id] = Math.min(O[id], share * (U[id] ?? 0))
    sumR += R[id]
  }
  const used: Record<string, number> = {}
  if (sumR > D) {
    for (const id of ids) used[id] = (R[id] * D) / sumR
    return used
  }
  const open = D - sumR
  let sumS = 0
  for (const id of ids) sumS += O[id] - R[id]
  for (const id of ids) {
    const S = O[id] - R[id]
    used[id] = R[id] + (sumS <= open ? S : (open * S) / sumS)
  }
  return used
}

function offerOf(d: Decision, p: PoolId): number {
  return p === 'citizens' ? d.power.town : p === 'otherDc' ? d.power.otherDc : d.compute[p]
}

/**
 * Reference rent matching (SPEC Round flow step 3): a renter is filled by OTHER companies' otherDc
 * sales first, never its own. The most rivals can fill is min(total rent, total sold, and per company k
 * the others' rent + the others' sales) (the min cut of renters x sellers without the k-k edges); it is
 * split pro rata to the requests, each renter capped at what the others sold. Found by bisection.
 */
function refRentFill(rent: Record<string, number>, sold: Record<string, number>): Record<string, number> {
  const ids = Object.keys(rent)
  const R = ids.reduce((a, id) => a + rent[id], 0)
  const S = Object.values(sold).reduce((a, b) => a + b, 0)
  let F = Math.min(R, S)
  for (const id of ids) F = Math.min(F, R - rent[id] + S - (sold[id] ?? 0))
  const fill = (lambda: number): Record<string, number> =>
    Object.fromEntries(ids.map((id) => [id, Math.min(rent[id], Math.max(0, S - (sold[id] ?? 0)), lambda * rent[id])]))
  const total = (f: Record<string, number>): number => Object.values(f).reduce((a, b) => a + b, 0)
  if (F <= 0) return fill(0)
  let lo = 0
  let hi = 1
  while (total(fill(hi)) < F - 1e-12 && hi < 1e12) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (total(fill(mid)) < F) lo = mid
    else hi = mid
  }
  return fill(hi)
}

/**
 * Checks one resolved round S -> T against the rules, from the decisions T stored as lastDecision.
 * Returns a list of mismatches (empty when the engine follows the rules).
 */
function oracle(S: GameState, T: GameState): string[] {
  const bad: string[] = []
  const near = (what: string, got: number, want: number, tol = 1e-9): void => {
    if (!(Math.abs(got - want) <= tol)) bad.push(`round ${S.round} ${what}: got ${got}, want ${want}`)
  }
  const active = S.companies.filter((c) => !c.bankrupt)
  const dec = new Map<string, Decision>()
  for (const c of active) dec.set(c.id, T.companies.find((x) => x.id === c.id)!.lastDecision!)

  // Demand: E, then g, then D; one normal per pool in POOLS order.
  const rng = refRng(S.rngState)
  const g: Record<string, number> = {}
  const E: Record<string, number> = {}
  const D: Record<string, number> = {}
  for (const p of POOLS) {
    const eps = rng.normal()
    const pool = S.pools[p]
    E[p] = 0.7 * pool.expectedGrowth + 0.3 * pool.growth
    const raw = pool.growth + 0.3 * (cfg.pool.meanGrowth[p] - pool.growth) + cfg.pool.volatility[p] * eps
    g[p] = Math.min(0.2, Math.max(-0.1, raw))
    D[p] = pool.demand * (1 + g[p])
    near(`${p} expectedGrowth`, T.pools[p].expectedGrowth, E[p], 1e-12)
    near(`${p} growth`, T.pools[p].growth, g[p], 1e-12)
    near(`${p} background demand`, T.pools[p].demand, D[p], 1e-9)
  }
  near('rngState', T.rngState, rng.state(), 0)

  // Rent joins the other datacenters pool.
  let totalRent = 0
  for (const c of active) totalRent += dec.get(c.id)!.rentMw
  const allocD: Record<string, number> = { ...D, otherDc: D.otherDc + totalRent }
  const summary = T.history.at(-1)!
  for (const p of POOLS) near(`${p} summary demand`, summary.pools[p].demand, allocD[p], 1e-9)
  near('summary rentDemand', summary.pools.otherDc.rentDemand, totalRent, 1e-9)

  // Allocation.
  const used: Record<PoolId, Record<string, number>> = {} as never
  for (const p of POOLS) {
    const O: Record<string, number> = {}
    for (const c of active) O[c.id] = offerOf(dec.get(c.id)!, p)
    used[p] = refAllocate(allocD[p], O, S.pools[p].lastUsed)
  }
  const rentAsked: Record<string, number> = {}
  for (const c of active) rentAsked[c.id] = dec.get(c.id)!.rentMw
  const rivalFill = refRentFill(rentAsked, used.otherDc)

  for (const c of active) {
    const d = dec.get(c.id)!
    const after = T.companies.find((x) => x.id === c.id)!
    const res = after.history.at(-1)!
    if (res.round !== S.round) {
      bad.push(`round ${S.round} ${c.id}: no result`)
      continue
    }
    const tag = (s: string): string => `${c.id} ${s}`
    for (const p of POOLS) near(tag(`used ${p}`), res.used[p], used[p][c.id], 1e-9)

    // Buildings during this resolution: what T holds, minus what was ordered now or still under construction.
    const prevById = new Map(c.buildings.map((b) => [b.id, b]))
    const runningNow = after.buildings.filter((b) => prevById.has(b.id) && prevById.get(b.id)!.status !== 'building')
    const plantMw = runningNow.filter((b) => b.kind === 'plant').reduce((s, b) => s + prevById.get(b.id)!.mw, 0)
    const dcMw = runningNow.filter((b) => b.kind === 'dc').reduce((s, b) => s + prevById.get(b.id)!.mw, 0)
    const linkCap = capacity(c).links

    // Power routing caps.
    if (d.power.internal + d.power.town + d.power.otherDc > plantMw + 1e-6) bad.push(tag(`round ${S.round} power over plant MW`))
    if (d.power.internal > linkCap.internal + 1e-6) bad.push(tag(`round ${S.round} internal over link`))
    if (d.power.town > linkCap.town + 1e-6) bad.push(tag(`round ${S.round} town over link`))
    if (d.rentMw > linkCap.import + 1e-6) bad.push(tag(`round ${S.round} rent over import link`))
    const computeOffer = d.compute.cloud + d.compute.btc + d.compute.ai
    if (computeOffer > Math.min(dcMw, d.power.internal + d.rentMw) + 1e-6) bad.push(tag(`round ${S.round} compute over min(dc, powered)`))

    // Rent.
    const fromRivals = rivalFill[c.id]
    near(tag('rent fromRivals'), res.rent.fromRivals, fromRivals, 1e-9)
    near(tag('rent fromMarket'), res.rent.fromMarket, d.rentMw - fromRivals, 1e-9)
    near(tag('rent cost'), res.costs.rent, r2(1.3 * fromRivals + 1.6 * (d.rentMw - fromRivals)), 0.0051)

    // Revenue.
    let revenue = 0
    for (const p of POOLS) {
      near(tag(`revenue ${p}`), res.revenueByPool[p], r2(used[p][c.id] * cfg.rate[p]), 0.0051)
      revenue += res.revenueByPool[p]
    }
    near(tag('revenue'), res.revenue, r2(revenue), 0.0051)

    // Own power: town + otherDc used + internal consumed, rented MW consumed first.
    const computeUsed = used.cloud[c.id] + used.btc[c.id] + used.ai[c.id]
    const internalConsumed = Math.min(d.power.internal, Math.max(0, computeUsed - d.rentMw))
    const own = used.citizens[c.id] + used.otherDc[c.id] + internalConsumed
    near(tag('plantUsed'), res.plantUsed, own, 1e-9)
    near(tag('power cost'), res.costs.power, r2(0.4 * own), 0.0051)
    near(tag('plantMw'), res.plantMw, plantMw, 1e-9)
    near(tag('dcMw'), res.dcMw, dcMw, 1e-9)

    // Maintenance: 2% of price paid (upgrades included) for everything not under construction.
    const maint = runningNow.reduce((s, b) => s + b.pricePaid, 0)
    near(tag('maintenance'), res.costs.maintenance, r2(0.02 * maint), 0.0051)

    // Profit and treasury (SPEC "Treasury =").
    const k = res.costs
    near(tag('profit'), res.profit, r2(res.revenue - k.power - k.rent - k.maintenance - k.interest), 0.0051)
    const f = res.finance
    if (f.forcedSharesIssued === 0) {
      const want = c.treasury + f.forcedSaleCash + f.loanTaken - f.repaid + f.shareCash - f.buildSpend + res.profit - res.principalRepaid
      near(tag('treasury'), after.treasury, r2(want), 0.0151)
    }

    // Timers: everything counts down once; new orders start at build time - 1.
    for (const b of after.buildings) {
      const prev = prevById.get(b.id)
      if (!prev) {
        const want = cfg.buildings[b.kind][b.size].rounds - 1
        near(tag(`new ${b.id} roundsLeft`), b.roundsLeft, want, 0)
        if ((want === 0) !== (b.status === 'online')) bad.push(tag(`round ${S.round} new ${b.id} status ${b.status}`))
        near(tag(`new ${b.id} mw`), b.mw, want === 0 ? cfg.buildings[b.kind][b.size].mw : 0, 0)
      } else if (prev.status === 'online' && b.status === 'upgrading') {
        near(tag(`upgrade ${b.id} roundsLeft`), b.roundsLeft, cfg.buildings[b.kind].upgrade.rounds - 1, 0)
        near(tag(`upgrade ${b.id} mw`), b.mw, 2, 0)
      } else {
        near(tag(`${b.id} roundsLeft`), b.roundsLeft, Math.max(0, prev.roundsLeft - 1), 0)
        if (prev.roundsLeft === 1) {
          if (b.status !== 'online') bad.push(tag(`round ${S.round} ${b.id} should be online`))
          near(tag(`${b.id} mw`), b.mw, cfg.buildings[b.kind][prev.status === 'upgrading' ? 'big' : prev.size].mw, 0)
        }
      }
    }
    for (const l of after.links) {
      const prev = c.links.find((x) => x.id === l.id)
      near(tag(`link ${l.id} roundsLeft`), l.roundsLeft, prev ? Math.max(0, prev.roundsLeft - 1) : 0, 0)
    }
  }

  // lastUsed: this round's used, bankrupt companies removed.
  for (const p of POOLS) {
    for (const c of active) {
      const bankrupt = T.companies.find((x) => x.id === c.id)!.bankrupt
      const lu = T.pools[p].lastUsed[c.id]
      if (bankrupt) {
        if (lu !== undefined) bad.push(`round ${S.round} ${c.id} bankrupt but keeps lastUsed in ${p}`)
      } else near(`${c.id} lastUsed ${p}`, lu, used[p][c.id], 1e-9)
    }
  }
  return bad
}

function botState(seed: number, styles: BotStyle[]): GameState {
  return createGame({ seed, companies: styles.map((s, i) => ({ id: `${s}${i}`, name: s, isBot: true, bot: s })) }, cfg)
}

// ---------- tests ----------

describe('demand growth (SPEC "Growth model", DESIGN 2.3 step 2)', () => {
  it('start values: D0 = startPerCompany x companies, g0 = E0 = mu', () => {
    const s = game(['a', 'b', 'c'])
    for (const p of POOLS) {
      expect(s.pools[p].demand).toBe(cfg.pool.startPerCompany[p] * 3)
      expect(s.pools[p].growth).toBe(cfg.pool.meanGrowth[p])
      expect(s.pools[p].expectedGrowth).toBe(cfg.pool.meanGrowth[p])
    }
  })

  it('round 1: E1 = mu, g1 = mu + sigma eps (pull is 0 at the mean), one Box-Muller normal per pool in POOLS order', () => {
    const s = game(['a', 'b'], 12345)
    const t = resolveRound(s, {})
    const rng = refRng(12345)
    for (const p of POOLS) {
      const eps = rng.normal()
      const mu = cfg.pool.meanGrowth[p]
      expect(t.pools[p].expectedGrowth).toBeCloseTo(mu, 12)
      expect(t.pools[p].growth).toBeCloseTo(Math.min(0.2, Math.max(-0.1, mu + cfg.pool.volatility[p] * eps)), 12)
      expect(t.pools[p].demand).toBeCloseTo(cfg.pool.startPerCompany[p] * 2 * (1 + t.pools[p].growth), 12)
    }
    // Exactly 2 uniforms per pool: 10 per round.
    expect(t.rngState).toBe(rng.state())
  })

  it('round 2: E uses last round g (E2 = 0.7 E1 + 0.3 g1), g pulls 30% back to the mean', () => {
    const s1 = resolveRound(game(['a'], 99), {})
    const s2 = resolveRound(s1, {})
    for (const p of POOLS) {
      const E2 = 0.7 * s1.pools[p].expectedGrowth + 0.3 * s1.pools[p].growth
      expect(s2.pools[p].expectedGrowth).toBeCloseTo(E2, 12)
    }
    expect(oracle(s1, s2)).toEqual([])
  })

  it('g is clamped to [-10%, +20%] and the clamped g is what the next round pulls from', () => {
    // A huge volatility forces the clamp on both sides across pools and rounds.
    const wild = structuredClone(cfg)
    for (const p of POOLS) wild.pool.volatility[p] = 5
    let s = createGame({ seed: 4, companies: [{ id: 'a', name: 'A', isBot: false }] }, wild)
    let hitLow = false
    let hitHigh = false
    for (let i = 0; i < 10; i++) {
      const prev = s
      s = resolveRound(s, {}, wild)
      for (const p of POOLS) {
        expect(s.pools[p].growth).toBeGreaterThanOrEqual(-0.1)
        expect(s.pools[p].growth).toBeLessThanOrEqual(0.2)
        if (s.pools[p].growth === -0.1) hitLow = true
        if (s.pools[p].growth === 0.2) hitHigh = true
        expect(s.pools[p].demand).toBeCloseTo(prev.pools[p].demand * (1 + s.pools[p].growth), 12)
      }
    }
    expect(hitLow && hitHigh).toBe(true)
  })

  it('unserved demand is lost: next D grows from D, not from D plus the shortfall, and otherDc keeps rent out of its base', () => {
    let s = edit(game(['a']), 'a', (c) => addLink(c, 'import', 3))
    s = resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.rentMw = 3), (d.compute.ai = 2))) })
    const bg = 2 * (1 + s.pools.otherDc.growth)
    expect(s.pools.otherDc.demand).toBeCloseTo(bg, 12)
    expect(s.history[0].pools.otherDc.demand).toBeCloseTo(bg + 3, 12)
  })
})

describe('allocation (SPEC "Allocation algorithm", worked example and degenerate inputs)', () => {
  it('worked example: 6, 5, 3 with idle 2, 1, 3', () => {
    const r = allocatePool(14, { you: 8, a: 6, c: 6 }, { you: 5, a: 5, c: 0 }, 0.8)
    expect(r.reserved).toEqual({ you: 4, a: 4, c: 0 })
    expect(r.open.you).toBeCloseTo(2, 12)
    expect(r.open.a).toBeCloseTo(1, 12)
    expect(r.open.c).toBeCloseTo(3, 12)
    expect(r.idle.you).toBeCloseTo(2, 12)
    expect(r.idle.a).toBeCloseTo(1, 12)
    expect(r.idle.c).toBeCloseTo(3, 12)
  })

  it('sum R > D: every reserve scales by D / sum R, no open share, even for a new entrant', () => {
    // R = min(O, 0.8U): a 8, b min(2, 4) = 2, c 0. Sum 10 > D 5: scale 0.5.
    const r = allocatePool(5, { a: 9, b: 2, c: 4 }, { a: 10, b: 5 }, 0.8)
    expect(r.used.a).toBeCloseTo(4, 12)
    expect(r.used.b).toBeCloseTo(1, 12)
    expect(r.used.c).toBe(0)
    expect(r.open).toEqual({ a: 0, b: 0, c: 0 })
    expect(r.idle.a).toBeCloseTo(5, 12)
    expect(r.idle.c).toBe(4)
  })

  it('sum R exactly D: incumbents keep their reserve, nothing is open', () => {
    const r = allocatePool(8, { a: 10, b: 3 }, { a: 10, b: 0 }, 0.8)
    expect(r.used).toEqual({ a: 8, b: 0 })
  })

  it('an incumbent that offers 0 reserves nothing and its lastUsed frees for the others', () => {
    const r = allocatePool(10, { a: 0, b: 10 }, { a: 10, b: 0 }, 0.8)
    expect(r.used).toEqual({ a: 0, b: 10 })
  })

  it('spare equal to the open MW is served in full (the fits test is <=)', () => {
    const r = allocatePool(10, { a: 6, b: 4 }, { a: 5, b: 0 }, 0.8)
    expect(r.used).toEqual({ a: 6, b: 4 })
  })

  it('zero demand with incumbents: nobody sells', () => {
    const r = allocatePool(0, { a: 5, b: 5 }, { a: 5, b: 5 }, 0.8)
    expect(r.used).toEqual({ a: 0, b: 0 })
    expect(r.idle).toEqual({ a: 5, b: 5 })
  })

  it('matches the reference implementation on a grid of cases', () => {
    const offers = [0, 0.5, 2, 3.3, 7, 12]
    for (const D of [0, 0.7, 3, 9.5, 20, 41]) {
      for (const oa of offers) for (const ob of offers) for (const ua of [0, 2, 9]) {
        const O = { a: oa, b: ob, c: 4 }
        const U = { a: ua, b: 3, c: 0 }
        const got = allocatePool(D, O, U, 0.8).used
        const want = refAllocate(D, O, U)
        for (const id of Object.keys(O)) expect(got[id]).toBeCloseTo(want[id], 9)
      }
    }
  })
})

describe('rent matching and power routing (SPEC "Power routing", DESIGN 2.3 steps 3-5)', () => {
  function twoRenters(): GameState {
    let s = game(['seller', 'r1', 'r2'])
    s = edit(s, 'seller', (c) => addOnline(c, 'plant', 'small'))
    for (const id of ['r1', 'r2']) s = edit(s, id, (c) => (addOnline(c, 'dc', 'big'), addLink(c, 'import', 10)))
    return s
  }

  it('rivals fill first at 1.3 pro rata over every renter, the market fills the rest at 1.6', () => {
    const s = twoRenters()
    // Seller offers 3 MW to otherDc: background 6 MW + rent 2 + 4 = 12 MW of demand, it sells all 3.
    const t = resolveRound(s, {
      seller: decision((d) => ((d.power.internal = 1), (d.power.otherDc = 3), (d.compute.ai = 1))),
      r1: decision((d) => ((d.power.internal = 2), (d.rentMw = 2), (d.compute.ai = 4))),
      r2: decision((d) => ((d.power.internal = 2), (d.rentMw = 4), (d.compute.ai = 6))),
    })
    expect(company(t, 'seller').history[0].used.otherDc).toBeCloseTo(3, 12)
    const a = company(t, 'r1').history[0]
    const b = company(t, 'r2').history[0]
    expect(a.rent.fromRivals).toBeCloseTo(1, 12)
    expect(a.rent.fromMarket).toBeCloseTo(1, 12)
    expect(b.rent.fromRivals).toBeCloseTo(2, 12)
    expect(b.rent.fromMarket).toBeCloseTo(2, 12)
    expect(a.costs.rent).toBe(2.9)
    expect(b.costs.rent).toBe(5.8)
    expect(t.history[0].pools.otherDc.demand).toBeCloseTo(6 * (1 + t.pools.otherDc.growth) + 6, 12)
    expect(oracle(s, t)).toEqual([])
  })

  it('rented MW is consumed first: 2 own + 2 rented, 3 MW of compute used -> 1 MW of own power is paid', () => {
    // Alone in the game the AI pool holds 2 MW: offer 3 on cloud (2 MW demand) and see the split.
    let s = edit(game(['a']), 'a', (c) => (addOnline(c, 'dc', 'small'), addLink(c, 'import', 2)))
    s = edit(s, 'a', (c) => (c.treasury = 30))
    const t = resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.rentMw = 2), (d.compute.ai = 2), (d.compute.cloud = 1))) })
    const r = company(t, 'a').history[0]
    const computeUsed = r.used.ai + r.used.cloud + r.used.btc
    expect(computeUsed).toBeGreaterThan(2)
    expect(r.plantUsed).toBeCloseTo(computeUsed - 2, 12)
    expect(r.costs.power).toBe(r2(0.4 * (computeUsed - 2)))
    expect(r.costs.rent).toBe(3.2)
  })

  it('own power cost applies only to MW that ends up used: MW offered to citizens but not bought costs nothing', () => {
    // 1 company: citizens demand 4 MW. Offer 6 MW to citizens from 6 MW of plants: 4 used.
    let s = edit(game(['a']), 'a', (c) => (addOnline(c, 'plant', 'small'), addOnline(c, 'plant', 'small'), addLink(c, 'town', 6)))
    s = edit(s, 'a', (c) => (c.links[0].mw = 0))
    const t = resolveRound(s, { a: decision((d) => (d.power.town = 6)) })
    const r = company(t, 'a').history[0]
    expect(r.used.citizens).toBeCloseTo(4 * (1 + t.pools.citizens.growth), 12)
    expect(r.costs.power).toBe(r2(0.4 * r.used.citizens))
    expect(r.revenue).toBe(r2(r.used.citizens * 1.0))
  })

  it('selling to the other datacenters pool needs no link and is paid 1.3 per MW used', () => {
    let s = edit(game(['a']), 'a', (c) => (c.links = []))
    const t = resolveRound(s, { a: decision((d) => (d.power.otherDc = 2)) })
    const r = company(t, 'a').history[0]
    expect(r.used.otherDc).toBeCloseTo(2, 12)
    expect(r.revenueByPool.otherDc).toBe(2.6)
    expect(r.costs.power).toBe(0.8)

  })

  it('compute is capped at min(datacenter MW, internal + rented MW): sanitize trims an over-offer', () => {
    let s = edit(game(['a']), 'a', (c) => (addOnline(c, 'dc', 'big'), addLink(c, 'import', 3)))
    const t = resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.rentMw = 3), (d.compute.ai = 12))) })
    const d = company(t, 'a').lastDecision!
    expect(d.compute.ai).toBeCloseTo(5, 9)

  })
})

describe('maintenance and timers (SPEC "Assets and building", DESIGN 2.1 and 2.3 step 5)', () => {
  it('starting round check: 2 MW on AI gives 6.4 - 0.8 - 0.44 = 5.16', () => {
    const t = resolveRound(game(['a']), { a: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))) })
    const r = company(t, 'a').history[0]
    expect(r.revenue).toBe(6.4)
    expect(r.costs).toEqual({ power: 0.8, rent: 0, maintenance: 0.44, interest: 0 })
    expect(r.profit).toBe(5.16)
  })

  it('a small plant ordered now pays no maintenance this round, is online next round and pays from then on', () => {
    const s = resolveRound(game(['a']), { a: decision((d) => d.builds.push({ kind: 'plant', size: 'small' })) })
    expect(company(s, 'a').history[0].costs.maintenance).toBe(0.44)
    const t = resolveRound(s, {})
    expect(company(t, 'a').history[1].costs.maintenance).toBe(0.64)
    expect(company(t, 'a').history[1].plantMw).toBe(4)
  })

  it('a big plant ordered in round 1 delivers from round 4 (3 rounds), maintenance starts with it', () => {
    let s = edit(game(['a']), 'a', (c) => (c.treasury = 50))
    s = resolveRound(s, { a: decision((d) => d.builds.push({ kind: 'plant', size: 'big' })) })
    s = resolveRound(s, {})
    s = resolveRound(s, {})
    const h = company(s, 'a').history
    expect(h.map((r) => r.plantMw)).toEqual([2, 2, 2])
    expect(h.map((r) => r.costs.maintenance)).toEqual([0.44, 0.44, 0.44])
    s = resolveRound(s, {})
    expect(company(s, 'a').history[3].plantMw).toBe(12)
    expect(company(s, 'a').history[3].costs.maintenance).toBe(r2(0.02 * 62))
  })

  it('an upgrade keeps 2 MW for the 4 rounds it takes and pays 2% of 10 + 46 from the order on', () => {
    let s = edit(game(['a']), 'a', (c) => (c.treasury = 50))
    const plant = company(s, 'a').buildings.find((b) => b.kind === 'plant')!
    s = resolveRound(s, { a: decision((d) => ((d.upgrades = [plant.id]), (d.power.internal = 2), (d.compute.ai = 2))) })
    for (let i = 0; i < 3; i++) s = resolveRound(s, {})
    const h = company(s, 'a').history
    expect(h.map((r) => r.plantMw)).toEqual([2, 2, 2, 2])
    expect(h.map((r) => r.costs.maintenance)).toEqual([1.36, 1.36, 1.36, 1.36])
    expect(capacity(company(s, 'a')).plantMw).toBe(10)
  })

  it('a link extension bought now carries next round; links pay no maintenance', () => {
    const s = resolveRound(game(['a']), { a: decision((d) => d.builds.push({ kind: 'link', use: 'internal', mw: 5 })) })
    expect(capacity(company(s, 'a')).links.internal).toBe(7)
    expect(company(s, 'a').history[0].costs.maintenance).toBe(0.44)
  })
})

describe('bankruptcy frees MW (SPEC "Losing round and bankruptcy" 4)', () => {
  it('the next round, the bankrupt company holds no reserve and the others share its old demand', () => {
    let s = game(['a', 'b'])
    s = edit(s, 'b', (c) => (addOnline(c, 'dc', 'big'), addOnline(c, 'plant', 'big'), (c.links[0].mw = 12)))
    // Round 1: both put 2 MW on AI (AI demand 4): each uses 2.
    s = resolveRound(s, {
      a: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))),
      b: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))),
    })
    expect(s.pools.ai.lastUsed).toEqual({ a: 2, b: 2 })
    s = edit(s, 'a', (c) => c.loans.push({ id: 'x', principal: 1e5, annualRate: 0.12, dueRound: s.round, takenRound: s.round - 7 }))
    const before = s
    s = resolveRound(s, {
      a: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))),
      b: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))),
    })
    expect(oracle(before, s)).toEqual([])
    expect(company(s, 'a').bankrupt).toBe(true)
    expect(s.pools.ai.lastUsed.a).toBeUndefined()
    const t = resolveRound(s, { b: decision((d) => ((d.power.internal = 12), (d.compute.ai = 12))) })
    // b alone: reserve 0.8 x its used, then all of the open AI demand.
    expect(company(t, 'b').history.at(-1)!.used.ai).toBeCloseTo(t.history.at(-1)!.pools.ai.demand, 9)
    expect(t.history.at(-1)!.pools.ai.ranking).toEqual(['b'])
  })
})

describe('replay oracle: every round of bot games follows the pool and money rules', () => {
  const lineups: BotStyle[][] = [
    ['volta', 'nimbus', 'hashfield', 'volta'],
    ['nimbus', 'nimbus', 'hashfield'],
    ['hashfield', 'volta'],
    ['volta', 'nimbus', 'hashfield', 'nimbus', 'hashfield', 'volta'],
  ]
  for (const styles of lineups) {
    it(`${styles.join(', ')}: 40 rounds, seeds 1..6`, () => {
      const problems: string[] = []
      let rentSeen = 0
      for (let seed = 1; seed <= 6; seed++) {
        let s = botState(seed, styles)
        while (!s.finished) {
          const t = resolveRound(s, {})
          problems.push(...oracle(s, t))
          rentSeen += t.history.at(-1)!.pools.otherDc.rentDemand
          s = t
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
      if (styles.includes('nimbus')) expect(rentSeen).toBeGreaterThan(0)
    })
  }

  it('solo game with a human on the default decision: 40 rounds', () => {
    const problems: string[] = []
    let s = createSoloGame({ seed: 21, playerName: 'P' })
    while (!s.finished) {
      const t = resolveRound(s, {})
      problems.push(...oracle(s, t))
      s = t
    }
    expect(problems.slice(0, 10)).toEqual([])
  })
})

/** A small local generator so the fuzz cases are reproducible without touching the engine RNG. */
function lcg(seed: number): () => number {
  let x = seed >>> 0
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296)
}

function randomDecision(c: Company, rnd: () => number): Decision {
  const d = decision()
  const plant = rnd() * 14
  d.power = { internal: rnd() * plant, town: rnd() * plant * 0.5, otherDc: rnd() * plant * 0.5 }
  d.compute = { cloud: rnd() * 6, btc: rnd() * 6, ai: rnd() * 8 }
  d.rentMw = rnd() < 0.5 ? rnd() * 8 : 0
  const pick = rnd()
  if (pick < 0.15) d.builds.push({ kind: 'plant', size: rnd() < 0.5 ? 'small' : 'big' })
  else if (pick < 0.3) d.builds.push({ kind: 'dc', size: rnd() < 0.5 ? 'small' : 'big' })
  else if (pick < 0.5) d.builds.push({ kind: 'link', use: (['internal', 'town', 'import'] as const)[Math.floor(rnd() * 3)], mw: 1 + Math.floor(rnd() * 6) })
  if (rnd() < 0.15) {
    const small = c.buildings.find((b) => b.size === 'small' && b.status === 'online')
    if (small) d.upgrades.push(small.id)
  }
  if (rnd() < 0.1) d.loans.take = Math.floor(rnd() * 40)
  return d
}

describe('the replay oracle has teeth', () => {
  it('flags a tampered growth, used MW, rent split, maintenance or timer', () => {
    const s = createSoloGame({ seed: 3, playerName: 'P' })
    const t = resolveRound(s, {})
    expect(oracle(s, t)).toEqual([])
    const tamper = (f: (x: GameState) => void): string[] => {
      const x = structuredClone(t)
      f(x)
      return oracle(s, x)
    }
    expect(tamper((x) => (x.pools.ai.growth += 1e-6)).length).toBeGreaterThan(0)
    expect(tamper((x) => (x.rngState += 1)).length).toBeGreaterThan(0)
    expect(tamper((x) => (x.companies[0].history[0].used.ai += 0.01)).length).toBeGreaterThan(0)
    expect(tamper((x) => (x.companies[0].history[0].costs.maintenance += 0.01)).length).toBeGreaterThan(0)
    expect(tamper((x) => (x.companies[0].history[0].plantUsed += 0.01)).length).toBeGreaterThan(0)
    expect(tamper((x) => (x.companies[0].buildings[0].roundsLeft = 1)).length).toBeGreaterThan(0)
    expect(tamper((x) => (x.pools.cloud.lastUsed.you = 99)).length).toBeGreaterThan(0)
  })
})

describe('replay oracle with random human decisions (builds, upgrades, rent, over-offers)', () => {
  it('3 humans and 1 bot, 40 rounds, seeds 1..15', () => {
    const problems: string[] = []
    let upgrades = 0
    for (let seed = 1; seed <= 15; seed++) {
      const rnd = lcg(seed * 7919)
      let s = createGame(
        {
          seed,
          companies: [
            { id: 'h1', name: 'H1', isBot: false },
            { id: 'h2', name: 'H2', isBot: false },
            { id: 'h3', name: 'H3', isBot: false },
            { id: 'v', name: 'V', isBot: true, bot: 'nimbus' },
          ],
        },
        cfg,
      )
      s = edit(s, 'h1', (c) => (c.treasury = 200))
      while (!s.finished) {
        const ds: Record<string, Decision> = {}
        for (const c of s.companies) if (!c.isBot && !c.bankrupt) ds[c.id] = randomDecision(c, rnd)
        const t = resolveRound(s, ds)
        for (const c of t.companies) upgrades += c.buildings.filter((b) => b.status === 'upgrading').length > 0 ? 1 : 0
        problems.push(...oracle(s, t))
        s = t
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
    expect(upgrades).toBeGreaterThan(0)
  })
})

describe('rent is filled by OTHER companies first (SPEC "Round flow" step 3, "Power routing")', () => {
  it('a lone company that sells to otherDc and rents does not rent its own MW back at the rival rate', () => {
    // SPEC: "Match rented power: buyers take surplus MW offered by other companies first, then the market."
    // With one company there is no rival seller, so all 2 rented MW come from the market at 1.6.
    const s = edit(game(['a']), 'a', (c) => addLink(c, 'import', 2))
    const t = resolveRound(s, { a: decision((d) => ((d.power.otherDc = 2), (d.rentMw = 2), (d.compute.ai = 2))) })
    const r = company(t, 'a').history[0]
    expect(r.used.otherDc).toBeCloseTo(2, 12)
    expect(r.rent.fromRivals).toBe(0)
    expect(r.rent.fromMarket).toBe(2)
    expect(r.costs.rent).toBe(3.2)
  })

  it('a seller that also rents takes only the other seller\'s MW; a pure renter is filled by both', () => {
    // a sells 2 and rents 2, b sells 0 and rents 2, c sells 1 and rents 0. Background 2 MW x 3 + 4 rent:
    // both sellers sell all they offer (3 MW in total). The most rivals can fill is 3: a can only take
    // c's 1 MW, so a gets 1 and b gets the other 2 (pro rata 1.5 each would give a more than c sold).
    let s = game(['a', 'b', 'c'])
    for (const id of ['a', 'b']) s = edit(s, id, (c) => (addLink(c, 'import', 2), addOnline(c, 'plant', 'small')))
    s = edit(s, 'c', (c) => addOnline(c, 'plant', 'small'))
    const t = resolveRound(s, {
      a: decision((d) => ((d.power.otherDc = 2), (d.power.internal = 2), (d.rentMw = 2), (d.compute.ai = 2))),
      b: decision((d) => ((d.power.internal = 2), (d.rentMw = 2), (d.compute.ai = 2))),
      c: decision((d) => ((d.power.otherDc = 1), (d.power.internal = 2), (d.compute.ai = 2))),
    })
    const [a, b, c] = ['a', 'b', 'c'].map((id) => company(t, id).history[0])
    expect(a.used.otherDc).toBeCloseTo(2, 12)
    expect(c.used.otherDc).toBeCloseTo(1, 12)
    expect(a.rent.fromRivals).toBeCloseTo(1, 12)
    expect(a.rent.fromMarket).toBeCloseTo(1, 12)
    expect(b.rent.fromRivals).toBeCloseTo(2, 12)
    expect(b.rent.fromMarket).toBeCloseTo(0, 12)
    expect(oracle(s, t)).toEqual([])
  })
})
