// Drag-to-place and tap-to-place for build cards (SPEC "Build panel": drag a card onto an
// empty tile; a ghost crane shows the countdown). The Build panel calls these; the map owns
// the interaction: it highlights free lots, draws the ghost crane under the pointer and adds
// the order to the draft on drop.
//
// STUB written before the map track: it places the order on the first free lot so the panels
// work on their own. The map track replaces the bodies and keeps the signatures.

import type { BuildOrder } from '../engine'
import { useDraft } from '../store/draft'

/** Start dragging a build card from a pointerdown on it. Drop on a free lot to place; anywhere else cancels. */
export function startBuildDrag(order: BuildOrder, _e: PointerEvent): void {
  useDraft.getState().addBuild(order)
}

/** Tap-to-place: free lots light up and the next tap on one places the order. Esc or cancelPlacement() stops it. */
export function startBuildPlacement(order: BuildOrder): void {
  useDraft.getState().addBuild(order)
}

export function cancelPlacement(): void {}

/** True while a drag or a tap-to-place is in progress (for the Build panel's hint line). */
export function isPlacing(): boolean {
  return false
}
