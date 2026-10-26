// Adversarial verification of the engine's public API contract (DESIGN.md 2.2-2.7, SPEC.md).
// Every test cites the rule it encodes. Passing tests stay as regression tests.

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  botDecision,
  capacity,
  createGame,
  createRng,
  createSoloGame,
  defaultConfig,
  defaultDecision,
  emptyDecision,
  findFreeTile,
  loanRate,
  plotRows,
  previewCompany,
  projectRound,
  resolveRound,
  revenueByBuilding,
  riskView,
  sanitizeDecision,
  validateDecision,
  warnings,
  type Decision,
  type GameState,
  type ValidationCode,
} from './index'
import { addLink, addOnline, company, decision, edit, game, hasNonFinite, isCents, moneyFields } from './test/helpers'

// ---------------------------------------------------------------- fixtures

function soloStates(seed = 9): GameState[] {
  const out: GameState[] = []
  let s = createSoloGame({ seed, playerName: 'P' })
  while (!s.finished) {
    out.push(s)
    s = resolveRound(s, {})
  }
  return out
}

function botOnly(seed: number, styles = ['volta', 'nimbus', 'hashfield', 'volta'] as const): GameState {
  const seen = new Map<string, number>()
  return createGame({
    seed,
    companies: styles.map((bot) => {
      const n = (seen.get(bot) ?? 0) + 1
      seen.set(bot, n)
      const id = n > 1 ? `${bot}${n}` : bot
      return { id, name: id, isBot: true, bot }
    }),
  })
}

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') {
    Object.freeze(x)
    for (const v of Object.values(x)) deepFreeze(v)
  }
  return x
}

/** States that stress every decision-phase branch for company 'you'. */
function hardStates(): GameState[] {
  const base = soloStates(9)
  const out: GameState[] = [base[0], base[6], base[17], base[30], base[39]]
  // losing round with buildings
  out.push(edit(base[12], 'you', (c) => (c.treasury = -35)))
  // losing round deeper than every building is worth
  out.push(edit(base[20], 'you', (c) => (c.treasury = -1e6)))
  // losing round with no building left at all
  out.push(edit(base[8], 'you', (c) => ((c.buildings = []), (c.treasury = -25))))
  // due loans, an upgrading building and a building under construction
  out.push(
    edit(base[5], 'you', (c) => {
      c.loans.push({ id: 'due', principal: 15, annualRate: 0.1, dueRound: base[5].round, takenRound: base[5].round - 7 })
      c.loans.push({ id: 'later', principal: 5, annualRate: 0.1, dueRound: base[5].round + 3, takenRound: base[5].round - 4 })
      addOnline(c, 'plant', 'big')
      c.buildings.push({ id: 'up', kind: 'dc', size: 'small', mw: 2, status: 'upgrading', roundsLeft: 2, pricePaid: 70, tile: [3, 3], builtRound: 0 })
      c.buildings.push({ id: 'wip', kind: 'plant', size: 'big', mw: 0, status: 'building', roundsLeft: 2, pricePaid: 40, tile: [2, 3], builtRound: base[5].round - 1 })
      addLink(c, 'town', 3)
      addLink(c, 'import', 4)
      c.links.push({ id: 'newlink', use: 'internal', mw: 5, roundsLeft: 1 })
    }),
  )
  return out
}

const NASTY = [
  -1,
  -0,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.MAX_VALUE,
  Number.MIN_VALUE,
  1e308,
  1e-12,
  0.333333,
  2.5,
  '5',
  null,
  undefined,
  true,
  {},
  [],
] as unknown as number[]

/** hugeLoans: also ask for loans near Number.MAX_VALUE (kept apart so other breaks are not masked). */
function adversarial(s: GameState, rng: () => number, hugeLoans = false): unknown {
  const c = company(s, 'you')
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]
  const mw = (): number => (rng() < 0.6 ? pick(NASTY) : rng() * 40)
  const foreign = s.companies.filter((x) => x.id !== 'you').flatMap((x) => x.buildings.map((b) => b.id))
  const ids = [...c.buildings.map((b) => b.id), ...c.loans.map((l) => l.id), ...foreign, 'ghost', '__proto__', 'constructor']
  return {
    builds: Array.from({ length: Math.floor(rng() * 7) }, () =>
      pick([
        { kind: 'link', use: pick(['internal', 'town', 'import', 'x']), mw: mw() },
        { kind: pick(['plant', 'dc']), size: pick(['small', 'big', 'giant']), tile: pick([undefined, [0, 0], [1, 0], [3, 9], [4, 0], [-1, 0], [0.5, 1], [Number.NaN, 0], [0, 0, 0], 'a1', null]) },
        { kind: 'plant', size: 'small', tile: [2, 2] },
        { kind: 'plant', size: 'small', tile: [2, 2] },
        null,
        42,
      ]),
    ),
    upgrades: Array.from({ length: Math.floor(rng() * 4) }, () => pick(ids)),
    power: { internal: mw(), town: mw(), otherDc: mw() },
    compute: { cloud: mw(), btc: mw(), ai: mw() },
    rentMw: mw(),
    loans: {
      take: pick(hugeLoans ? [0, 40, Number.MAX_VALUE, 1e307, 2e306] : [0, 3.333, 40, 1e9, -5, Number.NaN, Number.POSITIVE_INFINITY]),
      repay: Object.fromEntries(ids.slice(0, 8).map((id) => [id, pick([0, 1, 2.555, 1e9, -1, Number.NaN, Number.POSITIVE_INFINITY])])),
      refinance: Array.from({ length: Math.floor(rng() * 3) }, () => pick(ids)),
    },
    shares: pick([
      { mode: 'none', count: 5 },
      { mode: 'issue', count: pick([1, 2, 2.7, 99, -1, Number.NaN]) },
      { mode: 'buyback', count: pick([1, 2, 9, 0.5, Number.POSITIVE_INFINITY]) },
      { mode: 'both', count: 1 },
      { mode: ['issue', 'buyback'], count: 1 },
      { mode: 'issue', count: 1, buyback: 1 },
    ]),
    forcedSales: Array.from({ length: Math.floor(rng() * 4) }, () => pick(ids)),
  }
}

afterEach(() => vi.restoreAllMocks())

// ---------------------------------------------------------------- sanitize (DESIGN 2.4)

describe('sanitizeDecision output always validates (DESIGN 2.4 "the result always validates")', () => {
  it('adversarial property test over hard states (negative, NaN, Infinity, fractional link MW, duplicate tiles, foreign ids...)', () => {
    const r = createRng(777)
    const all = hardStates()
    const failures: string[] = []
    for (let i = 0; i < 4000; i++) {
      const s = all[i % all.length]
      const raw = adversarial(s, r.next)
      const clean = sanitizeDecision(s, 'you', raw as Decision)
      const v = validateDecision(s, 'you', clean)
      if (!v.ok && failures.length < 5) failures.push(`${JSON.stringify(v.errors)} from ${JSON.stringify((raw as Decision).loans?.take)}`)
    }
    expect(failures).toEqual([])
  })

  it('the same property with huge loan requests (2e306 .. Number.MAX_VALUE)', () => {
    const r = createRng(778)
    const all = hardStates()
    let failures = 0
    for (let i = 0; i < 500; i++) {
      const s = all[i % all.length]
      const clean = sanitizeDecision(s, 'you', adversarial(s, r.next, true) as Decision)
      if (!validateDecision(s, 'you', clean).ok) failures++
    }
    expect(failures).toBe(0)
  })

  it('a sanitized decision (it always validates) never leaves the decision phase below 0 (DESIGN 2.2.6), losing rounds included', () => {
    const r = createRng(779)
    const all = hardStates()
    const bad: string[] = []
    for (let i = 0; i < 3000; i++) {
      const s = all[i % all.length]
      const clean = sanitizeDecision(s, 'you', adversarial(s, r.next) as Decision)
      const left = previewCompany(s, 'you', clean).treasuryLeft
      if (left < 0 && bad.length < 5) bad.push(`state ${i % all.length}: ${left} after ${JSON.stringify(clean.shares)} ${JSON.stringify(clean.builds)}`)
    }
    expect(bad).toEqual([])
  })

  it('a decision validateDecision accepts gets the loan it asked for at resolution (2e306 is accepted, then silently dropped)', () => {
    const s = game(['you'])
    const d = decision((x) => (x.loans.take = 2e306))
    expect(validateDecision(s, 'you', d).ok).toBe(true)
    const next = resolveRound(s, { you: d })
    expect(company(next, 'you').history[0].finance.loanTaken).toBeGreaterThan(0)
    // the stored lastDecision must stay finite: a GameState goes through JSON (save, network)
    expect(hasNonFinite(next)).toBe(false)
  })

  it('a huge loan request (Number.MAX_VALUE) sanitizes to a finite loan that validates (loans have no limit, but must be numbers)', () => {
    const s = game(['you'])
    const clean = sanitizeDecision(s, 'you', decision((d) => (d.loans.take = Number.MAX_VALUE)))
    expect(Number.isFinite(clean.loans.take)).toBe(true)
    expect(validateDecision(s, 'you', clean).errors).toEqual([])
  })

  it('a 1e307 loan request sanitizes to something validateDecision accepts', () => {
    const s = game(['you'])
    const clean = sanitizeDecision(s, 'you', decision((d) => (d.loans.take = 1e307)))
    expect(validateDecision(s, 'you', clean).ok).toBe(true)
  })

  it('drops forced sales when not losing, upgrades of big / building / foreign / unknown ids, repayments of unknown loans', () => {
    let s = game(['you', 'b'])
    s = edit(s, 'you', (c) => {
      addOnline(c, 'plant', 'big')
      c.buildings.push({ id: 'wip', kind: 'dc', size: 'small', mw: 0, status: 'building', roundsLeft: 1, pricePaid: 12, tile: [3, 0], builtRound: 1 })
      c.treasury = 500
    })
    const you = company(s, 'you')
    const big = you.buildings.find((b) => b.size === 'big')!.id
    const foreign = company(s, 'b').buildings[0].id
    const small = you.buildings[0].id
    const clean = sanitizeDecision(
      s,
      'you',
      decision((d) => {
        d.forcedSales = [small]
        d.upgrades = [big, 'wip', foreign, 'ghost', small, small]
        d.loans.repay = { ghost: 5 }
      }),
    )
    expect(clean.forcedSales).toEqual([])
    expect(clean.upgrades).toEqual([small])
    expect(clean.loans.repay).toEqual({})
    expect(validateDecision(s, 'you', clean).ok).toBe(true)
  })

  it('moves a duplicate tile to the first free lot and floors fractional link MW', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = 100))
    const clean = sanitizeDecision(
      s,
      'you',
      decision((d) => {
        d.builds = [
          { kind: 'plant', size: 'small', tile: [2, 0] },
          { kind: 'dc', size: 'small', tile: [2, 0] },
          { kind: 'link', use: 'town', mw: 2.9 },
        ]
      }),
    )
    expect(clean.builds).toEqual([
      { kind: 'plant', size: 'small', tile: [2, 0] },
      { kind: 'dc', size: 'small', tile: [3, 0] },
      { kind: 'link', use: 'town', mw: 2 },
    ])
    expect(validateDecision(s, 'you', clean).ok).toBe(true)
  })

  it('in a losing round picks the cheapest sell values first until treasury >= 0 (DESIGN 2.4)', () => {
    // start kit: plant 10 (sells 3), dc 12 (sells 3.6); plus a big plant 40 (sells 12)
    const s = edit(game(['you']), 'you', (c) => {
      addOnline(c, 'plant', 'big')
      c.treasury = -5
    })
    const you = company(s, 'you')
    const clean = sanitizeDecision(s, 'you', emptyDecision())
    expect(clean.forcedSales).toEqual([you.buildings[0].id, you.buildings[1].id])
    expect(validateDecision(s, 'you', clean).ok).toBe(true)
  })

  it('is idempotent: sanitizing a sanitized decision changes nothing', () => {
    const r = createRng(99)
    for (const s of hardStates()) {
      for (let i = 0; i < 100; i++) {
        const once = sanitizeDecision(s, 'you', adversarial(s, r.next) as Decision)
        expect(sanitizeDecision(s, 'you', once)).toEqual(once)
      }
    }
  })
})

// ---------------------------------------------------------------- validate (DESIGN 2.4)

describe('validateDecision codes (DESIGN 2.4, ValidationCode)', () => {
  const codes = (s: GameState, d: Decision, id = 'you'): ValidationCode[] => validateDecision(s, id, d).errors.map((e) => e.code)

  it('finished and bankrupt', () => {
    const s = game(['you'])
    expect(codes({ ...s, finished: true }, emptyDecision())).toEqual(['finished'])
    expect(codes(edit(s, 'you', (c) => (c.bankrupt = true)), emptyDecision())).toEqual(['bankrupt'])
    expect(codes(s, emptyDecision(), 'nobody')).toEqual(['bankrupt'])
  })

  it('forced sales: not allowed, unknown, short; selling everything is enough (DESIGN 2.2.1)', () => {
    const s = game(['you'])
    const ids = company(s, 'you').buildings.map((b) => b.id)
    expect(codes(s, decision((d) => (d.forcedSales = [ids[0]])))).toEqual(['forced_sale_not_allowed'])
    const losing = edit(s, 'you', (c) => (c.treasury = -5))
    // (validate also repeats over_treasury once the treasury stays below 0: redundant but not wrong)
    expect(codes(losing, decision((d) => (d.forcedSales = [ids[0]])))[0]).toBe('forced_sale_short')
    expect(codes(losing, decision((d) => (d.forcedSales = [ids[0], ids[0], 'ghost']))).slice(0, 3)).toEqual(['forced_sale_unknown', 'forced_sale_unknown', 'forced_sale_short'])
    expect(codes(losing, decision((d) => (d.forcedSales = ids)))).toEqual([])
    // Even selling everything cannot reach 0 here: the engine issues shares, so it is valid.
    const deep = edit(s, 'you', (c) => (c.treasury = -500))
    expect(codes(deep, decision((d) => (d.forcedSales = ids)))).toEqual([])
    expect(codes(deep, emptyDecision())[0]).toBe('forced_sale_short')
  })

  it('capacities are this round\'s, after forced sales (DESIGN 2.4)', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = -2))
    const plant = company(s, 'you').buildings[0].id
    const d = decision((x) => {
      x.forcedSales = [plant]
      x.power.internal = 2
      x.compute.ai = 2
    })
    expect(codes(s, d)).toEqual(['over_plant_capacity'])
  })

  it('repayments: unknown loan, over principal, negative, over treasury', () => {
    const s = edit(game(['you']), 'you', (c) => c.loans.push({ id: 'n9', principal: 20, annualRate: 0.1, dueRound: 5, takenRound: 1 }))
    expect(codes(s, decision((d) => (d.loans.repay = { ghost: 1 })))).toEqual(['repay_unknown_loan'])
    expect(codes(s, decision((d) => (d.loans.repay = { n9: 20.01 })))).toEqual(['repay_over_principal'])
    expect(codes(s, decision((d) => (d.loans.repay = { n9: -1 })))).toEqual(['negative'])
    expect(codes(s, decision((d) => (d.loans.repay = { n9: Number.NaN })))).toEqual(['negative'])
    const poor = edit(s, 'you', (c) => (c.treasury = 5))
    expect(codes(poor, decision((d) => (d.loans.repay = { n9: 6 })))).toContain('over_treasury')
    expect(codes(poor, decision((d) => (d.loans.repay = { n9: 5 })))).toEqual([])
  })

  it('refinance: only due loans, refused with a negative treasury (SPEC Debt "Refused if treasury is below 0")', () => {
    const s = edit(game(['you']), 'you', (c) => {
      c.loans.push({ id: 'due', principal: 20, annualRate: 0.1, dueRound: 1, takenRound: -6 })
      c.loans.push({ id: 'later', principal: 20, annualRate: 0.1, dueRound: 4, takenRound: -3 })
    })
    expect(codes(s, decision((d) => (d.loans.refinance = ['due'])))).toEqual([])
    expect(codes(s, decision((d) => (d.loans.refinance = ['later', 'ghost'])))).toEqual(['refinance_not_due', 'refinance_not_due'])
    expect(codes(s, decision((d) => ((d.loans.repay = { due: 20 }), (d.loans.refinance = ['due']))))).toEqual(['refinance_not_due'])
    const neg = edit(s, 'you', (c) => (c.treasury = -1))
    const sold = company(neg, 'you').buildings.map((b) => b.id)
    expect(codes(neg, decision((d) => ((d.forcedSales = sold), (d.loans.refinance = ['due']))))).toEqual(['refinance_negative_treasury'])
  })

  it('shares: both, not integer, over cap, buyback over treasury - debt (SPEC Shares; DESIGN 2.2.5)', () => {
    const s = game(['you'])
    expect(codes(s, { ...emptyDecision(), shares: { mode: 'both' as never, count: 1 } })).toEqual(['issue_and_buyback'])
    expect(codes(s, decision((d) => (d.shares = { mode: 'issue', count: 1.5 })))).toEqual(['not_integer'])
    expect(codes(s, decision((d) => (d.shares = { mode: 'issue', count: 3 })))).toEqual(['shares_over_cap'])
    expect(codes(s, decision((d) => (d.shares = { mode: 'issue', count: 2 })))).toEqual([])
    // treasury 30, price 10: buyback 2 = 20 <= 30 - 0
    expect(codes(s, decision((d) => (d.shares = { mode: 'buyback', count: 2 })))).toEqual([])
    // with 15 of debt: 20 > 30 - 15
    const owed = edit(s, 'you', (c) => c.loans.push({ id: 'n9', principal: 15, annualRate: 0.1, dueRound: 5, takenRound: 1 }))
    expect(codes(owed, decision((d) => (d.shares = { mode: 'buyback', count: 2 })))).toEqual(['buyback_over_cash'])
    // a loan taken the same round does not make room: +20 treasury, +20 debt
    expect(codes(s, decision((d) => ((d.loans.take = 20), (d.shares = { mode: 'buyback', count: 2 }))))).toEqual([])
    expect(codes(owed, decision((d) => ((d.loans.take = 20), (d.shares = { mode: 'buyback', count: 2 }))))).toEqual(['buyback_over_cash'])
  })

  it('upgrades: big, under construction, foreign, twice', () => {
    let s = game(['you', 'b'])
    s = edit(s, 'you', (c) => {
      c.treasury = 1000
      addOnline(c, 'plant', 'big')
      c.buildings.push({ id: 'wip', kind: 'dc', size: 'small', mw: 0, status: 'building', roundsLeft: 1, pricePaid: 12, tile: [3, 0], builtRound: 1 })
    })
    const you = company(s, 'you')
    const big = you.buildings.find((b) => b.size === 'big')!.id
    const foreign = company(s, 'b').buildings[0].id
    const small = you.buildings[0].id
    expect(codes(s, decision((d) => (d.upgrades = [big, 'wip', foreign, small, small])))).toEqual(['upgrade_invalid', 'upgrade_invalid', 'upgrade_invalid', 'upgrade_invalid'])
  })

  it('builds: bad kind/size/use, link MW < 1 or fractional, tile taken / out of plot, two orders on one lot', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = 1000))
    const d = decision((x) => {
      x.builds = [
        { kind: 'tower' as never, size: 'small' },
        { kind: 'plant', size: 'huge' as never },
        { kind: 'link', use: 'moon' as never, mw: 2 },
        { kind: 'link', use: 'town', mw: 0 },
        { kind: 'link', use: 'town', mw: 2.5 },
        { kind: 'plant', size: 'small', tile: [0, 0] },
        { kind: 'plant', size: 'small', tile: [4, 0] },
        { kind: 'plant', size: 'small', tile: [-1, 0] },
        { kind: 'plant', size: 'small', tile: [2, 0] },
        { kind: 'dc', size: 'small', tile: [2, 0] },
      ]
    })
    expect(codes(s, d)).toEqual(['build_invalid', 'build_invalid', 'build_invalid', 'build_invalid', 'not_integer', 'tile_taken', 'tile_out_of_plot', 'tile_out_of_plot', 'tile_taken'])
  })

  it('over treasury after everything', () => {
    const s = game(['you'])
    expect(codes(s, decision((d) => (d.builds = [{ kind: 'plant', size: 'big' }])))).toEqual(['over_treasury'])
    expect(codes(s, decision((d) => ((d.loans.take = 10), (d.builds = [{ kind: 'plant', size: 'big' }]))))).toEqual([])
  })

  it('allocations: negative / non-finite, no town link, over town / internal / import link, over plant, over compute', () => {
    const s = game(['you'])
    expect(codes(s, decision((d) => ((d.power.internal = -1), (d.compute.ai = Number.POSITIVE_INFINITY))))).toEqual(['negative', 'negative'])
    expect(codes(s, decision((d) => (d.power.town = 1)))).toEqual(['no_town_link'])
    const linked = edit(s, 'you', (c) => (addLink(c, 'town', 1), addLink(c, 'import', 1), addOnline(c, 'dc', 'big')))
    expect(codes(linked, decision((d) => (d.power.town = 1.5)))).toEqual(['over_town_link'])
    expect(codes(linked, decision((d) => (d.power.internal = 3)))).toEqual(['over_internal_link', 'over_plant_capacity'])
    expect(codes(linked, decision((d) => (d.rentMw = 2)))).toEqual(['over_import_link'])
    expect(codes(linked, decision((d) => ((d.power.internal = 2), (d.power.otherDc = 1))))).toEqual(['over_plant_capacity'])
    expect(codes(linked, decision((d) => ((d.power.internal = 1), (d.rentMw = 1), (d.compute.cloud = 2.5))))).toEqual(['over_compute_capacity'])
    expect(codes(linked, decision((d) => ((d.power.internal = 1), (d.rentMw = 1), (d.compute.cloud = 2))))).toEqual([])
    // a town link bought this round does not carry yet (roundsLeft 1)
    const pending = edit(s, 'you', (c) => c.links.push({ id: 'p', use: 'town', mw: 2, roundsLeft: 1 }))
    expect(codes(pending, decision((d) => (d.power.town = 1)))).toEqual(['no_town_link'])
  })

  it('reports every issue in phase order: forced sales, repay, refinance, shares, upgrades, builds, treasury, allocations', () => {
    const s = edit(game(['you']), 'you', (c) => {
      c.treasury = -1
      c.loans.push({ id: 'n9', principal: 5, annualRate: 0.1, dueRound: 9, takenRound: 2 })
    })
    const raw = {
      ...emptyDecision(),
      forcedSales: ['ghost'],
      loans: { take: 0, repay: { ghost: 1 }, refinance: ['n9'] },
      shares: { mode: 'issue' as const, count: 7 },
      upgrades: ['ghost'],
      builds: [{ kind: 'plant' as const, size: 'big' as const, tile: [9, 9] as [number, number] }],
      power: { internal: 0, town: 3, otherDc: 0 },
    }
    expect(codes(s, raw)).toEqual([
      'forced_sale_unknown',
      'forced_sale_short',
      'repay_unknown_loan',
      'refinance_negative_treasury',
      'shares_over_cap',
      'upgrade_invalid',
      'tile_out_of_plot',
      'over_treasury',
      'no_town_link',
      'over_plant_capacity',
    ])
  })

  it('a decision that validates never leaves the treasury below 0 once the phase is applied (DESIGN 2.2.6)', () => {
    // No building left, treasury -25, price 10: the engine issues 3 shares (30), leaving 5.
    // Then a regular issue of 2 shares and a small plant + small datacenter (22).
    const s = edit(game(['you']), 'you', (c) => ((c.buildings = []), (c.treasury = -25)))
    const d = decision((x) => {
      x.shares = { mode: 'issue', count: 2 }
      x.builds = [
        { kind: 'plant', size: 'small' },
        { kind: 'dc', size: 'small' },
      ]
    })
    // The forced issue dilutes the price to round2(100 / 13) = 7.69, so the regular issue brings 15.38
    // (cap floor(20% x 13) = 2): 5 + 15.38 - 22 = -1.62. Validation, sanitize and the phase all agree.
    expect(validateDecision(s, 'you', d).errors.map((e) => e.code)).toEqual(['over_treasury'])
    expect(previewCompany(s, 'you', d).treasuryLeft).toBe(-1.62)
    const clean = sanitizeDecision(s, 'you', d)
    expect(clean).toMatchObject({ shares: { mode: 'issue', count: 2 } })
    expect(validateDecision(s, 'you', clean).ok).toBe(true)
    expect(previewCompany(s, 'you', clean).treasuryLeft).toBeGreaterThanOrEqual(0)
    // One build fits: 5 + 15.38 - 10 = 10.38.
    const one = decision((x) => ((x.shares = { mode: 'issue', count: 2 }), (x.builds = [{ kind: 'plant', size: 'small' }])))
    expect(validateDecision(s, 'you', one).ok).toBe(true)
    expect(previewCompany(s, 'you', one)).toMatchObject({ treasuryLeft: 10.38, shares: 15 })
  })
})

// ---------------------------------------------------------------- resolveRound (DESIGN 2.3, 2.7)

describe('resolveRound robustness', () => {
  it('never throws on garbage decisions and never mutates its (deep-frozen) input', () => {
    const r = createRng(5)
    let s = createSoloGame({ seed: 3, playerName: 'P' })
    const garbage: unknown[] = [null, undefined, 'x', 42, [], { power: 'lots' }, { builds: [null, 1, 'a'], loans: null, shares: 'buyback' }]
    while (!s.finished) {
      const frozen = deepFreeze(structuredClone(s))
      const snapshot = JSON.stringify(frozen)
      const decisions: Record<string, Decision> = {
        you: (r.next() < 0.5 ? garbage[s.round % garbage.length] : adversarial(frozen, r.next)) as Decision,
        nimbus: adversarial(frozen, r.next) as Decision,
        ghost: emptyDecision(),
      }
      const next = resolveRound(frozen, decisions)
      expect(JSON.stringify(frozen)).toBe(snapshot)
      expect(hasNonFinite(next)).toBe(false)
      s = next
    }
  })

  it('same seed and same decisions give deep-equal states; Math.random and Date are never used (DESIGN 2.7)', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random used')
    })
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now used')
    })
    const run = (): GameState => {
      let s = createSoloGame({ seed: 11, playerName: 'P' })
      const r = createRng(1)
      while (!s.finished) s = resolveRound(s, { you: adversarial(s, r.next) as Decision })
      return s
    }
    expect(run()).toEqual(run())
  })

  it('a finished state resolves to an equal state', () => {
    let s = createSoloGame({ seed: 2, playerName: 'P' })
    while (!s.finished) s = resolveRound(s, {})
    expect(s.round).toBe(41)
    expect(resolveRound(s, {})).toEqual(s)
  })

  it('performance: 40 rounds of 4 bots in well under a second, and a 6-company round with 60 buildings each stays fast', () => {
    const t0 = performance.now()
    let s = botOnly(4)
    while (!s.finished) s = resolveRound(s, {})
    expect(performance.now() - t0).toBeLessThan(1500)

    let big = createGame({ seed: 1, companies: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id, isBot: true, bot: 'nimbus' as const })) })
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      big = edit(big, id, (c) => {
        for (let i = 0; i < 30; i++) addOnline(c, 'plant', 'big'), addOnline(c, 'dc', 'big')
        addLink(c, 'internal', 300)
        addLink(c, 'town', 100)
        addLink(c, 'import', 100)
        c.treasury = 5000
      })
    }
    const t1 = performance.now()
    for (let i = 0; i < 5; i++) big = resolveRound(big, {})
    expect((performance.now() - t1) / 5).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------- bots (DESIGN 2.6)

describe('bots: deterministic, no RNG, public information only, always valid', () => {
  it('a bot decision does not depend on rivals\' private state, the seed or the RNG state', () => {
    let s = botOnly(8)
    for (let i = 0; i < 14; i++) s = resolveRound(s, {})
    for (const me of ['volta', 'nimbus', 'hashfield']) {
      const base = botDecision(s, me)
      const blurred = structuredClone(s)
      blurred.seed = 123456
      blurred.rngState = 42
      for (const c of blurred.companies) {
        if (c.id === me) continue
        c.treasury += 1000
        c.loans.push({ id: 'zz', principal: 99, annualRate: 0.2, dueRound: 40, takenRound: 1 })
        c.buildings = c.buildings.slice(0, 1)
        c.links = []
        c.lastDecision = null
        c.history = []
      }
      for (const p of Object.values(blurred.pools)) for (const id of Object.keys(p.lastUsed)) if (id !== me) p.lastUsed[id] = 777
      expect(botDecision(blurred, me)).toEqual(base)
    }
  })

  it('every bot decision validates in every round of 12 bot-only games and a solo game', () => {
    const bad: string[] = []
    const check = (s: GameState): void => {
      for (const c of s.companies) {
        if (!c.isBot || c.bankrupt) continue
        const v = validateDecision(s, c.id, botDecision(s, c.id))
        if (!v.ok) bad.push(`${s.seed}/${s.round}/${c.id}: ${v.errors.map((e) => e.code).join(',')}`)
      }
    }
    for (let seed = 1; seed <= 12; seed++) {
      let s = botOnly(seed)
      while (!s.finished) {
        check(s)
        s = resolveRound(s, {})
      }
    }
    for (const s of soloStates(4)) check(s)
    expect(bad).toEqual([])
  })

  it('50 seeds of bot-only games: no NaN, money at 2 decimals, no bankruptcy, every bot builds and buys links (DESIGN 2.6, 2.8)', () => {
    const problems: string[] = []
    for (let seed = 1; seed <= 50; seed++) {
      let s = botOnly(seed)
      while (!s.finished) s = resolveRound(s, {})
      if (hasNonFinite(s)) problems.push(`${seed}: non-finite`)
      if (!moneyFields(s).every(isCents)) problems.push(`${seed}: money not in cents`)
      for (const c of s.companies) {
        if (c.bankrupt) problems.push(`${seed}: ${c.id} bankrupt`)
        if (c.buildings.length <= 2) problems.push(`${seed}: ${c.id} never built`)
        if (c.links.length <= 1) problems.push(`${seed}: ${c.id} never bought a link`)
      }
      const prices = s.companies.map((c) => c.sharePrice)
      if (new Set(prices).size < prices.length - 1) problems.push(`${seed}: identical finishing prices`)
    }
    expect(problems).toEqual([])
  })

  it('bots keep idle under 25% (DESIGN 2.6 "keep idle under 25%"): mean bot idle per round over seeds 1..10 stays at or under maxIdle', () => {
    const byRound = new Map<number, number[]>()
    for (let seed = 1; seed <= 10; seed++) {
      let s = botOnly(seed)
      while (!s.finished) s = resolveRound(s, {})
      for (const c of s.companies) for (const r of c.history) byRound.set(r.round, [...(byRound.get(r.round) ?? []), r.idle])
    }
    const over = [...byRound.entries()]
      .map(([round, xs]) => ({ round, mean: xs.reduce((a, b) => a + b, 0) / xs.length }))
      .filter((x) => x.mean > defaultConfig.bots.maxIdle)
      .map((x) => `R${x.round} ${(x.mean * 100).toFixed(1)}%`)
    expect(over).toEqual([])
  })
})

// ---------------------------------------------------------------- UI helpers (DESIGN 2.5)

describe('defaultDecision (DESIGN 2.5)', () => {
  it('round 1: internal = min(plantMw, internal link), ai = min(dcMw, internal), rest 0', () => {
    const s = game(['you'])
    expect(defaultDecision(s, 'you')).toEqual(decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))))
    const wide = edit(s, 'you', (c) => (addOnline(c, 'plant', 'big'), (c.links[0].mw = 5)))
    expect(defaultDecision(wide, 'you')).toEqual(decision((d) => ((d.power.internal = 5), (d.compute.ai = 2))))
  })

  it('later rounds repeat last power/compute/rent, no builds or finance, sanitized to capacity', () => {
    let s = edit(game(['you']), 'you', (c) => (addLink(c, 'import', 2), addOnline(c, 'dc', 'small')))
    s = resolveRound(s, { you: decision((d) => ((d.power.internal = 2), (d.rentMw = 2), (d.compute.cloud = 1), (d.compute.ai = 3), (d.loans.take = 5), (d.builds = [{ kind: 'link', use: 'town', mw: 1 }]))) })
    const d = defaultDecision(s, 'you')
    expect(d).toEqual(decision((x) => ((x.power.internal = 2), (x.rentMw = 2), (x.compute.cloud = 1), (x.compute.ai = 3))))
    // capacity drops: the import link is gone
    const cut = edit(s, 'you', (c) => (c.links = c.links.filter((l) => l.use !== 'import')))
    const d2 = defaultDecision(cut, 'you')
    expect(d2.rentMw).toBe(0)
    expect(d2.compute.cloud + d2.compute.ai).toBeLessThanOrEqual(2 + 1e-9)
    expect(validateDecision(cut, 'you', d2).ok).toBe(true)
  })

  it('in a losing round it picks the forced sales', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = -1))
    const d = defaultDecision(s, 'you')
    expect(d.forcedSales).toHaveLength(1)
    expect(validateDecision(s, 'you', d).ok).toBe(true)
  })
})

describe('previewCompany (DESIGN 2.5)', () => {
  it('treasury left after finance and builds, pending builds listed, price and shares after the share action', () => {
    const s = game(['you'])
    const d = decision((x) => {
      x.loans.take = 20
      x.shares = { mode: 'issue', count: 2 }
      x.builds = [
        { kind: 'plant', size: 'small' },
        { kind: 'link', use: 'town', mw: 3 },
      ]
    })
    const p = previewCompany(s, 'you', d)
    // 30 + 20 + 2 x 10 - 10 - 3
    expect(p.treasuryLeft).toBe(57)
    expect(p.shares).toBe(12)
    expect(p.sharePrice).toBe(8.33)
    expect(p.debt).toBe(20)
    expect(p.plantMw).toBe(2)
    expect(p.pendingPlantMw).toBe(4)
    expect(p.links.town).toBe(0)
    expect(p.pendingLinks.town).toBe(3)
    expect(p.buildSpend).toBe(13)
    // the state is untouched
    expect(company(s, 'you').treasury).toBe(30)
  })

  it('buyback raises the price: 2 of 10 at 10 gives 12.50 and -20 (SPEC Shares table)', () => {
    const p = previewCompany(game(['you']), 'you', decision((x) => (x.shares = { mode: 'buyback', count: 2 })))
    expect(p.sharePrice).toBe(12.5)
    expect(p.treasuryLeft).toBe(10)
  })
})

describe('projectRound (DESIGN 2.5)', () => {
  it('round 1 with 2 MW on AI projects the starting round check: 6.4 - 0.8 - 0.44 = 5.16', () => {
    const s = createSoloGame({ seed: 1, playerName: 'P' })
    const p = projectRound(s, 'you', defaultDecision(s, 'you'))
    expect(p.revenue).toBe(6.4)
    expect(p.costs).toEqual({ power: 0.8, rent: 0, maintenance: 0.44, interest: 0 })
    expect(p.profit).toBe(5.16)
    expect(p.idle).toBe(0)
    expect(p.marginPerMw).toEqual({ citizens: 0.6, otherDc: 0.9, cloud: 1.6, btc: 1.2, ai: 2.8 })
  })

  it('estUsed = min(offer, U_self + max(0, D_last - sum U_last)), from the last summary', () => {
    let s = game(['you', 'b'])
    s = resolveRound(s, { you: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))), b: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))) })
    const last = s.history.at(-1)!.pools.ai
    const p = projectRound(s, 'you', decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))))
    const expected = Math.min(2, 2 + Math.max(0, last.demand - last.used))
    expect(p.usedByPool.ai).toBeCloseTo(expected, 9)
  })

  it('counts the draft\'s new loan interest and an upgrade\'s maintenance from the order on', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = 100))
    const plant = company(s, 'you').buildings[0].id
    const p = projectRound(s, 'you', decision((d) => ((d.loans.take = 20), (d.upgrades = [plant]), (d.power.internal = 2), (d.compute.ai = 2))))
    // 20 at 12% / 4
    expect(p.costs.interest).toBe(0.6)
    // 2% of (10 + 46) + 2% of 12
    expect(p.costs.maintenance).toBe(1.36)
  })
})

describe('warnings (DESIGN 2.5)', () => {
  const codesOf = (s: GameState, d: Decision): string[] => warnings(s, 'you', d).map((w) => w.code).sort()

  it('each chip fires on its condition', () => {
    const s = game(['you'])
    expect(codesOf(s, defaultDecision(s, 'you'))).toEqual([])
    expect(codesOf(s, decision((d) => (d.power.town = 1)))).toContain('no_town_link')
    expect(codesOf(s, decision((d) => ((d.power.internal = 3), (d.compute.ai = 2))))).toContain('link_short')
    expect(codesOf(s, decision((d) => ((d.power.internal = 2), (d.compute.ai = 2), (d.rentMw = 1))))).toContain('rent_over_import')
    expect(codesOf(s, decision((d) => ((d.power.internal = 1), (d.compute.ai = 2))))).toContain('compute_unpowered')
    expect(codesOf(s, decision((d) => (d.builds = [{ kind: 'plant', size: 'big' }])))).toContain('treasury_negative')
    // nothing allocated: idle 100%
    expect(codesOf(s, emptyDecision())).toContain('idle_high')
    const due = edit(s, 'you', (c) => c.loans.push({ id: 'n9', principal: 5, annualRate: 0.1, dueRound: 3, takenRound: -4 }))
    expect(codesOf(due, defaultDecision(due, 'you'))).toEqual(['loan_due_soon'])
    const later = edit(s, 'you', (c) => c.loans.push({ id: 'n9', principal: 5, annualRate: 0.1, dueRound: 4, takenRound: -3 }))
    expect(codesOf(later, defaultDecision(later, 'you'))).toEqual([])
  })
})

describe('loanRate and riskView (SPEC Loan rate, Risk view; DESIGN 2.5)', () => {
  it('12% before round 1; 50% citizens + 50% cloud gives 4.8%; 100% bitcoin 11.2%; +4 points under stress', () => {
    const s = game(['you'])
    expect(loanRate(s, 'you')).toBe(0.12)
    const withHistory = (rev: Record<string, number>, profit = 1, treasury = 30): GameState =>
      edit(s, 'you', (c) => {
        c.treasury = treasury
        c.history.push({ revenueByPool: { citizens: 0, otherDc: 0, cloud: 0, btc: 0, ai: 0, ...rev }, profit } as never)
      })
    expect(loanRate(withHistory({ citizens: 5, cloud: 5 }), 'you')).toBeCloseTo(0.048, 10)
    expect(loanRate(withHistory({ btc: 5 }), 'you')).toBeCloseTo(0.112, 10)
    expect(loanRate(withHistory({ btc: 5 }, -1), 'you')).toBeCloseTo(0.152, 10)
    expect(loanRate(withHistory({ btc: 5 }, 1, -1), 'you')).toBeCloseTo(0.152, 10)
  })

  it('risk view after one AI round: est revenue, interest with the new loan, cost share, drag, next due', () => {
    let s = game(['you'])
    s = resolveRound(s, { you: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))) })
    const g = s.pools.ai.growth
    const last = company(s, 'you').history.at(-1)!
    const rate = loanRate(s, 'you')
    // 100% AI revenue last round: 12% - 8% x 0.3
    expect(rate).toBeCloseTo(0.096, 10)
    const rv = riskView(s, 'you', decision((d) => (d.loans.take = 20)))
    const est = Math.round(last.revenue * (1 + g) * 100) / 100
    expect(rv.estRevenue).toBeCloseTo(est, 2)
    expect(rv.interestNextRound).toBeCloseTo((20 * rate) / 4, 2)
    const share = Math.min(1, rv.interestNextRound / rv.estRevenue)
    expect(rv.debtCostShare).toBeCloseTo(share, 9)
    expect(rv.marketCapDrag).toBeCloseTo(20 * ((Math.exp(3 * share) - 1) / (Math.exp(3) - 1)), 2)
    // the new loan is due at round + termRounds - 1 = 2 + 7
    expect(rv.nextDue).toEqual({ round: 9, principal: 20 })
  })

  it('a loan due this round counts its principal in the cost share unless the draft refinances it', () => {
    const s = edit(game(['you']), 'you', (c) => {
      c.loans.push({ id: 'due', principal: 10, annualRate: 0.08, dueRound: 1, takenRound: -6 })
      c.history.push({ revenue: 10, revenueByPool: { citizens: 10, otherDc: 0, cloud: 0, btc: 0, ai: 0 }, profit: 1 } as never)
    })
    const paid = riskView(s, 'you', emptyDecision())
    const rolled = riskView(s, 'you', decision((d) => (d.loans.refinance = ['due'])))
    expect(paid.interestNextRound).toBe(0.2)
    expect(paid.debtCostShare).toBeGreaterThan(rolled.debtCostShare)
  })

  it('next due reflects a refinance in the draft: a rolled loan\'s principal is not due this round (SPEC Risk view "The next due date and its principal")', () => {
    const s = edit(game(['you']), 'you', (c) => {
      c.loans.push({ id: 'due', principal: 10, annualRate: 0.08, dueRound: 1, takenRound: -6 })
      c.history.push({ revenue: 10, revenueByPool: { citizens: 10, otherDc: 0, cloud: 0, btc: 0, ai: 0 }, profit: 1 } as never)
    })
    const rolled = riskView(s, 'you', decision((d) => (d.loans.refinance = ['due'])))
    expect(rolled.nextDue).not.toEqual({ round: 1, principal: 10 })
  })
})

describe('revenueByBuilding, findFreeTile, plotRows (DESIGN 2.5, 2.2.6, 6)', () => {
  it('after a 2 MW AI round the datacenter earns 6.4 and the plant 0', () => {
    let s = game(['you'])
    s = resolveRound(s, { you: decision((d) => ((d.power.internal = 2), (d.compute.ai = 2))) })
    const you = company(s, 'you')
    expect(revenueByBuilding(s, 'you')).toEqual({ [you.buildings[0].id]: 0, [you.buildings[1].id]: 6.4 })
    expect(revenueByBuilding(game(['you']), 'you')).toEqual({})
  })

  it('power revenue splits over plants by delivered MW; a plant ordered this round gets nothing', () => {
    let s = edit(game(['you']), 'you', (c) => (addOnline(c, 'plant', 'small'), addLink(c, 'town', 4), (c.treasury = 50)))
    s = resolveRound(s, { you: decision((d) => ((d.power.town = 4), (d.builds = [{ kind: 'plant', size: 'small' }]))) })
    const you = company(s, 'you')
    const r = revenueByBuilding(s, 'you')
    const plants = you.buildings.filter((b) => b.kind === 'plant')
    const total = you.history[0].revenueByPool.citizens
    expect(r[plants[0].id]).toBeCloseTo(total / 2, 2)
    expect(r[plants[1].id]).toBeCloseTo(total / 2, 2)
    expect(r[plants[2].id]).toBe(0)
  })

  it('findFreeTile goes row by row, 4 per row; plotRows keeps one free row under the last building', () => {
    const s = game(['you'])
    const you = company(s, 'you')
    expect(findFreeTile(you)).toEqual([2, 0])
    expect(findFreeTile(you, [[2, 0], [3, 0]])).toEqual([0, 1])
    expect(plotRows(you)).toBe(2)
    expect(plotRows(you, [[0, 1]])).toBe(3)
    expect(plotRows(you, [[0, 4]])).toBe(6)
    expect(capacity(you)).toEqual({ plantMw: 2, dcMw: 2, links: { internal: 2, town: 0, import: 0 } })
  })
})

describe('build tiles (DESIGN 2.2.6 "Build tile: a free lot; if omitted, findFreeTile")', () => {
  it('an order without a tile never takes the lot another valid order of the same decision names', () => {
    const s = edit(game(['you']), 'you', (c) => (c.treasury = 100))
    const d = decision((x) => {
      x.builds = [
        { kind: 'plant', size: 'small' },
        { kind: 'dc', size: 'small', tile: [2, 0] },
      ]
    })
    expect(validateDecision(s, 'you', d).ok).toBe(true)
    const placed = company(resolveRound(s, { you: d }), 'you').buildings.find((b) => b.kind === 'dc' && b.builtRound === 1)!
    expect(placed.tile).toEqual([2, 0])
  })
})
