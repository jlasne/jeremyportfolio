import { describe, expect, it } from 'vitest'
import { resolveRound, validateDecision, type Decision, type GameState, type ValidationCode } from './index'
import { addLink, addOnline, company, decision, edit, game } from './test/helpers'

const base = game(['a', 'b'])
const plantId = company(base, 'a').buildings.find((b) => b.kind === 'plant')!.id
const dcId = company(base, 'a').buildings.find((b) => b.kind === 'dc')!.id
const withLoan = edit(base, 'a', (c) => c.loans.push({ id: 'n1', principal: 15, annualRate: 0.1, dueRound: 5, takenRound: 1 }))
const losing = edit(base, 'a', (c) => (c.treasury = -20))

function codes(state: GameState, d: unknown, id = 'a'): ValidationCode[] {
  return validateDecision(state, id, d as Decision).errors.map((e) => e.code)
}

const cases: [ValidationCode, GameState, unknown][] = [
  ['bankrupt', edit(base, 'a', (c) => (c.bankrupt = true)), decision()],
  ['finished', { ...base, finished: true }, decision()],
  ['negative', base, decision((d) => (d.power.internal = -1))],
  ['not_integer', base, decision((d) => (d.shares = { mode: 'issue', count: 1.5 }))],
  ['issue_and_buyback', base, { ...decision(), shares: { mode: 'both', count: 1 } }],
  ['shares_over_cap', base, decision((d) => (d.shares = { mode: 'issue', count: 3 }))],
  ['buyback_over_cash', withLoan, decision((d) => (d.shares = { mode: 'buyback', count: 2 }))],
  ['repay_unknown_loan', withLoan, decision((d) => (d.loans.repay = { nope: 1 }))],
  ['repay_over_principal', withLoan, decision((d) => (d.loans.repay = { n1: 16 }))],
  ['refinance_negative_treasury', edit(withLoan, 'a', (c) => ((c.treasury = -1), (c.loans[0].dueRound = 1))), decision((d) => ((d.loans.refinance = ['n1']), (d.forcedSales = [plantId])))],
  ['refinance_not_due', withLoan, decision((d) => (d.loans.refinance = ['n1']))],
  ['forced_sale_not_allowed', base, decision((d) => (d.forcedSales = [plantId]))],
  ['forced_sale_unknown', losing, decision((d) => (d.forcedSales = ['ghost', plantId, dcId]))],
  ['forced_sale_short', losing, decision((d) => (d.forcedSales = [plantId]))],
  ['build_invalid', base, decision((d) => d.builds.push({ kind: 'tower' as never }))],
  ['tile_taken', base, decision((d) => d.builds.push({ kind: 'plant', size: 'small', tile: [0, 0] }))],
  ['tile_out_of_plot', base, decision((d) => d.builds.push({ kind: 'plant', size: 'small', tile: [4, 0] }))],
  ['upgrade_invalid', base, decision((d) => (d.upgrades = ['ghost']))],
  ['over_treasury', base, decision((d) => d.builds.push({ kind: 'plant', size: 'big' }))],
  ['no_town_link', base, decision((d) => (d.power.town = 1))],
  ['over_town_link', edit(base, 'a', (c) => (addOnline(c, 'plant', 'small'), addLink(c, 'town', 1))), decision((d) => (d.power.town = 2))],
  ['over_internal_link', edit(base, 'a', (c) => addOnline(c, 'plant', 'small')), decision((d) => (d.power.internal = 3))],
  ['over_import_link', base, decision((d) => (d.rentMw = 1))],
  ['over_plant_capacity', base, decision((d) => ((d.power.internal = 2), (d.power.otherDc = 1)))],
  ['over_compute_capacity', base, decision((d) => ((d.power.internal = 1), (d.compute.ai = 2)))],
]

describe('validateDecision', () => {
  it('accepts the empty decision and the round 1 default', () => {
    expect(validateDecision(base, 'a', decision())).toEqual({ ok: true, errors: [] })
    expect(validateDecision(base, 'a', decision((d) => ((d.power.internal = 2), (d.compute.ai = 2)))).ok).toBe(true)
  })

  it.each(cases)('reports %s', (code, state, d) => {
    const res = validateDecision(state, 'a', d as Decision)
    expect(res.ok).toBe(false)
    expect(res.errors.map((e) => e.code)).toContain(code)
    for (const e of res.errors) expect(e.message.length).toBeGreaterThan(0)
  })

  it('covers every validation code', () => {
    const all: ValidationCode[] = [
      'bankrupt', 'finished', 'negative', 'not_integer', 'issue_and_buyback', 'shares_over_cap', 'buyback_over_cash',
      'repay_unknown_loan', 'repay_over_principal', 'refinance_negative_treasury', 'refinance_not_due',
      'forced_sale_not_allowed', 'forced_sale_unknown', 'forced_sale_short', 'build_invalid', 'tile_taken',
      'tile_out_of_plot', 'upgrade_invalid', 'over_treasury', 'no_town_link', 'over_town_link', 'over_internal_link',
      'over_import_link', 'over_plant_capacity', 'over_compute_capacity',
    ]
    expect(new Set(cases.map((c) => c[0]))).toEqual(new Set(all))
  })

  it('names the field of each issue', () => {
    const res = validateDecision(base, 'a', decision((d) => ((d.power.town = 1), d.builds.push({ kind: 'link', use: 'town', mw: 0 }))))
    expect(res.errors.find((e) => e.code === 'no_town_link')?.field).toBe('power.town')
    expect(res.errors.find((e) => e.code === 'build_invalid')?.field).toBe('builds.0')
  })

  it('a losing round is valid once the sales bring the treasury back to 0, or everything is sold', () => {
    const enough = edit(base, 'a', (c) => (c.treasury = -3))
    expect(validateDecision(enough, 'a', decision((d) => (d.forcedSales = [plantId]))).ok).toBe(true)
    expect(validateDecision(losing, 'a', decision((d) => (d.forcedSales = [plantId, dcId]))).ok).toBe(true)
  })

  it('cash from a loan or a share issue can be spent in the same phase', () => {
    const d = decision((x) => ((x.loans.take = 15), x.builds.push({ kind: 'plant', size: 'big' })))
    expect(validateDecision(base, 'a', d).ok).toBe(true)
    const e = decision((x) => ((x.shares = { mode: 'issue', count: 1 }), x.builds.push({ kind: 'plant', size: 'big' })))
    expect(validateDecision(base, 'a', e).ok).toBe(true)
  })

  it('this round only allocates what is online: a plant ordered now adds nothing yet', () => {
    const d = decision((x) => ((x.power.otherDc = 4), x.builds.push({ kind: 'plant', size: 'small' })))
    expect(codes(base, d)).toContain('over_plant_capacity')
    const next = resolveRound(base, { a: decision((x) => x.builds.push({ kind: 'plant', size: 'small' })) })
    expect(codes(next, decision((x) => (x.power.otherDc = 4)))).toEqual([])
  })

  it('never throws on garbage', () => {
    for (const junk of [null, undefined, 42, 'x', [], { power: 'lots' }, { builds: [null, 3] }, { loans: { repay: { n1: 'a' } } }]) {
      expect(() => validateDecision(withLoan, 'a', junk as never)).not.toThrow()
    }
    expect(codes(base, { power: { internal: Number.NaN } })).toContain('negative')
  })
})
