// Shared state of a build placement (drag from a build card, tap-to-place, or moving a pending
// order on the map), plus the bridge between drag.ts and the mounted map. The map renders from this
// store; drag.ts drives it. Kept free of Pixi so it costs nothing until the map is on screen.

import { create } from 'zustand'
import { companyById, plotRows } from '../engine'
import type { BuildOrder, Config, Decision, GameState, Tile } from '../engine'
import { tileKey } from './layout'

export type PlacementMode = 'drag' | 'tap' | 'move'

export interface PlacementState {
  mode: PlacementMode | null
  order: BuildOrder | null
  /** Index in decision.builds of the pending order being moved (mode 'move'). */
  moveIndex: number | null
  /** The free lot under the pointer (or the keyboard-focused one), where the ghost shows. */
  hover: Tile | null
  /** Pointer in client px during a drag, for the map's edge auto-scroll. */
  pointer: { x: number; y: number } | null
  /** A drag becomes active once the pointer has moved past the threshold. */
  active: boolean
}

export const usePlacement = create<PlacementState>()(() => ({ mode: null, order: null, moveIndex: null, hover: null, pointer: null, active: false }))

export function resetPlacement(): void {
  usePlacement.setState({ mode: null, order: null, moveIndex: null, hover: null, pointer: null, active: false })
}

/** Lots taken by a building or a pending order (optionally ignoring one order being moved). */
export function takenTiles(state: GameState, meId: string, decision: Decision, skipIndex: number | null = null): Set<string> {
  const me = companyById(state, meId)
  const taken = new Set(me.buildings.map((b) => tileKey(b.tile)))
  decision.builds.forEach((b, i) => {
    if (i !== skipIndex && b.kind !== 'link' && b.tile) taken.add(tileKey(b.tile))
  })
  return taken
}

/** Every free lot of the plot in reading order (the plot always keeps one free row at the bottom). */
export function freeTiles(state: GameState, meId: string, decision: Decision, config: Config, skipIndex: number | null = null): Tile[] {
  const me = companyById(state, meId)
  const pending = decision.builds.filter((b, i) => i !== skipIndex && b.kind !== 'link' && b.tile).map((b) => b.tile as Tile)
  const rows = plotRows(me, pending, config)
  const taken = takenTiles(state, meId, decision, skipIndex)
  const out: Tile[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < config.plot.lotsPerRow; c++) if (!taken.has(`${c},${r}`)) out.push([c, r])
  return out
}

/** What the mounted map exposes to drag.ts and mapApi. */
export interface MapHandle {
  lotAt(clientX: number, clientY: number): Tile | null
  highlightLots(tiles: Tile[] | null): void
  focusBuilding(id: string): void
  playResolution(before: GameState, after: GameState): void
  /** Integer CSS px per art px right now (for the drag ghost), or the nearest integer. */
  cssScale(): number
  /** A lot's rectangle in client px (for placing the drag caption above it), or null if off the map. */
  lotClientRect(tile: Tile): { left: number; top: number; width: number; height: number } | null
  /** Frame rectangle of an atlas sprite, for the DOM drag ghost. */
  frame(name: string): { x: number; y: number; w: number; h: number; atlasW: number; atlasH: number; url: string } | null
}

let handle: MapHandle | null = null
let externalHighlight: Tile[] | null = null

export function registerMap(h: MapHandle | null): void {
  handle = h
  if (h && externalHighlight) h.highlightLots(externalHighlight)
}
export function mapHandle(): MapHandle | null {
  return handle
}

/** The map's module API (DESIGN.md section 6). Safe to call when the map is not mounted. */
export const mapApi = {
  /** The lot under a client-space point, or null. */
  lotAt(clientX: number, clientY: number): Tile | null {
    return handle?.lotAt(clientX, clientY) ?? null
  },
  /** Lights up these lots (tutorial, panels), or clears the highlight with null. */
  highlightLots(tiles: Tile[] | null): void {
    externalHighlight = tiles && tiles.length ? tiles.map((t) => [t[0], t[1]] as Tile) : null
    handle?.highlightLots(externalHighlight)
  },
  /** Pans the camera to a building (or a pending order's lot, id `pending:c,r`) and pulses it. */
  focusBuilding(id: string): void {
    handle?.focusBuilding(id)
  },
  /** Coins and sparkles for a resolved round. The map also plays them on its own when useGame.last changes. */
  playResolution(before: GameState, after: GameState): void {
    handle?.playResolution(before, after)
  },
}
