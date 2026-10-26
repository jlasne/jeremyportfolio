// Plants (orange): the small solar + wind plant, the big gas station,
// turbine rotor frames, smoke puffs and the solar glint overlay.
import { Canvas, C, building, box } from './raster.mjs'

// --- plant_small: a low gravel bed with two long solar rows, an inverter
// hut and one wind turbine as the single vertical accent ---

const HUB = [51, 12]
const SMALL_FOOT = [32, 56]
const BED = { x0: 2, x1: 61, y0: 36, y1: 56 }

/**
 * One tilted solar module seen from above: aluminium frame, 2 x 2 cells on
 * dark grid lines, a diagonal sky reflection, a dark underside and legs.
 */
function solarModule(cv, mx, my, cells) {
  const mw = 14
  const mh = 7
  cv.markUp(mx, my, mw, mh + 2, 0)
  cv.rect(mx, my, mw, mh, C('ink.1'))
  cv.hline(mx, mx + mw - 1, my, C('stone.2'))
  cv.hline(mx, mx + mw - 1, my + mh - 1, C('stone.0'))
  cv.vline(mx, my, my + mh - 1, C('stone.1'))
  cv.vline(mx + mw - 1, my + 1, my + mh - 1, C('stone.0'))
  for (let y = my + 1; y < my + mh - 1; y++) {
    for (let x = mx + 1; x < mx + mw - 1; x++) {
      const line = (x - mx) % 3 === 0 || (y - my) % 3 === 0
      // the sky reflection: a 2-3 px diagonal stripe
      const d = x - mx - (y - my) * 1.5
      const sky = d >= 3 && d < 5.5
      cv.set(x, y, C(sky ? (line ? 'grid.1' : 'grid.2') : line ? 'ink.1' : 'ink.2'))
      cells?.push([x, y])
    }
  }
  // underside shadow and legs
  cv.hline(mx, mx + mw - 1, my + mh, C('ink.0'))
  cv.set(mx + 2, my + mh + 1, C('stone.0'))
  cv.set(mx + mw - 3, my + mh + 1, C('stone.0'))
}

function smallPlantBody(cv, cells) {
  const { x0, x1, y0, y1 } = BED
  cv.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, C('dirt.1'))
  cv.markUp(x0, y0, x1 - x0 + 1, y1 - y0 + 1)
  for (let y = y0 + 1; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) {
      const h = (x * 73856093) ^ (y * 19349663)
      if ((h & 63) === 0) cv.set(x, y, C('dirt.0'))
      else if ((h & 63) === 1) cv.set(x, y, C('dirt.2'))
    }
  }
  cv.hline(x0, x1, y1, C('dirt.0'))
  cv.vline(x1, y0, y1, C('dirt.0'))
  // orange safety rail: back rail with posts, side rails, front kerb
  cv.hline(x0, x1, y0, C('plant.1'))
  cv.hline(x0, x1, y0 + 1, C('plant.0'))
  cv.vline(x0, y0, y1, C('plant.2'))
  cv.vline(x0 + 1, y0 + 2, y1 - 1, C('plant.1'))
  cv.vline(x1, y0, y1, C('plant.0'))
  cv.hline(x0, x1, y1, C('plant.0'))
  for (let px = x0 + 5; px < x1; px += 8) {
    cv.vline(px, y0 - 2, y0, C('plant.1'))
    cv.set(px, y0 - 2, C('plant.2'))
  }

  // two long rows of three modules each
  for (const my of [y0 + 3, y0 + 12]) for (let m = 0; m < 3; m++) solarModule(cv, x0 + 2 + m * 15, my, cells)

  // turbine mast: tapering, lit on the left, two orange bands
  const [hx, hy] = HUB
  for (let y = hy + 2; y <= y0 + 4; y++) {
    const wide = y > hy + 14
    const xa = hx - 1
    const xb = wide ? hx + 1 : hx
    for (let x = xa; x <= xb; x++) {
      const band = (y >= hy + 7 && y <= hy + 8) || (y >= hy + 17 && y <= hy + 18)
      const tone = x === xa ? (band ? 'plant.2' : 'cream.2') : x === xb && wide ? (band ? 'plant.0' : 'stone.1') : band ? 'plant.1' : 'cream.0'
      cv.set(x, y, C(tone))
    }
  }
  // front-facing nacelle pod behind the rotor hub
  cv.rect(hx - 2, hy - 2, 4, 4, C('cream.0'))
  cv.vline(hx - 2, hy - 2, hy + 1, C('cream.2'))
  cv.vline(hx - 1, hy - 2, hy + 1, C('cream.2'))
  cv.hline(hx - 2, hx + 1, hy + 1, C('plant.1'))

  // inverter hut with an orange roof, in front of the mast foot
  const bx = 48
  const by = 40
  box(cv, bx, by, 12, 5, 9, { roof: ['plant.0', 'plant.1', 'plant.2'], wall: ['stone.0', 'cream.0', 'cream.1'] })
  cv.hline(bx + 1, bx + 10, by + 2, C('plant.2'))
  cv.hline(bx + 1, bx + 10, by + 5, C('ink.1'))
  cv.rect(bx + 2, by + 7, 3, 6, C('ink.2'))
  cv.vline(bx + 2, by + 7, by + 12, C('stone.0'))
  cv.rect(bx + 7, by + 7, 4, 3, C('grid.1'))
  cv.set(bx + 7, by + 7, C('grid.2'))
  cv.light(bx + 7, by + 7, 4, 3)
  // yellow high-voltage sign
  cv.set(bx + 8, by + 11, C('power.1'))
  cv.set(bx + 9, by + 11, C('power.0'))
}

function plantSmall() {
  const cells = []
  const img = building(64, 64, (cv) => smallPlantBody(cv, cells), { cast: { wall: 6 } })
  return { img, cells }
}

/** Rotor frames: three blades, 30 degrees apart per frame (120 deg symmetry). */
function blades(i) {
  const S = 24
  const c = 12.5
  const body = new Canvas(S, S)
  const L = 10.5
  for (let b = 0; b < 3; b++) {
    const a = (-90 + b * 120 + i * 30) * (Math.PI / 180)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const nx = -dy
    const ny = dx
    // the side facing the top-left light is the lit one
    const litSide = nx + ny < 0 ? 1 : -1
    for (let t = 1.5; t <= L; t += 0.25) {
      const offs = t < 5.5 ? [-0.5, 0.5] : [0]
      for (const o of offs) {
        const x = Math.floor(c + dx * t + nx * o)
        const y = Math.floor(c + dy * t + ny * o)
        let tone = t > L - 2.2 ? 'plant.1' : offs.length === 2 && Math.sign(o) === litSide ? 'cream.2' : 'cream.0'
        if (offs.length === 1 && t <= L - 2.2) tone = 'cream.1'
        body.set(x, y, C(tone))
      }
    }
  }
  body.rect(11, 11, 3, 3, C('stone.1'))
  body.set(11, 11, C('stone.2'))
  body.set(13, 13, C('stone.0'))
  body.outline(C('ink.0'))
  return body
}

// --- plant_big: gas station with a tall chimney and a cooling tower ---

const CHIMNEY_TOP = [17, 5]
const TOWER_TOP = [75, 27]
const BIG_FOOT = [48, 85]

function chimney(cv) {
  const [cx, ty] = CHIMNEY_TOP
  const bands = [[ty + 2, ty + 4], [ty + 8, ty + 10], [ty + 14, ty + 16]]
  for (let y = ty + 1; y <= 52; y++) {
    const x0 = cx - 3
    const x1 = cx + 3
    const band = bands.some(([a, b]) => y >= a && y <= b)
    for (let x = x0; x <= x1; x++) {
      const tone = x <= x0 ? 2 : x >= x1 - 1 ? 0 : 1
      cv.set(x, y, C(band ? ['plant.0', 'plant.1', 'plant.2'][tone] : ['stone.0', 'cream.0', 'cream.2'][tone]))
    }
  }
  // the rim, its dark mouth, the aviation light
  cv.rect(cx - 4, ty, 9, 2, C('stone.1'))
  cv.hline(cx - 4, cx + 4, ty, C('stone.2'))
  cv.hline(cx - 2, cx + 2, ty, C('ink.1'))
  cv.markUp(cx - 4, ty, 9, 1)
  cv.set(cx + 4, ty + 1, C('status.2'))
  cv.light(cx + 4, ty + 1, 1, 1, 'beacon')
  // service ladder
  for (let y = ty + 18; y < 50; y += 2) cv.set(cx + 1, y, C('stone.0'))
}

function coolingTower(cv) {
  const top = TOWER_TOP[1]
  const bottom = 84
  const cx = TOWER_TOP[0]
  // hyperbolic profile: waist 30% down, flaring to ~12 at the lip and ~16 at the base
  const yw = top + Math.round((bottom - top) * 0.3)
  const half = (y) => 9 * Math.sqrt(1 + ((y - yw) / (y < yw ? 19 : 27.5)) ** 2)
  for (let y = top; y <= bottom; y++) {
    const x0 = Math.round(cx + 0.5 - half(y))
    const x1 = Math.round(cx + 0.5 + half(y)) - 1
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0)
      let tone = u < 0.18 ? 'cream.2' : u < 0.5 ? 'cream.1' : u < 0.78 ? 'cream.0' : 'stone.1'
      if (u > 0.92) tone = 'stone.0'
      cv.set(x, y, C(tone))
    }
  }
  // the open top seen from above: a rim ellipse with a shadowed inside
  const rx = half(top)
  cv.ellipse(cx + 0.5, top + 1.5, rx, 3, C('cream.2'))
  cv.ellipse(cx + 0.5, top + 1.8, rx - 2, 2, C('ink.1'))
  cv.hline(cx - 6, cx + 5, top + 1, C('ink.0'))
  cv.markUp(Math.round(cx - rx), top - 1, Math.round(rx * 2) + 1, 2)
  // concrete ring joints
  for (const ry of [top + 20, top + 38]) {
    for (let x = 0; x < 96; x++) if (cv.alpha(x, ry) && cv.get(x, ry)[0] > 150) cv.set(x, ry, C(cv.get(x, ry)[2] > 220 ? 'cream.0' : 'stone.1'))
  }
  // two orange service bands near the lip
  for (const ry of [top + 5, top + 6, top + 10]) {
    const h = half(ry)
    for (let x = Math.round(cx + 0.5 - h); x <= Math.round(cx + 0.5 + h) - 1; x++) {
      const u = (x - (cx + 0.5 - h)) / (2 * h)
      cv.set(x, ry, C(u < 0.3 ? 'plant.2' : u < 0.75 ? 'plant.1' : 'plant.0'))
    }
  }
  // dark air intakes at the base
  for (let x = cx - 12; x <= cx + 12; x += 4) cv.rect(x, bottom - 3, 2, 3, C('ink.1'))
}

/** A small rooftop vent: lit top face, 1 px front face. */
function vent(cv, x, y, w) {
  cv.rect(x, y, w, 2, C('stone.2'))
  cv.set(x, y, C('cream.1'))
  cv.hline(x, x + w - 1, y + 2, C('stone.0'))
  cv.hline(x, x + w - 1, y + 3, C('plant.0'))
}

function hall(cv) {
  const x = 4
  const y = 46
  const w = 56
  const roofH = 12
  const wallH = 26
  box(cv, x, y, w, roofH, wallH, { roof: ['plant.0', 'plant.1', 'plant.2'], wall: ['stone.0', 'stone.1', 'stone.2'] })
  // roof plane: lit top row and left column, dark eave row, flat metal
  cv.hline(x, x + w - 1, y + roofH - 1, C('plant.0'))
  for (let k = x + 2; k < x + w - 2; k += 2) cv.set(k, y + 1, C('plant.2'))
  // skylights: foreshortened parallelograms, lit glass row over a dark one
  for (let k = 0; k < 3; k++) {
    const sx = x + 5 + k * 7
    cv.hline(sx + 1, sx + 4, y + 3, C('grid.2'))
    cv.hline(sx, sx + 3, y + 4, C('grid.0'))
    cv.hline(sx + 1, sx + 4, y + 6, C('grid.2'))
    cv.hline(sx, sx + 3, y + 7, C('grid.0'))
    cv.hline(sx, sx + 4, y + 8, C('plant.0'))
  }
  // rooftop vents
  for (const vx of [x + 30, x + 37, x + 44]) vent(cv, vx, y + 3, 5)
  // overhang shadow under the eave
  cv.hline(x + 1, x + w - 2, y + roofH, C('ink.1'))
  // wall cladding ribs
  for (let rx = x + 3; rx < x + w - 2; rx += 4) cv.vline(rx, y + roofH + 2, y + roofH + wallH - 2, C('stone.0'))
  // window strip: dark glass with a sky glint, orange mullions
  const wy = y + roofH + 4
  cv.rect(x + 3, wy, w - 6, 4, C('ink.2'))
  for (let wx = x + 3; wx < x + w - 3; wx++) {
    cv.set(wx, wy, C('stone.2'))
    if ((wx - x) % 6 === 2) cv.vline(wx, wy, wy + 3, C('plant.0'))
    else if ((wx - x) % 6 === 3) cv.set(wx, wy + 1, C('stone.1'))
  }
  for (let wx = x + 3; wx < x + w - 3; wx += 6) cv.light(wx, wy + 1, 5, 3)
  // roller door with an ink / cream hazard frame
  const dy = y + roofH + 11
  cv.rect(x + 8, dy, 14, wallH - 12, C('stone.0'))
  for (let k = 0; k < wallH - 12; k += 2) cv.hline(x + 9, x + 20, dy + 1 + k, C('ink.2'))
  for (let k = 0; k < 14; k++) cv.set(x + 8 + k, dy - 1, C(k % 4 < 2 ? 'cream.1' : 'ink.0'))
  // a person-door in orange and its lamp
  cv.rect(x + 28, dy + 4, 5, wallH - 16, C('plant.0'))
  cv.vline(x + 28, dy + 4, dy + wallH - 13, C('plant.1'))
  cv.set(x + 31, dy + 8, C('power.1'))
  cv.set(x + 30, dy + 1, C('power.2'))
  cv.set(x + 31, dy + 1, C('cream.1'))
  cv.light(x + 30, dy + 1, 2, 1, 'lamp')
}

function pipes(cv) {
  // an orange pipe from the hall to the tower, with lit top and flanges
  const y = 68
  for (let x = 58; x <= 66; x++) {
    cv.set(x, y, C('plant.2'))
    cv.set(x, y + 1, C('plant.1'))
    cv.set(x, y + 2, C('plant.0'))
  }
  for (const fx of [60, 64]) cv.vline(fx, y - 1, y + 3, C('plant.0'))
}

function plantBig() {
  return building(
    96,
    96,
    (cv) => {
      chimney(cv)
      coolingTower(cv)
      hall(cv)
      pipes(cv)
    },
    { cast: { wall: 22, reach: 6 } },
  )
}

// --- smoke and shimmer ---

// lobes per frame [cx, cy, r]; the puff grows, splits and rises
const SMOKE = [
  [[8, 11, 2.5]],
  [[8, 10.5, 3], [9.5, 11, 2.4]],
  [[7.5, 10, 3.4], [10, 9, 2.8], [6, 11.5, 2.2]],
  [[7.5, 9, 4], [10.5, 8, 3.2], [5.5, 11, 2.6]],
  [[8, 8, 4.6], [11, 6.5, 3.4], [5, 10, 3]],
]
const SMOKE_ALPHA = [255, 255, 255, 190, 110]

/**
 * A puff: opaque round body (lit top-left, body, shaded crescent bottom-
 * right) with a softer 1 px rim. Drawn light so the map can tint chimney
 * smoke grey and leave cooling-tower steam white.
 */
function smoke(i) {
  const cv = new Canvas(16, 16)
  const lobes = SMOKE[i]
  const inside = (x, y, grow = 0) => lobes.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= (r + grow) ** 2)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y)) continue
      const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      // light from the top-left: measure against the first lobe's centre
      const [cx, cy, r] = lobes[0]
      const k = ((x + 0.5 - cx) + (y + 0.5 - cy)) / r
      const shade = !inside(x + 1, y + 1, -0.6) && k > 0.2
      let tone = k < -0.7 ? 'cream.2' : shade ? 'stone.1' : 'stone.2'
      if (i === 0 && k < -0.2) tone = 'cream.2'
      const a = rim ? Math.round(SMOKE_ALPHA[i] * 0.6) : SMOKE_ALPHA[i]
      cv.set(x, y, C(tone, a))
    }
  }
  return cv
}

/** A diagonal glint sweeping over the solar cells only. */
function shimmer(i, cells) {
  const cv = new Canvas(64, 64)
  const k = ([x, y]) => x + y * 0.7
  const lo = Math.min(...cells.map(k))
  const hi = Math.max(...cells.map(k))
  const pos = lo + ((hi - lo) * (i + 0.5)) / 6
  for (const c of cells) {
    const d = Math.abs(k(c) - pos)
    if (d < 1.5) cv.set(c[0], c[1], C('cream.2', 200))
    else if (d < 3.5) cv.set(c[0], c[1], C('grid.2', 110))
  }
  return cv
}

export function plantFrames() {
  const { img, cells } = plantSmall()
  const out = [{ name: 'plant_small', canvas: img, points: { hub: HUB, foot: SMALL_FOOT }, snow: true, lights: true }]
  for (let i = 0; i < 4; i++) out.push({ name: `blades_${i}`, canvas: blades(i), points: { center: [12, 12] } })
  out.push({
    name: 'plant_big',
    canvas: plantBig(),
    points: { chimneys: [CHIMNEY_TOP, TOWER_TOP], chimney: CHIMNEY_TOP, tower: TOWER_TOP, beacon: [CHIMNEY_TOP[0] + 4, CHIMNEY_TOP[1] + 1], foot: BIG_FOOT },
    snow: true,
    lights: true,
  })
  for (let i = 0; i < 5; i++) out.push({ name: `smoke_${i}`, canvas: smoke(i), points: { base: [8, 13] } })
  for (let i = 0; i < 6; i++) out.push({ name: `shimmer_${i}`, canvas: shimmer(i, cells) })
  return out
}
