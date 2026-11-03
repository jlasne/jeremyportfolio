import balance from '../../config/balance.json'
import type { BuildingKind, Config, Size } from './types'

export const defaultConfig: Config = balance

export function buildingSpec(config: Config, kind: BuildingKind, size: Size): { mw: number; cost: number; rounds: number } {
  return config.buildings[kind][size]
}

/** The level a building reaches with its next upgrade, or null at the top level. */
export function nextSize(size: Size): Size | null {
  return size === 'small' ? 'big' : size === 'big' ? 'mega' : null
}

/** Level 1, 2 or 3. */
export function levelOf(size: Size): 1 | 2 | 3 {
  return size === 'small' ? 1 : size === 'big' ? 2 : 3
}

/** Cost and build time of the upgrade from `from` to the next level (small to big, big to mega). */
export function upgradeSpec(config: Config, kind: BuildingKind, from: Size = 'small'): { cost: number; rounds: number } {
  return from === 'big' ? config.buildings[kind].upgradeMega : config.buildings[kind].upgrade
}

/** Price of the n-th land row bought (n = 1 for the first row past the start rows). */
export function landRowCost(config: Config, n: number): number {
  const raw = config.plot.rowCost * Math.pow(1 + config.plot.rowCostGrowth, Math.max(0, n - 1))
  return Math.round(raw * 100) / 100
}
