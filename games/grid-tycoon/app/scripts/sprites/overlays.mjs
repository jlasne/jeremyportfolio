// Overlays derived from a drawn building: the dusk light frame (windows,
// strips, lamps; the map draws it above the dusk tint, untinted) and the
// winter snow frame (snow on every up-facing roof pixel, eaves left showing
// so the asset hue still reads).
import { Canvas, C } from './raster.mjs'

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

// core = lit interior, edge = bottom/right rim, halo = faint spill around it
const KINDS = {
  warm: { core: 'power.2', edge: 'power.1', halo: 'power.2' },
  cool: { core: 'cream.2', edge: 'dc.2', halo: 'dc.2' },
  dc: { core: 'dc.2', edge: 'dc.1', halo: 'dc.2' },
  lamp: { core: 'cream.2', edge: 'power.2', halo: 'power.2' },
  beacon: { core: 'status.2', edge: 'status.2', halo: 'status.2' },
}

/** The dusk light overlay of a building frame: every recorded light rect, glowing. */
export function lightsFrame(src) {
  const cv = new Canvas(src.w, src.h)
  const halo = new Float32Array(src.w * src.h)
  const haloTone = new Array(src.w * src.h)
  const lit = new Uint8Array(src.w * src.h)
  for (const { x, y, w, h, kind } of src.lights) {
    const k = KINDS[kind]
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (!cv.inside(i, j)) continue
        const rim = w > 1 && h > 1 && (i === x + w - 1 || j === y + h - 1)
        cv.set(i, j, C(rim ? k.edge : k.core))
        lit[j * cv.w + i] = 1
      }
    }
    // spill: 1 px ring at 25%, a second at 12%; only onto the building itself
    const reach = kind === 'beacon' ? 1 : 2
    for (let j = y - reach; j < y + h + reach; j++) {
      for (let i = x - reach; i < x + w + reach; i++) {
        if (!cv.inside(i, j) || src.alpha(i, j) < 128) continue
        const d = Math.max(x - i, i - (x + w - 1), y - j, j - (y + h - 1))
        if (d <= 0) continue
        const a = d === 1 ? 0.25 : 0.12
        const n = j * cv.w + i
        if (a > halo[n]) {
          halo[n] = a
          haloTone[n] = k.halo
        }
      }
    }
  }
  for (let n = 0; n < halo.length; n++) {
    if (!halo[n] || lit[n]) continue
    cv.set(n % cv.w, (n / cv.w) | 0, C(haloTone[n], Math.round(halo[n] * 255)))
  }
  return cv
}

/**
 * Snow over every up-facing pixel. Each vertical run of roof pixels is
 * covered from the top down to ~70% of its depth with a scalloped lower edge,
 * so the eave row keeps the asset's own colour. Lit top row, shaded lip and
 * right edge.
 */
export function snowFrame(src, { keep = 0.3 } = {}) {
  const cv = new Canvas(src.w, src.h)
  const up = (x, y) => src.isUp(x, y) && src.alpha(x, y) > 127
  const cover = new Uint8Array(src.w * src.h)
  for (let x = 0; x < src.w; x++) {
    let y = 0
    while (y < src.h) {
      if (!up(x, y)) {
        y++
        continue
      }
      const a = y
      while (y < src.h && up(x, y)) y++
      const len = y - a
      // short runs (chimney caps, rails, ridges) are buried; long ones keep their eave
      const wobble = (x >> 1) % 3 === 0 ? 1 : (x >> 1) % 3 === 1 ? 0 : -1
      const depth = len <= 3 ? len : Math.max(2, Math.min(len - 1, Math.round(len * (1 - keep)) + wobble))
      for (let j = a; j < a + depth; j++) cover[j * src.w + x] = j === a ? 2 : j === a + depth - 1 ? 3 : 1
    }
  }
  const at = (x, y) => (cv.inside(x, y) ? cover[y * cv.w + x] : 0)
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const c = at(x, y)
      if (!c) continue
      let tone = c === 2 ? 'cream.2' : c === 3 ? 'snowShade' : 'snow'
      if (c === 1 && !at(x + 1, y)) tone = 'snowShade'
      if (c === 1 && hash(x, y) % 23 === 0) tone = 'snowShade'
      cv.set(x, y, C(tone))
    }
  }
  return cv
}
