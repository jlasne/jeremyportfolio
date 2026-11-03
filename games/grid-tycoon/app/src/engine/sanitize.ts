// Lenient repair (DESIGN 2.4): clamp allocations, drop what cannot apply, pick forced sales.
// The output always passes validateDecision, so resolution never throws on input.

import { buildCost, canUpgrade, capacity, findCompany, landCost, ownedRows, placeOrders, sellValue, takenTiles, upgradeCost, type Capacity } from './assets'
import { floorsFor, zeroFloors, type Floors } from './commitment'
import { defaultConfig } from './config'
import { COMPUTE_POOLS, MW_EPSILON } from './constants'
import { emptyDecision, readDecision } from './decision'
import { finite, floorMw, round2 } from './money'
import { currentPrice, forcedIssue, type ShareBook } from './phase'
import { shareCap } from './validate'
import type { Building, Config, Decision, GameState } from './types'

const nonNeg = (x: unknown): number => Math.max(0, finite(x))

/** Scales values down by the same factor so their sum fits the cap, flooring so float noise cannot overshoot. */
function fitSum(values: number[], cap: number): number[] {
  const sum = values.reduce((a, b) => a + b, 0)
  if (sum <= cap + MW_EPSILON) return values
  const scale = cap > 0 ? cap / sum : 0
  return values.map((v) => floorMw(v * scale))
}

/** Clamps power, compute and rent to the company's links and capacities. */
export function clampAllocations(
  cap: Capacity,
  power: Decision['power'],
  compute: Decision['compute'],
  rentMw: number,
  floors: Floors = zeroFloors(),
): Pick<Decision, 'power' | 'compute' | 'rentMw'> {
  const internal0 = Math.min(nonNeg(power.internal), cap.links.internal)
  const town0 = cap.links.town > 0 ? Math.min(nonNeg(power.town), cap.links.town) : 0
  let [internal, town, otherDc] = fitSum([internal0, town0, nonNeg(power.otherDc)], cap.plantMw)
  const rent = Math.min(Math.max(nonNeg(rentMw), floors.rentMw), cap.links.import)
  const raised = { cloud: 0, btc: 0, ai: 0 }
  let need = 0
  for (const p of COMPUTE_POOLS) {
    raised[p] = Math.max(nonNeg(compute[p]), floors.compute[p])
    need += raised[p]
  }
  // Committed compute needs power: take it from the plants, cutting power sales if it must.
  const mustPower = Math.min(cap.dcMw, need) - rent
  if (mustPower > internal + MW_EPSILON) {
    internal = Math.min(mustPower, cap.links.internal, cap.plantMw)
    let over = internal + town + otherDc - cap.plantMw
    if (over > 0) {
      const cut = Math.min(otherDc, over)
      otherDc = floorMwSafe(otherDc - cut)
      over -= cut
    }
    if (over > 0) town = floorMwSafe(town - over)
    internal = Math.min(internal, cap.plantMw - town - otherDc)
  }
  // Floors first, then what is asked above them scaled into the room left.
  const room = Math.min(cap.dcMw, internal + rent)
  const base = COMPUTE_POOLS.map((p) => Math.min(floors.compute[p], raised[p]))
  const baseFit = fitSum(base, room)
  const extra = fitSum(
    COMPUTE_POOLS.map((p, i) => raised[p] - base[i]),
    Math.max(0, room - baseFit.reduce((x, y) => x + y, 0)),
  )
  const [cloud, btc, ai] = COMPUTE_POOLS.map((_, i) => baseFit[i] + extra[i])
  return { power: { internal, town, otherDc }, compute: { cloud, btc, ai }, rentMw: rent }
}

const floorMwSafe = (x: number): number => Math.max(0, floorMw(x))

/** Forced sales for a losing round: the listed ones first, then the cheapest sell values until the treasury is back to 0. */
function pickForcedSales(buildings: Building[], treasury: number, listed: string[], config: Config): { sold: string[]; treasury: number } {
  const sold: string[] = []
  let t = treasury
  for (const id of listed) {
    const b = buildings.find((x) => x.id === id)
    if (!b || sold.includes(id)) continue
    sold.push(id)
    t = round2(t + sellValue(b, config))
  }
  const rest = buildings.filter((b) => !sold.includes(b.id)).sort((a, b) => sellValue(a, config) - sellValue(b, config))
  for (const b of rest) {
    if (t >= 0) break
    sold.push(b.id)
    t = round2(t + sellValue(b, config))
  }
  return { sold, treasury: t }
}

export function sanitizeDecision(state: GameState, companyId: string, raw: unknown, config: Config = defaultConfig): Decision {
  const out = emptyDecision()
  const company = findCompany(state, companyId)
  if (state.finished || !company || company.bankrupt) return out
  const d = readDecision(raw)
  const startTreasury = company.treasury
  let treasury = startTreasury

  // Forced sales. A forced share issue dilutes the book that the share action below is priced on.
  let book: ShareBook = company
  let buildings = company.buildings
  if (startTreasury < 0) {
    const picked = pickForcedSales(company.buildings, treasury, d.forcedSales, config)
    out.forcedSales = picked.sold
    treasury = picked.treasury
    buildings = company.buildings.filter((b) => !picked.sold.includes(b.id))
    const issue = buildings.length === 0 ? forcedIssue(book, treasury) : null
    if (issue) {
      treasury = round2(treasury + issue.cash)
      book = issue.book
    }
  }

  // Early repayments, never more than the principal or the treasury.
  const principal = new Map(company.loans.map((l) => [l.id, l.principal]))
  for (const loan of company.loans) {
    const asked = round2(Math.min(nonNeg(d.loans.repay[loan.id]), loan.principal))
    const amount = round2(Math.min(asked, Math.max(0, treasury)))
    if (amount <= 0) continue
    out.loans.repay[loan.id] = amount
    treasury = round2(treasury - amount)
    principal.set(loan.id, round2(loan.principal - amount))
  }

  // Refinance.
  if (startTreasury >= 0) {
    out.loans.refinance = [...new Set(d.loans.refinance)].filter((id) =>
      company.loans.some((l) => l.id === id && l.dueRound === state.round && (principal.get(id) ?? 0) > 0),
    )
  }

  // New loan.
  const take = round2(nonNeg(d.loans.take))
  out.loans.take = take
  treasury = round2(treasury + take)

  // Shares.
  if (!d.sharesConflict && d.shares.mode !== 'none') {
    const price = currentPrice(book)
    let count = Math.min(Math.floor(nonNeg(d.shares.count)), shareCap(d.shares.mode, book.shares, config))
    if (price <= 0) count = 0
    if (d.shares.mode === 'buyback') {
      const room = Math.max(0, treasury)
      count = Math.max(0, Math.min(count, Math.floor(room / price)))
      while (count > 0 && round2(count * price) > room) count--
    }
    if (count > 0) {
      out.shares = { mode: d.shares.mode, count }
      const cash = round2(count * price)
      treasury = round2(d.shares.mode === 'issue' ? treasury + cash : treasury - cash)
    }
  }

  // Land, while the treasury allows.
  let rows = ownedRows(company, config)
  let buy = Math.floor(nonNeg(d.landRows))
  while (buy > 0 && landCost(rows, buy, config) > treasury) buy--
  if (buy > 0) {
    out.landRows = buy
    treasury = round2(treasury - landCost(rows, buy, config))
    rows += buy
  }

  // Upgrades, while the treasury allows.
  for (const id of d.upgrades) {
    const b = buildings.find((x) => x.id === id)
    if (!b || out.upgrades.includes(id) || !canUpgrade(b)) continue
    const cost = upgradeCost(b, config)
    if (cost > treasury) continue
    out.upgrades.push(id)
    treasury = round2(treasury - cost)
  }

  // Builds: what the treasury cannot pay is dropped; then lots are handed out, named ones first,
  // a bad or missing lot getting the first free one.
  const kept: Decision['builds'] = []
  for (const order of d.builds) {
    if (order.kind === 'link') {
      if (order.use !== 'internal' && order.use !== 'town' && order.use !== 'import') continue
      let mw = Math.floor(nonNeg(order.mw))
      if (config.link.costPerMw > 0) mw = Math.min(mw, Math.floor(treasury / config.link.costPerMw))
      if (mw < 1) continue
      out.builds.push({ kind: 'link', use: order.use, mw })
      treasury = round2(treasury - buildCost({ kind: 'link', mw }, config))
      continue
    }
    if ((order.kind !== 'plant' && order.kind !== 'dc') || (order.size !== 'small' && order.size !== 'big')) continue
    const cost = buildCost(order, config)
    if (cost > treasury) continue
    const placed: Decision['builds'][number] = { kind: order.kind, size: order.size }
    if (order.tile !== undefined) placed.tile = order.tile
    out.builds.push(placed)
    kept.push(placed)
    treasury = round2(treasury - cost)
  }
  // An order with no lot left on the owned land is dropped and refunded.
  const tiles = placeOrders(takenTiles({ ...company, buildings }), kept.map((o) => o.tile), config, rows)
  kept.forEach((o, i) => {
    const t = tiles[i]
    if (t) o.tile = t
    else {
      out.builds.splice(out.builds.indexOf(o), 1)
      treasury = round2(treasury + buildCost(o, config))
    }
  })

  // Allocations, against this round's capacity, with the commitment floors.
  const cap = capacity({ ...company, buildings })
  const alloc = clampAllocations(cap, d.power, d.compute, d.rentMw, floorsFor(company, cap, config))
  out.power = alloc.power
  out.compute = alloc.compute
  out.rentMw = alloc.rentMw
  return out
}
