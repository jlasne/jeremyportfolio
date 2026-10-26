// What a company owns: capacities, costs, lots on the plot, debt.

import { buildingSpec, defaultConfig, upgradeSpec } from './config'
import { round2 } from './money'
import type { BuildOrder, Building, BuildingKind, Company, Config, GameState, LinkUse, Size, Tile } from './types'

export interface Capacity {
  plantMw: number
  dcMw: number
  links: Record<LinkUse, number>
}

/** Online MW (upgrading buildings count at their current 2 MW) and carrying link MW (roundsLeft 0). */
export function capacity(company: Company): Capacity {
  let plantMw = 0
  let dcMw = 0
  for (const b of company.buildings) {
    if (b.status === 'building') continue
    if (b.kind === 'plant') plantMw += b.mw
    else dcMw += b.mw
  }
  const links: Record<LinkUse, number> = { internal: 0, town: 0, import: 0 }
  for (const l of company.links) if (l.roundsLeft === 0) links[l.use] += l.mw
  return { plantMw, dcMw, links }
}

/** Capacity once everything ordered is finished: buildings at their final size, every link carrying. */
export function finalCapacity(company: Company, config: Config = defaultConfig): Capacity {
  let plantMw = 0
  let dcMw = 0
  for (const b of company.buildings) {
    const mw = b.status === 'upgrading' ? buildingSpec(config, b.kind, 'big').mw : buildingSpec(config, b.kind, b.size).mw
    if (b.kind === 'plant') plantMw += mw
    else dcMw += mw
  }
  const links: Record<LinkUse, number> = { internal: 0, town: 0, import: 0 }
  for (const l of company.links) links[l.use] += l.mw
  return { plantMw, dcMw, links }
}

export function buildCost(order: BuildOrder, config: Config = defaultConfig): number {
  if (order.kind === 'link') return round2(config.link.costPerMw * Math.max(0, order.mw ?? 0))
  return buildingSpec(config, order.kind, order.size ?? 'small').cost
}

export function upgradeCost(building: Building, config: Config = defaultConfig): number {
  return upgradeSpec(config, building.kind).cost
}

/** 30% of price paid, upgrades included. */
export function sellValue(building: Building, config: Config = defaultConfig): number {
  return round2(config.sellBackRate * building.pricePaid)
}

export function totalDebt(company: Company): number {
  return round2(company.loans.reduce((sum, l) => sum + l.principal, 0))
}

export function companyById(state: GameState, id: string): Company {
  const c = state.companies.find((x) => x.id === id)
  if (!c) throw new Error(`engine: unknown company ${id}`)
  return c
}

export function findCompany(state: GameState, id: string): Company | undefined {
  return state.companies.find((x) => x.id === id)
}

const tileKey = (t: Tile): string => `${t[0]},${t[1]}`

export function isTile(t: unknown): t is Tile {
  return Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1])
}

export function inPlot(t: Tile, config: Config = defaultConfig): boolean {
  return t[0] >= 0 && t[0] < config.plot.lotsPerRow && t[1] >= 0
}

export function takenTiles(company: Company, extra: Tile[] = []): Set<string> {
  const set = new Set<string>()
  for (const b of company.buildings) set.add(tileKey(b.tile))
  for (const t of extra) set.add(tileKey(t))
  return set
}

export function tileFree(taken: Set<string>, t: Tile): boolean {
  return !taken.has(tileKey(t))
}

export function markTile(taken: Set<string>, t: Tile): void {
  taken.add(tileKey(t))
}

/** A plant or datacenter order with a valid size (link orders and garbage excluded). */
export function isBuildingOrder(o: BuildOrder): o is BuildOrder & { kind: BuildingKind; size: Size } {
  return (o.kind === 'plant' || o.kind === 'dc') && (o.size === 'small' || o.size === 'big')
}

/**
 * Lots for the building orders of one decision, in order. Named lots that are in the plot and free are
 * reserved first, so an order without a lot (or with a bad one) never takes a lot a later order names;
 * the rest take the first free lot. Marks every lot it hands out in `taken`.
 */
export function placeOrders(taken: Set<string>, named: unknown[], config: Config = defaultConfig): Tile[] {
  const out: (Tile | null)[] = named.map((t) => {
    if (!isTile(t) || !inPlot(t, config) || !tileFree(taken, t)) return null
    markTile(taken, t)
    return [t[0], t[1]]
  })
  return out.map((t) => {
    if (t) return t
    const free = firstFree(taken, config)
    markTile(taken, free)
    return free
  })
}

/** First free lot, row by row, 4 per row. */
export function findFreeTile(company: Company, taken: Tile[] = [], config: Config = defaultConfig): Tile {
  return firstFree(takenTiles(company, taken), config)
}

export function firstFree(taken: Set<string>, config: Config = defaultConfig): Tile {
  for (let row = 0; ; row++) {
    for (let col = 0; col < config.plot.lotsPerRow; col++) {
      const t: Tile = [col, row]
      if (!taken.has(tileKey(t))) return t
    }
  }
}

/** Lot rows to draw: at least plot.startRows, and always one free row under the last building. */
export function plotRows(company: Company, extra: Tile[] = [], config: Config = defaultConfig): number {
  let maxRow = -1
  for (const b of company.buildings) maxRow = Math.max(maxRow, b.tile[1])
  for (const t of extra) maxRow = Math.max(maxRow, t[1])
  return Math.max(config.plot.startRows, maxRow + 2)
}
