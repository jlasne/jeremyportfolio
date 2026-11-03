// The rules update (state version 2): land rows, level 3 by upgrade, the 30% commitment, the
// unallocated power penalty, share and tenure priority, pool beta and stability premium, the 10%
// buyback. One describe per rule, hand-computed values in the comments.

import { describe, expect, it } from 'vitest'
import {
  allocatePool,
  canUpgrade,
  capacity,
  commitmentFloors,
  createGame,
  defaultConfig,
  findFreeTile,
  freeLots,
  landCost,
  levelOf,
  nextSize,
  ownedRows,
  plotRows,
  previewCompany,
  priorityWeights,
  projectRound,
  resolveRound,
  sanitizeDecision,
  stockReturn,
  upgradeSpec,
  validateDecision,
  warnings,
  type Decision,
  type GameState,
} from './index'
import { addLink, addOnline, company, decision, edit, game, roomy, tuned } from './test/helpers'

const codes = (s: GameState, d: unknown, id = 'a'): string[] => validateDecision(s, id, d as Decision).errors.map((e) => e.code)
const last = (s: GameState, id = 'a') => company(s, id).history.at(-1)!
/** The start kit runs: 2 MW from the plant to the datacenter, on AI. */
const ai2 = (change: (d: Decision) => void = () => {}): Decision =>
  decision((d) => {
    d.power.internal = 2
    d.compute.ai = 2
    change(d)
  })
/** A company whose 2 start rows (8 lots) are full. */
const fullLand = (s: GameState, id = 'a'): GameState =>
  edit(s, id, (c) => {
    for (let i = 0; i < 6; i++) addOnline(c, 'plant', 'small')
  })

// ---------------------------------------------------------------- 1. land

describe('land rows (rule 1)', () => {
  it('row n past the start costs 50 x 1.1^(n - 1): 50, 55, 60.50, 66.55', () => {
    expect(landCost(2, 1)).toBe(50)
    expect(landCost(3, 1)).toBe(55)
    expect(landCost(4, 1)).toBe(60.5)
    expect(landCost(5, 1)).toBe(66.55)
    // Several rows at once add up the same way: 50 + 55 + 60.5.
    expect(landCost(2, 3)).toBe(165.5)
    expect(landCost(2, 0)).toBe(0)
  })

  it('a new company owns 2 rows of 4 lots; plotRows draws one locked row under them', () => {
    const c = company(game(['a']), 'a')
    expect(c.landRows).toBe(2)
    expect(ownedRows(c)).toBe(2)
    expect(freeLots(c, 2)).toBe(6)
    expect(plotRows(c)).toBe(3)
    const p = previewCompany(game(['a']), 'a', decision())
    expect(p).toMatchObject({ landRows: 2, nextRowCost: 50, freeLots: 6 })
  })

  it('full land: an order without a lot is no_land, sanitize drops and refunds it, findFreeTile gives null', () => {
    const s = fullLand(edit(game(['a']), 'a', (c) => (c.treasury = 100)))
    const build = decision((d) => d.builds.push({ kind: 'plant', size: 'small' }, { kind: 'link', use: 'town', mw: 2 }))
    expect(codes(s, build)).toEqual(['no_land'])
    expect(findFreeTile(company(s, 'a'))).toBeNull()
    const clean = sanitizeDecision(s, 'a', build)
    expect(clean.builds).toEqual([{ kind: 'link', use: 'town', mw: 2 }])
    expect(validateDecision(s, 'a', clean).ok).toBe(true)
    // Resolution: only the link is paid.
    const r = last(resolveRound(s, { a: build }))
    expect(r.finance.buildSpend).toBe(2)
  })

  it('a lot on a row not owned is tile_out_of_plot; buying the row in the same decision makes it valid', () => {
    const s = edit(game(['a']), 'a', (c) => (c.treasury = 100))
    const onRow2 = decision((d) => d.builds.push({ kind: 'plant', size: 'small', tile: [1, 2] }))
    expect(codes(s, onRow2)).toEqual(['tile_out_of_plot'])
    const bought = decision((d) => ((d.landRows = 1), d.builds.push({ kind: 'plant', size: 'small', tile: [1, 2] })))
    expect(codes(s, bought)).toEqual([])
    const t = resolveRound(s, { a: bought })
    expect(company(t, 'a').landRows).toBe(3)
    expect(company(t, 'a').buildings.at(-1)!.tile).toEqual([1, 2])
    expect(last(t).finance).toMatchObject({ landSpend: 50, landBought: 1, buildSpend: 10 })
    expect(last(t).landRows).toBe(3)
    expect(last(t).treasury).toBe(Math.round((100 - 60 + last(t).profit) * 100) / 100)
  })

  it('on full land an order without a lot takes the first lot of a row bought in the same decision', () => {
    const s = fullLand(edit(game(['a']), 'a', (c) => (c.treasury = 100)))
    const d = decision((x) => ((x.landRows = 1), x.builds.push({ kind: 'dc', size: 'small' })))
    expect(codes(s, d)).toEqual([])
    const t = resolveRound(s, { a: d })
    expect(company(t, 'a').buildings.at(-1)!.tile).toEqual([0, 2])
  })

  it('each row costs more than the last, across rounds: 2 rows for 105, then the next for 60.50', () => {
    let s = edit(game(['a']), 'a', (c) => (c.treasury = 300))
    s = resolveRound(s, { a: ai2((d) => (d.landRows = 2)) })
    expect(last(s).finance.landSpend).toBe(105)
    s = resolveRound(s, { a: ai2((d) => (d.landRows = 1)) })
    expect(last(s).finance.landSpend).toBe(60.5)
    expect(company(s, 'a').landRows).toBe(5)
  })

  it('land is bought while the treasury allows: sanitize keeps the rows it can pay, validate reports over_treasury', () => {
    const s = edit(game(['a']), 'a', (c) => (c.treasury = 110))
    const d = decision((x) => (x.landRows = 3))
    expect(codes(s, d)).toContain('over_treasury')
    expect(sanitizeDecision(s, 'a', d).landRows).toBe(2)
    expect(codes(s, decision((x) => (x.landRows = 1.5)))).toContain('not_integer')
    expect(codes(s, decision((x) => (x.landRows = -1)))).toContain('negative')
  })
})

// ---------------------------------------------------------------- 2. level 3

describe('level 3 by upgrade (rule 2)', () => {
  it('levels and upgrade specs: small -> big 46 / 58 in 4 rounds, big -> mega 50 / 62 in 6 rounds', () => {
    expect([nextSize('small'), nextSize('big'), nextSize('mega')]).toEqual(['big', 'mega', null])
    expect([levelOf('small'), levelOf('big'), levelOf('mega')]).toEqual([1, 2, 3])
    expect(upgradeSpec('plant', 'small')).toEqual({ cost: 46, rounds: 4 })
    expect(upgradeSpec('dc', 'small')).toEqual({ cost: 58, rounds: 4 })
    expect(upgradeSpec('plant', 'big')).toEqual({ cost: 50, rounds: 6 })
    expect(upgradeSpec('dc', 'big')).toEqual({ cost: 62, rounds: 6 })
    expect(defaultConfig.buildings.plant.mega.mw).toBe(25)
  })

  it('a mega build order is build_invalid and sanitize drops it', () => {
    const s = edit(game(['a']), 'a', (c) => (c.treasury = 500))
    const d = decision((x) => x.builds.push({ kind: 'plant', size: 'mega' as never }))
    expect(codes(s, d)).toEqual(['build_invalid'])
    expect(sanitizeDecision(s, 'a', d).builds).toEqual([])
  })

  it('canUpgrade: online and below mega', () => {
    const s = edit(game(['a']), 'a', (c) => {
      addOnline(c, 'plant', 'big')
      addOnline(c, 'dc', 'mega')
      c.buildings.push({ id: 'wip', kind: 'dc', size: 'big', mw: 0, status: 'building', roundsLeft: 2, pricePaid: 50, tile: [0, 1], builtRound: 1 })
    })
    const by = (size: string, status = 'online') => company(s, 'a').buildings.find((b) => b.size === size && b.status === status)!
    expect(canUpgrade(by('small'))).toBe(true)
    expect(canUpgrade(by('big'))).toBe(true)
    expect(canUpgrade(by('mega'))).toBe(false)
    expect(canUpgrade(by('big', 'building'))).toBe(false)
    expect(codes(edit(s, 'a', (c) => (c.treasury = 500)), decision((d) => (d.upgrades = [by('mega').id])))).toEqual(['upgrade_invalid'])
  })

  it('a big plant upgraded to mega delivers 10 MW for the 6 rounds it takes, then 25 MW; it pays 50 and 2% of 90', () => {
    let s = edit(roomy(game(['a'])), 'a', (c) => (addOnline(c, 'plant', 'big'), (c.treasury = 100)))
    const big = company(s, 'a').buildings.find((b) => b.size === 'big')!
    // Plants 2 + 10: 2 MW to the datacenter, 10 MW sold to the other datacenters pool, nothing unallocated.
    const run = ai2((d) => (d.power.otherDc = 10))
    s = resolveRound(s, { a: ai2((d) => ((d.power.otherDc = 10), (d.upgrades = [big.id]))) })
    const up = company(s, 'a').buildings.find((b) => b.id === big.id)!
    expect(up).toMatchObject({ status: 'upgrading', size: 'big', mw: 10, roundsLeft: 5, pricePaid: 90 })
    expect(last(s).finance.buildSpend).toBe(50)
    for (let i = 0; i < 5; i++) s = resolveRound(s, { a: run })
    const h = company(s, 'a').history
    expect(h.map((r) => r.plantMw)).toEqual([12, 12, 12, 12, 12, 12])
    // Maintenance on everything online or upgrading: 0.02 x (10 + 12 + 90) = 2.24.
    expect(h.every((r) => r.costs.maintenance === 2.24)).toBe(true)
    const done = company(s, 'a').buildings.find((b) => b.id === big.id)!
    expect(done).toMatchObject({ status: 'online', size: 'mega', mw: 25, roundsLeft: 0 })
    expect(h.at(-1)!.completed).toContain(big.id)
    expect(capacity(company(s, 'a')).plantMw).toBe(27)
    expect(canUpgrade(done)).toBe(false)
  })

  it('a small datacenter still goes small -> big in 4 rounds for 58, keeping 2 MW meanwhile', () => {
    let s = edit(roomy(game(['a'])), 'a', (c) => (c.treasury = 100))
    const dc = company(s, 'a').buildings.find((b) => b.kind === 'dc')!
    s = resolveRound(s, { a: ai2((d) => (d.upgrades = [dc.id])) })
    expect(company(s, 'a').buildings.find((b) => b.id === dc.id)).toMatchObject({ status: 'upgrading', mw: 2, roundsLeft: 3, pricePaid: 70 })
    for (let i = 0; i < 3; i++) s = resolveRound(s, { a: ai2() })
    expect(company(s, 'a').history.map((r) => r.dcMw)).toEqual([2, 2, 2, 2])
    expect(company(s, 'a').buildings.find((b) => b.id === dc.id)).toMatchObject({ status: 'online', size: 'big', mw: 10 })
  })
})

// ---------------------------------------------------------------- 3. commitment

describe('commitment: an offer drops by at most 30% a round (rule 3)', () => {
  /** Round 1 resolved with the given decision; the company then holds `extra` buildings and links. */
  function after(d: Decision, setup: (c: GameState['companies'][number]) => void = () => {}): GameState {
    const s = edit(roomy(game(['a'])), 'a', setup)
    return resolveRound(s, { a: d })
  }

  it('floors are 70% of last round, floored to 0.01 MW; nothing before round 1', () => {
    expect(commitmentFloors(game(['a']), 'a')).toEqual({ compute: { cloud: 0, btc: 0, ai: 0 }, rentMw: 0 })
    const s = after(decision((d) => ((d.power.internal = 2), (d.compute = { cloud: 0.8, btc: 0.5, ai: 0.7 }))))
    expect(commitmentFloors(s, 'a')).toEqual({ compute: { cloud: 0.56, btc: 0.35, ai: 0.49 }, rentMw: 0 })
    const odd = after(decision((d) => ((d.power.internal = 2), (d.compute.ai = 1.33))))
    // 1.33 x 0.7 = 0.931 -> 0.93
    expect(commitmentFloors(odd, 'a').compute.ai).toBe(0.93)
  })

  it('validate: compute_below_commitment per pool and rent_below_commitment; at the floor it is fine', () => {
    const s = after(ai2((d) => (d.rentMw = 2)), (c) => (addLink(c, 'import', 2), addOnline(c, 'dc', 'small')))
    expect(commitmentFloors(s, 'a')).toEqual({ compute: { cloud: 0, btc: 0, ai: 1.4 }, rentMw: 1.4 })
    expect(codes(s, decision((d) => ((d.power.internal = 2), (d.compute.ai = 1.39), (d.rentMw = 1.4))))).toEqual(['compute_below_commitment'])
    expect(codes(s, decision((d) => ((d.power.internal = 2), (d.compute.ai = 1.4), (d.rentMw = 1))))).toEqual(['rent_below_commitment'])
    expect(codes(s, decision((d) => ((d.power.internal = 2), (d.compute.ai = 1.4), (d.rentMw = 1.4))))).toEqual([])
    // Growing is free, and moving MW to another pool counts as a drop in the old one.
    expect(codes(s, decision((d) => ((d.power.internal = 2), (d.compute.ai = 4), (d.rentMw = 2))))).toEqual([])
    expect(codes(s, decision((d) => ((d.power.internal = 2), (d.compute.cloud = 2), (d.rentMw = 1.4))))).toEqual(['compute_below_commitment'])
  })

  it('sanitize raises offers to the floors and the result validates', () => {
    const s = after(ai2((d) => (d.rentMw = 2)), (c) => (addLink(c, 'import', 2), addOnline(c, 'dc', 'small')))
    const clean = sanitizeDecision(s, 'a', decision())
    expect(clean.compute).toEqual({ cloud: 0, btc: 0, ai: 1.4 })
    expect(clean.rentMw).toBe(1.4)
    expect(validateDecision(s, 'a', clean).ok).toBe(true)
    // Resolution applies the same floor to a decision that drops everything.
    const t = resolveRound(s, { a: decision() })
    expect(company(t, 'a').lastDecision!.compute.ai).toBe(1.4)
    expect(last(t).rent.requested).toBe(1.4)
  })

  it('sanitize takes the plant MW a committed offer needs from otherDc first, then from town', () => {
    // Last round: 2 MW on AI. This round the draft sells all 4 MW of plants: 2 to town, 2 to otherDc.
    const s = after(ai2(), (c) => (addOnline(c, 'plant', 'small'), addLink(c, 'town', 2)))
    const sell = decision((d) => ((d.power.town = 2), (d.power.otherDc = 2)))
    const clean = sanitizeDecision(s, 'a', sell)
    // 1.4 MW must reach the datacenter: otherDc gives 1.4.
    expect(clean.power).toEqual({ internal: 1.4, town: 2, otherDc: 0.6 })
    expect(clean.compute.ai).toBe(1.4)
    expect(validateDecision(s, 'a', clean).ok).toBe(true)
    // With room left on the plants nothing is cut.
    const townOnly = sanitizeDecision(s, 'a', decision((d) => (d.power.town = 2)))
    expect(townOnly.power).toEqual({ internal: 1.4, town: 2, otherDc: 0 })
    // One 2 MW plant, all of it to town: town gives the 1.4 MW.
    const tight = after(ai2(), (c) => addLink(c, 'town', 2))
    const cut = sanitizeDecision(tight, 'a', decision((d) => (d.power.town = 2)))
    expect(cut.power).toEqual({ internal: 1.4, town: 0.6, otherDc: 0 })
    expect(validateDecision(tight, 'a', cut).ok).toBe(true)
  })

  it('floors shrink with capacity: fewer datacenters online or a smaller import link scale them down', () => {
    let s = after(decision((d) => ((d.power.internal = 4), (d.rentMw = 4), (d.compute = { cloud: 4, btc: 0, ai: 4 }))), (c) => {
      addOnline(c, 'dc', 'big')
      addOnline(c, 'plant', 'small')
      addLink(c, 'internal', 2)
      addLink(c, 'import', 4)
    })
    expect(commitmentFloors(s, 'a')).toEqual({ compute: { cloud: 2.8, btc: 0, ai: 2.8 }, rentMw: 2.8 })
    // The import link drops to 1 MW: rent floor 1, compute floors fit 4 internal + 1 rented = 5 MW.
    s = edit(s, 'a', (c) => (c.links = c.links.map((l) => (l.use === 'import' ? { ...l, mw: 1 } : l))))
    const f = commitmentFloors(s, 'a')
    expect(f.rentMw).toBe(1)
    expect(f.compute.cloud + f.compute.ai).toBeLessThanOrEqual(5 + 1e-9)
    expect(f.compute.cloud).toBeCloseTo(2.5, 2)
    expect(validateDecision(s, 'a', sanitizeDecision(s, 'a', decision())).ok).toBe(true)
  })

  it('fuzz: for random last decisions, capacities and drafts, sanitize output always validates', () => {
    let seed = 12345
    const rnd = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    const bad: string[] = []
    for (let i = 0; i < 400; i++) {
      const s = edit(game(['a']), 'a', (c) => {
        for (let k = Math.floor(rnd() * 3); k > 0; k--) addOnline(c, rnd() < 0.5 ? 'plant' : 'dc', rnd() < 0.7 ? 'small' : 'big')
        if (rnd() < 0.6) addLink(c, 'import', Math.floor(rnd() * 6))
        if (rnd() < 0.5) addLink(c, 'town', Math.floor(rnd() * 6))
        if (rnd() < 0.5) addLink(c, 'internal', Math.floor(rnd() * 8))
        c.lastDecision = decision((d) => {
          d.power.internal = rnd() * 12
          d.rentMw = rnd() < 0.5 ? rnd() * 8 : 0
          d.compute = { cloud: rnd() * 9, btc: rnd() * 9, ai: rnd() * 9 }
        })
      })
      const draft = decision((d) => {
        d.power = { internal: rnd() * 10, town: rnd() * 6, otherDc: rnd() * 6 }
        d.compute = { cloud: rnd() * 4, btc: rnd() * 4, ai: rnd() * 4 }
        d.rentMw = rnd() * 4
      })
      const clean = sanitizeDecision(s, 'a', draft)
      const v = validateDecision(s, 'a', clean)
      if (!v.ok) bad.push(`${i}: ${v.errors.map((e) => e.code).join(',')}`)
    }
    expect(bad).toEqual([])
  })
})

// ---------------------------------------------------------------- 4. unallocated power

describe('unallocated plant power penalty (rule 4)', () => {
  it('2 of 4 plant MW routed nowhere cost 5 x 0.4 x 2 = 4.00', () => {
    const s = edit(roomy(game(['a'])), 'a', (c) => addOnline(c, 'plant', 'small'))
    const r = last(resolveRound(s, { a: ai2() }))
    expect(r.plantMw).toBe(4)
    expect(r.unallocatedMw).toBe(2)
    expect(r.costs.unallocated).toBe(4)
    // 6.4 - 0.8 power - 0.64 maintenance - 4 penalty
    expect(r.profit).toBe(0.96)
  })

  it('internal MW above the compute offer counts as unallocated, and so does internal MW rent already covers', () => {
    const s = edit(roomy(game(['a'])), 'a', (c) => addLink(c, 'import', 2))
    // internal 2, compute 1: 1 MW goes nowhere.
    expect(last(resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.compute.ai = 1))) })).unallocatedMw).toBe(1)
    // internal 2, rent 2, compute 2: rent powers it all, the 2 own MW go nowhere.
    const r = last(resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.rentMw = 2), (d.compute.ai = 2))) }))
    expect(r.unallocatedMw).toBe(2)
    expect(r.costs.unallocated).toBe(4)
  })

  it('MW offered to a pool count as allocated even when the pool buys less', () => {
    const s = edit(game(['a']), 'a', (c) => (c.links = []))
    const r = last(resolveRound(s, { a: decision((d) => (d.power.otherDc = 2)) }))
    expect(r.used.otherDc).toBeLessThan(2)
    expect(r.unallocatedMw).toBe(0)
    expect(r.costs.unallocated).toBe(0)
  })

  it('the projection and the warning chip show it', () => {
    const s = edit(roomy(game(['a'])), 'a', (c) => addOnline(c, 'plant', 'small'))
    const p = projectRound(s, 'a', ai2())
    expect(p.unallocatedMw).toBe(2)
    expect(p.costs.unallocated).toBe(4)
    const w = warnings(s, 'a', ai2()).find((x) => x.code === 'power_unallocated')
    expect(w?.level).toBe('critical')
    expect(warnings(s, 'a', ai2((d) => (d.power.otherDc = 2))).some((x) => x.code === 'power_unallocated')).toBe(false)
  })
})

// ---------------------------------------------------------------- 5. allocation priority

describe('open MW by spare x priority weight (rule 5)', () => {
  it('without weights, or with equal weights, it is the SPEC algorithm', () => {
    const offers = [0, 0.5, 2, 3.3, 7, 12]
    for (const D of [0, 0.7, 3, 9.5, 20, 41]) {
      for (const oa of offers) for (const ob of offers) for (const ua of [0, 2, 9]) {
        const O = { a: oa, b: ob, c: 4 }
        const U = { a: ua, b: 3, c: 0 }
        const plain = allocatePool(D, O, U, 0.8)
        for (const k of [1, 2.5]) {
          const w = allocatePool(D, O, U, 0.8, { a: k, b: k, c: k })
          for (const id of Object.keys(O)) expect(w.used[id]).toBeCloseTo(plain.used[id], 9)
        }
      }
    }
    expect(allocatePool(14, { you: 8, a: 6, c: 6 }, { you: 5, a: 5, c: 0 }, 0.8, { you: 1, a: 1, c: 1 }).used.c).toBeCloseTo(3, 9)
  })

  it('open MW split by spare x weight: weights 3 and 1 on 10 MW of spare each give 7.5 and 2.5', () => {
    const r = allocatePool(10, { a: 10, b: 10 }, {}, 0.8, { a: 3, b: 1 })
    expect(r.open.a).toBeCloseTo(7.5, 12)
    expect(r.open.b).toBeCloseTo(2.5, 12)
    expect(r.idle.b).toBeCloseTo(7.5, 12)
  })

  it('a capped company gets its spare and the rest goes to the others by the same rule', () => {
    // a: 3 x 2 = 6 of 16 -> 3.75 > its 2 MW of spare: capped at 2; b takes the other 8.
    const r = allocatePool(10, { a: 2, b: 10 }, {}, 0.8, { a: 3, b: 1 })
    expect(r.used.a).toBeCloseTo(2, 12)
    expect(r.used.b).toBeCloseTo(8, 12)
    // Two rounds of capping: D 12, a 1 (w 4), b 3 (w 2), c 20 (w 1).
    // Totals 4 + 6 + 20 = 30: a 1.6 > 1 capped. Left 11 over 6 + 20: b 2.54 < 3, c 8.46.
    const t = allocatePool(12, { a: 1, b: 3, c: 20 }, {}, 0.8, { a: 4, b: 2, c: 1 })
    expect(t.used.a).toBeCloseTo(1, 12)
    expect(t.used.b).toBeCloseTo((11 * 6) / 26, 12)
    expect(t.used.c).toBeCloseTo((11 * 20) / 26, 12)
    // Reserves come first and are not weighted: b keeps 0.8 x 5 = 4.
    const u = allocatePool(10, { a: 10, b: 10 }, { b: 5 }, 0.8, { a: 3, b: 1 })
    expect(u.reserved.b).toBe(4)
    expect(u.open.a).toBeCloseTo((6 * 30) / 36, 12)
    expect(u.used.a + u.used.b).toBeCloseTo(10, 12)
  })

  it('priorityWeights = (1 + 1 x last share) x (1 + 0.05 x min(tenure, 10)); a newcomer has 1', () => {
    const s = game(['a', 'b', 'c'])
    s.pools.ai.lastUsed = { a: 3, b: 1 }
    s.pools.ai.tenure = { a: 4, b: 15 }
    const w = priorityWeights(s, 'ai', ['a', 'b', 'c'])
    expect(w.a).toBeCloseTo(1.75 * 1.2, 12)
    expect(w.b).toBeCloseTo(1.25 * 1.5, 12)
    expect(w.c).toBe(1)
  })

  it('in resolution, tenure counts consecutive rounds served and resets to 0; the summary shows offered and used per company', () => {
    let s = roomy(game(['a', 'b']))
    s = resolveRound(s, { a: ai2(), b: decision((d) => ((d.power.internal = 2), (d.compute.cloud = 2))) })
    expect(s.pools.ai.tenure).toEqual({ a: 1, b: 0 })
    expect(s.pools.cloud.tenure).toEqual({ a: 0, b: 1 })
    s = resolveRound(s, { a: ai2(), b: decision((d) => ((d.power.internal = 2), (d.compute.cloud = 2))) })
    expect(s.pools.ai.tenure.a).toBe(2)
    const sum = s.history.at(-1)!.pools.ai
    expect(sum.offered).toEqual({ a: 2, b: 0 })
    expect(sum.usedBy.a).toBeCloseTo(2, 12)
    expect(sum.usedBy.b).toBe(0)
    expect(s.version).toBe(2)
    // a moves to cloud within the 30% rule (AI 1.4, cloud 0.6): it keeps serving AI, so tenure goes on.
    s = resolveRound(s, { a: decision((d) => ((d.power.internal = 2), (d.compute.ai = 1.4), (d.compute.cloud = 0.6))), b: decision((d) => ((d.power.internal = 2), (d.compute.cloud = 2))) })
    expect(s.pools.ai.tenure.a).toBe(3)
    expect(s.pools.cloud.tenure).toEqual({ a: 1, b: 3 })
  })

  it('an incumbent with share and tenure gets the open MW first against a newcomer offering the same', () => {
    // a served AI alone for 3 rounds at 1 MW. Demand jumps; a and the newcomer b both offer 10 MW.
    let s = roomy(game(['a', 'b']), 1)
    s = edit(s, 'a', (c) => (addOnline(c, 'dc', 'big'), addOnline(c, 'plant', 'big'), (c.links[0].mw = 12), (c.treasury = 200)))
    s = edit(s, 'b', (c) => (addOnline(c, 'dc', 'big'), addOnline(c, 'plant', 'big'), (c.links[0].mw = 12), (c.treasury = 200)))
    const one = decision((d) => ((d.power.internal = 1), (d.power.otherDc = 11), (d.compute.ai = 1)))
    for (let i = 0; i < 3; i++) s = resolveRound(s, { a: one, b: decision((d) => (d.power.otherDc = 12)) })
    s.pools.ai.demand = 6
    const ten = decision((d) => ((d.power.internal = 10), (d.power.otherDc = 2), (d.compute.ai = 10)))
    const t = resolveRound(s, { a: ten, b: ten })
    const a = last(t, 'a').used.ai
    const b = last(t, 'b').used.ai
    // a reserves 0.8, then weights (1 + 1) x 1.15 = 2.3 against 1.
    expect(a).toBeGreaterThan(b)
    const D = t.history.at(-1)!.pools.ai.demand
    const open = D - 0.8
    expect(a).toBeCloseTo(0.8 + (open * 2.3 * 9.2) / (2.3 * 9.2 + 10), 9)
    expect(a + b).toBeCloseTo(D, 9)
  })
})

// ---------------------------------------------------------------- 6. stock

describe('pool beta and stability premium (rule 6)', () => {
  const zero = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }
  const only = (p: keyof typeof zero) => ({ ...zero, [p]: 1 })
  const miss = (p: keyof typeof zero, x: number) => ({ growth: { ...zero, [p]: x }, expected: zero })

  it('a demand miss of 1 point moves r by beta points: bitcoin 2.5, citizens 0.5, AI 1', () => {
    const at = (p: keyof typeof zero): number => stockReturn({ revenue: 1, prevRevenue: 1, weights: only(p), idle: 0, ...miss(p, 0.01) }).demandMiss[p]
    expect(at('btc')).toBeCloseTo(0.025, 12)
    expect(at('citizens')).toBeCloseTo(0.005, 12)
    expect(at('cloud')).toBeCloseTo(0.006, 12)
    expect(at('ai')).toBeCloseTo(0.01, 12)
  })

  it('the stability premium is the revenue-weighted premium: 0.6% for citizens or cloud, 0 for bitcoin', () => {
    const flat = { revenue: 1, prevRevenue: 1, idle: 0, growth: zero, expected: zero }
    expect(stockReturn({ ...flat, weights: only('citizens') }).stability).toBeCloseTo(0.006, 12)
    expect(stockReturn({ ...flat, weights: only('btc') }).stability).toBe(0)
    const mixed = stockReturn({ ...flat, weights: { ...zero, cloud: 0.5, ai: 0.5 } })
    expect(mixed.stability).toBeCloseTo(0.004, 12)
    expect(mixed.r).toBeCloseTo(0.004, 12)
    // Neutral values switch both off.
    const neutral = tuned((c) => {
      c.stock.stabilityPremium = { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0 }
      c.stock.poolBeta = { citizens: 1, otherDc: 1, cloud: 1, btc: 1, ai: 1 }
    })
    expect(stockReturn({ ...flat, weights: only('citizens') }, neutral).r).toBe(0)
    expect(stockReturn({ revenue: 1, prevRevenue: 1, idle: 0, weights: only('btc'), ...miss('btc', 0.01) }, neutral).r).toBeCloseTo(0.01, 12)
  })

  it('in resolution, the premium shows as rParts.stability and parts.stability from last round weights', () => {
    let s = edit(roomy(game(['a'])), 'a', (c) => addLink(c, 'town', 2))
    s = resolveRound(s, { a: decision((d) => (d.power.town = 2)) })
    // Round 1 has no weights yet: no premium.
    expect(last(s).stock.rParts.stability).toBe(0)
    s = resolveRound(s, { a: decision((d) => (d.power.town = 2)) })
    const st = last(s).stock
    expect(st.rParts.stability).toBeCloseTo(0.006, 12)
    // 0.85 x BV before x 0.006 / 10 shares.
    expect(st.parts.stability).toBe(Math.round(((0.85 * st.bvBefore * 0.006) / 10) * 100) / 100)
    expect(st.rParts.demandMiss.citizens).toBeCloseTo(0.5 * (s.pools.citizens.growth - s.pools.citizens.expectedGrowth), 12)
  })
})

// ---------------------------------------------------------------- 7. shares

describe('buyback: at most 10% a round, paid from the treasury (rule 7)', () => {
  it('cap: 1 of 10 shares, 2 of 25; issues stay at 20%', () => {
    const s = game(['a'])
    expect(codes(s, decision((d) => (d.shares = { mode: 'buyback', count: 2 })))).toEqual(['shares_over_cap'])
    expect(codes(s, decision((d) => (d.shares = { mode: 'buyback', count: 1 })))).toEqual([])
    expect(codes(s, decision((d) => (d.shares = { mode: 'issue', count: 2 })))).toEqual([])
    const many = edit(s, 'a', (c) => ((c.shares = 25), (c.sharePrice = 4)))
    expect(codes(many, decision((d) => (d.shares = { mode: 'buyback', count: 3 })))).toEqual(['shares_over_cap'])
    expect(codes(many, decision((d) => (d.shares = { mode: 'buyback', count: 2 })))).toEqual([])
    expect(sanitizeDecision(many, 'a', decision((d) => (d.shares = { mode: 'buyback', count: 9 }))).shares).toEqual({ mode: 'buyback', count: 2 })
  })

  it('cash: up to the whole treasury, whatever the debt; sanitize buys what the treasury pays', () => {
    const s = edit(game(['a', 'b']), 'a', (c) => {
      c.shares = 50
      c.sharePrice = 2
      c.marketCap = 100
      c.treasury = 7
      c.loans.push({ id: 'L', principal: 500, annualRate: 0.1, dueRound: 8, takenRound: 1 })
    })
    // 3 shares at 2 = 6 <= 7, debt 500 aside; 4 = 8 > 7.
    expect(codes(s, decision((d) => (d.shares = { mode: 'buyback', count: 3 })))).toEqual([])
    expect(codes(s, decision((d) => (d.shares = { mode: 'buyback', count: 4 })))).toContain('buyback_over_cash')
    const clean = sanitizeDecision(s, 'a', decision((d) => (d.shares = { mode: 'buyback', count: 5 })))
    expect(clean.shares).toEqual({ mode: 'buyback', count: 3 })
    const t = resolveRound(s, { a: clean })
    expect(last(t).finance).toMatchObject({ sharesBought: 3, shareCash: -6 })
    expect(last(t).shares).toBe(47)
  })
})

// ---------------------------------------------------------------- 8. start demand and round 1 default

describe('start demand and the round 1 default (rule 8)', () => {
  it('total start demand is close to the start capacity, and the round 1 default fills the compute pools', () => {
    const s = createGame({ seed: 5, companies: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, isBot: false })) })
    const compute = s.pools.cloud.demand + s.pools.btc.demand + s.pools.ai.demand
    // 4 companies x 2 MW of datacenter.
    expect(compute).toBeCloseTo(8, 9)
    const t = resolveRound(s, {})
    for (const c of t.companies) {
      const r = c.history[0]
      expect(r.offered.cloud + r.offered.btc + r.offered.ai).toBeCloseTo(2, 9)
      expect(r.idle).toBeLessThan(0.1)
      expect(r.unallocatedMw).toBe(0)
    }
  })
})
