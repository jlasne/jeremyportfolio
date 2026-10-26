// Strict validation (DESIGN 2.4): every issue, in phase order, each with a code.

import { buildCost, capacity, findCompany, inPlot, isTile, markTile, sellValue, takenTiles, tileFree, upgradeCost } from './assets'
import { defaultConfig } from './config'
import { MW_EPSILON } from './constants'
import { readDecision } from './decision'
import { round2 } from './money'
import { currentPrice, forcedIssue, type ShareBook } from './phase'
import type { Building, Config, GameState, ValidationCode, ValidationIssue, ValidationResult } from './types'

const isNum = (x: number): boolean => Number.isFinite(x)

export function validateDecision(state: GameState, companyId: string, raw: unknown, config: Config = defaultConfig): ValidationResult {
  const errors: ValidationIssue[] = []
  const push = (code: ValidationCode, message: string, field?: string): void => {
    errors.push(field === undefined ? { code, message } : { code, message, field })
  }
  const done = (): ValidationResult => ({ ok: errors.length === 0, errors })

  if (state.finished) {
    push('finished', 'The game is over.')
    return done()
  }
  const company = findCompany(state, companyId)
  if (!company || company.bankrupt) {
    push('bankrupt', company ? 'This company is bankrupt and out of the game.' : `Unknown company ${companyId}.`)
    return done()
  }

  const d = readDecision(raw)
  const startTreasury = company.treasury
  let treasury = startTreasury

  // Forced sales. A forced share issue dilutes the book that the share action below is priced on.
  let book: ShareBook = company
  let buildings: Building[] = company.buildings
  if (d.forcedSales.length > 0 && startTreasury >= 0) {
    push('forced_sale_not_allowed', 'Buildings can only be sold in a losing round.', 'forcedSales')
  } else if (startTreasury < 0) {
    const sold = new Set<string>()
    d.forcedSales.forEach((id, i) => {
      const b = company.buildings.find((x) => x.id === id)
      if (!b || sold.has(id)) {
        push('forced_sale_unknown', `No building ${id} to sell.`, `forcedSales.${i}`)
        return
      }
      sold.add(id)
      treasury = round2(treasury + sellValue(b, config))
    })
    buildings = company.buildings.filter((b) => !sold.has(b.id))
    if (treasury < 0 && buildings.length > 0) {
      push('forced_sale_short', 'Sell more buildings: the treasury must get back to 0.', 'forcedSales')
    } else if (treasury < 0) {
      // Everything is sold: the engine issues shares until the treasury is back to 0.
      const issue = forcedIssue(book, treasury)
      if (issue) {
        treasury = round2(treasury + issue.cash)
        book = issue.book
      }
    }
  }
  const afterSales = { ...company, buildings }

  // Early repayments.
  const principal = new Map(company.loans.map((l) => [l.id, l.principal]))
  for (const [id, amount] of Object.entries(d.loans.repay)) {
    const field = `loans.repay.${id}`
    if (!isNum(amount) || amount < 0) {
      push('negative', 'A repayment must be a number of 0 or more.', field)
      continue
    }
    const left = principal.get(id)
    if (left === undefined) {
      push('repay_unknown_loan', `No loan ${id}.`, field)
      continue
    }
    if (round2(amount) > left) {
      push('repay_over_principal', 'You cannot repay more than the loan principal.', field)
      continue
    }
    treasury = round2(treasury - round2(amount))
    principal.set(id, round2(left - round2(amount)))
    if (treasury < 0) push('over_treasury', 'Not enough treasury for this repayment.', field)
  }

  // Refinance.
  d.loans.refinance.forEach((id, i) => {
    const field = `loans.refinance.${i}`
    if (startTreasury < 0) {
      push('refinance_negative_treasury', 'Refinancing is refused while the treasury is below 0.', field)
      return
    }
    const loan = company.loans.find((l) => l.id === id)
    if (!loan || loan.dueRound !== state.round || (principal.get(id) ?? 0) <= 0) {
      push('refinance_not_due', 'Only a loan due this round can be refinanced.', field)
    }
  })

  // New loan.
  let debt = round2([...principal.values()].reduce((a, b) => a + b, 0))
  if (!isNum(d.loans.take) || d.loans.take < 0) {
    push('negative', 'A loan must be a number of 0 or more.', 'loans.take')
  } else {
    treasury = round2(treasury + round2(d.loans.take))
    debt = round2(debt + round2(d.loans.take))
  }

  // Shares.
  if (d.sharesConflict) {
    push('issue_and_buyback', 'Issue or buy back shares, never both in one round.', 'shares')
  } else if (d.shares.mode !== 'none') {
    const count = d.shares.count
    const shares = book.shares
    if (!isNum(count) || count < 0) push('negative', 'Share count must be 0 or more.', 'shares.count')
    else if (!Number.isInteger(count)) push('not_integer', 'Shares come in whole numbers.', 'shares.count')
    else if (count > Math.floor(config.shares.maxChangePerRound * shares)) {
      push('shares_over_cap', `At most ${Math.floor(config.shares.maxChangePerRound * shares)} shares this round.`, 'shares.count')
    } else {
      const cash = round2(count * currentPrice(book))
      if (d.shares.mode === 'issue') treasury = round2(treasury + cash)
      else {
        if (cash > round2(treasury - debt)) push('buyback_over_cash', 'A buyback cannot exceed treasury minus debt.', 'shares.count')
        treasury = round2(treasury - cash)
      }
    }
  }

  // Upgrades.
  const upgraded = new Set<string>()
  d.upgrades.forEach((id, i) => {
    const b = buildings.find((x) => x.id === id)
    if (!b || upgraded.has(id) || b.size !== 'small' || b.status !== 'online') {
      push('upgrade_invalid', 'Only an online small building can be upgraded, once.', `upgrades.${i}`)
      return
    }
    upgraded.add(id)
    treasury = round2(treasury - upgradeCost(b, config))
  })

  // Builds.
  const taken = takenTiles(afterSales)
  d.builds.forEach((order, i) => {
    const field = `builds.${i}`
    if (order.kind === 'link') {
      const mw = order.mw ?? Number.NaN
      if (order.use !== 'internal' && order.use !== 'town' && order.use !== 'import') {
        push('build_invalid', 'A link needs a use: internal, town or import.', field)
      } else if (!isNum(mw) || mw < 1) {
        push('build_invalid', 'A link order needs at least 1 MW.', field)
      } else if (!Number.isInteger(mw)) {
        push('not_integer', 'Link MW come in whole numbers.', field)
      } else {
        treasury = round2(treasury - buildCost(order, config))
      }
      return
    }
    if ((order.kind !== 'plant' && order.kind !== 'dc') || (order.size !== 'small' && order.size !== 'big')) {
      push('build_invalid', 'Build a small or big plant or datacenter, or a link.', field)
      return
    }
    if (order.tile !== undefined) {
      if (!isTile(order.tile) || !inPlot(order.tile, config)) {
        push('tile_out_of_plot', 'That lot is outside the plot.', `${field}.tile`)
        return
      }
      if (!tileFree(taken, order.tile)) {
        push('tile_taken', 'That lot is already taken.', `${field}.tile`)
        return
      }
      markTile(taken, order.tile)
    }
    treasury = round2(treasury - buildCost(order, config))
  })

  if (treasury < 0) push('over_treasury', 'Not enough treasury for these orders.', 'builds')

  // Allocations, against this round's capacity (after forced sales; new orders do not count).
  const cap = capacity(afterSales)
  const alloc: [string, number][] = [
    ['power.internal', d.power.internal],
    ['power.town', d.power.town],
    ['power.otherDc', d.power.otherDc],
    ['compute.cloud', d.compute.cloud],
    ['compute.btc', d.compute.btc],
    ['compute.ai', d.compute.ai],
    ['rentMw', d.rentMw],
  ]
  let allocOk = true
  for (const [field, v] of alloc) {
    if (!isNum(v) || v < 0) {
      push('negative', 'Allocations must be numbers of 0 or more.', field)
      allocOk = false
    }
  }
  if (allocOk) {
    const { internal, town, otherDc } = d.power
    if (town > MW_EPSILON && cap.links.town <= 0) push('no_town_link', 'Selling to citizens needs a town link.', 'power.town')
    else if (town > cap.links.town + MW_EPSILON) push('over_town_link', 'More MW to citizens than the town link carries.', 'power.town')
    if (internal > cap.links.internal + MW_EPSILON) push('over_internal_link', 'More MW to your datacenters than the internal link carries.', 'power.internal')
    if (internal + town + otherDc > cap.plantMw + MW_EPSILON) push('over_plant_capacity', 'More power assigned than your plants make.', 'power')
    if (d.rentMw > cap.links.import + MW_EPSILON) push('over_import_link', 'More rent than the import link carries.', 'rentMw')
    const compute = d.compute.cloud + d.compute.btc + d.compute.ai
    if (compute > Math.min(cap.dcMw, internal + d.rentMw) + MW_EPSILON) {
      push('over_compute_capacity', 'More compute than your powered datacenters offer.', 'compute')
    }
  }

  return done()
}
