/* jeremylasne.com/wellness: the block charts both pages draw. */

import { COLOR } from '/wellness/data.js';

export const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* a canvas sized to its box, drawn in CSS pixels */
export function prep(cv, h) {
  const dpr = Math.max(1, Math.round(devicePixelRatio || 1)), w = cv.clientWidth;
  cv.style.height = h + 'px';
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* a drawing animated from 0 to 1 once, or drawn whole */
export function play(draw, ms = 700) {
  if (still) return draw(1);
  const t0 = performance.now();
  const tick = t => { const p = Math.min(1, (t - t0) / ms); draw(1 - Math.pow(1 - p, 3)); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

const FILL = { good: COLOR.good, bad: COLOR.bad, mid: COLOR.blue };

/* One column of thin blocks per day. `value(k)` is the day's number,
   `tone(v)` its colour (or `fill(k)` a colour of its own, `empty(k)` the
   colour of a day with no number), `band` the normal range drawn behind, `lo` and `hi`
   a fixed scale (otherwise the data's own), `marks(k)` the sessions shown
   as small squares under the column, `read(i)` what to say about a column
   (null: the default line). A tap pins a column, a second tap lets go. */
export function blockChart(cv, opts) {
  const ROWS = 34, PITCH = 5, BH = 4, MARK = 12, H = ROWS * PITCH + MARK;
  let geo = null, pick = null;
  function draw(animate) {
    const { keys, value, band, marks } = opts();
    const n = keys.length, { ctx, w } = prep(cv, H);
    const vals = keys.map(value), got = vals.filter(v => v !== undefined);
    const o = opts();
    const hi = o.hi ?? (got.length ? Math.max(...got) : 1);
    const loRaw = got.length ? Math.min(...got) : 0;
    const lo = o.lo ?? Math.max(0, loRaw - (hi - loRaw || hi * .2) * .35);
    const rowsOf = v => Math.max(1, Math.min(ROWS, Math.round((v - lo) / ((hi - lo) || 1) * ROWS)));
    const colW = w / n, gap = colW > 12 ? 3 : colW > 6 ? 2 : 1;
    const x0 = i => Math.floor(i * colW), cw = i => Math.max(1, Math.floor((i + 1) * colW) - Math.floor(i * colW) - gap);
    geo = { colW, n, keys, vals };
    const paint = p => {
      ctx.clearRect(0, 0, w, H);
      if (band) {
        const a = rowsOf(band.q1), b = rowsOf(band.q3);
        ctx.fillStyle = 'rgba(95,168,211,.09)';
        ctx.fillRect(0, (ROWS - b) * PITCH, w, (b - a + 1) * PITCH);
        const my = (ROWS - rowsOf(band.med)) * PITCH + BH / 2 - 1;
        ctx.fillStyle = 'rgba(234,244,251,.35)';
        for (let x = 0; x < w; x += 6) ctx.fillRect(x, my, 2, 1);
      }
      keys.forEach((k, i) => {
        const v = vals[i];
        if (v !== undefined) {
          const rows = rowsOf(v), show = Math.round(rows * Math.max(0, Math.min(1, p * 1.7 - i / n * .7)));
          ctx.fillStyle = o.fill ? o.fill(k) : FILL[o.tone(v)];
          const dim = pick !== null && pick !== i;
          for (let r = 0; r < show; r++) {
            ctx.globalAlpha = (dim ? .35 : 1) * (r === rows - 1 ? 1 : .78);
            ctx.fillRect(x0(i), (ROWS - 1 - r) * PITCH, cw(i), BH);
          }
          ctx.globalAlpha = 1;
        } else {
          /* nothing to measure: a faint base, in the day's colour when it has one */
          const c = o.empty && o.empty(k);
          ctx.fillStyle = c || 'rgba(234,244,251,.06)';
          ctx.globalAlpha = c ? .45 : 1;
          ctx.fillRect(x0(i), (ROWS - 1) * PITCH, cw(i), BH);
          ctx.globalAlpha = 1;
        }
        (marks ? marks(k) : []).slice(0, 2).forEach((s, j) => {
          const sz = Math.min(5, cw(i));
          ctx.fillStyle = COLOR[s.s];
          ctx.fillRect(x0(i) + j * (sz + 1), ROWS * PITCH + 4, sz, sz);
        });
      });
    };
    animate ? play(paint) : paint(1);
    o.read(pick ?? vals.map((v, i) => (v !== undefined ? i : -1)).filter(i => i >= 0).pop() ?? null);
  }
  const at = e => {
    if (!geo) return null;
    const r = cv.getBoundingClientRect();
    return Math.max(0, Math.min(geo.n - 1, Math.floor((e.clientX - r.left) / geo.colW)));
  };
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') opts().read(at(e)); });
  cv.addEventListener('pointerleave', () => { if (pick === null) draw(false); });
  cv.addEventListener('click', e => { const i = at(e); pick = pick === i ? null : i; draw(false); });
  return { draw, reset() { pick = null; } };
}
