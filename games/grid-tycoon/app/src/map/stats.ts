// Numbers for the building card: what a building does this round (the draft's allocation spread over
// buildings by capacity), what it did last round, what it costs, and whether it can be upgraded.

import { buildCost, canUpgrade, capacity, companyById, levelOf, nextSize, revenueByBuilding, sellValue, upgradeCost, upgradeSpec } from '../engine'
import type { Building, BuildOrder, CompanyPreview, Config, Decision, GameState, Size, Tile } from '../engine'
import { tileKey } from './layout'

/** "Plant · Level 1", "Datacenter · Level 3". */
export function kindName(kind: 'plant' | 'dc', size: Size): string {
  return `${kind === 'plant' ? 'Plant' : 'Datacenter'} · Level ${levelOf(size)}`
}

/** The size a building had before its last upgrade (small for a fresh build). */
function previousSize(size: Size): Size {
  return size === 'mega' ? 'big' : 'small'
}

/** MW a building delivered during the last resolved round (the engine's revenueByBuilding rule). */
export function deliveredLastRound(b: Building, state: GameState, meId: string, config: Config): number {
  const me = companyById(state, meId)
  const last = me.history.at(-1)
  if (!last || b.status === 'building') return 0
  if (!last.completed.includes(b.id)) return b.mw
  // finished last round: a new build delivered nothing, an upgrade ran at the level below
  const newOrder = b.size !== 'mega' && b.builtRound + config.buildings[b.kind][b.size].rounds - 1 === last.round
  return newOrder ? 0 : config.buildings[b.kind][previousSize(b.size)].mw
}

export interface BuildingStats {
  building: Building
  name: string
  /** MW it can deliver this round (0 while building, the current level's MW while upgrading). */
  mwNow: number
  level: 1 | 2 | 3
  /** The level and MW it reaches with its next upgrade (or the one under way), null at level 3. */
  next: { level: 1 | 2 | 3; mw: number } | null
  /** MW it will deliver once built (for a building under construction). */
  mwOnline: number
  /** This round, from the draft: MW assigned to it and MW left idle. */
  used: number
  idle: number
  last: { delivered: number; used: number; revenue: number } | null
  maintenance: number
  /** Maintenance is only charged once a building is online or upgrading. */
  maintenanceActive: boolean
  sell: number
  selling: boolean
  /** The next upgrade, offered while the building is online below level 3. */
  upgrade: { cost: number; rounds: number; ordered: boolean; canAfford: boolean; short: number; toLevel: 2 | 3; gain: number } | null
}

export function buildingStats(state: GameState, meId: string, decision: Decision, preview: CompanyPreview, config: Config, id: string): BuildingStats | null {
  const me = companyById(state, meId)
  const b = me.buildings.find((x) => x.id === id)
  if (!b) return null
  const cap = capacity(me)
  const plant = b.kind === 'plant'
  const assigned = plant ? decision.power.internal + decision.power.town + decision.power.otherDc : decision.compute.cloud + decision.compute.btc + decision.compute.ai
  const total = plant ? cap.plantMw : cap.dcMw
  const share = total > 0 ? Math.min(1, Math.max(0, assigned / total)) : 0
  const mwNow = b.status === 'building' ? 0 : b.mw
  const used = mwNow * share
  const lastRes = me.history.at(-1)
  let last: BuildingStats['last'] = null
  if (lastRes) {
    const delivered = deliveredLastRound(b, state, meId, config)
    const pool = plant ? lastRes.plantMw : lastRes.dcMw
    const poolUsed = plant ? lastRes.plantUsed : lastRes.dcUsed
    last = { delivered, used: pool > 0 ? (delivered * poolUsed) / pool : 0, revenue: revenueByBuilding(state, meId)[b.id] ?? 0 }
  }
  const up = nextSize(b.size)
  const next = up ? { level: levelOf(up), mw: config.buildings[b.kind][up].mw } : null
  let upgrade: BuildingStats['upgrade'] = null
  if (canUpgrade(b) && up && next) {
    const ordered = decision.upgrades.includes(b.id)
    const cost = upgradeCost(b, config)
    const left = preview.treasuryLeft
    upgrade = {
      cost,
      rounds: upgradeSpec(b.kind, b.size, config).rounds,
      ordered,
      canAfford: ordered || left >= cost - 1e-9,
      short: Math.max(0, cost - left),
      toLevel: next.level as 2 | 3,
      gain: next.mw - config.buildings[b.kind][b.size].mw,
    }
  }
  return {
    building: b,
    name: kindName(b.kind, b.size),
    mwNow,
    level: levelOf(b.size),
    next,
    mwOnline: b.mw > 0 ? b.mw : config.buildings[b.kind][b.size].mw,
    used,
    idle: Math.max(0, mwNow - used),
    last,
    maintenance: b.pricePaid * config.maintenanceRate,
    maintenanceActive: b.status !== 'building',
    sell: sellValue(b, config),
    selling: decision.forcedSales.includes(b.id),
    upgrade,
  }
}

export interface PendingStats {
  index: number
  order: BuildOrder
  tile: Tile
  name: string
  cost: number
  rounds: number
  onlineRound: number
  mw: number
  maintenance: number
}

export function pendingStats(state: GameState, decision: Decision, config: Config, id: string): PendingStats | null {
  if (!id.startsWith('pending:')) return null
  const key = id.slice(8)
  const index = decision.builds.findIndex((b) => b.kind !== 'link' && b.tile && tileKey(b.tile) === key)
  if (index < 0) return null
  const order = decision.builds[index]
  if (order.kind === 'link' || !order.tile) return null
  const size = order.size ?? 'small'
  const spec = config.buildings[order.kind][size]
  const cost = buildCost(order, config)
  return {
    index,
    order,
    tile: order.tile,
    name: kindName(order.kind, size),
    cost,
    rounds: spec.rounds,
    onlineRound: state.round + spec.rounds,
    mw: spec.mw,
    maintenance: cost * config.maintenanceRate,
  }
}
