/* The reel engine. Every frame is a pure function of t, so the reel can be
   scrubbed, stepped a frame at a time and exported frame by frame.
   Scenes draw on a 1920x1080 Canvas 2D; one WebGL2 pass adds the lens. */
(() => {
  'use strict';

  const W = 1920, H = 1080, BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = 15, FPS = 60;
  const TAU = Math.PI * 2;
  const R = window.Reel = { W, H, BPM, BEAT, BAR, DUR, FPS, TAU, scenes: [] };

  // ---- time on the grid: at(bar, beat, sixteenth), all 1-based like a DAW ----
  R.at = (bar, beat = 1, six = 1) => (bar - 1) * BAR + (beat - 1) * BEAT + (six - 1) * BEAT / 4;
  R.beats = n => n * BEAT;
  R.sixteenths = n => n * BEAT / 4;

  // ---- math ----
  const clamp = R.clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = R.lerp = (a, b, t) => a + (b - a) * t;
  R.invlerp = (a, b, v) => (v - a) / (b - a);
  R.remap = (v, a, b, c, d, cl = true) => { let p = (v - a) / (b - a); if (cl) p = clamp(p); return c + (d - c) * p; };
  R.smoothstep = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
  R.fract = x => x - Math.floor(x);
  R.mod = (a, n) => ((a % n) + n) % n;
  const prog = R.prog = (t, a, b) => b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a));
  R.pingpong = x => 1 - Math.abs(1 - 2 * R.fract(x * 0.5));
  R.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  // ---- easing: the whole vocabulary ----
  const E = R.ease = {
    linear: x => x,
    inQuad: x => x * x, outQuad: x => 1 - (1 - x) * (1 - x),
    inOutQuad: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    inCubic: x => x * x * x, outCubic: x => 1 - Math.pow(1 - x, 3),
    inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    inQuart: x => x ** 4, outQuart: x => 1 - Math.pow(1 - x, 4),
    inOutQuart: x => x < .5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2,
    inQuint: x => x ** 5, outQuint: x => 1 - Math.pow(1 - x, 5),
    inOutQuint: x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2,
    inSine: x => 1 - Math.cos(x * Math.PI / 2), outSine: x => Math.sin(x * Math.PI / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
    outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    inCirc: x => 1 - Math.sqrt(1 - x * x), outCirc: x => Math.sqrt(1 - Math.pow(x - 1, 2)),
    inOutCirc: x => x < .5 ? (1 - Math.sqrt(1 - 4 * x * x)) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2,
    inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
    outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
    inOutBack: (x, s = 1.70158) => {
      const c = s * 1.525;
      return x < .5 ? (Math.pow(2 * x, 2) * ((c + 1) * 2 * x - c)) / 2
        : (Math.pow(2 * x - 2, 2) * ((c + 1) * (x * 2 - 2) + c) + 2) / 2;
    },
    outElastic: (x, amp = 1, period = .3) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      const a = Math.max(1, amp), s = period / TAU * Math.asin(1 / a);
      return a * Math.pow(2, -10 * x) * Math.sin((x - s) * TAU / period) + 1;
    },
    inElastic: (x, amp, period) => 1 - E.outElastic(1 - x, amp, period),
    outBounce: x => {
      const n = 7.5625, d = 2.75;
      if (x < 1 / d) return n * x * x;
      if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75;
      if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375;
      return n * (x -= 2.625 / d) * x + .984375;
    },
    inBounce: x => 1 - E.outBounce(1 - x),
  };

  // CSS-style cubic-bezier(x1, y1, x2, y2), solved with Newton then bisection
  R.bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u;
    const dx = u => (3 * ax * u + 2 * bx) * u + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let u = x;
      for (let i = 0; i < 8; i++) { const e = sx(u) - x, d = dx(u); if (Math.abs(e) < 1e-6) return sy(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
      let lo = 0, hi = 1; u = x;
      for (let i = 0; i < 30; i++) { const v = sx(u); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = u; else hi = u; u = (lo + hi) / 2; }
      return sy(u);
    };
  };
  // the curves a motion designer actually reaches for
  E.snap = R.bezier(.7, 0, .12, 1);       // hard in, glide out
  E.whip = R.bezier(.85, 0, .15, 1);      // whip pans
  E.swift = R.bezier(.22, 1, .36, 1);     // the site's own curve
  E.anticipate = R.bezier(.36, -0.45, .6, 1);

  const easeFn = e => typeof e === 'function' ? e : (E[e] || E.linear);
  R.easeFn = easeFn;

  // A damped spring, closed form. x = seconds since release. Goes 0 -> 1.
  // stiffness k, damping c, mass m, initial velocity v0 (units per second)
  R.spring = (x, k = 170, c = 26, m = 1, v0 = 0) => {
    if (x <= 0) return 0;
    const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m)), A = -1;
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z), B = (z * w0 * A + v0) / wd;
      return 1 + Math.exp(-z * w0 * x) * (A * Math.cos(wd * x) + B * Math.sin(wd * x));
    }
    if (z === 1) return 1 + Math.exp(-w0 * x) * (A + (v0 + w0 * A) * x);
    const s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s);
    const C2 = (v0 - r1 * A) / (r2 - r1), C1 = A - C2;
    return 1 + C1 * Math.exp(r1 * x) + C2 * Math.exp(r2 * x);
  };

  // tween between two values over [a, b] with an easing
  R.tween = (t, a, b, from, to, ease = 'outCubic') => {
    const p = easeFn(ease)(prog(t, a, b));
    if (Array.isArray(from)) return from.map((v, i) => lerp(v, to[i], p));
    return lerp(from, to, p);
  };

  // keyframes: [[time, value], [time, value, easeIntoThisKey], ...]; numbers or arrays
  R.keys = (t, frames) => {
    if (t <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      const [t1, v1, e] = frames[i];
      if (t < t1) {
        const [t0, v0] = frames[i - 1];
        const p = easeFn(e || 'inOutCubic')(prog(t, t0, t1));
        if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], p));
        return lerp(v0, v1, p);
      }
    }
    return frames[frames.length - 1][1];
  };

  // stagger: index i of n, spread over `spread` seconds
  R.stagger = (t, start, i, n, spread, dur, ease = 'outCubic') =>
    easeFn(ease)(prog(t, start + (n > 1 ? i / (n - 1) : 0) * spread, start + (n > 1 ? i / (n - 1) : 0) * spread + dur));

  // ---- deterministic randomness ----
  R.rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  R.hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  R.hash2 = (x, y) => R.hash(x * 12.9898 + y * 78.233);

  // ---- simplex noise, 2D and 3D, seeded once ----
  const perm = new Uint8Array(512);
  { const r = R.rng(1337), p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const G3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
  R.noise2 = (x, y) => {
    const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    const c = (xx, yy, g) => { let tt = .5 - xx * xx - yy * yy; if (tt < 0) return 0; tt *= tt; return tt * tt * (G3[g] * xx + G3[g + 1] * yy); };
    n += c(x0, y0, (perm[ii + perm[jj]] % 12) * 3);
    n += c(x1, y1, (perm[ii + i1 + perm[jj + j1]] % 12) * 3);
    n += c(x2, y2, (perm[ii + 1 + perm[jj + 1]] % 12) * 3);
    return 70 * n;
  };
  R.noise3 = (x, y, z) => {
    const F3 = 1 / 3, G = 1 / 6;
    const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G, x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const pts = [[x0, y0, z0, 0, 0, 0], [x0 - i1 + G, y0 - j1 + G, z0 - k1 + G, i1, j1, k1],
      [x0 - i2 + 2 * G, y0 - j2 + 2 * G, z0 - k2 + 2 * G, i2, j2, k2], [x0 - 1 + .5, y0 - 1 + .5, z0 - 1 + .5, 1, 1, 1]];
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    for (const [px, py, pz, a, b, c] of pts) {
      let tt = .6 - px * px - py * py - pz * pz;
      if (tt < 0) continue;
      const g = (perm[ii + a + perm[jj + b + perm[kk + c]]] % 12) * 3;
      tt *= tt; n += tt * tt * (G3[g] * px + G3[g + 1] * py + G3[g + 2] * pz);
    }
    return 32 * n;
  };
  R.fbm2 = (x, y, oct = 4) => { let a = .5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * R.noise2(x * f, y * f); f *= 2; a *= .5; } return s; };

  // ---- colour ----
  const hexCache = new Map();
  const hex = R.hex = h => {
    if (Array.isArray(h)) return h;
    let v = hexCache.get(h);
    if (v) return v;
    const s = h.replace('#', ''), f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    v = [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
    hexCache.set(h, v);
    return v;
  };
  R.rgba = (h, a = 1) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  R.mix = (a, b, t, alpha = 1) => {
    const A = hex(a), B = hex(b);
    return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${alpha})`;
  };
  R.mixArr = (a, b, t) => { const A = hex(a), B = hex(b); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; };
  R.hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  // the site's palette; scenes add the storyboard's accents
  R.C = { ink: '#050b16', blue: '#5fa8d3', ice: '#eaf4fb', red: '#ff4b1f', lime: '#d7ff3a', ink2: '#0c1628', redDeep: '#b8260c' };

  // ---- type ----
  R.F = { display: 'Unbounded', sans: 'Inter Tight', grot: 'Space Grotesk', serif: 'Instrument Serif', mono: 'JetBrains Mono' };
  R.font = (ctx, size, family = 'sans', weight = 700, style = '') => {
    const fam = R.F[family] || family;
    ctx.font = `${style ? style + ' ' : ''}${weight} ${size}px "${fam}"`;
    return ctx.font;
  };
  // glyph positions for per-letter animation; kerning kept by measuring prefixes
  const glyphCache = new Map();
  R.glyphs = (ctx, str, tracking = 0) => {
    const key = ctx.font + '|' + tracking + '|' + str;
    let g = glyphCache.get(key);
    if (g) return g;
    const chars = [];
    const chrs = Array.from(str);
    let prefix = '';
    for (let i = 0; i < chrs.length; i++) {
      const x = ctx.measureText(prefix).width + i * tracking;
      const w = ctx.measureText(chrs[i]).width;
      chars.push({ ch: chrs[i], x, w, i });
      prefix += chrs[i];
    }
    const width = ctx.measureText(str).width + Math.max(0, chrs.length - 1) * tracking;
    g = { chars, width };
    glyphCache.set(key, g);
    return g;
  };
  R.textWidth = (ctx, str, tracking = 0) => R.glyphs(ctx, str, tracking).width;
  // draw text with tracking; align: left | center | right (baseline stays whatever ctx has)
  R.text = (ctx, str, x, y, opts = {}) => {
    const { tracking = 0, align = 'left', stroke = false } = opts;
    const prevAlign = ctx.textAlign;
    if (!tracking) {
      ctx.textAlign = align;
      stroke ? ctx.strokeText(str, x, y) : ctx.fillText(str, x, y);
      ctx.textAlign = prevAlign;
      return;
    }
    const g = R.glyphs(ctx, str, tracking);
    const x0 = align === 'center' ? x - g.width / 2 : align === 'right' ? x - g.width : x;
    ctx.textAlign = 'left';
    for (const c of g.chars) stroke ? ctx.strokeText(c.ch, x0 + c.x, y) : ctx.fillText(c.ch, x0 + c.x, y);
    ctx.textAlign = prevAlign;
  };

  // ---- shapes, as point lists so anything can morph into anything ----
  R.pathLen = (pts, closed = true) => {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]);
    return L;
  };
  // n points evenly spaced along the outline
  R.resample = (pts, n, closed = true) => {
    const src = closed ? [...pts, pts[0]] : pts;
    const seg = [];
    let L = 0;
    for (let i = 1; i < src.length; i++) { const d = Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]); seg.push(d); L += d; }
    const out = [];
    const step = L / (closed ? n : n - 1);
    let si = 0, acc = 0;
    for (let k = 0; k < n; k++) {
      const target = k * step;
      while (si < seg.length - 1 && acc + seg[si] < target) { acc += seg[si]; si++; }
      const u = seg[si] ? (target - acc) / seg[si] : 0;
      const a = src[si], b = src[si + 1] || src[si];
      out.push([lerp(a[0], b[0], clamp(u)), lerp(a[1], b[1], clamp(u))]);
    }
    return out;
  };
  // start at the top (angle -90deg), clockwise, so shapes line up when morphing
  R.circlePts = (n, r, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + i / n * TAU; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  R.polyPts = (sides, r, n = 0, cx = 0, cy = 0, rot = 0) => {
    const v = Array.from({ length: sides }, (_, i) => {
      const a = -Math.PI / 2 + rot + i / sides * TAU; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    return n ? R.resample(v, n) : v;
  };
  R.starPts = (spikes, r1, r2, n = 0, cx = 0, cy = 0, rot = 0) => {
    const v = [];
    for (let i = 0; i < spikes * 2; i++) {
      const a = -Math.PI / 2 + rot + i / (spikes * 2) * TAU, r = i % 2 ? r2 : r1;
      v.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return n ? R.resample(v, n) : v;
  };
  R.rectPts = (w, h, n = 0, cx = 0, cy = 0, rad = 0) => {
    let v;
    if (!rad) v = [[cx, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2]];
    else {
      v = [];
      const rr = Math.min(rad, w / 2, h / 2), seg = 8;
      const corners = [[cx + w / 2 - rr, cy - h / 2 + rr, -Math.PI / 2], [cx + w / 2 - rr, cy + h / 2 - rr, 0],
        [cx - w / 2 + rr, cy + h / 2 - rr, Math.PI / 2], [cx - w / 2 + rr, cy - h / 2 + rr, Math.PI]];
      v.push([cx, cy - h / 2]);
      for (const [x, y, a0] of corners) for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; v.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    }
    return n ? R.resample(v, n) : v;
  };
  R.morph = (a, b, t) => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);
  R.tracePts = (ctx, pts, closed = true) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
  };
  // smooth closed curve through points (Catmull-Rom to Bezier), for blobs
  R.traceSmooth = (ctx, pts, closed = true, tension = 1) => {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const q0 = closed || i > 0 ? p0 : p1, q3 = closed || i < n - 2 ? p3 : p2;
      ctx.bezierCurveTo(p1[0] + (p2[0] - q0[0]) / 6 * tension, p1[1] + (p2[1] - q0[1]) / 6 * tension,
        p2[0] - (q3[0] - p1[0]) / 6 * tension, p2[1] - (q3[1] - p1[1]) / 6 * tension, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  };
  R.roundRect = (ctx, x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // stroke only the first p (0..1) of a path of length len (draw-on)
  R.dashProgress = (ctx, len, p, offset = 0) => {
    ctx.setLineDash([Math.max(0.001, len * p), len + 1]);
    ctx.lineDashOffset = -offset;
  };

  // ---- 3D, projected in software ----
  R.rotX = ([x, y, z], a) => { const c = Math.cos(a), s = Math.sin(a); return [x, y * c - z * s, y * s + z * c]; };
  R.rotY = ([x, y, z], a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, y, -x * s + z * c]; };
  R.rotZ = ([x, y, z], a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c, z]; };
  R.rot3 = (p, rx, ry, rz) => R.rotZ(R.rotY(R.rotX(p, rx), ry), rz);
  // camera looks down +z; focal in px (1000 ~ 57deg vertical fov on a 1080 frame)
  R.project = ([x, y, z], cam = {}) => {
    const { focal = 1000, cx = W / 2, cy = H / 2, dist = 0 } = cam;
    const zz = z + dist;
    if (zz <= 1) return null;
    const s = focal / zz;
    return [cx + x * s, cy + y * s, s, zz];
  };

  // ---- offscreen layers, sized to the render resolution, drawn in logical px ----
  const layers = new Map();
  R.layer = (name = 'a') => {
    let L = layers.get(name);
    if (!L || L.canvas.width !== R.rw || L.canvas.height !== R.rh) {
      const c = L ? L.canvas : document.createElement('canvas');
      c.width = R.rw; c.height = R.rh;
      L = { canvas: c, ctx: c.getContext('2d') };
      layers.set(name, L);
    }
    L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    L.ctx.globalAlpha = 1;
    L.ctx.globalCompositeOperation = 'source-over';
    L.ctx.filter = 'none';
    L.ctx.clearRect(0, 0, R.rw, R.rh);
    // Chromium can present a stale snapshot of a canvas that was only cleared; one real draw prevents it
    L.ctx.fillStyle = 'rgba(0,0,0,0.004)';
    L.ctx.fillRect(0, 0, 1, 1);
    L.ctx.setTransform(R.rs, 0, 0, R.rs, 0, 0);
    return L;
  };
  // draw a layer back at 1:1 regardless of the current transform
  R.blit = (ctx, L, alpha = 1, op = 'source-over') => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = op;
    ctx.drawImage(L.canvas, 0, 0);
    ctx.restore();
  };

  // Real motion blur: average `samples` sub-frames across the shutter.
  // draw(ctx, tt) must draw the moving thing at time tt. shutter in seconds (1/48 = 180deg at 24fps).
  R.motionBlur = (ctx, t, draw, { samples = 8, shutter = 1 / 48, name = '_mb' } = {}) => {
    if (samples <= 1 || R.quality < 1) { draw(ctx, t); return; }
    const L = R.layer(name);
    L.ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < samples; i++) {
      const tt = t - shutter * (i / (samples - 1) - .5);
      L.ctx.save();
      L.ctx.globalAlpha = 1 / samples;
      draw(L.ctx, tt);
      L.ctx.restore();
    }
    R.blit(ctx, L);
  };

  // ---- post-FX parameters: scenes set these every frame; the engine resets them ----
  const FX0 = {
    zoom: 1, rot: 0, shakeX: 0, shakeY: 0,
    chroma: 0, chromaAngle: 0, distort: 0,
    bloom: .35, threshold: .62,
    flash: 0, flashColor: [1, 1, 1],
    exposure: 1, saturation: 1, contrast: 1,
    grain: .045, vignette: .35, scan: 0,
  };
  R.fx = { ...FX0 };
  // camera shake that decays after an impact at t0
  R.impact = (t, t0, { amount = 18, decay = 6, freq = 28, rot = .01 } = {}) => {
    if (t < t0) return;
    const k = Math.exp(-(t - t0) * decay) * amount, s = (t - t0) * freq;
    R.fx.shakeX += R.noise2(s, 11.3) * k;
    R.fx.shakeY += R.noise2(s, 47.9) * k;
    R.fx.rot += R.noise2(s, 91.1) * rot * k / amount;
  };
  // a flash that decays after t0
  R.flash = (t, t0, { amount = .8, decay = 10, color } = {}) => {
    if (t < t0) return;
    const v = Math.exp(-(t - t0) * decay) * amount;
    if (v > R.fx.flash) { R.fx.flash = v; if (color) R.fx.flashColor = hex(color).map(c => c / 255); }
  };

  // ---- scenes ----
  // Reel.scene({ id, start, end, layer, setup(R), draw(ctx, t, lt, R) })
  R.scene = def => {
    R.scenes.push({ layer: 0, ...def });
    R.scenes.sort((a, b) => a.layer - b.layer || a.start - b.start);
  };
  R.bg = R.C.ink;
  R.onFrame = []; // global hooks, run after scenes: (ctx, t) => void

  // ---- rendering ----
  R.quality = 1;
  R.rs = 1; R.rw = W; R.rh = H;
  let cv, cx;
  R.setRenderSize = w => {
    w = Math.round(Math.max(320, Math.min(w, 3840)));
    const h = Math.round(w * H / W);
    // alpha: true keeps text antialiasing greyscale (an opaque canvas gets LCD subpixel text, which fringes through the lens)
    if (!cv) { cv = document.createElement('canvas'); cx = cv.getContext('2d'); R.canvas = cv; R.ctx = cx; }
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    R.rw = w; R.rh = h; R.rs = w / W;
  };

  R.draw = t => {
    Object.assign(R.fx, FX0);
    R.fx.flashColor = [1, 1, 1];
    const ctx = cx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = R.bg;
    ctx.fillRect(0, 0, R.rw, R.rh);
    ctx.fillStyle = 'rgba(0,0,0,0.004)';
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(R.rs, 0, 0, R.rs, 0, 0);
    for (const s of R.scenes) {
      if (t < s.start || t >= s.end) continue;
      ctx.save();
      try { s.draw(ctx, t, t - s.start, R); }
      catch (e) { if (!s._err) { s._err = 1; console.error('scene ' + s.id, e); } }
      ctx.restore();
    }
    for (const f of R.onFrame) { ctx.save(); f(ctx, t); ctx.restore(); }
  };

  // ---- the lens: one WebGL2 pass ----
  const VS = `#version 300 es
in vec2 p; out vec2 v;
void main(){ v = p * .5 + .5; v.y = 1. - v.y; gl_Position = vec4(p, 0, 1); }`;
  const FS = `#version 300 es
precision highp float;
uniform sampler2D T; uniform vec2 res; uniform float time, aspect;
uniform float zoom, rot, chroma, chromaAng, distort, bloom, thresh, flash, expo, sat, con, grain, vign, scan;
uniform vec2 shake; uniform vec3 flashCol;
in vec2 v; out vec4 o;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 lens(vec2 uv){
  vec2 p = (uv - .5) * vec2(aspect, 1.);
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p / zoom;
  p *= 1. + distort * dot(p, p);
  return p / vec2(aspect, 1.) + .5 + shake;
}
void main(){
  vec2 uv = lens(v);
  vec2 d = vec2(cos(chromaAng), sin(chromaAng)) * chroma + (uv - .5) * chroma * .6;
  vec3 col = vec3(texture(T, uv + d).r, texture(T, uv).g, texture(T, uv - d).b);
  vec3 b = textureLod(T, uv, 3.).rgb * .25 + textureLod(T, uv, 4.5).rgb * .35 + textureLod(T, uv, 6.).rgb * .4;
  float bl = dot(b, vec3(.2126, .7152, .0722));
  b *= max(bl - thresh, 0.) / max(bl * (1. - thresh), .001);   // threshold on luminance, so saturated red does not bloom
  col += b * bloom;
  col *= expo;
  col = (col - .5) * con + .5;
  float l = dot(col, vec3(.2126, .7152, .0722));
  col = mix(vec3(l), col, sat);
  if (scan > 0.) col *= 1. - scan * (.5 + .5 * sin(v.y * res.y * 3.14159));
  vec2 q = (v - .5) * vec2(aspect, 1.);
  col = min(col, vec3(1.));
  col *= mix(1., smoothstep(1.25, .35, length(q)), vign);
  col += (hash(v * res + fract(time * 7.31) * 517.) - .5) * grain;
  col = mix(col, flashCol, clamp(flash, 0., 1.));
  o = vec4(col, 1.);
}`;
  let gl, prog2, tex, U = {}, out2d;
  R.initOutput = (canvas, opts = {}) => {
    R.out = canvas;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (gl) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      try {
        prog2 = gl.createProgram();
        gl.attachShader(prog2, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog2, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog2);
        if (!gl.getProgramParameter(prog2, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog2));
        gl.useProgram(prog2);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog2, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        for (const n of ['T', 'res', 'time', 'aspect', 'zoom', 'rot', 'chroma', 'chromaAng', 'distort', 'bloom', 'thresh', 'flash', 'expo', 'sat', 'con', 'grain', 'vign', 'scan', 'shake', 'flashCol'])
          U[n] = gl.getUniformLocation(prog2, n);
      } catch (e) { console.warn('post pass off:', e); gl = null; }
    }
    if (!gl) out2d = canvas.getContext('2d', { alpha: false });
    R.gl = !!gl;
  };

  R.present = t => {
    const o = R.out, f = R.fx;
    if (!gl) {
      out2d.setTransform(1, 0, 0, 1, 0, 0);
      const s = f.zoom;
      out2d.fillStyle = R.bg;
      out2d.fillRect(0, 0, o.width, o.height);
      out2d.translate(o.width / 2 + f.shakeX * o.width / W, o.height / 2 + f.shakeY * o.height / H);
      out2d.rotate(f.rot);
      out2d.scale(s, s);
      out2d.drawImage(cv, -o.width / 2, -o.height / 2, o.width, o.height);
      if (f.flash > 0) { out2d.setTransform(1, 0, 0, 1, 0, 0); out2d.fillStyle = `rgba(${f.flashColor.map(c => c * 255 | 0)},${Math.min(1, f.flash)})`; out2d.fillRect(0, 0, o.width, o.height); }
      return;
    }
    gl.viewport(0, 0, o.width, o.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(U.T, 0);
    gl.uniform2f(U.res, o.width, o.height);
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.aspect, W / H);
    gl.uniform1f(U.zoom, f.zoom);
    gl.uniform1f(U.rot, f.rot);
    gl.uniform2f(U.shake, f.shakeX / W, f.shakeY / H);
    gl.uniform1f(U.chroma, f.chroma / W);
    gl.uniform1f(U.chromaAng, f.chromaAngle);
    gl.uniform1f(U.distort, f.distort);
    gl.uniform1f(U.bloom, f.bloom);
    gl.uniform1f(U.thresh, f.threshold);
    gl.uniform1f(U.flash, f.flash);
    gl.uniform3f(U.flashCol, ...f.flashColor);
    gl.uniform1f(U.expo, f.exposure);
    gl.uniform1f(U.sat, f.saturation);
    gl.uniform1f(U.con, f.contrast);
    gl.uniform1f(U.grain, f.grain);
    gl.uniform1f(U.vign, f.vignette);
    gl.uniform1f(U.scan, f.scan);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  R.renderAt = t => { R.t = t; R.draw(t); R.present(t); };

  // setup hooks run once after fonts are ready
  R.setup = () => { for (const s of R.scenes) if (s.setup) { try { s.setup(R); } catch (e) { console.error('setup ' + s.id, e); } } };
})();
