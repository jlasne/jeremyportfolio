// Datacenters (violet): dark sleek halls with rooftop cooling, violet
// parapets and light strips, rack windows whose LEDs the map animates.
import { Canvas, C, building, box } from './raster.mjs'

/** A rooftop cooling unit seen from above: a box with a round fan grille. */
function fanUnit(cv, x, y, w = 11) {
  box(cv, x, y, w, w - 3, 3, { roof: ['stone.0', 'stone.1', 'stone.2'], wall: ['ink.1', 'ink.2', 'stone.0'] })
  const cx = x + w / 2
  const cy = y + (w - 3) / 2
  const r = (w - 4) / 2
  cv.ellipse(cx, cy, r, r * 0.78, C('ink.1'))
  cv.ellipse(cx, cy, r - 1, r * 0.78 - 1, C('ink.2'))
  // fan blades: a cross of stone pixels and a hub
  cv.hline(Math.round(cx - r + 1.5), Math.round(cx + r - 2.5), Math.floor(cy), C('stone.0'))
  cv.vline(Math.floor(cx), Math.round(cy - r * 0.78 + 1.5), Math.round(cy + r * 0.78 - 2.5), C('stone.0'))
  cv.set(Math.floor(cx), Math.floor(cy), C('stone.2'))
}

/**
 * A rack window on the front wall: dark glass, grille slots, dim LEDs.
 * Returns the LED positions (top-left of each 2 x 2 LED).
 */
function rackWindow(cv, x, y, w, h, ledRows) {
  cv.rect(x, y, w, h, C('ink.0'))
  cv.hline(x, x + w - 1, y, C('dc.0'))
  for (let ry = y + 2; ry < y + h - 1; ry += 3) cv.hline(x + 1, x + w - 2, ry, C('ink.1'))
  // glass reflection in the top-left corner
  cv.set(x + 1, y + 1, C('dc.2'))
  cv.set(x + 2, y + 1, C('dc.1'))
  cv.set(x + 1, y + 2, C('dc.1'))
  const leds = []
  for (const [lx, ly] of ledRows) {
    cv.rect(x + lx, y + ly, 2, 2, C('dc.0'))
    cv.set(x + lx + 1, y + ly + 1, C('ink.1'))
    leds.push([x + lx, y + ly])
  }
  return leds
}

/** The violet light strip along the top of the wall. */
function lightStrip(cv, x0, x1, y) {
  cv.hline(x0, x1, y, C('dc.2'))
  cv.hline(x0, x1, y + 1, C('dc.1'))
  cv.light(x0, y, x1 - x0 + 1, 2, 'dc')
}

// --- dc_small: narrow and tall, chillers breaking the roof line ---

const SMALL_FOOT = [32, 56]
const SMALL_BEACON = [49, 9]

function dcSmall() {
  let leds = []
  const img = building(
    64,
    64,
    (cv) => {
      const x = 10
      const y = 24
      const w = 44
      const roofH = 10
      const wallH = 22
      box(cv, x, y, w, roofH, wallH, { roof: ['stone.0', 'stone.1', 'stone.2'], wall: ['ink.0', 'ink.2', 'stone.0'] })
      // violet parapet around the roof
      cv.hline(x, x + w - 1, y, C('dc.2'))
      cv.vline(x, y, y + roofH - 1, C('dc.2'))
      cv.vline(x + w - 1, y + 1, y + roofH - 1, C('dc.0'))
      cv.hline(x, x + w - 1, y + roofH - 1, C('dc.0'))
      cv.hline(x + 1, x + w - 2, y + roofH - 2, C('dc.1'))
      // a roof hatch and the antenna mast with its beacon
      cv.rect(x + 29, y + 3, 8, 4, C('stone.0'))
      cv.hline(x + 29, x + 36, y + 3, C('stone.2'))
      cv.vline(x + 29, y + 3, y + 6, C('stone.2'))
      cv.vline(SMALL_BEACON[0], SMALL_BEACON[1] + 1, y + 5, C('stone.0'))
      cv.vline(SMALL_BEACON[0] - 1, SMALL_BEACON[1] + 6, y + 5, C('stone.1'))
      cv.hline(SMALL_BEACON[0] - 2, SMALL_BEACON[0] + 1, SMALL_BEACON[1] + 5, C('stone.0'))
      cv.set(SMALL_BEACON[0], SMALL_BEACON[1], C('status.2'))
      cv.light(SMALL_BEACON[0], SMALL_BEACON[1], 1, 1, 'beacon')
      // two chillers standing on the back of the roof, rising 4 px above it
      fanUnit(cv, x + 3, y - 4, 11)
      fanUnit(cv, x + 15, y - 4, 11)
      // wall: violet light strip, seams, rack windows, door
      const wy = y + roofH
      cv.hline(x + 1, x + w - 2, wy, C('ink.1'))
      lightStrip(cv, x + 1, x + w - 2, wy + 1)
      for (let sx = x + 4; sx < x + w - 2; sx += 8) cv.vline(sx, wy + 4, wy + wallH - 3, C('ink.1'))
      leds = leds.concat(
        rackWindow(cv, x + 3, wy + 5, 10, 14, [[2, 4], [6, 4], [2, 7], [6, 10]]),
        rackWindow(cv, x + 15, wy + 5, 10, 14, [[3, 4], [6, 7], [2, 10]]),
        rackWindow(cv, x + 35, wy + 5, 6, 14, [[2, 4], [2, 9]]),
      )
      // glass door with a violet frame
      const dx = x + 27
      cv.rect(dx, wy + 8, 7, 13, C('dc.0'))
      cv.rect(dx + 1, wy + 9, 5, 12, C('dc.1'))
      cv.vline(dx + 3, wy + 9, wy + 20, C('dc.0'))
      cv.set(dx + 1, wy + 9, C('cream.2'))
      cv.set(dx + 2, wy + 9, C('dc.2'))
      cv.set(dx + 1, wy + 10, C('dc.2'))
      cv.hline(dx - 1, dx + 7, wy + 7, C('dc.2'))
      cv.light(dx + 1, wy + 9, 5, 12, 'cool')
    },
    { cast: { wall: 18 } },
  )
  return { img, leds }
}

// --- dc_big ---

const BIG_FOOT = [48, 86]

function dcBig() {
  let leds = []
  const img = building(
    96,
    96,
    (cv) => {
      // a taller office block on the left, the long server hall to its right
      const hx = 30
      const hy = 38
      const hw = 62
      box(cv, hx, hy, hw, 20, 26, { roof: ['stone.0', 'stone.1', 'stone.2'], wall: ['ink.0', 'ink.2', 'stone.0'] })
      cv.hline(hx, hx + hw - 1, hy, C('dc.2'))
      cv.vline(hx + hw - 1, hy + 1, hy + 19, C('dc.0'))
      cv.hline(hx, hx + hw - 1, hy + 19, C('dc.0'))
      cv.hline(hx + 1, hx + hw - 2, hy + 18, C('dc.1'))
      // rooftop fan array, 2 rows of 4
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) fanUnit(cv, hx + 4 + c * 14, hy + 1 + r * 8, 10)
      lightStrip(cv, hx + 1, hx + hw - 2, hy + 21)
      for (let sx = hx + 3; sx < hx + hw - 2; sx += 10) cv.vline(sx, hy + 24, hy + 44, C('ink.1'))
      const rows = [[2, 4], [6, 4], [3, 7], [7, 10], [2, 13]]
      leds = leds.concat(
        rackWindow(cv, hx + 5, hy + 25, 11, 16, rows),
        rackWindow(cv, hx + 19, hy + 25, 11, 16, [[3, 4], [7, 7], [2, 10], [6, 13]]),
        rackWindow(cv, hx + 33, hy + 25, 11, 16, [[2, 4], [7, 7], [3, 13]]),
        rackWindow(cv, hx + 47, hy + 25, 11, 16, [[6, 4], [2, 10]]),
      )

      // office block: taller, violet roof cap, glazed front with the entrance
      const ox = 4
      const oy = 22
      const ow = 30
      box(cv, ox, oy, ow, 14, 50, { roof: ['dc.0', 'dc.1', 'dc.2'], wall: ['ink.0', 'ink.2', 'stone.0'] })
      // roof hatch with a lit top edge
      cv.rect(ox + 3, oy + 3, 9, 6, C('dc.0'))
      cv.hline(ox + 3, ox + 11, oy + 3, C('dc.2'))
      cv.vline(ox + 3, oy + 3, oy + 8, C('dc.1'))
      cv.hline(ox + 3, ox + 11, oy + 9, C('ink.1'))
      // satellite dish: a 7 x 4 bowl on a short mount, feed arm to the focus
      const dx = ox + 17
      const dy = oy + 4
      cv.rect(dx + 2, dy + 4, 2, 3, C('stone.0'))
      cv.ellipse(dx + 3.5, dy + 2, 3.5, 2, C('stone.0'))
      cv.hline(dx + 1, dx + 5, dy, C('stone.2'))
      cv.set(dx, dy + 1, C('stone.2'))
      cv.set(dx + 1, dy + 1, C('stone.1'))
      cv.set(dx + 6, dy + 2, C('ink.2'))
      cv.line(dx + 3, dy + 2, dx + 6, dy - 2, C('ink.2'))
      cv.set(dx + 6, dy - 3, C('dc.2'))
      // glazed floors: violet-tinted glass bands
      for (let f = 0; f < 4; f++) {
        const fy = oy + 17 + f * 10
        cv.rect(ox + 3, fy, ow - 6, 6, C('dc.0'))
        for (let gx = ox + 3; gx < ox + ow - 3; gx++) {
          if ((gx - ox) % 5 === 2) cv.vline(gx, fy, fy + 5, C('ink.1'))
          else cv.set(gx, fy, C('dc.1'))
        }
        cv.set(ox + 4, fy + 1, C('dc.2'))
        cv.set(ox + 5, fy + 1, C('dc.2'))
        // at dusk, most panes of each floor are lit
        for (let p = 0; p < 5; p++) {
          if ((f * 3 + p) % 4 === 1) continue
          const px = ox + 3 + p * 5
          cv.light(px, fy + 1, Math.min(4, ox + ow - 3 - px), 5, 'cool')
        }
      }
      // entrance canopy and doors
      cv.rect(ox + 8, oy + 56, 14, 8, C('dc.1'))
      cv.vline(ox + 15, oy + 56, oy + 63, C('dc.0'))
      cv.hline(ox + 8, ox + 21, oy + 56, C('dc.2'))
      cv.set(ox + 9, oy + 57, C('cream.2'))
      cv.set(ox + 10, oy + 57, C('dc.2'))
      cv.set(ox + 9, oy + 58, C('dc.2'))
      cv.rect(ox + 6, oy + 53, 18, 3, C('dc.1'))
      cv.hline(ox + 6, ox + 23, oy + 53, C('dc.2'))
      cv.hline(ox + 6, ox + 23, oy + 55, C('dc.0'))
      cv.light(ox + 9, oy + 57, 13, 7, 'cool')
      // the violet sign on the hall wall
      cv.rect(hx + 22, hy + 42, 18, 4, C('dc.1'))
      cv.hline(hx + 22, hx + 39, hy + 42, C('dc.2'))
      for (let k = 0; k < 5; k++) cv.set(hx + 24 + k * 3, hy + 44, C('cream.2'))
      cv.light(hx + 22, hy + 42, 18, 4, 'dc')
    },
    { cast: { wall: 26, reach: 6 } },
  )
  return { img, leds }
}

function led(on) {
  const cv = new Canvas(2, 2)
  if (on) {
    cv.rect(0, 0, 2, 2, C('dc.2'))
    cv.set(0, 0, C('cream.2'))
  } else {
    cv.rect(0, 0, 2, 2, C('dc.0'))
    cv.set(1, 1, C('ink.1'))
  }
  return cv
}

export function dcFrames() {
  const small = dcSmall()
  const big = dcBig()
  return [
    { name: 'dc_small', canvas: small.img, points: { leds: small.leds, beacon: SMALL_BEACON, foot: SMALL_FOOT }, snow: true, lights: true },
    { name: 'dc_big', canvas: big.img, points: { leds: big.leds, foot: BIG_FOOT }, snow: true, lights: true },
    { name: 'rack_led_on', canvas: led(true) },
    { name: 'rack_led_dim', canvas: led(false) },
  ]
}
