// Town (green roofs) and grid (blue): houses, the town hall, the
// substation, pylons and poles.
import { Canvas, C, building, box } from './raster.mjs'

const MID = ['town.0', 'town.1', 'town.2']
const DARK = ['ink.2', 'town.0', 'town.1']

/** Paint a roof pixel and flag it as facing the sky (snow lands there). */
function roofPx(cv, x, y, c) {
  cv.set(x, y, c)
  cv.markUp(x, y, 1, 1)
}

/**
 * A roof plane seen from above. Light from the top-left: a lit ridge row,
 * light dabs on the left third, heavier shade on the right third, a dark
 * eave row and a 1 px cast shadow on the wall below.
 *  style 'shingle': scalloped courses, 'seam': standing-seam metal,
 *  'thatch': ragged straw courses with a shaggy eave.
 * `inside(x, y)` clips the plane to a non-rectangular outline (hips, gables).
 */
function roof(cv, x, y, w, h, { tones = MID, style = 'shingle', inside = () => true, cast = true } = {}) {
  const [d, m, l] = tones
  const third = (i) => (i - x < w / 3 ? 0 : i - x < (2 * w) / 3 ? 1 : 2)
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (!inside(i, j)) continue
      const row = j - y
      const t = third(i)
      let tone = m
      if (row === 0) tone = l
      else if (j === y + h - 1) tone = d
      else if (style === 'shingle') {
        const course = Math.floor((row - 1) / 3)
        const k = (row - 1) % 3
        const off = (course % 2) * 2
        if (k === 2 && (i + off) % 3 === 0) tone = d
        else if (k === 2 && t === 2 && (i + off) % 3 === 1) tone = d
        else if (k === 0 && t === 0 && (i + off) % 3 === 1) tone = l
      } else if (style === 'seam') {
        const s = (i - x) % 3
        if (s === 0) tone = t === 2 ? d : l
        else if (s === 2) tone = d
      } else if (style === 'thatch') {
        const n = (i * 7 + row * 13 + ((i * row) % 5)) % 9
        if (row % 2 === 1 && n < 3) tone = d
        else if (row % 2 === 0 && n === 4 && t < 2) tone = l
        else if (t === 2 && n === 7) tone = d
      }
      roofPx(cv, i, j, C(tone))
    }
  }
  if (style === 'thatch') {
    // shaggy eave: a ragged fringe hanging one row lower
    for (let i = x; i < x + w; i++) if (inside(i, y + h - 1) && (i * 5) % 3 !== 0) roofPx(cv, i, y + h, C(d))
  }
  if (cast) for (let i = x + 1; i < x + w; i++) if (inside(i, y + h - 1) && !cv.isUp(i, y + h + (style === 'thatch' ? 1 : 0))) cv.set(i, y + h + (style === 'thatch' ? 1 : 0), C('ink.1'))
}

function window_(cv, x, y, w = 3, h = 3, { box: flowerBox = false } = {}) {
  cv.rect(x, y, w, h, C('grid.1'))
  cv.set(x, y, C('grid.2'))
  if (w > 3) cv.vline(x + (w >> 1), y, y + h - 1, C('cream.1'))
  cv.hline(x, x + w - 1, y + h, C('cream.0'))
  cv.light(x, y, w, h)
  if (flowerBox) {
    // a window box under the sill with pink and cream blooms
    cv.hline(x - 1, x + w, y + h + 1, C('dirt.0'))
    for (let i = x - 1; i <= x + w; i++) cv.set(i, y + h, C((i - x) % 2 ? 'blossom' : 'grass.1'))
    cv.set(x, y + h, C('cream.2'))
  }
}

/** A door with a stone step and a short trodden path stub below it. */
function door(cv, x, y, h = 6, tone = 'dirt.0') {
  cv.rect(x, y, 3, h, C(tone))
  cv.vline(x, y, y + h - 1, C('dirt.1'))
  cv.set(x + 2, y + (h >> 1), C('power.1'))
  cv.hline(x - 1, x + 3, y + h, C('stone.2'))
  cv.set(x + 3, y + h, C('stone.1'))
}

/** Path stub, drawn after the outline so it reads as ground, not building. */
function pathStub(cv, x, y) {
  cv.hline(x, x + 2, y, C('dirt.2'))
  cv.hline(x, x + 2, y + 1, C('dirt.1'))
  cv.set(x + 1, y + 2, C('dirt.2'))
  cv.set(x, y + 1, C('dirt.2'))
}

function chimney(cv, x, y, h = 5) {
  cv.rect(x, y, 3, h, C('brick'))
  cv.vline(x, y, y + h - 1, C('dirt.2'))
  cv.vline(x + 2, y + 1, y + h - 1, C('rust'))
  cv.hline(x, x + 2, y, C('stone.1'))
  cv.markUp(x, y + 1, 3, h - 1, 0)
  cv.markUp(x, y, 3, 1, 1)
}

/** Wall block with a lit left edge and a dark base. */
function wall(cv, x, y, w, h, tones) {
  cv.rect(x, y, w, h, C(tones[1]))
  cv.vline(x, y, y + h - 1, C(tones[2]))
  cv.vline(x + w - 1, y, y + h - 1, C(tones[0]))
  cv.hline(x, x + w - 1, y + h - 1, C(tones[0]))
  cv.markUp(x, y, w, h, 0)
}

const CREAM = ['cream.0', 'cream.1', 'cream.2']
const HOUSE_FOOT = [16, 28]

// Each house returns its chimney top (where the map puffs smoke) and its door stub.
const HOUSES = [
  // 0: cottage with an L-wing reaching forward on the right; dark shingle roof
  (cv) => {
    chimney(cv, 8, 5, 6)
    wall(cv, 4, 17, 16, 11, CREAM)
    roof(cv, 3, 9, 18, 8, { tones: DARK })
    // the wing: its gable end faces us
    wall(cv, 20, 18, 9, 10, CREAM)
    roof(cv, 19, 11, 11, 7, { tones: DARK, style: 'seam' })
    door(cv, 13, 21, 6)
    window_(cv, 6, 20, 4, 3, { box: true })
    window_(cv, 23, 21)
    return { chimney: [9, 4], stub: [13, 29] }
  },
  // 1: wide wooden house, hipped standing-seam roof, porch on two posts
  (cv) => {
    wall(cv, 5, 19, 22, 9, ['dirt.0', 'dirt.2', 'cream.0'])
    for (let r = 21; r < 27; r += 2) cv.hline(6, 25, r, C('dirt.1'))
    const hip = (i, j) => i >= 7 - Math.floor(((j - 9) * 3) / 9) && i <= 24 + Math.floor(((j - 9) * 3) / 9)
    roof(cv, 4, 9, 24, 10, { style: 'seam', inside: hip })
    // porch: a lean-to roof on two posts
    cv.rect(13, 19, 13, 2, C('town.0'))
    cv.hline(13, 25, 19, C('town.1'))
    cv.markUp(13, 19, 13, 1)
    cv.hline(14, 25, 21, C('ink.1'))
    cv.vline(14, 21, 27, C('cream.2'))
    cv.vline(24, 21, 27, C('cream.0'))
    door(cv, 18, 22, 5, 'town.0')
    window_(cv, 7, 22, 4, 3, { box: true })
    return { chimney: null, stub: [18, 29] }
  },
  // 2: tall two-storey brick house, steep shingle roof, chimney
  (cv) => {
    chimney(cv, 18, 1, 5)
    wall(cv, 9, 12, 14, 16, ['rust', 'brick', 'dirt.2'])
    for (let r = 14; r < 27; r += 3) for (let i = 10; i < 22; i++) if ((i + r) % 5 === 0) cv.set(i, r, C('rust'))
    roof(cv, 8, 4, 16, 8)
    window_(cv, 11, 14, 3, 3, { box: true })
    window_(cv, 18, 14, 3, 3, { box: true })
    door(cv, 14, 21, 6, 'town.0')
    window_(cv, 19, 22)
    return { chimney: [19, 0], stub: [14, 29] }
  },
  // 3: front gable: the triangle faces the street; mossy thatch
  (cv) => {
    wall(cv, 7, 17, 18, 11, CREAM)
    const slope = (i, j) => Math.abs(i + 0.5 - 16) <= (j - 3) * 0.95
    roof(cv, 4, 4, 24, 13, { style: 'thatch', inside: slope })
    // gable wall triangle under the eaves, with a round attic window
    cv.poly([[16, 10], [10, 17], [22, 17]], C('cream.1'))
    cv.markUp(10, 10, 13, 8, 0)
    cv.ellipse(16, 14, 1.6, 1.6, C('grid.1'))
    cv.set(15, 13, C('grid.2'))
    cv.light(15, 13, 2, 2)
    door(cv, 15, 22, 5, 'dirt.0')
    window_(cv, 9, 20, 3, 3, { box: true })
    window_(cv, 20, 20, 3, 3, { box: true })
    return { chimney: null, stub: [15, 29] }
  },
  // 4: bungalow with a side shed on the left; dark roof, flower box
  (cv) => {
    chimney(cv, 22, 7, 5)
    wall(cv, 9, 19, 20, 9, ['stone.0', 'stone.2', 'cream.2'])
    roof(cv, 8, 11, 22, 8, { tones: DARK })
    // the shed: lower, plank wall, seam roof
    wall(cv, 2, 21, 7, 7, ['dirt.0', 'dirt.1', 'dirt.2'])
    cv.vline(4, 22, 26, C('dirt.0'))
    cv.vline(6, 22, 26, C('dirt.0'))
    roof(cv, 1, 17, 8, 4, { tones: DARK, style: 'seam' })
    door(cv, 20, 21, 6)
    window_(cv, 11, 21, 5, 3, { box: true })
    window_(cv, 25, 21)
    return { chimney: [23, 6], stub: [20, 29] }
  },
  // 5: tiny round-window cottage, thatch, big chimney and a dormer
  (cv) => {
    chimney(cv, 6, 5, 8)
    wall(cv, 7, 20, 18, 8, ['dirt.1', 'cream.0', 'cream.2'])
    roof(cv, 5, 10, 22, 10, { style: 'thatch' })
    // dormer
    cv.rect(17, 9, 6, 5, C('cream.1'))
    cv.markUp(17, 9, 6, 5, 0)
    cv.poly([[16, 10], [20, 6], [24, 10]], (x, y) => {
      cv.markUp(x, y, 1, 1)
      return C(x < 20 ? 'town.2' : 'town.1')
    })
    cv.line(20, 6, 24, 10, C('town.0'))
    cv.rect(19, 11, 2, 2, C('grid.1'))
    cv.light(19, 11, 2, 2)
    door(cv, 10, 22, 5, 'rust')
    cv.ellipse(19.5, 23.5, 2, 2, C('grid.1'))
    cv.set(19, 23, C('grid.2'))
    cv.light(18, 22, 3, 3)
    cv.hline(17, 22, 26, C('cream.0'))
    return { chimney: [7, 4], stub: [10, 29] }
  },
]

function house(i) {
  let info
  const img = building(
    32,
    32,
    (cv) => {
      info = HOUSES[i](cv)
    },
    { cast: { wall: 8, reach: 3 } },
  )
  const [sx, sy] = info.stub
  pathStub(img, sx, sy)
  return { img, info }
}

// --- town hall: civic front, pediment with a clock, green roofs, flag ---

const HALL_FOOT = [32, 57]

function townhall() {
  return building(
    64,
    64,
    (cv) => {
      // wings
      for (const wx of [4, 42]) {
        wall(cv, wx + 1, 36, 16, 19, CREAM)
        roof(cv, wx, 27, 18, 9)
        window_(cv, wx + 4, 40, 4, 4)
        window_(cv, wx + 10, 40, 4, 4)
        window_(cv, wx + 4, 47, 4, 4, { box: true })
        window_(cv, wx + 10, 47, 4, 4, { box: true })
      }
      // central block, taller
      wall(cv, 21, 28, 22, 27, ['cream.0', 'cream.2', 'cream.2'])
      roof(cv, 20, 18, 24, 10, { cast: false })
      // pediment
      cv.poly([[32, 21], [20, 31], [44, 31]], C('cream.1'))
      cv.markUp(20, 21, 25, 11, 0)
      cv.line(32, 21, 20, 31, C('town.2'))
      cv.line(32, 21, 44, 31, C('town.0'))
      cv.hline(20, 44, 31, C('town.0'))
      cv.hline(20, 44, 32, C('stone.1'))
      cv.hline(21, 43, 33, C('ink.1'))
      // clock: a stone ring, hands at ten past twelve
      cv.ellipse(32.5, 27.5, 3, 3, C('stone.0'))
      cv.ellipse(32.5, 27.5, 2, 2, C('cream.2'))
      cv.vline(32, 25, 27, C('ink.1'))
      cv.set(33, 27, C('ink.1'))
      // columns
      for (const cx of [23, 28, 35, 40]) {
        cv.rect(cx, 34, 2, 17, C('cream.2'))
        cv.vline(cx + 1, 34, 50, C('cream.0'))
        cv.hline(cx - 1, cx + 2, 34, C('cream.1'))
      }
      // doorway (warm light inside at dusk), steps
      cv.rect(30, 42, 5, 9, C('ink.2'))
      cv.rect(30, 42, 5, 1, C('ink.1'))
      cv.light(30, 43, 5, 8)
      cv.hline(22, 42, 51, C('stone.2'))
      cv.hline(21, 43, 52, C('stone.1'))
      cv.hline(20, 44, 53, C('stone.0'))
      // bell tower and flag
      cv.rect(29, 10, 6, 8, C('cream.1'))
      cv.vline(29, 10, 17, C('cream.2'))
      cv.vline(34, 11, 17, C('cream.0'))
      cv.rect(31, 12, 2, 3, C('ink.2'))
      cv.markUp(29, 10, 6, 8, 0)
      cv.poly([[28, 10], [32, 5], [36, 10]], (x, y) => {
        cv.markUp(x, y, 1, 1)
        return C(x < 32 ? 'town.2' : 'town.1')
      })
      cv.line(32, 5, 36, 10, C('town.0'))
      cv.vline(32, 0, 5, C('stone.0'))
      cv.rect(33, 0, 5, 3, C('town.1'))
      cv.hline(33, 37, 0, C('town.2'))
      cv.set(37, 2, C('town.0'))
    },
    { cast: { wall: 20, reach: 4 } },
  )
}

// --- substation (blue): fenced yard, transformers, gantry, control hut ---

const SUB_FOOT = [32, 57]
const SUB_IN = [[13, 14], [51, 14]]

function transformer(cv, x, y) {
  box(cv, x, y, 12, 5, 9, { roof: ['grid.0', 'grid.1', 'grid.2'], wall: ['grid.0', 'grid.1', 'grid.2'] })
  // radiator fins on the front
  for (let k = 1; k < 11; k += 2) cv.vline(x + k, y + 7, y + 12, C('grid.0'))
  // bushings: cream insulator stacks
  for (const bx of [x + 2, x + 6, x + 9]) {
    cv.vline(bx, y - 4, y, C('cream.1'))
    for (let k = y - 4; k <= y; k += 2) cv.set(bx, k, C('stone.1'))
    cv.set(bx, y - 5, C('stone.0'))
  }
  // high-voltage sign
  cv.rect(x + 4, y + 8, 3, 3, C('power.1'))
  cv.set(x + 5, y + 9, C('ink.0'))
}

function substation() {
  return building(
    64,
    64,
    (cv) => {
      // gravel yard
      cv.rect(3, 22, 58, 34, C('stone.1'))
      for (let y = 23; y < 55; y++) {
        for (let x = 4; x < 60; x++) {
          const h = (x * 73856093) ^ (y * 83492791)
          if (h % 61 === 0) cv.set(x, y, C('stone.0'))
          else if (h % 67 === 1) cv.set(x, y, C('stone.2'))
        }
      }
      cv.hline(3, 60, 22, C('stone.2'))
      // gantry: two lattice towers and the cross beam with insulators
      for (const gx of [12, 50]) {
        for (let y = 14; y < 40; y++) {
          cv.set(gx, y, C('grid.2'))
          cv.set(gx + 2, y, C('grid.0'))
          if (y % 4 === 0) cv.set(gx + 1, y, C('grid.1'))
          else if (y % 4 === 2) cv.set(gx + 1, y, C('grid.0'))
        }
      }
      cv.hline(12, 52, 14, C('grid.2'))
      cv.hline(12, 52, 15, C('grid.0'))
      for (const ix of [20, 28, 36, 44]) {
        cv.vline(ix, 16, 19, C('cream.1'))
        cv.set(ix, 17, C('stone.1'))
        cv.set(ix, 20, C('stone.0'))
        // wires down to the busbar
        cv.vline(ix, 21, 25, C('ink.2'))
      }
      cv.hline(18, 46, 26, C('stone.0'))
      transformer(cv, 16, 32)
      transformer(cv, 34, 32)
      // control hut with a blue roof and a lit window
      box(cv, 46, 40, 13, 5, 10, { roof: ['grid.0', 'grid.1', 'grid.2'], wall: ['stone.0', 'cream.0', 'cream.1'] })
      cv.hline(47, 57, 45, C('ink.1'))
      cv.rect(49, 47, 3, 6, C('ink.2'))
      cv.rect(54, 47, 3, 2, C('grid.1'))
      cv.light(54, 47, 3, 2)
      // a yard lamp over the hut door
      cv.set(50, 46, C('cream.2'))
      cv.light(50, 46, 2, 1, 'lamp')
      // fence: posts every 6 px, a mesh line
      for (let x = 3; x < 61; x++) {
        cv.set(x, 51, C('stone.0'))
        cv.set(x, 54, C('stone.0'))
        if (x % 2) cv.set(x, 52, C('stone.0')), cv.set(x - 1, 53, C('stone.0'))
        if (x % 6 === 3) cv.vline(x, 49, 55, C('ink.2'))
      }
      // gate with ink / cream stripes
      for (let x = 26; x < 36; x++) {
        cv.set(x, 52, C(x % 4 < 2 ? 'cream.1' : 'ink.0'))
        cv.set(x, 53, C(x % 4 < 2 ? 'cream.0' : 'ink.1'))
      }
    },
    { cast: { wall: 10 } },
  )
}

// --- pylon (32 x 64) and pole (16 x 32), unoutlined thin structures ---

const PYLON_WIRES = [[3, 12], [28, 12], [6, 22], [25, 22]]

function pylon() {
  const cv = new Canvas(32, 64)
  shadowStrip(cv, 17, 61, 9)
  const left = (y) => Math.round(16 - 2 - (y - 6) * (8 / 54))
  const right = (y) => Math.round(16 + 1 + (y - 6) * (8 / 54))
  // lattice panels: a horizontal strut, then one clean diagonal at a constant slope
  const panels = [8, 15, 23, 31, 40, 50, 60]
  for (let k = 0; k + 1 < panels.length; k++) {
    const y0 = panels[k]
    const y1 = panels[k + 1]
    cv.hline(left(y0), right(y0), y0, C('grid.1'))
    const fwd = k % 2 === 0
    cv.line(fwd ? left(y0) : right(y0), y0, fwd ? right(y1) : left(y1), y1, C('grid.0'))
  }
  // legs, 1 px: lit left, shaded right
  for (let y = 6; y < 61; y++) {
    cv.set(left(y), y, C('grid.2'))
    cv.set(right(y), y, C('grid.0'))
  }
  // cross arms: lit top, shaded underside, braces back to the mast
  for (const [ay, half] of [[12, 13], [22, 10]]) {
    cv.hline(16 - half, 15 + half, ay - 1, C('grid.2'))
    cv.hline(16 - half, 15 + half, ay, C('grid.0'))
    cv.line(16 - half + 1, ay + 1, left(ay + 4), ay + 4, C('grid.1'))
    cv.line(15 + half - 1, ay + 1, right(ay + 4), ay + 4, C('grid.0'))
  }
  // insulators hanging under the arm tips
  for (const [wx, wy] of PYLON_WIRES) {
    cv.vline(wx, wy + 1, wy + 3, C('cream.1'))
    cv.set(wx, wy + 2, C('grid.2'))
  }
  // peak
  cv.vline(16, 2, 6, C('grid.0'))
  cv.vline(15, 3, 6, C('grid.2'))
  cv.set(15, 1, C('status.2'))
  // feet
  for (const fx of [left(60), right(60)]) {
    cv.rect(fx - 1, 60, 3, 2, C('stone.1'))
    cv.set(fx - 1, 60, C('stone.2'))
  }
  return cv
}

function shadowStrip(cv, cx, cy, rx) {
  for (let x = cx - rx; x <= cx + rx; x++) {
    const a = Math.abs(x - cx) < rx * 0.6 ? 90 : 46
    cv.px(x, cy, C('ink.1', a))
    if (Math.abs(x - cx - 2) < rx * 0.7) cv.px(x, cy + 1, C('ink.1', 46))
  }
}

const POLE_WIRES = [[2, 6], [13, 6]]

function pole() {
  return building(
    16,
    32,
    (cv) => {
      cv.rect(7, 4, 2, 26, C('dirt.1'))
      cv.vline(7, 4, 29, C('dirt.2'))
      cv.vline(8, 5, 29, C('dirt.0'))
      cv.rect(2, 7, 12, 2, C('dirt.1'))
      cv.hline(2, 13, 7, C('dirt.2'))
      cv.hline(2, 13, 8, C('dirt.0'))
      for (const [wx] of POLE_WIRES) {
        cv.vline(wx, 4, 6, C('grid.1'))
        cv.set(wx, 4, C('grid.2'))
      }
      cv.vline(8, 2, 3, C('grid.1'))
      cv.set(8, 2, C('grid.2'))
    },
    { shadow: { cx: 10, cy: 30, rx: 4, ry: 1.5 } },
  )
}

export function townFrames() {
  const out = []
  for (let i = 0; i < 6; i++) {
    const { img, info } = house(i)
    const points = { foot: HOUSE_FOOT, door: [info.stub[0] + 1, 28] }
    if (info.chimney) points.chimney = info.chimney
    out.push({ name: `house_${i}`, canvas: img, points, snow: true, lights: true })
  }
  out.push({ name: 'townhall', canvas: townhall(), points: { foot: HALL_FOOT, door: [32, 54] }, snow: true, lights: true })
  out.push({ name: 'substation', canvas: substation(), points: { wires: SUB_IN, foot: SUB_FOOT }, snow: true, lights: true })
  out.push({ name: 'pylon', canvas: pylon(), points: { wires: PYLON_WIRES, foot: [16, 61] } })
  out.push({ name: 'pole', canvas: pole(), points: { wires: POLE_WIRES, top: [8, 2], foot: [8, 30] } })
  return out
}
