// World geometry of the company map, in art pixels (1 art px = 1 sprite pixel). Pure functions, no
// Pixi: the renderer, the DOM accessibility layer, the drag controller and the tests all share it.
//
// Columns (32 px tiles), after scripts/sprites/preview.mjs, the reference composition:
//   0..4   town: town hall, houses along dirt lanes, trees
//   5      west road (vertical)
//   6..17  the plot: 4 lots of 3 x 3 tiles per lot row
//   18     east road (vertical)
//   19..23 grid: substation, branch road, pylons
// Rows: 0 verge, 1 road, then per lot row 3 rows of lots + 1 road row, then a 2 row verge.

import type { Tile } from '../engine'

export const T = 32
export const COLS = 24
export const WORLD_W = COLS * T
export const LOT = 96
export const LOTS_PER_ROW = 4
export const PLOT_COL0 = 6
export const WEST_ROAD_COL = 5
export const EAST_ROAD_COL = 18
export const PLOT_X0 = PLOT_COL0 * T // 192
export const PLOT_X1 = PLOT_X0 + LOTS_PER_ROW * LOT // 576
export const WEST_X = WEST_ROAD_COL * T + T / 2 // 176, centre of the west road
export const EAST_X = EAST_ROAD_COL * T + T / 2 // 592, centre of the east road
/** The plot with its two side roads: what the camera always tries to fit. */
export const CORE = { x0: WEST_ROAD_COL * T, x1: (EAST_ROAD_COL + 1) * T } // 160..608
/** Town lanes start at this tile row, one every 3 rows. */
export const LANE_ROW0 = 3
/** Houses that are always there, whatever the citizens share. */
export const BASE_HOUSES = 4
export const MAX_HOUSES = 2 + 4 * 24
/** Branch road to the substation: always the second road row. */
export const BRANCH_ROW = 5

export type Pt = [number, number]
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Tile row of road row j (j = 0 above the first lot row, j = plotRows below the last). */
export const roadRow = (j: number): number => 1 + 4 * j
export const roadCenterY = (j: number): number => roadRow(j) * T + T / 2

export function lotRect(tile: Tile): Rect {
  return { x: (PLOT_COL0 + 3 * tile[0]) * T, y: (2 + 4 * tile[1]) * T, w: LOT, h: LOT }
}

/** Where a building sprite's foot point goes on its lot (96 px sprites sit a little lower). */
export function footOnLot(tile: Tile, size: 'small' | 'big'): Pt {
  const r = lotRect(tile)
  return size === 'big' ? [r.x + 48, r.y + 86] : [r.x + 48, r.y + 80]
}

/** The crane's foot on a lot: on the scaffold for a big build, left of the building for a small one. */
export function craneFoot(tile: Tile, size: 'small' | 'big'): Pt {
  const r = lotRect(tile)
  return size === 'big' ? [r.x + 22, r.y + 74] : [r.x + 12, r.y + 84]
}

/** Number of houses for a citizens share: a few base houses plus 1 per 0.5 MW used. */
export function houseCount(citizensUsedMw: number): number {
  const extra = Number.isFinite(citizensUsedMw) && citizensUsedMw > 0 ? Math.floor(citizensUsedMw / 0.5 + 1e-9) : 0
  return Math.min(MAX_HOUSES, BASE_HOUSES + extra)
}

/** Lanes needed for n houses: 2 on the town hall lane, 4 on every other. */
export function laneCount(houses: number): number {
  return 1 + Math.ceil(Math.max(0, houses - 2) / 4)
}

/** Tile rows of the world: the plot's rows plus verges, or more if the town needs the room. */
export function worldRows(plotRows: number, houses: number): number {
  const plot = 4 * plotRows + 4
  const town = LANE_ROW0 + 3 * (laneCount(houses) - 1) + 3
  return Math.max(plot, town, 12)
}

export interface HouseSpot {
  /** Foot point. */
  x: number
  y: number
  lane: number
}

/** Foot points of the first n houses, filling lanes top to bottom (the reference scene's spots). */
export function houseSpots(n: number): HouseSpot[] {
  const out: HouseSpot[] = []
  for (let lane = 0; out.length < n; lane++) {
    const y = (LANE_ROW0 + 3 * lane) * T + 8
    const xs = lane === 0 ? [18, 142] : [18, 50, 112, 144]
    for (const x of xs) {
      if (out.length >= n) break
      out.push({ x, y, lane })
    }
  }
  return out
}

/** Lot under an art-space point, or null (only the 96 px pads count, not the roads between). */
export function tileAt(ax: number, ay: number, plotRows: number): Tile | null {
  if (ax < PLOT_X0 || ax >= PLOT_X1) return null
  const c = Math.floor((ax - PLOT_X0) / LOT)
  const rel = ay - 2 * T
  if (rel < 0) return null
  const r = Math.floor(rel / (4 * T))
  if (r >= plotRows) return null
  if (rel - r * 4 * T >= LOT) return null
  return [c, r]
}

export const tileKey = (t: Tile): string => `${t[0]},${t[1]}`

// ---------- flow routes ----------

/** Lane offsets on the road so links that share a road stay readable. */
export const LANE_OFFSET = { internal: -4, town: 5, import: 5, otherDc: -9 } as const

function lotFront(tile: Tile, off: number): { stub: Pt; road: Pt } {
  const r = lotRect(tile)
  const x = r.x + 48
  return { stub: [x, r.y + 84], road: [x, roadCenterY(tile[1] + 1) + off] }
}

/** Removes repeated points so segment lengths are never 0. */
function clean(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p)
  }
  return out
}

/** Plant lot to datacenter lot, along the road rows and the nearer side road. */
export function routeLots(a: Tile, b: Tile, off: number = LANE_OFFSET.internal): Pt[] {
  const fa = lotFront(a, off)
  const fb = lotFront(b, off)
  if (a[1] === b[1]) return clean([fa.stub, fa.road, fb.road, fb.stub])
  const side = (fa.road[0] + fb.road[0]) / 2 < WORLD_W / 2 ? WEST_X + off : EAST_X + off
  return clean([fa.stub, fa.road, [side, fa.road[1]], [side, fb.road[1]], fb.road, fb.stub])
}

/** The town hall's east door step, where the town link ends. */
export const TOWN_END: Pt = [116, LANE_ROW0 * T + 18]
/** The substation foot point (its sprite is anchored here). */
export const SUBSTATION_FOOT: Pt = [668, 120]

/** Plant lot to the town hall: road row, west road, up to the first town lane, west to the hall. */
export function routeToTown(a: Tile, off: number = LANE_OFFSET.town): Pt[] {
  const fa = lotFront(a, off)
  return clean([fa.stub, fa.road, [WEST_X - off, fa.road[1]], [WEST_X - off, TOWN_END[1]], TOWN_END])
}

/** Substation to a datacenter lot: down to the branch road, west to the east road, along it, in. */
export function routeFromSubstation(b: Tile, off: number = LANE_OFFSET.import): Pt[] {
  const fb = lotFront(b, off)
  const branchY = BRANCH_ROW * T + T / 2 + off
  const sx = SUBSTATION_FOOT[0] - 10
  return clean([[sx, SUBSTATION_FOOT[1] + 2], [sx, branchY], [EAST_X + off, branchY], [EAST_X + off, fb.road[1]], fb.road, fb.stub])
}

/** Plant lot to the substation (power offered to other datacenters): the reverse trip. */
export function routeToSubstation(a: Tile, off: number = LANE_OFFSET.otherDc): Pt[] {
  return routeFromSubstation(a, off).reverse()
}

export interface Polyline {
  pts: Pt[]
  /** Cumulative length at each point. */
  cum: number[]
  length: number
}

export function polyline(pts: Pt[]): Polyline {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  return { pts, cum, length: cum[cum.length - 1] }
}

/** Point at distance d along a polyline (clamped to its ends). */
export function pointAt(pl: Polyline, d: number): Pt {
  const { pts, cum, length } = pl
  if (pts.length === 1 || d <= 0) return pts[0]
  if (d >= length) return pts[pts.length - 1]
  let i = 1
  while (cum[i] < d) i++
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1])
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
}

/**
 * Dot speed in art px per second for the MW a link carries: on a log scale, so 2 vs 4 MW and
 * 40 vs 80 MW both read as a step, up to a cap no real flow reaches.
 */
export function flowSpeed(mw: number): number {
  if (!(mw > 0)) return 0
  return Math.min(140, 8 + 26 * Math.log(1 + mw))
}

/** Spacing of flow dots, art px: 24 for a trickle down to 10 for the biggest flows (log scale). */
export function dotGap(mw: number): number {
  if (!(mw > 0)) return 24
  const t = Math.min(1, Math.log(1 + mw) / Math.log(1 + 150))
  return Math.round(24 - 14 * t)
}

/**
 * Moves an axis-aligned route onto the right-hand lane of each road it uses: eastbound below the
 * centre line, westbound above, southbound west of it, northbound east of it. Each direction then
 * has its own lane, so opposite flows on one road never mix their dots. Corners land where the two
 * shifted lanes meet.
 */
export function laneShift(pts: Pt[], d = 5): Pt[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]] as Pt)
  const seg = (i: number): Pt => {
    // shift of segment i (from pts[i] to pts[i + 1]): [dx, dy]
    const a = pts[i]
    const b = pts[i + 1]
    if (a[1] === b[1]) return [0, b[0] >= a[0] ? d : -d]
    return [b[1] >= a[1] ? -d : d, 0]
  }
  return pts.map((p, i) => {
    let dx = 0
    let dy = 0
    for (const j of [i - 1, i]) {
      if (j < 0 || j >= pts.length - 1) continue
      const [sx, sy] = seg(j)
      if (sx) dx = sx
      if (sy) dy = sy
    }
    return [p[0] + dx, p[1] + dy] as Pt
  })
}

/** Pairs plants with datacenters so every one of them has a route and nothing is drawn twice. */
export function pairUp<A, B>(as: A[], bs: B[]): [A, B][] {
  if (as.length === 0 || bs.length === 0) return []
  const n = Math.max(as.length, bs.length)
  const out: [A, B][] = []
  for (let i = 0; i < n; i++) out.push([as[i % as.length], bs[i % bs.length]])
  return out
}

// ---------- camera ----------

export interface CamInput {
  /** Viewport in CSS px. */
  viewW: number
  viewH: number
  dpr: number
  /** Width the open side sheet covers on desktop, CSS px (0 when closed or on phones). */
  sheetW: number
  phone: boolean
}

/**
 * Device-pixel scale of the world: an integer number of device pixels per art pixel, so every
 * sprite pixel is a whole block of device pixels. Desktop aims at 2-3 CSS px per art px with the
 * plot and its roads in view; phones fit the 4 lots across at about 1 CSS px per art px.
 */
export function pickScale({ viewW, dpr, sheetW, phone }: CamInput): number {
  const d = dpr > 0 && Number.isFinite(dpr) ? dpr : 1
  const dev = viewW * d
  const cap = Math.max(1, Math.floor(3 * d + 1e-6))
  const coreW = CORE.x1 - CORE.x0
  const lotsW = PLOT_X1 - PLOT_X0
  if (!phone) {
    const kCore = Math.floor(dev / coreW)
    const kLots = Math.floor(((viewW - sheetW) * d) / lotsW)
    let k = Math.min(cap, kCore, kLots)
    if (k < 2 * d) k = Math.min(cap, kCore)
    if (k >= Math.max(1, Math.round(d))) return Math.max(1, k)
  }
  const kLots = Math.floor((dev - 8 * d) / lotsW)
  return Math.max(1, Math.min(cap, Math.max(kLots, Math.round(d))))
}

/** Visible part of the viewport in CSS px (the part the sheet does not cover). */
export interface Safe {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Clamps a camera position (art px at the viewport's top-left) so the world covers the safe rect.
 * `top` lets the camera show that many art px above the world's first row (sprites that stand on
 * the top verge reach above y = 0); `centreY` centres a world shorter than the view instead of
 * hanging it from the top.
 */
export function clampCam(cx: number, cy: number, s: number, safe: Safe, worldW: number, worldH: number, opts: { top?: number; centreY?: boolean } = {}): Pt {
  const axis = (c: number, a0: number, a1: number, lo: number, hi: number, centre: boolean): number => {
    const span = (a1 - a0) / s
    const size = hi - lo
    if (size <= span) return centre ? lo - (a0 + (a1 - a0 - size * s) / 2) / s : lo - a0 / s
    return Math.min(hi - a1 / s, Math.max(lo - a0 / s, c))
  }
  const top = Math.max(0, opts.top ?? 0)
  return [axis(cx, safe.x0, safe.x1, 0, worldW, true) || 0, axis(cy, safe.y0, safe.y1, -top, worldH, !!opts.centreY) || 0]
}

/** Smallest camera move that brings rect r (art px) into the safe rect, with a margin. */
export function ensureVisible(cx: number, cy: number, s: number, safe: Safe, r: Rect, margin = 12): Pt {
  const axis = (c: number, a0: number, a1: number, lo: number, hi: number): number => {
    const v0 = c + a0 / s
    const v1 = c + a1 / s
    // Too big to fit, or off the near edge: align its top / left edge.
    if (hi - lo + 2 * margin > v1 - v0 || lo - margin < v0) return lo - margin - a0 / s
    if (hi + margin > v1) return hi + margin - a1 / s
    return c
  }
  return [axis(cx, safe.x0, safe.x1, r.x, r.x + r.w), axis(cy, safe.y0, safe.y1, r.y, r.y + r.h)]
}

/** Left edges (art px) that never slice a column of houses or the town hall. */
export const TOWN_SNAPS = [0, 34, 66, 96, 128, 160]

/**
 * Camera x (art px at the safe rect's left edge) for the default framing of a view `span` art px
 * wide: the whole world when it fits; else the town and the plot from the left edge, dropping the
 * grid side first; on a narrower view the plot stays whole and the town is cut at a gap between
 * house columns, never through one; with no room for the town at all, the lots are centred.
 */
export function frameX(span: number): number {
  if (span >= WORLD_W) return (WORLD_W - span) / 2
  const need = PLOT_X1 + 12 // the lots and the near half of the east road
  const left = need - span
  if (left <= 0) return 0
  const snap = TOWN_SNAPS.find((x) => x >= left)
  if (snap != null) return snap
  // no room for any of the town: centre the lots (phones)
  return (PLOT_X0 + PLOT_X1) / 2 - span / 2
}

// ---------- deterministic variety ----------

export function hash(a: number, b: number, salt = 0): number {
  let h = (a * 374761393 + b * 668265263 + salt * 1442695041) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
