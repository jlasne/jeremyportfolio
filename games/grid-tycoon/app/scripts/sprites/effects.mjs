// Effects: the teal spinning coin (money) and the yellow spark (electricity).
import { Canvas, C } from './raster.mjs'

/**
 * Coin frames: the face narrows to its edge and widens again, showing the
 * back on the second half. Half-widths per frame (full face is 6).
 */
const COIN_HALF = [6, 4.6, 2.4, 0.6, 2.4, 4.6]

const DOLLAR = ['.#.', '###', '#..', '###', '..#', '###', '.#.']
const DOLLAR_NARROW = ['#.', '##', '#.', '##', '.#', '##', '#.']

function coin(i) {
  const cv = new Canvas(16, 16)
  const hw = COIN_HALF[i]
  const cx = 8
  const cy = 8
  const ry = 6
  const back = i >= 4
  if (hw < 1) {
    // edge-on: a thin rim with a lit top
    cv.vline(cx - 1, cy - ry, cy + ry - 1, C('money.0'))
    cv.vline(cx, cy - ry, cy + ry - 1, C('money.1'))
    cv.set(cx, cy - ry, C('money.2'))
  } else {
    // rim then face, lit from the top-left
    cv.ellipse(cx, cy, hw, ry, C('money.0'))
    cv.ellipse(cx, cy, Math.max(0.8, hw - 1), ry - 1, (x, y, u, v) => C(u + v < -0.7 ? 'money.2' : u + v < 0.7 ? 'money.1' : 'money.0'))
    if (hw > 2) {
      // front: an embossed dollar sign (dark strokes, lit top-left edges);
      // back: a raised ring
      if (!back) {
        const glyph = hw > 5 ? DOLLAR : DOLLAR_NARROW
        const gx = cx - 1
        const gy = cy - 4
        glyph.forEach((row, j) =>
          [...row].forEach((ch, i) => {
            if (ch !== '#') return
            const x = gx + i
            const y = gy + j
            if (glyph[j - 1]?.[i - 1] !== '#' && cv.alpha(x - 1, y - 1)) cv.set(x - 1, y - 1, C('money.2'))
          }),
        )
        glyph.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && cv.set(gx + i, gy + j, C('money.0'))))
      } else {
        cv.ellipse(cx, cy, Math.max(1, hw - 2.2), ry - 2.2, C('money.0'))
        cv.ellipse(cx, cy, Math.max(0.6, hw - 3.2), ry - 3.2, C('money.1'))
      }
    }
    // specular glint on the rim
    cv.set(Math.round(cx - hw + 1), cy - 3, C('cream.2'))
  }
  // a dark ink rim so the coin reads over any ground
  const out = new Canvas(16, 16)
  out.blit(cv, 0, 0)
  out.outline(C('ink.0'))
  return out
}

/** Spark: a yellow four-point flash that grows, bursts, then fades to motes. */
function spark(i) {
  const cv = new Canvas(8, 8)
  const core = C('cream.2')
  const hot = C('power.1')
  const warm = C('power.0')
  if (i === 0) {
    cv.set(3, 3, core)
    cv.set(4, 3, hot)
    cv.set(3, 4, hot)
    cv.set(4, 4, hot)
  } else if (i === 1) {
    cv.rect(3, 3, 2, 2, core)
    cv.vline(3, 1, 2, hot)
    cv.vline(4, 5, 6, hot)
    cv.hline(1, 2, 4, hot)
    cv.hline(5, 6, 3, hot)
  } else if (i === 2) {
    cv.rect(3, 3, 2, 2, core)
    cv.vline(3, 0, 2, hot)
    cv.vline(4, 5, 7, hot)
    cv.hline(0, 2, 4, hot)
    cv.hline(5, 7, 3, hot)
    cv.set(1, 1, warm)
    cv.set(6, 6, warm)
    cv.set(6, 1, warm)
    cv.set(1, 6, warm)
  } else {
    cv.set(3, 3, hot)
    cv.set(0, 4, warm)
    cv.set(7, 3, warm)
    cv.set(3, 0, warm)
    cv.set(4, 7, warm)
    cv.set(1, 1, C('power.0', 150))
    cv.set(6, 6, C('power.0', 150))
  }
  return cv
}

export function effectFrames() {
  const out = []
  for (let i = 0; i < 6; i++) out.push({ name: `coin_${i}`, canvas: coin(i), points: { center: [8, 8] } })
  for (let i = 0; i < 4; i++) out.push({ name: `spark_${i}`, canvas: spark(i), points: { center: [4, 4] } })
  return out
}
