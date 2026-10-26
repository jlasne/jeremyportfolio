import balance from '../../config/balance.json'
import type { BuildingKind, Config, Size } from './types'

export const defaultConfig: Config = balance

export function buildingSpec(config: Config, kind: BuildingKind, size: Size): { mw: number; cost: number; rounds: number } {
  return config.buildings[kind][size]
}

export function upgradeSpec(config: Config, kind: BuildingKind): { cost: number; rounds: number } {
  return config.buildings[kind].upgrade
}
