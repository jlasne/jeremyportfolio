// Review images: a labelled contact sheet of every frame, and a mock
// company plot per season, composed the way the map lays things out.
import { Canvas, C, tokenOf } from './raster.mjs'

export const SEASONS = ['spring', 'summer', 'autumn', 'winter']

// 3 x 5 pixel font for labels: each glyph is 5 rows of 3 bits.
const FONT = {
  a: [2, 5, 7, 5, 5], b: [6, 5, 6, 5, 6], c: [3, 4, 4, 4, 3], d: [6, 5, 5, 5, 6], e: [7, 4, 6, 4, 7],
  f: [7, 4, 6, 4, 4], g: [3, 4, 5, 5, 3], h: [5, 5, 7, 5, 5], i: [7, 2, 2, 2, 7], j: [1, 1, 1, 5, 2],
  k: [5, 5, 6, 5, 5], l: [4, 4, 4, 4, 7], m: [5, 7, 7, 5, 5], n: [6, 5, 5, 5, 5], o: [2, 5, 5, 5, 2],
  p: [6, 5, 6, 4, 4], q: [2, 5, 5, 6, 3], r: [6, 5, 6, 5, 5], s: [3, 4, 2, 1, 6], t: [7, 2, 2, 2, 2],
  u: [5, 5, 5, 5, 7], v: [5, 5, 5, 5, 2], w: [5, 5, 7, 7, 5], x: [5, 5, 2, 5, 5], y: [5, 5, 2, 2, 2],
  z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 6], _: [0, 0, 0, 0, 7],
}

function text(cv, x, y, str, color, k = 1) {
  for (const ch of str) {
    const g = FONT[ch]
    if (g) g.forEach((bits, j) => [4, 2, 1].forEach((b, i) => bits & b && cv.rect(x + i * k, y + j * k, k, k, color)))
    x += 4 * k
  }
}

function checker(cv) {
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) cv.set(x, y, ((x >> 3) + (y >> 3)) % 2 ? [128, 128, 134, 255] : [116, 116, 124, 255])
}

/** Every frame at `k` x, in build order, each with its name underneath. */
export function contactSheet(frames, k) {
  const W = 1500
  const gap = 10
  let x = gap
  let y = gap
  let rowH = 0
  const placed = []
  for (const f of frames) {
    const w = Math.max(f.canvas.w * k, f.name.length * 8)
    const h = f.canvas.h * k + 14
    if (x + w > W - gap) {
      x = gap
      y += rowH + gap
      rowH = 0
    }
    placed.push([f, x, y])
    x += w + gap
    rowH = Math.max(rowH, h)
  }
  const cv = new Canvas(W, y + rowH + gap)
  checker(cv)
  for (const [f, px, py] of placed) {
    cv.blit(f.canvas.scale(k), px, py)
    text(cv, px, py + f.canvas.h * k + 4, f.name, [24, 24, 32, 255], 2)
  }
  return cv
}

/** Luminance-only copy, to check that buildings, not the ground, carry the contrast. */
export function greyscale(src) {
  return src.clone().map((c) => {
    const l = Math.round(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    return [l, l, l, c[3]]
  })
}

/** Flat ink silhouettes at 2x, to compare building shapes without detail. */
export function silhouettes(by, names) {
  const k = 2
  const gap = 12
  const W = names.reduce((w, n) => w + by[n].w * k + gap, gap)
  const H = 96 * k + 30
  const cv = new Canvas(W, H)
  cv.rect(0, 0, W, H, C('cream.1'))
  let x = gap
  for (const n of names) {
    const f = by[n]
    const sil = f.clone().map((c) => (c[3] > 127 && !(c[0] < 60 && c[1] < 60 && c[3] < 255) ? C('ink.1') : [0, 0, 0, 0]))
    cv.blit(sil.scale(k), x, gap + (96 - f.h) * k)
    text(cv, x, H - 14, n, C('ink.0'), 2)
    x += f.w * k + gap
  }
  return cv
}

// palette family of each opaque pixel, for the hue-ownership report
const FAMILY = {
  plant: 'plant', grid: 'grid', dc: 'dc', town: 'town', power: 'power', money: 'money', status: 'status',
  grass: 'nature', dirt: 'nature', leaf: 'nature', olive: 'nature', oliveDark: 'nature', dryGrass: 'nature',
  rust: 'nature', brick: 'nature', blossom: 'nature', snow: 'nature', snowShade: 'nature',
  stone: 'neutral', ink: 'neutral', cream: 'neutral',
}

/** Share of each hue family per building frame (opaque pixels only, outline excluded). */
export function hueReport(by) {
  const lines = ['hue share per frame (opaque pixels, ink outline excluded)', '']
  const names = ['plant_small', 'plant_big', 'dc_small', 'dc_big', 'house_0', 'house_1', 'house_2', 'house_3', 'house_4', 'house_5', 'townhall', 'substation', 'pylon', 'crane', 'scaffold_small', 'scaffold_big', 'tree_spring', 'tree_summer', 'tree_autumn', 'tree_winter', 'bush_0', 'bush_1', 'flowers_0', 'flowers_1', 'flowers_2', 'grass_autumn_0', 'grass_spring_0', 'lot']
  for (const n of names) {
    const c = by[n]
    const count = {}
    let total = 0
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const p = c.get(x, y)
        if (p[3] < 255) continue
        const t = tokenOf(p)
        if (!t || t === 'ink.0') continue
        const fam = FAMILY[t.split('.')[0]] ?? 'other'
        count[fam] = (count[fam] ?? 0) + 1
        total++
      }
    }
    const parts = Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .map(([f, k]) => `${f} ${Math.round((100 * k) / total)}%`)
    lines.push(`${n.padEnd(16)} ${parts.join(', ')}`)
  }
  return lines.join('\n') + '\n'
}

// --- the mock company plot, composed the way DESIGN section 6 lays it out ---

const T = 32
const COLS = 24
const ROWS = 12
const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

const DUSK = (c) => [Math.round(c[0] * 0.5), Math.round(c[1] * 0.52), Math.round(c[2] * 0.72), c[3]]

export function scene(by, points, season, { dusk = false } = {}) {
  const winter = season === 'winter'
  const cv = new Canvas(COLS * T, ROWS * T)
  const tile = (name, c, r, flipX = false) => cv.blit(by[name], c * T, r * T, { flipX })

  // ground: near-plain variants ~60% of the time, random flipX for free variety
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const h = hash(c, r)
      const v = h % 10 < 6 ? 2 + ((h >> 4) & 1) : (h >> 4) & 1
      tile(`grass_${season}_${v}`, c, r, ((h >> 9) & 1) === 1)
    }
  }
  // town paths: three lanes and a spine, joined at a plaza by the town hall
  for (const r of [3, 6, 9]) for (const c of [0, 1, 3, 4]) tile(`path_h_${(c + r) % 2}`, c, r)
  for (let r = 3; r < ROWS; r++) tile([3, 6, 9].includes(r) ? 'path_x' : `path_v_${r % 2}`, 2, r)

  // roads: two verticals framing the plot, three road rows across it
  for (let r = 0; r < ROWS; r++) {
    tile('road_v', 5, r)
    tile('road_v', 18, r)
  }
  for (const r of [1, 5, 9]) {
    for (let c = 6; c < 18; c++) tile('road_h', c, r)
    tile('road_t_e', 5, r)
    tile('road_t_w', 18, r)
  }
  tile('road_x', 18, 5)
  for (let c = 19; c < COLS; c++) tile('road_h', c, 5)
  // lot pads; corner marks on free lots only
  const lots = []
  for (const r of [2, 6]) for (const c of [6, 9, 12, 15]) {
    tile('lot', c, r)
    lots.push([c * T, r * T])
  }
  cv.blit(by.lot_marks, lots[6][0], lots[6][1])
  if (dusk) cv.map(DUSK)

  // sprites, drawn back to front by their foot
  const sprites = []
  const put = (name, fx, fy, extra = {}) => {
    const p = points[name]?.foot ?? [by[name].w >> 1, by[name].h - 1]
    const s = { name, x: Math.round(fx - p[0]), y: Math.round(fy - p[1]), z: fy, ...extra }
    sprites.push(s)
    return s
  }
  const overlay = (name, x, y, z, extra = {}) => sprites.push({ name, x, y, z, overlay: true, ...extra })
  const onLot = (name, [lx, ly]) => (by[name].w === 96 ? put(name, lx + 48, ly + 86) : put(name, lx + 48, ly + 80))
  const prop = (name, x, y) => {
    if (winter && name.startsWith('bush_')) name = name.replace('bush_', 'bush_winter_')
    if (winter && name.startsWith('flowers_')) return
    put(name, x, y)
  }

  const ps = onLot('plant_small', lots[0])
  const hub = points.plant_small.hub
  overlay('shimmer_2', ps.x, ps.y, ps.z + 0.1)
  overlay('blades_1', ps.x + hub[0] - 12, ps.y + hub[1] - 12, ps.z + 0.2)
  const ds = onLot('dc_small', lots[1])
  points.dc_small.leds.forEach(([x, y], i) => overlay(i % 3 ? 'rack_led_on' : 'rack_led_dim', ds.x + x, ds.y + y, ds.z + 0.1, { glow: true }))
  const pb = onLot('plant_big', lots[2])
  const [ch, tw] = points.plant_big.chimneys
  const grey = (c) => [Math.round(c[0] * 0.88), Math.round(c[1] * 0.88), Math.round(c[2] * 0.9), c[3]]
  overlay('smoke_0', pb.x + ch[0] - 8, pb.y + ch[1] - 13, 9999, { tint: grey })
  overlay('smoke_2', pb.x + ch[0] - 7, pb.y + ch[1] - 23, 9999, { tint: grey })
  overlay('smoke_4', pb.x + ch[0] - 4, pb.y + ch[1] - 34, 9999, { tint: grey })
  overlay('smoke_1', pb.x + tw[0] - 8, pb.y + tw[1] - 13, 9999)
  overlay('smoke_3', pb.x + tw[0] - 7, pb.y + tw[1] - 24, 9999)
  const db = onLot('dc_big', lots[3])
  points.dc_big.leds.forEach(([x, y], i) => overlay(i % 4 === 1 ? 'rack_led_dim' : 'rack_led_on', db.x + x, db.y + y, db.z + 0.1, { glow: true }))
  overlay('coin_0', db.x + 40, db.y + 14, 9999)
  overlay('coin_2', db.x + 60, db.y + 6, 9999)
  overlay('coin_4', ds.x + 30, ds.y + 4, 9999)
  const sb = onLot('scaffold_big', lots[4])
  overlay('tarp_big', sb.x, sb.y, sb.z + 0.1, { tint: (c) => [c[0], Math.round(c[1] * 0.62), Math.round(c[2] * 0.4), c[3]] })
  put('crane', sb.x + 22, sb.y + 74)
  onLot('scaffold_small', lots[5])
  const ps2 = onLot('plant_small', lots[7])
  overlay('blades_3', ps2.x + hub[0] - 12, ps2.y + hub[1] - 12, ps2.z + 0.2)

  // town on the left: town hall over the plaza, houses along the lanes
  put('townhall', 80, 112)
  const houses = [
    [18, 104, 2], [142, 104, 5],
    [18, 200, 0], [50, 200, 3], [112, 200, 1], [144, 200, 4],
    [18, 296, 4], [50, 296, 5], [112, 296, 0], [144, 296, 2],
    [26, 392, 1], [118, 392, 3],
  ]
  for (const [x, y, v] of houses) {
    const h = put(`house_${v}`, x, y)
    const chim = points[`house_${v}`].chimney
    if (chim) overlay((x + y) % 2 ? 'smoke_0' : 'smoke_1', h.x + chim[0] - 8, h.y + chim[1] - 13, 9999, { tint: grey })
  }
  // small yard fences beside a few houses
  overlay('fence_h', 0, 7 * T + 4, 7 * T + 26)
  overlay('fence_h', 4 * T, 7 * T + 4, 7 * T + 26)
  overlay('fence_v', -14, 4 * T + 10, 4 * T + 40)
  prop(`tree_${season}`, 14, 44)
  prop(`tree_${season}`, 148, 40)
  prop(`tree_${season}`, 88, 250)
  prop(`tree_${season}`, 70, 350)
  prop('bush_0', 36, 154)
  prop('bush_1', 128, 154)
  prop('bush_0', 96, 344)
  prop('flowers_0', 30, 222)
  prop('flowers_2', 126, 320)
  prop('flowers_1', 96, 136)

  // grid on the right: substation, pylons, poles along the top road
  const sub = put('substation', 668, 120)
  overlay('spark_2', sub.x + points.substation.wires[0][0] - 4, sub.y + points.substation.wires[0][1] - 4, 9999)
  const pylons = [put('pylon', 700, 290), put('pylon', 640, 372)]
  prop(`tree_${season}`, 740, 44)
  prop(`tree_${season}`, 610, 254)
  prop('bush_0', 752, 220)
  prop('rock_0', 730, 330)
  prop('flowers_1', 670, 226)
  const poles = []
  for (let c = 6; c <= 17; c += 3) poles.push(put('pole', c * T + 16, T + 3))

  // street lamps on the middle road's sidewalks and along the bottom road
  const lamps = []
  for (const x of [6 * T + 4, 9 * T + 4, 12 * T + 4, 15 * T + 4]) lamps.push(put('lamp', x, 5 * T + 3))
  for (const x of [7 * T + 20, 13 * T + 20]) lamps.push(put('lamp', x, 10 * T - 1))
  lamps.push(put('lamp', 5 * T - 6, 4 * T + 2))

  // top and bottom verges: trees, flowers, a rock
  for (const x of [230, 300, 420, 520]) prop(`tree_${season}`, x, 24)
  for (const x of [210, 330, 460, 560]) prop(`tree_${season}`, x, 372)
  prop('bush_1', 270, 362)
  prop('rock_0', 400, 366)
  prop('flowers_1', 480, 344)
  prop('flowers_0', 360, 4)

  sprites.sort((a, b) => a.z - b.z)
  const tinted = new Map()
  const look = (name, tint) => {
    if (!dusk && !tint) return by[name]
    const key = name + (tint ? '+t' : '')
    if (!tinted.has(key)) {
      let c = by[name].clone()
      if (tint) c = c.map(tint)
      if (dusk) c = c.map(DUSK)
      tinted.set(key, c)
    }
    return tinted.get(key)
  }
  for (const s of sprites) {
    // LEDs glow at dusk, so they skip the tint
    cv.blit(s.glow ? by[s.name] : look(s.name, s.tint), s.x, s.y)
    if (winter && by[`snow_${s.name}`]) cv.blit(look(`snow_${s.name}`), s.x, s.y)
    if (dusk && by[`lights_${s.name}`]) cv.blit(by[`lights_${s.name}`], s.x, s.y)
  }
  if (dusk) {
    for (const l of lamps) {
      const p = points.lamp.light
      cv.blit(by.glow_0, l.x + p[0] - 12, l.y + p[1] - 12)
      cv.blit(by.glow_0, l.x + p[0] - 12, l.y + points.lamp.foot[1] - 10)
    }
  }

  // wires between poles and pylons: continuous 1 px lines with a 3 px sag
  const wire = (a, b) => {
    const n = 12
    let prev = a
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * 3]
      cv.line(prev[0], prev[1], p[0], p[1], dusk ? DUSK(C('ink.1')) : C('ink.1'))
      prev = p
    }
  }
  const pw = points.pole.wires
  for (let i = 0; i + 1 < poles.length; i++) for (const w of pw) wire([poles[i].x + w[0], poles[i].y + w[1]], [poles[i + 1].x + w[0], poles[i + 1].y + w[1]])
  const yw = points.pylon.wires
  for (const w of yw.slice(0, 2)) wire([pylons[0].x + w[0], pylons[0].y + w[1]], [pylons[1].x + w[0], pylons[1].y + w[1]])
  for (const w of yw.slice(0, 2)) wire([pylons[0].x + w[0], pylons[0].y + w[1]], [sub.x + 51, sub.y + 14])

  // flow dots on the internal link, as the map will draw them (they glow at dusk)
  for (let x = 6 * T + 10; x < 18 * T; x += 22) {
    cv.rect(x, 5 * T + 15, 2, 2, C('power.1'))
    cv.set(x, 5 * T + 15, C('power.2'))
  }

  text(cv, 4, ROWS * T - 9, season + (dusk ? ' dusk' : ''), C('ink.0'))
  return cv
}
