// Drag-to-place and tap-to-place for build cards (SPEC "Build panel": drag a card onto an empty
// tile; a ghost crane shows the countdown). The Build panel calls these; the map renders the
// highlight from the placement store: free lots light up, the hovered lot shows the ghost building
// with a ghost crane and its build time, and a drop on a free lot adds the order to the draft.
//
//   startBuildDrag(order, e)    from a pointerdown on a build card (mouse, pen or touch)
//   startBuildPlacement(order)  tap / keyboard mode: tap a free lot, or arrow between lots + Enter
//   cancelPlacement(), isPlacing()
//
// For touch drags, the card that calls startBuildDrag needs `touch-action: none` so the browser
// does not turn the gesture into a scroll before the drag starts.

import { buildCost } from '../engine'
import type { BuildOrder, Tile } from '../engine'
import { audio } from '../audio'
import { useDraft } from '../store/draft'
import { useGame } from '../store/game'
import { useUi } from '../store/ui'
import { freeTiles, mapApi, mapHandle, resetPlacement, usePlacement } from './placement'
import type { PlacementMode } from './placement'
import { tileKey } from './layout'

export { mapApi } from './placement'

/** Pointer travel (CSS px) before a press on a card turns into a drag; below it, it stays a click. */
const THRESHOLD = 6

interface Session {
  pointerId: number | null
  startX: number
  startY: number
  ghost: HTMLElement | null
  restoreFocus: HTMLElement | null
  cleanup: () => void
}

let session: Session | null = null

function canPlace(): boolean {
  const g = useGame.getState()
  return g.screen === 'game' && g.phase === 'decide' && !!g.state && !!g.meId
}

function freeSet(skip: number | null): Set<string> {
  const { state, meId, config } = useGame.getState()
  if (!state || !meId) return new Set()
  return new Set(freeTiles(state, meId, useDraft.getState().decision, config, skip).map(tileKey))
}

/** The free lot under a client point (null over a taken lot, a road, or off the map). */
function freeLotAt(x: number, y: number): Tile | null {
  const t = mapApi.lotAt(x, y)
  if (!t) return null
  return freeSet(usePlacement.getState().moveIndex).has(tileKey(t)) ? t : null
}

export function orderLabel(o: BuildOrder): string {
  return `${o.size === 'big' ? 'Big' : 'Small'} ${o.kind === 'plant' ? 'plant' : 'datacenter'}`
}

function buildRounds(o: BuildOrder): number {
  const cfg = useGame.getState().config
  if (o.kind === 'link') return cfg.link.rounds
  return cfg.buildings[o.kind][o.size ?? 'small'].rounds
}

/** The floating pointer-events:none ghost: the sprite at the map's scale plus a caption. */
function makeGhost(o: BuildOrder): HTMLElement {
  const el = document.createElement('div')
  el.className = 'gt-drag-ghost'
  el.setAttribute('aria-hidden', 'true')
  const name = `${o.kind === 'plant' ? 'plant' : 'dc'}_${o.size === 'big' ? 'big' : 'small'}`
  const h = mapHandle()
  const f = h?.frame(name)
  if (f) {
    const k = Math.max(1, Math.min(3, h?.cssScale() ?? 2))
    const art = document.createElement('div')
    art.className = 'gt-drag-ghost-art'
    art.style.width = `${f.w * k}px`
    art.style.height = `${f.h * k}px`
    art.style.backgroundImage = `url("${f.url}")`
    art.style.backgroundSize = `${f.atlasW * k}px ${f.atlasH * k}px`
    art.style.backgroundPosition = `${-f.x * k}px ${-f.y * k}px`
    el.appendChild(art)
  }
  const cap = document.createElement('div')
  cap.className = 'gt-drag-ghost-cap'
  const cfg = useGame.getState().config
  const r = buildRounds(o)
  const text = document.createElement('span')
  text.className = 'gt-drag-ghost-text'
  text.textContent = `${orderLabel(o)} · ${buildCost(o, cfg).toFixed(2)} · ${r} round${r === 1 ? '' : 's'}`
  // shown instead of the order over a lot that is already taken (with a no-entry mark: not colour alone)
  const blocked = document.createElement('span')
  blocked.className = 'gt-drag-ghost-blocked'
  blocked.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12 12 4" stroke="currentColor" stroke-width="2"/></svg>Lot taken'
  cap.append(text, blocked)
  el.appendChild(cap)
  document.body.appendChild(el)
  return el
}

/**
 * Follows the pointer. Snapped to a free lot, the sprite hides (the map draws the ghost building in
 * place) and the caption lifts to just above that lot so it never covers it. Over a taken lot the
 * ghost greys out and says so, and the cursor turns to not-allowed.
 */
function moveGhost(el: HTMLElement | null, x: number, y: number, lot: Tile | null, blocked: boolean): void {
  if (!el) return
  const rect = lot ? mapHandle()?.lotClientRect(lot) : null
  if (rect) el.style.transform = `translate3d(${Math.round(rect.left + rect.width / 2)}px, ${Math.round(rect.top - 6)}px, 0) translate(-50%, -100%)`
  else el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -85%)`
  el.classList.toggle('is-over-lot', !!rect)
  el.classList.toggle('is-blocked', blocked)
  document.documentElement.classList.toggle('gt-drag-blocked', blocked)
}

function end(): void {
  const s = session
  session = null
  resetPlacement()
  document.documentElement.classList.remove('gt-dragging', 'gt-placing', 'gt-drag-blocked')
  useUi.getState().setDrag(null)
  if (s) {
    s.cleanup()
    s.ghost?.remove()
  }
}

function onEscCapture(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !session) return
  // Before useGameKeys (which would close the panel): Esc only cancels the placement.
  e.preventDefault()
  e.stopPropagation()
  cancelPlacement()
}

/** Starts a drag session for a new order ('drag') or a pending order on the map ('move'). */
function beginDrag(mode: PlacementMode, order: BuildOrder, e: PointerEvent, moveIndex: number | null): void {
  const target = e.target instanceof Element ? e.target : null
  try {
    target?.setPointerCapture?.(e.pointerId)
  } catch {
    /* capture is a nicety: window listeners still see the pointer */
  }
  usePlacement.setState({ mode, order, moveIndex, hover: null, pointer: { x: e.clientX, y: e.clientY }, active: false })

  const onMove = (ev: PointerEvent) => {
    const s = session
    if (!s || ev.pointerId !== s.pointerId) return
    const st = usePlacement.getState()
    if (!st.active) {
      if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < THRESHOLD) return
      s.ghost = makeGhost(order)
      document.documentElement.classList.add('gt-dragging')
      useUi.getState().setDrag({ order })
      usePlacement.setState({ active: true })
    }
    ev.preventDefault()
    const hover = freeLotAt(ev.clientX, ev.clientY)
    const prev = usePlacement.getState().hover
    if (!(prev && hover && prev[0] === hover[0] && prev[1] === hover[1]) && (prev || hover)) usePlacement.setState({ hover })
    usePlacement.setState({ pointer: { x: ev.clientX, y: ev.clientY } })
    const under = hover ? null : mapApi.lotAt(ev.clientX, ev.clientY)
    moveGhost(s.ghost, ev.clientX, ev.clientY, hover, !!under)
  }
  const onUp = (ev: PointerEvent) => {
    const s = session
    if (!s || ev.pointerId !== s.pointerId) return
    const st = usePlacement.getState()
    const tile = st.active ? freeLotAt(ev.clientX, ev.clientY) : null
    const idx = st.moveIndex
    end()
    if (!tile || !canPlace()) return
    if (mode === 'move' && idx != null) useDraft.getState().moveBuild(idx, tile)
    else useDraft.getState().addBuild({ ...order, tile })
    audio.cue('click')
  }
  const onCancel = (ev: PointerEvent) => {
    if (session && ev.pointerId === session.pointerId) end()
  }
  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onEscCapture, true)
  session = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    ghost: null,
    restoreFocus: null,
    cleanup: () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onEscCapture, true)
      try {
        if (target?.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    },
  }
}

/** Start dragging a build card from a pointerdown on it. Drop on a free lot to place; anywhere else cancels. */
export function startBuildDrag(order: BuildOrder, e: PointerEvent): void {
  if (order.kind === 'link') {
    // Links have no lot: a drag of a link card simply orders it.
    useDraft.getState().addBuild(order)
    return
  }
  cancelPlacement()
  if (!canPlace()) return
  beginDrag('drag', { kind: order.kind, size: order.size ?? 'small' }, e, null)
}

/** Map-internal: drag a pending order to another free lot. */
export function startMoveDrag(index: number, e: PointerEvent): void {
  const o = useDraft.getState().decision.builds[index]
  if (!o || o.kind === 'link') return
  cancelPlacement()
  if (!canPlace()) return
  beginDrag('move', o, e, index)
}

/** Tap-to-place: free lots light up and the next tap on one places the order. Esc or cancelPlacement() stops it. */
export function startBuildPlacement(order: BuildOrder): void {
  if (order.kind === 'link') {
    useDraft.getState().addBuild(order)
    return
  }
  cancelPlacement()
  if (!canPlace()) return
  const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const placed: BuildOrder = { kind: order.kind, size: order.size ?? 'small' }
  usePlacement.setState({ mode: 'tap', order: placed, moveIndex: null, hover: null, pointer: null, active: true })
  document.documentElement.classList.add('gt-placing')
  useUi.getState().setDrag({ order: placed })
  window.addEventListener('keydown', onEscCapture, true)
  session = {
    pointerId: null,
    startX: 0,
    startY: 0,
    ghost: null,
    restoreFocus: restore,
    cleanup: () => window.removeEventListener('keydown', onEscCapture, true),
  }
  const n = freeSet(null).size
  useUi.getState().announce(`Placing a ${orderLabel(placed).toLowerCase()}: ${n} free lot${n === 1 ? '' : 's'}. Tap a lot or use the arrow keys and Enter. Escape cancels.`)
}

/** Places the tap-to-place order on a lot (the map calls this on a tap or Enter). Returns true when placed. */
export function placeAt(tile: Tile): boolean {
  const st = usePlacement.getState()
  if (st.mode !== 'tap' || !st.order || !canPlace()) return false
  if (!freeSet(null).has(tileKey(tile))) return false
  const order = st.order
  const restore = session?.restoreFocus ?? null
  end()
  useDraft.getState().addBuild({ ...order, tile })
  audio.cue('click')
  useUi.getState().announce(`${orderLabel(order)} ordered on lot ${tile[0] + 1}, row ${tile[1] + 1}.`)
  if (restore && restore.isConnected) restore.focus({ preventScroll: true })
  return true
}

export function cancelPlacement(): void {
  if (!session && !usePlacement.getState().mode) return
  const restore = session?.restoreFocus ?? null
  const wasTap = usePlacement.getState().mode === 'tap'
  end()
  if (wasTap && restore && restore.isConnected) restore.focus({ preventScroll: true })
}

/** True while a drag or a tap-to-place is in progress (for the Build panel's hint line). */
export function isPlacing(): boolean {
  return usePlacement.getState().mode != null
}

/** Subscribe to placement start/stop (for panels that show a hint while placing). */
export function onPlacingChange(cb: (placing: boolean) => void): () => void {
  let prev = isPlacing()
  return usePlacement.subscribe((s) => {
    const now = s.mode != null
    if (now !== prev) {
      prev = now
      cb(now)
    }
  })
}
