// Ground tiles (32 x 32, no outline, seamless), path pieces, and small
// props: trees, bushes, rocks, flowers, fences, street lamps.
import { Canvas, C, building, periodicNoise, rng, stamp, softShadow, tokenOf } from './raster.mjs'

const S = 32

// Season looks. base = ground, clump = a mound of denser grass (body, lit
// top row, shaded bottom row), tuft blades (blade, deep base, lit tip).
const SEASONS = {
  spring: { base: 'grass.2', body: 'grass.1', top: 'grass.2', bottom: 'grass.0', tuft: 'grass.1', deep: 'grass.0', tip: 'cream.0', speck: ['grass.1', 'cream.0'] },
  summer: { base: 'grass.1', body: 'grass.1', top: 'grass.2', bottom: 'grass.0', tuft: 'grass.0', deep: 'leaf', tip: 'grass.2', speck: ['grass.0', 'grass.2'] },
  autumn: { base: 'dryGrass', body: 'dryGrass', top: 'olive', bottom: 'oliveDark', tuft: 'oliveDark', deep: 'oliveDark', tip: 'olive', speck: ['oliveDark', 'olive'] },
  winter: { base: 'snow', body: 'snow', top: 'cream.2', bottom: 'snowShade', tuft: 'grass.0', deep: 'grass.0', tip: 'grass.1', speck: ['snowShade', 'cream.2'] },
}

const SEASON_SEED = { spring: 11, summer: 23, autumn: 37, winter: 41 }

const TUFTS = [
  // grass tufts: d = blade, D = deep base, t = lit tip
  ['t...t', 'd.t.d', '.dDd.'],
  ['t.t', 'dDd'],
  ['.t.', 'tdt', 'dDd'],
  ['t..', 'd.t', 'Dd.'],
  ['..t', 't.d', '.dD'],
]

/**
 * Scatter stamps at random spots inside the 1 px edge ring (which every
 * variant leaves plain so any two tiles butt together, and flipX is safe).
 */
function scatter(r, count, w, h, fn, margin = 1) {
  const placed = []
  let tries = 0
  while (placed.length < count && tries++ < count * 60) {
    const x = margin + Math.floor(r() * (S - margin * 2 - w + 1))
    const y = margin + Math.floor(r() * (S - margin * 2 - h + 1))
    if (placed.some(([px, py]) => Math.abs(px - x) < w + 2 && Math.abs(py - y) < h + 2)) continue
    placed.push([x, y])
    fn(x, y)
  }
}

/** A mound of grass: union of two ellipses, lit top row, shaded bottom row. */
function clumpAt(cv, x, y, w, h, r, tones) {
  const m = new Canvas(S, S)
  const rx = w / 2
  const ry = h / 2
  m.ellipse(x + rx, y + ry, rx, ry, [0, 0, 0, 255])
  const side = r() < 0.5 ? -1 : 1
  m.ellipse(x + rx + side * rx * 0.55, y + ry + 0.8, rx * 0.6, ry * 0.75, [0, 0, 0, 255])
  const inM = (i, j) => i > 0 && j > 0 && i < S - 1 && j < S - 1 && m.alpha(i, j) > 0
  for (let j = 1; j < S - 1; j++) {
    for (let i = 1; i < S - 1; i++) {
      if (!inM(i, j)) continue
      cv.set(i, j, C(!inM(i, j - 1) ? tones.top : !inM(i, j + 1) ? tones.bottom : tones.body))
    }
  }
}

/** Fine speckle, seeded per variant so no pixel pattern repeats every 32 px. */
function speckle(cv, seed, count, tones) {
  const r = rng(seed * 7 + 3)
  for (let i = 0; i < count; i++) {
    const x = 1 + Math.floor(r() * (S - 2))
    const y = 1 + Math.floor(r() * (S - 2))
    cv.set(x, y, C(tones[r() < 0.5 ? 0 : 1]))
  }
}

/** Variants 0-1 carry the detail, 2-3 are near-plain so a field reads as ground, not carpet. */
function grassTile(season, v) {
  const s = SEASONS[season]
  const seed = SEASON_SEED[season]
  const plain = v >= 2
  const cv = new Canvas(S, S)
  cv.rect(0, 0, S, S, C(s.base))
  speckle(cv, seed * 13 + v * 101, plain ? 8 : 14, s.speck)
  const r = rng(seed * 31 + v * 977)
  scatter(r, plain ? (v === 2 ? 1 : 0) : 2, 9, 4, (x, y) => clumpAt(cv, x, y, 6 + Math.floor(r() * 3), 3 + Math.floor(r() * 2), r, s))
  const key = { d: C(s.tuft), D: C(s.deep), t: C(s.tip) }
  if (season === 'winter') {
    const peeks = [['t.t', 'd.d'], ['.t.', 't.d', 'd..'], ['t..', 'd.t', '..d']]
    scatter(r, plain ? 1 : 3, 3, 3, (x, y) => stamp(cv, x, y, peeks[Math.floor(r() * peeks.length)], { d: C('grass.0'), t: C('grass.1') }))
    scatter(r, plain ? 2 : 4, 1, 1, (x, y) => cv.set(x, y, C('cream.2')))
    return cv
  }
  const tufts = plain ? 2 : season === 'autumn' ? 4 + v : 4 + v * 2
  scatter(r, tufts, 5, 3, (x, y) => stamp(cv, x, y, TUFTS[Math.floor(r() * TUFTS.length)], key))
  if (season === 'spring') {
    const petals = ['blossom', 'cream.2', 'blossom']
    scatter(r, plain ? 1 : 3, 3, 3, (x, y) => {
      const p = C(petals[Math.floor(r() * petals.length)])
      cv.set(x + 1, y, p)
      cv.set(x, y + 1, p)
      cv.set(x + 2, y + 1, p)
      cv.set(x + 1, y + 2, p)
      cv.set(x + 1, y + 1, C('olive'))
    })
  }
  if (season === 'summer' && !plain) {
    // white clover heads
    scatter(r, 2, 2, 2, (x, y) => {
      cv.set(x, y, C('cream.2'))
      cv.set(x + 1, y, C('cream.0'))
      cv.set(x, y + 1, C('leaf'))
    })
  }
  if (season === 'autumn') {
    const leaves = ['rust', 'brick', 'dirt.2']
    scatter(r, plain ? 2 : 5 + v, 2, 2, (x, y) => {
      const l = C(leaves[Math.floor(r() * leaves.length)])
      cv.set(x, y, l)
      cv.set(x + 1, y, l)
      if (r() < 0.6) cv.set(x + 1, y + 1, l)
      else cv.set(x, y + 1, C('oliveDark'))
    })
  }
  return cv
}

/** A pebble: lit top-left pixel, shaded bottom-right pixel. */
function pebble(cv, x, y) {
  cv.set(x, y, C('stone.2'))
  cv.set(x + 1, y, C('stone.1'))
  cv.set(x + 1, y + 1, C('stone.0'))
}

function dirtTile(v) {
  const cv = new Canvas(S, S)
  cv.rect(0, 0, S, S, C('dirt.1'))
  speckle(cv, 53 + v * 7, 16, ['dirt.0', 'dirt.2'])
  const r = rng(531 + v * 17)
  // packed lighter patches (lit top, shaded lip), ruts, pebbles
  scatter(r, 2, 9, 4, (x, y) => clumpAt(cv, x, y, 6 + Math.floor(r() * 3), 3, r, { top: 'cream.0', body: 'dirt.2', bottom: 'dirt.1' }))
  scatter(r, 3 + v, 2, 2, (x, y) => pebble(cv, x, y))
  scatter(r, 3, 2, 1, (x, y) => cv.hline(x, x + 1, y, C('dirt.0')))
  return cv
}

// --- path pieces: dirt with ragged, transparent edges; the map draws them over grass ---

const PATH_W = 12
// edge wobble, periodic over 32 px so straight pieces join seamlessly
const wob = (t, phase) => Math.round(0.9 + 0.7 * Math.sin(((t + phase) * 2 * Math.PI * 2) / S) + 0.5 * Math.sin(((t * 3 + phase) * 2 * Math.PI) / S))

/**
 * A path mask in local coordinates. `arms` lists the edges it reaches (n, s, e, w).
 * Each arm is a band of PATH_W px with wobbling sides; the centre is a round
 * plaza so ends and junctions look trodden rather than cut.
 */
function pathMask(arms) {
  const lo = (S - PATH_W) / 2
  const hi = lo + PATH_W - 1
  return (x, y) => {
    const dx = x + 0.5 - S / 2
    const dy = y + 0.5 - S / 2
    if (dx * dx + dy * dy <= (PATH_W / 2 + 0.5) ** 2) return true
    const v = (a, b) => x >= lo + wob(y, a) - 1 && x <= hi - wob(y, b) + 1
    const h = (a, b) => y >= lo + wob(x, a) - 1 && y <= hi - wob(x, b) + 1
    if (arms.includes('n') && y < S / 2 && v(0, 9)) return true
    if (arms.includes('s') && y >= S / 2 && v(0, 9)) return true
    if (arms.includes('w') && x < S / 2 && h(5, 14)) return true
    if (arms.includes('e') && x >= S / 2 && h(5, 14)) return true
    return false
  }
}

function pathTile(arms, v = 0) {
  const cv = new Canvas(S, S)
  const m = pathMask(arms)
  const r = rng(900 + v * 31 + arms.length * 7)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!m(x, y)) continue
      // a slight hollow: the near (top-left) lip is shaded, the far one lit
      let t = 'dirt.1'
      if (!m(x - 1, y) || !m(x, y - 1)) t = 'dirt.0'
      else if (!m(x + 1, y) || !m(x, y + 1)) t = 'dirt.2'
      cv.set(x, y, C(t))
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * S)
    const y = Math.floor(r() * S)
    if (m(x, y) && m(x - 1, y) && m(x + 2, y + 1) && m(x, y - 1) && m(x + 1, y + 2)) {
      if (i % 3 === 0) pebble(cv, x, y)
      else cv.set(x, y, C(i % 2 ? 'dirt.2' : 'dirt.0'))
    }
  }
  return cv
}

// --- roads ---
// A 4 px sidewalk on each side, asphalt between, a dashed centre line. Kerb
// profiles run outer edge -> road; the near (top/left) side is lit, the far
// (bottom/right) side drops into a dark gutter.
const WALK = 4
const NEAR = ['stone.1', 'stone.2', 'stone.1', 'stone.0']
const FAR = ['stone.1', 'stone.1', 'stone.2', 'ink.2']
const JOINT = (i) => i % 16 === 8 // slab joints, never on a tile edge

function asphalt(cv) {
  cv.rect(0, 0, S, S, C('asphalt'))
  // a hairline crack and one patch; aggregate kept to a few pixels
  const n = periodicNoise(77, S, 8)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (n(x, y) > 0.9) cv.set(x, y, C('ink.2'))
  for (const [x, y] of [[9, 7], [10, 8], [10, 9], [11, 10], [22, 22], [23, 23], [23, 24]]) cv.set(x, y, C('ink.2'))
  for (const [x, y] of [[5, 11], [21, 6], [27, 26], [13, 24]]) cv.set(x, y, C('stone.0'))
}

/** Sidewalk along one side of the tile: n, s, w or e. */
function walk(cv, side) {
  const prof = side === 'n' || side === 'w' ? NEAR : FAR
  for (let i = 0; i < S; i++) {
    for (let d = 0; d < WALK; d++) {
      let tone = prof[d]
      // a slab joint across the walk: a dark line with a lit line beside it
      if (d < WALK - 1 && JOINT(i)) tone = 'stone.0'
      else if (d < WALK - 1 && JOINT(i - 1)) tone = 'stone.2'
      const [x, y] = side === 'n' ? [i, d] : side === 's' ? [i, S - 1 - d] : side === 'w' ? [d, i] : [S - 1 - d, i]
      cv.set(x, y, C(tone))
    }
  }
}

/** Corner kerb where two sidewalks meet: each edge keeps its own profile so it joins the neighbour tile. */
function corner(cv, which) {
  const ph = which[0] === 'n' ? NEAR : FAR // the sidewalk running east-west
  const pv = which[1] === 'w' ? NEAR : FAR // the sidewalk running north-south
  for (let dy = 0; dy < WALK; dy++) {
    for (let dx = 0; dx < WALK; dx++) {
      const x = which[1] === 'w' ? dx : S - 1 - dx
      const y = which[0] === 'n' ? dy : S - 1 - dy
      cv.set(x, y, C(dy >= dx ? ph[dy] : pv[dx]))
    }
  }
}

/** Centre line: 6 px pale stone dashes, so yellow stays the colour of flowing power. */
function dashes(cv, vertical) {
  for (let i = 0; i < S; i++) {
    if (i % 16 < 5 || i % 16 >= 11) continue
    if (vertical) cv.set(15, i, C('stone.2')), cv.set(16, i, C('stone.1'))
    else cv.set(i, 15, C('stone.2')), cv.set(i, 16, C('stone.1'))
  }
}

function road(walks, corners, dash) {
  const cv = new Canvas(S, S)
  asphalt(cv)
  for (const w of walks) walk(cv, w)
  for (const c of corners) corner(cv, c)
  if (dash) dashes(cv, dash === 'v')
  return cv
}

const roadH = () => road(['n', 's'], [], 'h')
const roadV = () => road(['w', 'e'], [], 'v')
const roadX = () => road([], ['nw', 'ne', 'sw', 'se'])
/** T junction: a through road with a branch towards `dir`; the side opposite the branch keeps its sidewalk. */
function roadT(dir) {
  const opposite = { n: 's', s: 'n', e: 'w', w: 'e' }[dir]
  const cs = { n: ['nw', 'ne'], s: ['sw', 'se'], e: ['ne', 'se'], w: ['nw', 'sw'] }[dir]
  return road([opposite], cs)
}

const hashXY = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

// The pad is inset so a strip of the season's grass (drawn under it by the
// map) separates neighbouring lots and the road.
const LOT = 96
const LOT_IN = 3

/** The 96 x 96 concrete pad a building stands on. Quiet on purpose: buildings carry the contrast. */
function lot() {
  const cv = new Canvas(LOT, LOT)
  const a = LOT_IN
  const b = LOT - 1 - LOT_IN
  cv.rect(a, a, b - a + 1, b - a + 1, C('stone.1'))
  // sparse 2 px pebbles (~1.5% of the pad)
  for (let y = a + 3; y < b - 3; y++) {
    for (let x = a + 3; x < b - 3; x++) {
      const h = hashXY(x, y)
      if (h % 97 === 0) {
        cv.set(x, y, C('stone.2'))
        cv.set(x + 1, y + 1, C('stone.0'))
      }
    }
  }
  // one old stain
  cv.rect(66, 24, 5, 2, C('stone.0'))
  cv.set(66, 24, C('stone.1'))
  cv.set(70, 25, C('stone.1'))
  // a single cross of slab joints: dark line, lit line beside it
  for (let i = a + 3; i <= b - 3; i++) {
    cv.set(48, i, C('stone.0'))
    cv.set(49, i, C('stone.2'))
    cv.set(i, 48, C('stone.0'))
    cv.set(i, 49, C('stone.2'))
  }
  // raised kerb: lit top/left, shaded bottom/right
  for (let i = a; i <= b; i++) {
    cv.set(i, a, C('cream.0'))
    cv.set(i, a + 1, C('stone.2'))
    cv.set(a, i, C('cream.0'))
    cv.set(a + 1, i, C('stone.2'))
    cv.set(i, b, C('ink.2'))
    cv.set(i, b - 1, C('stone.0'))
    cv.set(b, i, C('ink.2'))
    cv.set(b - 1, i, C('stone.0'))
  }
  cv.set(b, a, C('stone.0'))
  cv.set(a, b, C('stone.0'))
  return cv
}

/** Painted corner marks for a free lot only (overlay; the map hides it once a lot is built on). */
function lotMarks() {
  const cv = new Canvas(LOT, LOT)
  const mark = (x, y, sx, sy) => {
    for (let i = 0; i < 7; i++) {
      cv.set(x + i * sx, y, C('cream.1'))
      cv.set(x, y + i * sy, C('cream.1'))
    }
    cv.set(x + sx, y + sy, C('stone.0'))
  }
  const n = LOT_IN + 5
  mark(n, n, 1, 1)
  mark(LOT - 1 - n, n, -1, 1)
  mark(n, LOT - 1 - n, 1, -1)
  mark(LOT - 1 - n, LOT - 1 - n, -1, -1)
  return cv
}

/** A cast shadow pixel: only on empty ground, never tinting the prop itself. */
const under = (cv, x, y, c) => cv.alpha(x, y) === 0 && cv.set(x, y, c)

function fenceH() {
  const cv = new Canvas(S, S)
  // two rails, posts every 16 px; lit tops, dark undersides
  for (let x = 0; x < S; x++) {
    cv.set(x, 16, C('dirt.2'))
    cv.set(x, 17, C('dirt.0'))
    cv.set(x, 21, C('dirt.2'))
    cv.set(x, 22, C('dirt.0'))
  }
  for (const px of [3, 19]) {
    cv.rect(px, 13, 3, 13, C('dirt.1'))
    cv.vline(px, 13, 25, C('dirt.2'))
    cv.vline(px + 2, 14, 25, C('dirt.0'))
    cv.hline(px, px + 2, 12, C('cream.0'))
    for (let x = px; x <= px + 4; x++) under(cv, x, 26, C('ink.1', 90))
  }
  for (let x = 1; x < S; x++) under(cv, x, 23, C('ink.1', 50))
  return cv
}
function fenceV() {
  const cv = new Canvas(S, S)
  for (let y = 0; y < S; y++) {
    cv.set(14, y, C('dirt.2'))
    cv.set(15, y, C('dirt.1'))
    cv.set(16, y, C('dirt.1'))
    cv.set(17, y, C('dirt.0'))
    under(cv, 18, y, C('ink.1', 60))
  }
  for (const py of [4, 20]) {
    cv.rect(13, py, 6, 6, C('dirt.1'))
    cv.hline(13, 18, py, C('cream.0'))
    cv.hline(13, 18, py + 1, C('dirt.2'))
    cv.vline(18, py + 1, py + 5, C('dirt.0'))
    cv.hline(13, 18, py + 6, C('dirt.0'))
    for (let x = 14; x <= 19; x++) under(cv, x, py + 7, C('ink.1', 90))
  }
  return cv
}

function flowers(v) {
  const cv = new Canvas(S, S)
  const r = rng(700 + v * 13)
  const sets = [
    ['blossom', 'cream.2', 'blossom'],
    ['cream.2', 'power.2', 'cream.2'],
    ['blossom', 'power.2', 'cream.0'],
  ][v]
  scatter(
    r,
    7,
    3,
    4,
    (x, y) => {
      const p = C(sets[Math.floor(r() * sets.length)])
      cv.set(x + 1, y + 2, C('grass.0'))
      cv.set(x + 1, y + 3, C('grass.0'))
      if (r() < 0.5) cv.set(x + 2, y + 3, C('grass.1'))
      cv.set(x + 1, y, p)
      cv.set(x, y + 1, p)
      cv.set(x + 2, y + 1, p)
      cv.set(x + 1, y + 1, C('olive'))
    },
    4,
  )
  return cv
}

// --- trees, 32 x 48 ---
const TREE = {
  spring: { leaf: ['grass.0', 'grass.1', 'grass.2'], edge: 'grass.0', blossom: true },
  summer: { leaf: ['leaf', 'grass.0', 'grass.1'], edge: 'leaf', dots: ['grass.2'] },
  autumn: { leaf: ['rust', 'brick', 'dirt.2'], edge: 'rust', dots: ['olive'] },
  winter: { bare: true },
}

/** One leaf clump: a highlight towards the top-left, a crescent of shade on the lower right. */
function clump(t, u, v) {
  const hl = (u + 0.3) ** 2 + (v + 0.4) ** 2
  const sh = (u + 0.22) ** 2 + (v + 0.3) ** 2
  if (hl < 0.22) return C(t.leaf[2])
  if (sh > 1.0) return C(t.leaf[0])
  return C(t.leaf[1])
}

const TRUNK_EDGE = { 'dirt.0': 'dirt.0', 'dirt.1': 'dirt.0', 'dirt.2': 'dirt.0' }

/** Prop outline picker: canopy pixels take the canopy's edge tone, trunk pixels dirt.0, snow its shade. */
function propEdge(edgeTone, extra = {}) {
  return (c) => {
    const t = tokenOf(c)
    if (t && extra[t]) return C(extra[t])
    if (t && TRUNK_EDGE[t]) return C(TRUNK_EDGE[t])
    if (t === 'snow' || t === 'cream.2' || t === 'snowShade') return C('snowShade')
    return C(edgeTone)
  }
}

const LOBES = [
  [16, 9, 7.5, 6],
  [9.5, 14, 6, 5.5],
  [22.5, 14, 6, 5.5],
  [16, 16, 7.5, 6],
  [8, 21, 6, 5],
  [24, 21, 6, 5],
  [16, 24, 8, 5.5],
]

function trunk(cv) {
  cv.rect(14, 30, 4, 13, C('dirt.1'))
  cv.vline(14, 30, 42, C('dirt.2'))
  cv.vline(17, 30, 42, C('dirt.0'))
  cv.set(13, 42, C('dirt.1'))
  cv.set(18, 42, C('dirt.0'))
}

/** Bare winter crown: forking branches, a 1 px line of snow on top of each. */
function bareCrown(cv) {
  const wood = []
  const branch = (x, y, ang, len, depth) => {
    const x1 = x + Math.cos(ang) * len
    const y1 = y + Math.sin(ang) * len
    const steps = Math.ceil(len * 1.5)
    for (let i = 0; i <= steps; i++) {
      const px = Math.round(x + ((x1 - x) * i) / steps)
      const py = Math.round(y + ((y1 - y) * i) / steps)
      wood.push([px, py, depth])
      if (depth === 0) wood.push([px + 1, py, depth])
    }
    if (depth >= 3) return
    const k = len * 0.68
    branch(x1, y1, ang - 0.45 - depth * 0.05, k, depth + 1)
    branch(x1, y1, ang + 0.42 + depth * 0.05, k * 0.9, depth + 1)
  }
  branch(15.5, 31, -Math.PI / 2, 8, 0)
  branch(15, 26, -Math.PI / 2 - 0.85, 6, 1)
  branch(16, 25, -Math.PI / 2 + 0.8, 6.5, 1)
  for (const [x, y, d] of wood) cv.set(x, y, C(d === 0 ? 'dirt.1' : d < 3 ? 'dirt.0' : 'dirt.1'))
  // lit left side of the main limbs
  for (const [x, y, d] of wood) if (d <= 1 && !cv.alpha(x - 1, y)) cv.set(x, y, C(d === 0 ? 'dirt.2' : 'dirt.1'))
  // snow resting on each branch
  for (const [x, y] of wood) if (!cv.alpha(x, y - 1) && y > 2) cv.set(x, y - 1, C('cream.2'))
  // a couple of heavier snow clumps in the forks
  for (const [x, y] of [[11, 14], [20, 12], [16, 9]]) {
    if (!cv.alpha(x, y)) continue
    cv.set(x, y - 1, C('snow'))
    cv.set(x + 1, y - 1, C('cream.2'))
  }
}

function tree(season) {
  const t = TREE[season]
  return building(
    32,
    48,
    (cv) => {
      trunk(cv)
      if (t.bare) {
        bareCrown(cv)
        return
      }
      // leaf clumps back to front, each lit on its own top-left: a scalloped crown
      for (const [cx, cy, rx, ry] of LOBES) cv.ellipse(cx, cy, rx, ry, (x, y, u, v) => clump(t, u, v))
      const r = rng(season.length * 101)
      if (t.dots) {
        for (let i = 0; i < 9; i++) {
          const x = 7 + Math.floor(r() * 18)
          const y = 6 + Math.floor(r() * 22)
          if (cv.alpha(x, y) && cv.alpha(x, y - 1) && cv.alpha(x, y + 1)) cv.set(x, y, C(t.dots[i % t.dots.length]))
        }
      }
      if (t.blossom) {
        // pink blossom clusters, 2 x 2 with one lit petal
        const spots = [[11, 7], [18, 6], [6, 13], [14, 12], [22, 11], [26, 17], [10, 19], [18, 18], [5, 22], [22, 24], [14, 25], [26, 22]]
        for (const [x, y] of spots) {
          if (!(cv.alpha(x, y) && cv.alpha(x + 1, y + 1))) continue
          cv.set(x, y, C('cream.2'))
          cv.set(x + 1, y, C('blossom'))
          cv.set(x, y + 1, C('blossom'))
          cv.set(x + 1, y + 1, C('blossom'))
        }
      }
    },
    { shadow: { cx: 19, cy: 41, rx: 12, ry: 4 }, outline: t.bare ? false : propEdge(t.edge) },
  )
}

function bushBody(cv, v, leaf) {
  const lobes = v === 0 ? [[12, 19, 6, 5], [20, 19, 6, 5], [16, 15, 7, 5.5]] : [[11, 20, 5, 4], [17, 17, 6, 5], [22, 21, 5, 4]]
  for (const [cx, cy, rx, ry] of lobes) cv.ellipse(cx, cy, rx, ry, (x, y, u, vv) => clump({ leaf }, u, vv))
}

function bush(v) {
  const leaf = v === 0 ? ['grass.0', 'grass.1', 'grass.2'] : ['leaf', 'grass.0', 'grass.1']
  return building(
    32,
    32,
    (cv) => {
      bushBody(cv, v, leaf)
      if (v === 0) {
        // small cream blossoms
        for (const [x, y] of [[13, 14], [19, 15], [11, 19], [21, 19]]) cv.set(x, y, C('cream.2'))
      } else {
        // pink berries, one lit pixel each
        for (const [x, y] of [[15, 15], [10, 19], [20, 18], [17, 21], [23, 21]]) {
          cv.set(x, y, C('cream.2'))
          cv.set(x, y + 1, C('blossom'))
          cv.set(x + 1, y + 1, C('blossom'))
        }
      }
    },
    { shadow: { cx: 18, cy: 24, rx: 10, ry: 3 }, outline: propEdge(leaf[0]) },
  )
}

/** Winter bush: dark evergreen with snow sitting on the top half of each lobe. */
function bushWinter(v) {
  const leaf = ['leaf', 'leaf', 'grass.0']
  return building(
    32,
    32,
    (cv) => {
      bushBody(cv, v, leaf)
      const lobes = v === 0 ? [[12, 19, 6, 5], [20, 19, 6, 5], [16, 15, 7, 5.5]] : [[11, 20, 5, 4], [17, 17, 6, 5], [22, 21, 5, 4]]
      for (const [cx, cy, rx, ry] of lobes) {
        cv.ellipse(cx, cy - 0.6, rx * 0.92, ry * 0.9, (x, y, u, vv) => {
          if (vv > -0.1 + Math.sin(u * 5) * 0.12) return [0, 0, 0, 0]
          return C(vv < -0.6 && u < 0.2 ? 'cream.2' : u > 0.55 ? 'snowShade' : 'snow')
        })
      }
    },
    { shadow: { cx: 18, cy: 24, rx: 10, ry: 3 }, outline: propEdge('leaf') },
  )
}

function rock() {
  return building(
    32,
    32,
    (cv) => {
      const pts = [
        [8, 22],
        [10, 15],
        [15, 11],
        [21, 12],
        [25, 17],
        [25, 23],
      ]
      cv.poly(pts, (x, y) => C(x + y < 30 ? 'stone.2' : x + y < 38 ? 'stone.1' : 'stone.0'))
      cv.line(15, 12, 17, 18, C('stone.0'))
      cv.line(17, 18, 24, 19, C('stone.0'))
      cv.set(12, 16, C('cream.2'))
      cv.set(13, 15, C('cream.2'))
      // moss
      cv.set(19, 12, C('grass.1'))
      cv.set(20, 12, C('grass.1'))
      cv.set(21, 13, C('grass.0'))
      // the upper faces catch snow in winter
      for (let y = 10; y < 24; y++) for (let x = 7; x < 27; x++) if (cv.alpha(x, y) && y < 17 - (x > 20 ? (x - 20) * 0.4 : 0)) cv.markUp(x, y, 1, 1)
    },
    { shadow: { cx: 18, cy: 23, rx: 10, ry: 3 }, outline: () => C('stone.0') },
  )
}

// --- street lamp (16 x 32) and the ground glow it casts at dusk (24 x 24) ---

const LAMP_LIGHT = [8, 4]

function lamp() {
  return building(
    16,
    32,
    (cv) => {
      // a slim post, lit left
      cv.vline(7, 8, 27, C('stone.1'))
      cv.vline(8, 8, 27, C('stone.0'))
      cv.rect(6, 26, 4, 2, C('stone.0'))
      cv.hline(6, 9, 26, C('stone.1'))
      // lantern: cap, glass, collar
      cv.hline(6, 9, 2, C('stone.0'))
      cv.rect(6, 3, 4, 3, C('cream.0'))
      cv.set(6, 3, C('cream.2'))
      cv.vline(9, 3, 5, C('stone.1'))
      cv.hline(6, 9, 6, C('stone.0'))
      cv.hline(7, 8, 7, C('stone.0'))
      cv.light(6, 3, 4, 3, 'lamp')
    },
    { shadow: { cx: 9, cy: 29, rx: 4, ry: 1.5 } },
  )
}

function glow() {
  const cv = new Canvas(24, 24)
  cv.ellipse(12, 12, 11.5, 11.5, C('power.2', 31))
  cv.ellipse(12, 12, 7, 7, C('power.2', 34))
  return cv
}

export function groundFrames() {
  const out = []
  for (const season of Object.keys(SEASONS)) for (let v = 0; v < 4; v++) out.push({ name: `grass_${season}_${v}`, canvas: grassTile(season, v) })
  for (let v = 0; v < 2; v++) out.push({ name: `dirt_${v}`, canvas: dirtTile(v) })
  for (let v = 0; v < 2; v++) {
    out.push({ name: `path_v_${v}`, canvas: pathTile(['n', 's'], v) })
    out.push({ name: `path_h_${v}`, canvas: pathTile(['e', 'w'], v) })
  }
  for (const d of ['n', 's', 'e', 'w']) {
    // path_end_n: the path comes in from the south and ends towards the north
    const from = { n: 's', s: 'n', e: 'w', w: 'e' }[d]
    out.push({ name: `path_end_${d}`, canvas: pathTile([from]) })
  }
  out.push({ name: 'path_x', canvas: pathTile(['n', 's', 'e', 'w']) })
  out.push({ name: 'road_h', canvas: roadH() })
  out.push({ name: 'road_v', canvas: roadV() })
  out.push({ name: 'road_x', canvas: roadX() })
  for (const d of ['n', 's', 'e', 'w']) out.push({ name: `road_t_${d}`, canvas: roadT(d) })
  out.push({ name: 'lot', canvas: lot() })
  out.push({ name: 'lot_marks', canvas: lotMarks() })
  out.push({ name: 'fence_h', canvas: fenceH() })
  out.push({ name: 'fence_v', canvas: fenceV() })
  for (let v = 0; v < 3; v++) out.push({ name: `flowers_${v}`, canvas: flowers(v) })
  for (const season of Object.keys(TREE)) out.push({ name: `tree_${season}`, canvas: tree(season), points: { foot: [16, 43] } })
  for (let v = 0; v < 2; v++) out.push({ name: `bush_${v}`, canvas: bush(v), points: { foot: [17, 24] } })
  for (let v = 0; v < 2; v++) out.push({ name: `bush_winter_${v}`, canvas: bushWinter(v), points: { foot: [17, 24] } })
  const rk = rock()
  out.push({ name: 'rock_0', canvas: rk, points: { foot: [17, 23] }, snow: true })
  const lp = lamp()
  out.push({ name: 'lamp', canvas: lp, points: { light: LAMP_LIGHT, foot: [8, 27] }, lights: true })
  out.push({ name: 'glow_0', canvas: glow(), points: { center: [12, 12] } })
  return out
}
