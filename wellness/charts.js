/* jeremylasne.com/wellness: the bar charts both pages draw. */

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

/* a rectangle with its top corners rounded, or all four */
function shape(ctx, x, y, w, h, r, all) {
  r = Math.max(0, Math.min(r, w / 2, h));
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, all ? r : [r, r, 0, 0]);
  else ctx.rect(x, y, w, h);
}

/* One rounded bar per day, anchored to the baseline. `value(k)` is the day's
   number, `tone(v)` its colour (or `fill(k)` a colour of its own, `stack(k)`
   parts [{ c, v }] stacked from the bottom in their colours, `empty(k)` the
   colour of a day with no number), `band` the normal range drawn behind, `lo` and `hi`
   a fixed scale (otherwise the data's own), `marks(k)` the sessions shown
   as small dots under the bar, `read(i)` what to say about a bar
   (null: the default line). A tap pins a bar, a second tap lets go.
   `ch` is the height of the bars' area in CSS pixels. */
export function barChart(cv, opts, ch = 170) {
  const CH = ch, MARK = 14, H = CH + MARK, R = 4;
  let geo = null, pick = null;
  function draw(animate) {
    const o = opts(), { keys, value, band, marks } = o;
    const n = keys.length, { ctx, w } = prep(cv, H);
    const vals = keys.map(value), got = vals.filter(v => v !== undefined);
    const hi = o.hi ?? (got.length ? Math.max(...got) : 1);
    const loRaw = got.length ? Math.min(...got) : 0;
    const lo = o.lo ?? Math.max(0, loRaw - (hi - loRaw || hi * .2) * .35);
    const hOf = v => Math.max(4, Math.min(CH, (v - lo) / ((hi - lo) || 1) * CH));
    const colW = w / n, gap = colW > 12 ? 4 : colW > 6 ? 2 : 1;
    const x0 = i => Math.floor(i * colW), cw = i => Math.max(1, Math.floor((i + 1) * colW) - Math.floor(i * colW) - gap);
    geo = { colW, n, keys, vals };
    const paint = p => {
      ctx.clearRect(0, 0, w, H);
      if (band) {
        const a = CH - hOf(band.q1), b = CH - hOf(band.q3);
        ctx.fillStyle = 'rgba(95,168,211,.1)';
        shape(ctx, 0, b, w, Math.max(2, a - b), 6, true); ctx.fill();
        const my = Math.round(CH - hOf(band.med)) + .5;
        ctx.strokeStyle = 'rgba(234,244,251,.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(w, my); ctx.stroke(); ctx.setLineDash([]);
      }
      keys.forEach((k, i) => {
        const v = vals[i], x = x0(i), bw = cw(i);
        const dim = pick !== null && pick !== i;
        if (v !== undefined) {
          const h = hOf(v) * Math.max(0, Math.min(1, p * 1.7 - i / n * .7));
          if (h > 0) {
            ctx.globalAlpha = dim ? .3 : .92;
            const parts = o.stack ? o.stack(k) : null;
            if (parts) {
              /* each part its share of the bar, from the bottom, a 2px gap between them */
              const sum = parts.reduce((a, s) => a + s.v, 0) || 1;
              ctx.save(); shape(ctx, x, CH - h, bw, h, R); ctx.clip();
              let y = CH;
              parts.forEach((s, j) => {
                const ph = s.v / sum * h, last = j === parts.length - 1;
                ctx.fillStyle = s.c;
                ctx.fillRect(x, y - ph, bw, Math.max(0, ph - (last ? 0 : 2)));
                y -= ph;
              });
              ctx.restore();
            } else {
              ctx.fillStyle = o.fill ? o.fill(k) : o.tone ? FILL[o.tone(v)] : FILL.mid;
              shape(ctx, x, CH - h, bw, h, R); ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        } else {
          /* nothing to measure: a faint stub, in the day's colour when it has one */
          const c = o.empty && o.empty(k);
          ctx.fillStyle = c || 'rgba(234,244,251,.1)';
          ctx.globalAlpha = c ? .45 : 1;
          shape(ctx, x, CH - 3, bw, 3, 2, true); ctx.fill();
          ctx.globalAlpha = 1;
        }
        (marks ? marks(k) : []).slice(0, 2).forEach((s, j) => {
          const d = Math.max(2, Math.min(6, bw));
          ctx.fillStyle = COLOR[s.s];
          ctx.beginPath(); ctx.arc(x + d / 2 + j * (d + 1), CH + 6 + d / 2, d / 2, 0, 6.29); ctx.fill();
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

/* One column per night, a bar from bedtime (top) to wake-up (bottom), the
   clock down the left. `bed(k)` and `wake(k)` are minutes after midnight
   (a bedtime after midnight past 1440), `tone(k)` the bar's colour, `lines`
   the normal bed and wake as dashed rules (wake-up past 1440 too), `read(i)` what to say about a
   night. A tap pins a night, a second tap lets go. */
export function spanChart(cv, opts, ch = 150) {
  const GUT = 38, R = 3;
  let geo = null, pick = null;
  function draw(animate) {
    const o = opts(), { keys, bed, wake } = o;
    const n = keys.length, { ctx, w } = prep(cv, ch);
    const b = keys.map(bed), e = keys.map(k => { const v = wake(k); return v === undefined ? undefined : v + 1440; });
    const got = keys.map((_, i) => b[i] !== undefined && e[i] !== undefined);
    const lo = Math.floor(Math.min(...b.filter((x, i) => got[i]), 1380) / 60) * 60;
    const hi = Math.ceil(Math.max(...e.filter((x, i) => got[i]), 1920) / 60) * 60;
    const y = m => 4 + (m - lo) / (hi - lo) * (ch - 8);
    const colW = (w - GUT) / n, gap = colW > 12 ? 4 : colW > 6 ? 2 : 1;
    const x0 = i => GUT + Math.floor(i * colW), cw = i => Math.max(1, Math.floor((i + 1) * colW) - Math.floor(i * colW) - gap);
    geo = { colW, n };
    const paint = p => {
      ctx.clearRect(0, 0, w, ch);
      ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'middle';
      const step = hi - lo > 720 ? 180 : 120;
      for (let m = Math.ceil(lo / step) * step; m <= hi; m += step) {
        const yy = Math.round(y(m)) + .5;
        ctx.fillStyle = 'rgba(234,244,251,.45)';
        ctx.fillText(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:00`, 0, yy);
        ctx.strokeStyle = 'rgba(234,244,251,.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(GUT, yy); ctx.lineTo(w, yy); ctx.stroke();
      }
      (o.lines || []).forEach(m => {
        const yy = Math.round(y(m)) + .5;
        ctx.strokeStyle = 'rgba(234,244,251,.4)'; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(GUT, yy); ctx.lineTo(w, yy); ctx.stroke(); ctx.setLineDash([]);
      });
      keys.forEach((k, i) => {
        if (!got[i]) return;
        const t = Math.max(0, Math.min(1, p * 1.7 - i / n * .7));
        if (!t) return;
        const top = y(b[i]), h = (y(e[i]) - top) * t;
        ctx.globalAlpha = pick !== null && pick !== i ? .3 : .92;
        ctx.fillStyle = FILL[o.tone(k)] || FILL.mid;
        shape(ctx, x0(i), top, cw(i), Math.max(2, h), R, true); ctx.fill();
        ctx.globalAlpha = 1;
      });
    };
    animate ? play(paint) : paint(1);
    const last = got.lastIndexOf(true);
    o.read(pick ?? (last >= 0 ? last : null));
  }
  const at = e => {
    if (!geo) return null;
    const r = cv.getBoundingClientRect();
    return Math.max(0, Math.min(geo.n - 1, Math.floor((e.clientX - r.left - GUT) / geo.colW)));
  };
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') opts().read(at(e)); });
  cv.addEventListener('pointerleave', () => { if (pick === null) draw(false); });
  cv.addEventListener('click', e => { const i = at(e); pick = pick === i ? null : i; draw(false); });
  return { draw };
}
