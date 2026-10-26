// Building sites: the tower crane and the small / big scaffolds.
import { Canvas, C, building, box, softShadow } from './raster.mjs'

// --- crane, 64 x 96: yellow / black lattice, readable hook ---

const MAST_X = 18 // left column of the 5 px mast
const JIB_Y = 14
const HOOK = [50, 52]
const CRANE_FOOT = [20, 93]

function crane() {
  const cv = new Canvas(64, 96)
  softShadow(cv, CRANE_FOOT[0] + 4, CRANE_FOOT[1] + 1, 11, 2.5)
  const Y = (t) => C(t)
  // mast: two yellow chords, black zig-zag bracing, lit left chord
  for (let y = JIB_Y + 4; y < 94; y++) {
    cv.set(MAST_X - 1, y, Y('ink.0'))
    cv.set(MAST_X, y, Y('power.2'))
    cv.set(MAST_X + 4, y, Y('power.0'))
    cv.set(MAST_X + 5, y, Y('ink.0'))
    const k = (y - JIB_Y) % 6
    // diagonal braces alternate direction each section
    const bx = Math.floor((y - JIB_Y) / 6) % 2 ? MAST_X + 1 + Math.min(2, k >> 1) : MAST_X + 3 - Math.min(2, k >> 1)
    cv.set(bx, y, Y('ink.1'))
    if (k === 0) for (let x = MAST_X + 1; x <= MAST_X + 3; x++) cv.set(x, y, Y('power.1'))
  }
  // concrete base block
  cv.rect(MAST_X - 4, 90, 14, 5, Y('stone.1'))
  cv.hline(MAST_X - 4, MAST_X + 9, 90, Y('stone.2'))
  cv.hline(MAST_X - 4, MAST_X + 9, 94, Y('stone.0'))
  cv.vline(MAST_X - 5, 90, 94, Y('ink.0'))
  cv.vline(MAST_X + 10, 90, 94, Y('ink.0'))
  cv.hline(MAST_X - 4, MAST_X + 9, 95, Y('ink.0'))

  // jib (right) and counter-jib (left): a 4 px truss
  const jx0 = 2
  const jx1 = 62
  for (let x = jx0; x <= jx1; x++) {
    cv.set(x, JIB_Y - 1, Y('ink.0'))
    cv.set(x, JIB_Y, Y('power.2'))
    cv.set(x, JIB_Y + 3, Y('power.0'))
    cv.set(x, JIB_Y + 4, Y('ink.0'))
    const k = x % 4
    cv.set(x, JIB_Y + 1 + (k < 2 ? k : 3 - k), Y('ink.1'))
    if (k === 0) cv.vline(x, JIB_Y + 1, JIB_Y + 2, Y('power.1'))
  }
  cv.vline(jx0 - 1, JIB_Y - 1, JIB_Y + 4, Y('ink.0'))
  cv.vline(jx1 + 1, JIB_Y - 1, JIB_Y + 4, Y('ink.0'))
  // counterweight blocks under the counter-jib
  cv.rect(3, JIB_Y + 5, 9, 7, Y('stone.0'))
  cv.rect(3, JIB_Y + 5, 9, 1, Y('stone.1'))
  cv.vline(3, JIB_Y + 5, JIB_Y + 11, Y('stone.1'))
  cv.hline(3, 11, JIB_Y + 8, Y('ink.2'))
  cv.rect(2, JIB_Y + 12, 11, 1, Y('ink.0'))
  cv.vline(2, JIB_Y + 5, JIB_Y + 11, Y('ink.0'))
  cv.vline(12, JIB_Y + 5, JIB_Y + 11, Y('ink.0'))
  // apex tower and tie lines to both ends
  for (let y = 2; y < JIB_Y - 1; y++) {
    cv.set(MAST_X + 1, y, Y('power.1'))
    cv.set(MAST_X + 2, y, Y('power.0'))
    cv.set(MAST_X, y, Y('ink.0'))
    cv.set(MAST_X + 3, y, Y('ink.0'))
  }
  cv.hline(MAST_X, MAST_X + 3, 1, Y('ink.0'))
  cv.set(MAST_X + 1, 0, Y('status.2'))
  cv.line(MAST_X + 3, 3, jx1 - 2, JIB_Y - 2, Y('ink.2'))
  cv.line(MAST_X, 3, jx0 + 2, JIB_Y - 2, Y('ink.2'))
  // operator cab under the jib, beside the mast
  cv.rect(MAST_X + 6, JIB_Y + 5, 7, 6, Y('cream.1'))
  cv.rect(MAST_X + 8, JIB_Y + 6, 4, 3, Y('grid.1'))
  cv.set(MAST_X + 8, JIB_Y + 6, Y('grid.2'))
  cv.hline(MAST_X + 6, MAST_X + 12, JIB_Y + 5, Y('cream.2'))
  cv.hline(MAST_X + 6, MAST_X + 12, JIB_Y + 10, Y('stone.1'))
  cv.vline(MAST_X + 13, JIB_Y + 5, JIB_Y + 11, Y('ink.0'))
  cv.hline(MAST_X + 6, MAST_X + 13, JIB_Y + 11, Y('ink.0'))
  // trolley, cable and hook block
  const [hx, hy] = HOOK
  cv.rect(hx - 3, JIB_Y + 4, 6, 3, Y('ink.1'))
  cv.hline(hx - 3, hx + 2, JIB_Y + 4, Y('stone.1'))
  cv.vline(hx - 1, JIB_Y + 7, hy - 6, Y('ink.1'))
  cv.vline(hx, JIB_Y + 7, hy - 6, Y('ink.1'))
  cv.rect(hx - 3, hy - 6, 6, 4, Y('cream.0'))
  cv.hline(hx - 3, hx + 2, hy - 6, Y('cream.2'))
  cv.set(hx - 2, hy - 4, Y('ink.0'))
  cv.set(hx, hy - 4, Y('ink.0'))
  cv.set(hx + 1, hy - 4, Y('ink.0'))
  cv.hline(hx - 4, hx + 3, hy - 7, Y('ink.0'))
  cv.hline(hx - 4, hx + 3, hy - 2, Y('ink.0'))
  cv.vline(hx - 4, hy - 6, hy - 3, Y('ink.0'))
  cv.vline(hx + 3, hy - 6, hy - 3, Y('ink.0'))
  // the hook itself: a dark J
  cv.vline(hx, hy - 1, hy + 1, Y('ink.0'))
  cv.set(hx - 1, hy + 2, Y('ink.0'))
  cv.set(hx - 2, hy + 1, Y('ink.0'))
  cv.set(hx, hy + 2, Y('ink.0'))
  return cv
}

// --- scaffolds: a foundation slab, half-built walls, a pipe scaffold ---

/** A scaffold tower: two tube columns, ledgers with wooden planks, one brace per lift. */
function scaffoldTower(cv, x, y, w, h) {
  for (const px of [x, x + w]) {
    cv.vline(px, y, y + h, C('stone.2'))
    cv.vline(px + 1, y + 1, y + h, C('stone.0'))
  }
  for (let py = y + 3; py < y + h; py += 9) {
    cv.hline(x + 1, x + w, py - 2, C('dirt.2'))
    cv.hline(x + 1, x + w, py - 1, C('dirt.1'))
    cv.hline(x, x + w + 1, py, C('stone.0'))
    if (py + 9 <= y + h) cv.line(x + 2, py + 8, x + w - 1, py + 1, C('stone.1'))
  }
}

/** A concrete column rising from the slab, lit on the left. */
function column(cv, x, top, bottom) {
  cv.rect(x, top, 3, bottom - top, C('stone.1'))
  cv.vline(x, top, bottom - 1, C('stone.2'))
  cv.vline(x + 2, top, bottom - 1, C('stone.0'))
  cv.hline(x, x + 2, top, C('cream.1'))
  cv.vline(x + 1, top - 3, top - 1, C('dirt.0'))
}

function hazard(cv, x, y, w) {
  for (let i = 0; i < w; i++) {
    const on = (i >> 1) % 2 === 0
    cv.set(x + i, y, C(on ? 'cream.2' : 'ink.0'))
    cv.set(x + i, y + 1, C(on ? 'cream.0' : 'ink.1'))
  }
  cv.vline(x, y, y + 4, C('stone.0'))
  cv.vline(x + w - 1, y, y + 4, C('stone.0'))
}

function pallet(cv, x, y) {
  box(cv, x, y, 8, 3, 3, { roof: ['dirt.0', 'dirt.1', 'dirt.2'], wall: ['dirt.0', 'dirt.1', 'dirt.2'] })
  cv.vline(x + 4, y + 3, y + 5, C('dirt.0'))
}

function cone(cv, x, y) {
  cv.set(x + 1, y, C('plant.2'))
  cv.hline(x, x + 2, y + 1, C('cream.2'))
  cv.hline(x, x + 2, y + 2, C('plant.1'))
  cv.hline(x - 1, x + 3, y + 3, C('ink.1'))
}

function scaffold(size) {
  const small = size === 'small'
  const S = small ? 64 : 96
  const foot = small ? [32, 56] : [48, 86]
  const img = building(
    S,
    S,
    (cv) => {
      const m = small ? 5 : 6
      const bottom = foot[1]
      const slabTop = small ? 26 : 38
      // dug ground, then the slab seen from above with its front edge
      cv.rect(m, slabTop - 2, S - m * 2, bottom - slabTop + 2, C('dirt.1'))
      for (let y = slabTop - 2; y < bottom; y++) for (let x = m; x < S - m; x++) if (((x * 31) ^ (y * 17)) % 13 === 0) cv.set(x, y, C('dirt.0'))
      const sx = m + 3
      const sw = S - m * 2 - 6
      const sh = bottom - slabTop - 8
      // the slab plane seen from above: pale, one joint, a front edge in shade
      cv.rect(sx, slabTop, sw, sh, C('stone.2'))
      cv.markUp(sx, slabTop, sw, sh)
      cv.hline(sx, sx + sw - 1, slabTop, C('cream.1'))
      cv.vline(sx, slabTop, slabTop + sh - 1, C('cream.1'))
      cv.rect(sx, slabTop + sh, sw, 3, C('stone.0'))
      cv.hline(sx, sx + sw - 1, slabTop + sh, C('stone.1'))
      cv.hline(sx + 1, sx + Math.floor(sw * 0.55) - 2, slabTop + Math.floor(sh / 2), C('stone.1'))
      // rebar still to pour: 1 px bars on a 3 px pitch over the formwork
      const mx = sx + Math.floor(sw * 0.55)
      cv.rect(mx, slabTop + 2, sx + sw - 2 - mx, sh - 4, C('stone.1'))
      for (let y = slabTop + 2; y < slabTop + sh - 2; y++) {
        for (let x = mx; x < sx + sw - 2; x++) {
          if ((x - mx) % 3 === 1 || (y - slabTop) % 3 === 0) cv.set(x, y, C('dirt.0'))
        }
      }
      cv.hline(mx, sx + sw - 3, slabTop + sh - 2, C('stone.0'))
      // the back wall going up: dark block courses, a ragged top stepping down to the right
      const wallTop = small ? 12 : 18
      const wallBottom = slabTop + 4
      const isWall = new Set()
      for (let x = sx; x < sx + sw; x++) {
        const t = (x - sx) / sw
        const rag = Math.min(9, Math.floor(t * 4) * 3 + ((x >> 1) % 5 === 0 ? 1 : 0))
        cv.vline(x, wallTop + rag, wallBottom, C('stone.1'))
        for (let y = wallTop + rag + 1; y <= wallBottom; y++) isWall.add(x * 1000 + y)
        cv.set(x, wallTop + rag, C('cream.1'))
        cv.markUp(x, wallTop + rag, 1, 1)
      }
      for (let y = wallTop + 4; y < wallBottom; y += 3) {
        for (let x = sx; x < sx + sw; x++) if (isWall.has(x * 1000 + y)) cv.set(x, y, C('stone.0'))
        for (let x = sx + (((y / 3) | 0) % 2) * 3; x < sx + sw; x += 6) if (isWall.has(x * 1000 + y - 2)) cv.vline(x, y - 2, y - 1, C('stone.0'))
      }
      cv.vline(sx, wallTop + 2, wallBottom, C('stone.2'))
      // window openings in the back wall
      const holes = small ? [sx + 12, sx + sw - 18] : [sx + 14, sx + 36, sx + sw - 22]
      for (const hx of holes) {
        cv.rect(hx, wallTop + 9, 6, 7, C('ink.2'))
        cv.hline(hx, hx + 5, wallTop + 9, C('ink.1'))
      }
      // front columns standing on the slab
      const colTop = small ? 30 : 46
      const colBottom = slabTop + sh
      const cols = small ? [sx + 2, sx + sw - 5] : [sx + 2, sx + Math.floor(sw / 2) - 1, sx + sw - 5]
      for (const cx of cols) column(cv, cx, colTop, colBottom)
      // scaffold tower on the left side
      scaffoldTower(cv, sx - 2, wallTop - 2, small ? 11 : 14, colBottom - wallTop + 2)
      // sand pile and props in front
      cv.ellipse(S - m - 10, bottom - 5, 6, 3, (x, y, u, v) => C(u + v < -0.4 ? 'cream.0' : u + v < 0.5 ? 'dirt.2' : 'dirt.1'))
      hazard(cv, sx + (small ? 12 : 20), bottom - 6, small ? 16 : 24)
      pallet(cv, small ? sx + sw - 24 : sx + sw - 36, bottom - 9)
      cone(cv, sx + (small ? 7 : 12), bottom - 5)
      if (!small) cone(cv, sx + 50, bottom - 5)
    },
    { cast: { wall: 8 } },
  )
  return { img, foot }
}

/**
 * A tarp hung on the scaffold tower, drawn in pale neutrals so the map can
 * tint it orange (a plant going up) or violet (a datacenter going up).
 */
function tarp(size) {
  const small = size === 'small'
  const S = small ? 64 : 96
  const cv = new Canvas(S, S)
  const m = small ? 5 : 6
  const x0 = m + 2
  const w = (small ? 11 : 14) - 1
  const top = (small ? 12 : 18) - 1
  const bottom = small ? 44 : 70
  for (let y = top; y <= bottom; y++) {
    for (let x = x0; x <= x0 + w; x++) {
      // vertical folds: lit crest, mid, shaded trough
      const k = (x - x0) % 4
      let t = k === 0 ? 'cream.2' : k === 3 ? 'stone.1' : 'cream.0'
      if (y === top) t = 'cream.2'
      if (y === bottom && (x - x0) % 2) continue
      cv.set(x, y, C(t))
    }
  }
  // tie points along the top
  for (let x = x0; x <= x0 + w; x += 4) cv.set(x, top, C('ink.1'))
  const out = new Canvas(S, S)
  out.blit(cv, 0, 0)
  out.outline(C('ink.0'))
  return out
}

export function constructionFrames() {
  const small = scaffold('small')
  const big = scaffold('big')
  return [
    { name: 'crane', canvas: crane(), points: { hook: HOOK, foot: CRANE_FOOT, jib: [[2, JIB_Y], [62, JIB_Y]] } },
    { name: 'scaffold_small', canvas: small.img, points: { foot: small.foot } },
    { name: 'scaffold_big', canvas: big.img, points: { foot: big.foot } },
    { name: 'tarp_small', canvas: tarp('small') },
    { name: 'tarp_big', canvas: tarp('big') },
  ]
}
