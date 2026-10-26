// A tiny RGBA raster toolkit for code-drawn pixel art. Everything works on
// integer pixels; colours are [r, g, b, a] arrays looked up by palette token.
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'

// DESIGN.md section 5, dark / mid / light per token, index 0..2.
const RAMPS = {
  plant: ['#9c4a1e', '#e07a2f', '#f6a95b'],
  grid: ['#2c5aa0', '#4a8ad8', '#8cc0f0'],
  dc: ['#4d3a8c', '#7b5fd0', '#b49cf5'],
  town: ['#1f7a4d', '#34b36a', '#8fe0a8'],
  power: ['#c99a1a', '#ffd23f', '#fff1a8'],
  money: ['#1f7f86', '#2fb8b0', '#8fe6dc'],
  grass: ['#4f7d32', '#6f9e3d', '#98c25a'],
  dirt: ['#7a5a3c', '#a07a52', '#c9a273'],
  stone: ['#5f6680', '#9aa1b8', '#d4d8e4'],
  ink: ['#1b1a24', '#2d2f40', '#3b3f54'],
  cream: ['#e9e2cf', '#f6f1e3', '#fffdf6'],
  status: ['#3bb273', '#f2a33a', '#e5484d'],
}

// The few in-between tones the palette lacks (snow, deep summer leaf,
// autumn field, blossom). Kept to a handful so the look stays one palette.
// Nature owns these so it never borrows an asset hue (plant orange, dc
// violet, power yellow): autumn reads red-brown, spring reads pink.
const EXTRA = {
  snow: '#eef4fb',
  snowShade: '#c3d2e8',
  leaf: '#3c6a2c',
  olive: '#b09a4a',
  oliveDark: '#7a7034',
  dryGrass: '#8f9443',
  brick: '#b8664a',
  rust: '#9e3b2b',
  blossom: '#f3b6c8',
  // mid asphalt, so roads frame the plot without out-shouting the buildings
  asphalt: '#4e5266',
}

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

const TABLE = new Map()
for (const [name, ramp] of Object.entries(RAMPS)) ramp.forEach((h, i) => TABLE.set(`${name}.${i}`, hex(h)))
for (const [name, h] of Object.entries(EXTRA)) TABLE.set(name, hex(h))

/** Palette colour by token ('plant.1', 'snow', ...) with an optional alpha 0..255. */
export function C(token, alpha = 255) {
  const rgb = TABLE.get(token)
  if (!rgb) throw new Error(`unknown palette token ${token}`)
  return [rgb[0], rgb[1], rgb[2], alpha]
}
export const INK = C('ink.0')

const BY_RGB = new Map([...TABLE].map(([t, rgb]) => [rgb.join(','), t]))
/** The palette token of a colour, or null when it is off-palette. */
export function tokenOf(c) {
  return BY_RGB.get(`${c[0]},${c[1]},${c[2]}`) ?? null
}

/** Every RGB the palette allows, for the audit in build.mjs. */
export function paletteSet() {
  return new Set([...TABLE.values()].map((c) => c.join(',')))
}

// 4x4 Bayer matrix, thresholds in 0..1.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)]

/** Deterministic PRNG so every build draws the same pixels. */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Value noise that wraps every `period` pixels, so tiles built from it are seamless. */
export function periodicNoise(seed, period, cell) {
  const n = Math.max(1, Math.round(period / cell))
  const r = rng(seed)
  const grid = Array.from({ length: n * n }, () => r())
  const at = (i, j) => grid[(((j % n) + n) % n) * n + (((i % n) + n) % n)]
  const s = (t) => t * t * (3 - 2 * t)
  return (x, y) => {
    const fx = x / cell
    const fy = y / cell
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const tx = s(fx - i)
    const ty = s(fy - j)
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx
    return a + (b - a) * ty
  }
}

export class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
    /** Per-pixel "faces the sky" flag (roofs, canopy tops); snow overlays land there. */
    this.up = new Uint8Array(w * h)
    /** Window and lamp rects that glow at dusk: { x, y, w, h, kind }. */
    this.lights = []
  }

  /** Flag a rect as up-facing (1) or not (0); later strokes override earlier ones. */
  markUp(x, y, w, h, v = 1) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inside(i, j)) this.up[j * this.w + i] = v
  }

  isUp(x, y) {
    return this.inside(x, y) && this.up[y * this.w + x] === 1
  }

  /** Record a rect that lights up at dusk ('warm' windows, 'cool' office glass, 'dc' strips). */
  light(x, y, w, h, kind = 'warm') {
    this.lights.push({ x, y, w, h, kind })
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }

  get(x, y) {
    if (!this.inside(x, y)) return [0, 0, 0, 0]
    const i = (y * this.w + x) * 4
    const d = this.data
    return [d[i], d[i + 1], d[i + 2], d[i + 3]]
  }

  alpha(x, y) {
    return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0
  }

  /** Overwrite a pixel (no blending). */
  set(x, y, c) {
    x |= 0
    y |= 0
    if (!this.inside(x, y)) return
    const i = (y * this.w + x) * 4
    this.data[i] = c[0]
    this.data[i + 1] = c[1]
    this.data[i + 2] = c[2]
    this.data[i + 3] = c[3]
  }

  /** Paint a pixel; translucent colours blend over what is there. */
  px(x, y, c) {
    x |= 0
    y |= 0
    if (!this.inside(x, y) || c[3] === 0) return
    if (c[3] === 255) return this.set(x, y, c)
    const i = (y * this.w + x) * 4
    const d = this.data
    const sa = c[3] / 255
    const da = d[i + 3] / 255
    const oa = sa + da * (1 - sa)
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * sa + d[i + k] * da * (1 - sa)) / oa
    d[i + 3] = oa * 255
  }

  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c)
  }

  hline(x0, x1, y, c) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, c)
  }

  vline(x, y0, y1, c) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, c)
  }

  /** Bresenham line, 1 px wide. */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.px(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }

  /** Filled ellipse sampled at pixel centres; `fn(x, y, u, v)` may pick the colour per pixel (u, v in -1..1). */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx
        const v = (y + 0.5 - cy) / ry
        if (u * u + v * v <= 1) this.px(x, y, typeof c === 'function' ? c(x, y, u, v) : c)
      }
    }
  }

  /** Filled polygon (even-odd scanline at pixel centres). */
  poly(pts, c) {
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5
      const xs = []
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[(i + 1) % pts.length]
        if (ay <= yc !== by <= yc) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
          this.px(x, y, typeof c === 'function' ? c(x, y) : c)
        }
      }
    }
  }

  /**
   * Vertical gradient across palette steps (top to bottom). With `dither`, the
   * band edges blend with a 2-row ordered dither instead of a hard step.
   */
  gradV(x, y, w, h, tokens, dither = false) {
    const n = tokens.length
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * (n - 1)
      for (let i = 0; i < w; i++) {
        let k = Math.floor(t)
        const f = t - k
        if (dither ? f > 0.5 + (bayer(x + i, y + j) - 0.5) * 0.5 : f > 0.5) k++
        this.px(x + i, y + j, C(tokens[Math.min(n - 1, k)]))
      }
    }
  }

  gradH(x, y, w, h, tokens, dither = false) {
    const n = tokens.length
    for (let i = 0; i < w; i++) {
      const t = (i / Math.max(1, w - 1)) * (n - 1)
      for (let j = 0; j < h; j++) {
        let k = Math.floor(t)
        const f = t - k
        if (dither ? f > 0.5 + (bayer(x + i, y + j) - 0.5) * 0.5 : f > 0.5) k++
        this.px(x + i, y + j, C(tokens[Math.min(n - 1, k)]))
      }
    }
  }

  /** Composite another canvas on top (alpha over). */
  blit(src, dx, dy, { flipX = false, flipY = false } = {}) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.get(flipX ? src.w - 1 - x : x, flipY ? src.h - 1 - y : y)
        if (c[3]) this.px(dx + x, dy + y, c)
      }
    }
    return this
  }

  /** Replace every opaque pixel's colour through `fn(c, x, y)`. */
  map(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y)
        if (c[3]) this.set(x, y, fn(c, x, y))
      }
    }
    return this
  }

  /**
   * The 1 px dark outline: every transparent pixel touching an opaque one
   * (4-neighbourhood) takes `color`. Buildings only; tiles never get it.
   */
  outline(color = INK) {
    const hit = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue
        if (this.alpha(x - 1, y) > 127 || this.alpha(x + 1, y) > 127 || this.alpha(x, y - 1) > 127 || this.alpha(x, y + 1) > 127) hit.push([x, y])
      }
    }
    for (const [x, y] of hit) this.set(x, y, color)
    return this
  }

  /**
   * Selective outline: like outline(), but each edge pixel takes a colour
   * picked from the opaque neighbour it borders (its material's darkest tone),
   * so props get a soft self-coloured edge instead of hard ink.
   */
  selout(pick) {
    const hit = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue
        // prefer the neighbour below (the edge we see most), then the sides, then above
        for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
          if (this.alpha(x + dx, y + dy) > 127) {
            hit.push([x, y, pick(this.get(x + dx, y + dy))])
            break
          }
        }
      }
    }
    for (const [x, y, c] of hit) if (c) this.set(x, y, c)
    return this
  }

  clone() {
    const c = new Canvas(this.w, this.h)
    c.data.set(this.data)
    c.up.set(this.up)
    c.lights = this.lights.map((l) => ({ ...l }))
    return c
  }

  /** Copy a sub-rectangle into a new canvas. */
  crop(x, y, w, h) {
    const c = new Canvas(w, h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.set(i, j, this.get(x + i, y + j))
    return c
  }

  /** Nearest-neighbour integer upscale (previews). */
  scale(k) {
    const c = new Canvas(this.w * k, this.h * k)
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) c.set(x, y, this.get((x / k) | 0, (y / k) | 0))
    return c
  }

  toPNG() {
    const png = new PNG({ width: this.w, height: this.h })
    png.data = Buffer.from(this.data.buffer)
    return PNG.sync.write(png)
  }

  save(path) {
    writeFileSync(path, this.toPNG())
  }
}

/**
 * Two-band soft shadow under a round prop (trees, bushes): a cool ink core
 * nudged left under the trunk, a fainter outer band. Max-blended, so the
 * bands never stack into stripes.
 */
export function softShadow(cv, cx, cy, rx, ry, strength = 1) {
  const A = new Float32Array(cv.w * cv.h)
  const put = (x, y, a) => {
    if (cv.inside(x, y)) A[y * cv.w + x] = Math.max(A[y * cv.w + x], a)
  }
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx
      const v = (y + 0.5 - cy) / ry
      const d = u * u + v * v
      if (d <= 1) put(x, y, 0.18)
      const uc = (x + 0.5 - (cx - rx * 0.15)) / (rx * 0.6)
      const vc = (y + 0.5 - cy) / (ry * 0.62)
      if (uc * uc + vc * vc <= 1) put(x, y, 0.36)
    }
  }
  paintShadow(cv, A, strength)
}

function paintShadow(cv, A, strength) {
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const a = A[y * cv.w + x]
      if (a > 0) cv.px(x, y, C('ink.1', Math.round(a * 255 * strength)))
    }
  }
}

/**
 * Cast shadow for top-left light, measured from the body itself: a dark
 * contact line hugging the base, a lighter band thrown to the bottom-right,
 * and a sliver along the right wall that widens towards the ground.
 * `wall` is how many rows up the right side the sliver climbs.
 */
export function castShadow(cv, body, { wall = 12, reach = 5, strength = 1 } = {}) {
  const A = new Float32Array(cv.w * cv.h)
  const put = (x, y, a) => {
    if (cv.inside(x, y)) A[y * cv.w + x] = Math.max(A[y * cv.w + x], a)
  }
  const solid = (x, y) => body.alpha(x, y) > 127
  let yb = -1
  for (let y = body.h - 1; y >= 0 && yb < 0; y--) for (let x = 0; x < body.w; x++) if (solid(x, y)) (yb = y), (x = body.w)
  if (yb < 0) return
  // contact line under every column that reaches the ground
  let x0 = Infinity
  let x1 = -Infinity
  for (let x = 0; x < body.w; x++) {
    let b = -1
    for (let y = body.h - 1; y >= 0; y--) if (solid(x, y)) (b = y), (y = -1)
    if (b < 0 || b < yb - 3) continue
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    put(x, b + 1, 0.4)
    put(x + 1, b + 2, 0.4)
  }
  if (x1 < x0) return
  put(x1 + 1, yb + 1, 0.4)
  // outer band, thrown right
  const cx = (x0 + x1 + 1) / 2 + reach
  const rx = (x1 - x0 + 1) / 2 + 2
  const ry = 3.6
  for (let y = yb - 4; y <= yb + 4; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx
      const v = (y + 0.5 - (yb + 0.6)) / ry
      if (u * u + v * v <= 1) put(x, y, 0.18)
    }
  }
  // right-wall sliver
  for (let y = yb - wall; y <= yb; y++) {
    let r = -1
    for (let x = body.w - 1; x >= 0; x--) if (solid(x, y)) (r = x), (x = -1)
    if (r < x1 - 6) continue
    const k = 1 + Math.round((2 * (y - (yb - wall))) / Math.max(1, wall))
    for (let i = 1; i <= k; i++) put(r + i, y + 1, 0.18)
  }
  paintShadow(cv, A, strength)
}

/** Old single-ellipse API, now two bands: kept for thin props (crane base, poles). */
export function shadow(cv, cx, cy, rx, ry, strength = 1) {
  softShadow(cv, cx, cy, rx, ry, strength)
}

/**
 * A building frame: draw the body on its own layer, outline that layer
 * (ink for buildings, or a selective outline picker for props), then lay it
 * over its shadow. The shadow never gets an outline. The result keeps the
 * body's up-mask and light rects for the snow and dusk overlays.
 */
export function building(w, h, draw, { shadow: sh, outline = true, cast } = {}) {
  const body = new Canvas(w, h)
  draw(body)
  if (typeof outline === 'function') body.selout(outline)
  else if (outline) body.outline(INK)
  const out = new Canvas(w, h)
  if (sh) softShadow(out, sh.cx, sh.cy, sh.rx, sh.ry, sh.strength ?? 1)
  if (cast) castShadow(out, body, cast)
  out.blit(body, 0, 0)
  out.up = body.up
  out.lights = body.lights
  return out
}

/** A frame built by a draw callback on a fresh canvas. */
export function frame(w, h, draw) {
  const c = new Canvas(w, h)
  draw(c)
  return c
}

/** Stamp a pattern given as rows of characters mapped to colours ('.' or ' ' is skipped). */
export function stamp(cv, x, y, rows, key) {
  rows.forEach((row, j) => {
    ;[...row].forEach((ch, i) => {
      const c = key[ch]
      if (c) cv.px(x + i, y + j, c)
    })
  })
}

/**
 * A 3/4 box: the roof (seen from above) on top of the front wall.
 * Light comes from the top-left: the roof's top and left edges are lit,
 * the wall darkens towards the ground.
 */
export function box(cv, x, y, w, roofH, wallH, { roof, wall, rim = true }) {
  cv.markUp(x, y, w, roofH, 1)
  cv.markUp(x, y + roofH, w, wallH, 0)
  // roof: [dark, mid, light]
  cv.rect(x, y, w, roofH, C(roof[1]))
  cv.hline(x, x + w - 1, y, C(roof[2]))
  cv.vline(x, y, y + roofH - 1, C(roof[2]))
  if (rim) {
    cv.hline(x, x + w - 1, y + roofH - 1, C(roof[0]))
    cv.vline(x + w - 1, y + 1, y + roofH - 1, C(roof[0]))
  }
  // wall: [dark, mid, light]
  cv.rect(x, y + roofH, w, wallH, C(wall[1]))
  cv.vline(x, y + roofH, y + roofH + wallH - 1, C(wall[2]))
  cv.hline(x, x + w - 1, y + roofH + wallH - 1, C(wall[0]))
  cv.vline(x + w - 1, y + roofH, y + roofH + wallH - 1, C(wall[0]))
}
