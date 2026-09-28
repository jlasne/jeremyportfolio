/* s2: Timing. The dot hops through "timing is everything", dotting each i on the 8ths; the Curve Monitor
   pen-draws the exact ease each stem recovers on; the full stop flies to centre and stretches into s3's axle. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', LIME = '#d7ff3a', INK2 = '#0c1628', ICE = '#eaf4fb', BLUE = '#5fa8d3';
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16;

  // ---- times (all on the grid) ----
  const T0 = R.at(2, 4, 3);                 // 3.515625 handoff H1
  const T31 = R.at(3, 1);                   // 3.75 launch, s2 owns FX from here
  const TC = [R.at(3, 1, 3), R.at(3, 2), R.at(3, 2, 3), R.at(3, 3), R.at(3, 4)];   // i1 i2 i3 i4 period
  const WIN = [S16 * 2, S16 * 2, S16 * 2, 0.35, S16 * 2];                          // recovery windows
  const CW = 0.025;                         // contact half-window
  const T_SINK = R.at(3, 4, 3);             // 5.390625 reading hold ends
  const T_FLY = T_SINK + S64;               // 5.419921875 period leaves
  const T_AX = R.at(3, 4, 4);               // 5.5078125 lands at centre, stretches
  const T_AXE = 5.625 - 1 / 60;             // capsule end state on the last drawn frame
  const GRID_ON_E = 3.733333333333333;      // grid full on s1's last frame (224)
  const SHUT = 1 / 60;                      // motion-blur shutter

  // ---- layout ----
  const OX = 71.19, B2 = 740, FS = 134.525;
  const SENT = 'tımıng ıs everythıng';
  const STEM_H = 78.97;
  // The dotless stem's top is a V-notch, not a flat edge: shoulders 78.97 above B2, centre ~75.5 (measured
  // in setup). The ball sits IN the valley, its bottom 0.75 px into the stem, so no ink shows between them.
  let VALLEY = 75.5;
  const SINK_IN = 0.75;
  const DF = 34.53, D0 = 86.04, DP = 36.86;
  const PX = 1829.70, PY = 723.18;
  let XI = [180.16, 394.59, 696.20, 1561.33];   // stem centres (re-measured in setup)
  let TD = [0, 0, 0, 0];                         // tittle appear times (setup: once the ball has cleared it)
  let GL = [];                                   // glyphs: { ch, x, w, cx, word, stem }
  const STEM_IDX = [1, 3, 7, 17];

  // words: rise 3.75 + n*S64, sink right to left from 5.390625
  const RISE = [T31, T31 + S64, T31 + 2 * S64], RISE_D = S16 * 1.75;
  const SINK = [T_SINK + 2 * S64, T_SINK + S64, T_SINK];
  const wordOff = (w, t) => 170 * (1 - E.outExpo(R.prog(t, RISE[w], RISE[w] + RISE_D)))
    + 170 * E.inExpo(R.prog(t, SINK[w], SINK[w] + S16));

  // ---- the five recovery curves (same function drives the stem and the monitor) ----
  const swift = E.swift;
  const F = [
    x => R.spring(x * WIN[0], 900, 18),
    x => E.outBack(x, 2.2),
    x => E.outElastic(x, 1, 0.35),
    x => E.outExpo(x),
    x => swift(x),
  ];
  const LABELS = ['spring(.30)', 'outBack(2.2)', 'outElastic(1,.35)', 'outExpo', 'cubic-bezier(.22,1,.36,1)'];
  const LX = [...XI, PX];

  // follow-through wave from every landing through the other glyphs
  const wave = (cx, own, t) => {
    let y = 0;
    for (let L = 0; L < 5; L++) {
      if (L === own) continue;
      const d = Math.abs(cx - LX[L]);
      if (d > 900) continue;
      const tp = t - TC[L] - d / 1800;
      if (tp <= 0) continue;
      y += 6 * Math.exp(-d / 140) * Math.exp(-10 * tp) * Math.sin(26 * tp);
    }
    return y;
  };

  // stem k vertical scale about the baseline
  const stemScale = (k, t) => {
    const tc = TC[k];
    if (t < tc - CW) return 1;
    if (t < tc) return 1 - 0.2 * E.outQuad(1 - (tc - t) / CW);
    if (k === 0) return 0.8 + 0.2 * R.spring(t - tc, 900, 18);
    return 0.8 + 0.2 * F[k](R.prog(t, tc, tc + WIN[k]));
  };
  const STEM_WORD = [0, 0, 1, 2];
  const stemYOff = (k, t) => wordOff(STEM_WORD[k], t) + wave(XI[k], k, t);
  const stemTop = (k, t) => B2 + stemYOff(k, t) - STEM_H * stemScale(k, t);
  const pinned = (k, t) => [XI[k], B2 + stemYOff(k, t) - VALLEY * stemScale(k, t) - (DF / 2 - SINK_IN)];

  // ---- the parabola from 1.7 ----
  function hop(t, t0, t1, x0, y0, x1, y1, h) {
    const T = t1 - t0, u = R.clamp((t - t0) / T);
    return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - 4 * h * u * (1 - u),
      vx: (x1 - x0) / T, vy: ((y1 - y0) - 4 * h * (1 - 2 * u)) / T, u };
  }
  const HOP_H = [170, 110, 150, 230, 360];

  // ---- the ball: a closed-form state for any t ----
  function ball(t) {
    const s = { x: 960, y: 540, d: D0, vx: 0, vy: 0, sx: 1, sy: 1, ab: true, k: 1, cap: false, kMax: 1.6 };
    if (t < T31) {                                       // handoff ring + launch anticipation
      const tau = t - T0, q = tau < 0 ? 0 : 1 - R.spring(tau, 500, 16);
      const a = T31 - S32, wgt = 1 - R.prog(t, a, T31);
      const sa = E.outQuad(R.prog(t, a, T31));
      s.sx = (1 + 0.25 * q * wgt) * (1 + 0.15 * sa);
      s.sy = (1 - 0.2 * q * wgt) * (1 - 0.15 * sa);
      return s;
    }
    if (t >= T_AX) { s.x = 960; s.y = 540; s.d = 24; s.cap = true; return s; }
    if (t >= T_FLY) {                                    // the full stop flies to centre
      const H = hop(t, T_FLY, T_AX, PX, PY, 960, 540, 60);
      const r = 1 - E.outQuad(R.prog(t, T_FLY, T_FLY + S32));
      Object.assign(s, { x: H.x, y: H.y, vx: H.vx, vy: H.vy, d: R.lerp(DP, 24, E.inOutCubic(H.u)),
        sx: 1 + 0.2 * r, sy: 1 - 0.2 * r, k: 1 - r, kMax: 2.4 });   // ~10,000 px/s: a longer streak so blur samples overlap
      return s;
    }
    if (t >= TC[4] - CW) {                               // period: incoming contact, settle, anticipation
      s.x = PX; s.y = PY; s.d = DP;
      if (t < TC[4]) { const w = 1 - (TC[4] - t) / CW; s.sx = 1 + 0.45 * w; s.sy = 1 - 0.38 * w; }
      else if (t < T_SINK) { const g = 1 - swift(R.prog(t, TC[4], TC[4] + WIN[4])); s.sx = 1 + 0.45 * g; s.sy = 1 - 0.38 * g; }
      else { const a = E.outQuad(R.prog(t, T_SINK, T_FLY)); s.sx = 1 + 0.2 * a; s.sy = 1 - 0.2 * a; }
      return s;
    }
    for (let k = 0; k < 4; k++) {                        // stem contact windows
      if (t >= TC[k] - CW && t < TC[k] + CW) {
        const [x, y] = pinned(k, t), w = 1 - Math.abs(t - TC[k]) / CW;
        Object.assign(s, { x, y, d: DF, sx: 1 + 0.45 * w, sy: 1 - 0.38 * w });
        return s;
      }
    }
    // flights
    let k = 0;
    while (k < 4 && t >= TC[k] + CW) k++;                // flight k goes into landing k
    const fa = k === 0 ? T31 : TC[k - 1] + CW, fb = TC[k] - CW;
    const [x0, y0] = k === 0 ? [960, 540] : pinned(k - 1, fa);
    const [x1, y1] = k === 4 ? [PX, PY] : pinned(k, fb);
    const H = hop(t, fa, fb, x0, y0, x1, y1, HOP_H[k]);
    Object.assign(s, { x: H.x, y: H.y, vx: H.vx, vy: H.vy, d: DF, ab: false });
    if (k === 0) {
      const r = 1 - E.outQuad(R.prog(t, T31, T31 + S32));
      s.d = R.lerp(D0, DF, E.inOutCubic(H.u));
      s.sx = 1 + 0.15 * r; s.sy = 1 - 0.15 * r; s.ab = true; s.k = 1 - r;
    } else if (k === 4) s.d = R.lerp(DF, DP, E.inOutCubic(H.u));
    // ease the velocity stretch in over the first two frames off a stem (no one-frame pop)
    if (k > 0) s.k = E.outQuad(R.prog(t, fa, fa + 0.03));
    return s;
  }
  const ballX = tau => (tau < T31 || tau >= T_AX) ? 960 : ball(tau).x;
  // Camera follow. The spec's x_off = clamp(-0.05*(ballX(t-0.1)-960), +-44) pans linearly and stops dead,
  // because ballX is piecewise linear. Low-pass it in closed form instead: a 12-tap Hann window over
  // ballX(t - 0.05 - k/60), centred ~0.1 s behind the ball. Then the follow eases back to 0 while the full
  // stop settles, so the reading hold is centred on the grid and the flight home starts from x_off = 0.
  const HANN = (() => { const w = Array.from({ length: 12 }, (_, k) => Math.sin(Math.PI * (k + 0.5) / 12) ** 2);
    const s = w.reduce((a, b) => a + b, 0); return w.map(v => v / s); })();
  const followTarget = t => { let x = 0; for (let k = 0; k < 12; k++) x += HANN[k] * ballX(t - 0.05 - k / 60); return x; };
  const T_RC0 = TC[3], T_RC1 = T_SINK;       // recentre over the lob and the settle
  const xOff = t => {
    if (t < T31 + 0.05 || t >= T_RC1) return 0;
    return R.clamp(-0.05 * (followTarget(t) - 960), -44, 44) * (1 - E.inOutSine(R.prog(t, T_RC0, T_RC1)));
  };

  // DOT (1.7) with a stretch weight km (0..1) so launches do not pop
  function drawDot(ctx, x, y, d, vx, vy, sx = 1, sy = 1, color = RED, anchorBottom = false, kMax = 1.6, km = 1) {
    const v = Math.hypot(vx, vy), k = 1 + (Math.min(kMax, 1 + v / 4000) - 1) * km, a = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, anchorBottom ? y + d / 2 : y);
    ctx.scale(sx, sy);
    if (anchorBottom) ctx.translate(0, -d / 2);
    ctx.rotate(a); ctx.scale(k, 1 / Math.sqrt(k)); ctx.rotate(-a);
    ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, R.TAU); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }
  const drawBall = (c, t) => {
    const s = ball(t);
    if (s.cap) return;
    drawDot(c, s.x, s.y, s.d, s.vx, s.vy, s.sx, s.sy, RED, s.ab, s.kMax, s.k);
  };

  // Analytic motion trail: one tapered polygon through the ball's true (camera-followed) centres over the
  // trailing shutter [t - 1/60, t], filled with a RED ramp from 0 at the tail to 0.55 at the head. Continuous
  // (no sample beads), trails only (no pre-echo), one fill per frame.
  const STREAK_N = 12;
  function drawStreak(ctx, t, lo) {
    const P = [];
    for (let i = 0; i < STREAK_N; i++) {
      const tt = Math.max(lo, t - SHUT * (1 - i / (STREAK_N - 1))), b = ball(tt);
      const k = 1 + (Math.min(b.kMax, 1 + Math.hypot(b.vx, b.vy) / 4000) - 1) * b.k;
      P.push([b.x + xOff(tt), b.y, b.d / 2 / Math.sqrt(k) * Math.sqrt(b.sx * b.sy)]);
    }
    const [tx, ty] = P[0], [hx, hy] = P[STREAK_N - 1];
    if (Math.hypot(hx - tx, hy - ty) < 4) return;
    const Lf = [], Rt = [];
    for (let i = 0; i < STREAK_N; i++) {
      const a = P[Math.max(0, i - 1)], c = P[Math.min(STREAK_N - 1, i + 1)];
      let dx = c[0] - a[0], dy = c[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = P[i][2] * (0.3 + 0.7 * (i / (STREAK_N - 1)) ** 0.7);
      Lf.push([P[i][0] - dy * w, P[i][1] + dx * w]); Rt.push([P[i][0] + dy * w, P[i][1] - dx * w]);
    }
    const g = ctx.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, R.rgba(RED, 0)); g.addColorStop(0.6, R.rgba(RED, 0.22)); g.addColorStop(1, R.rgba(RED, 0.55));
    ctx.beginPath(); ctx.moveTo(Lf[0][0], Lf[0][1]);
    for (let i = 1; i < STREAK_N; i++) ctx.lineTo(Lf[i][0], Lf[i][1]);
    ctx.arc(hx, hy, P[STREAK_N - 1][2], Math.atan2(Lf.at(-1)[1] - hy, Lf.at(-1)[0] - hx), Math.atan2(Rt.at(-1)[1] - hy, Rt.at(-1)[0] - hx), true);
    for (let i = STREAK_N - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  }

  // ---- grid ----
  const GV = [72, 198, 222, 348, 372, 498, 522, 648, 672, 798, 822, 948, 972, 1098, 1122, 1248, 1272, 1398, 1422, 1548, 1572, 1698, 1722, 1848];
  const GH = [72, 208, 232, 368, 392, 528, 552, 688, 712, 848, 872, 1008];
  const snap = (v, lw) => { const rs = R.rs, dw = Math.round(lw * rs); return Math.round(v * rs) / rs + (dw % 2 ? 0.5 / rs : 0); };
  function drawGrid(ctx, t, xo) {
    const L = E.outExpo(R.prog(t, T0, GRID_ON_E)) * (1 - E.inExpo(R.prog(t, T_SINK, T_AX)));
    if (L <= 0) return;
    const lw = Math.max(1, Math.round(1.5 * R.rs)) / R.rs;
    ctx.beginPath();
    const hy = 468 * L, hx = 888 * L;
    for (const x of GV) { const X = snap(x + xo, lw); ctx.moveTo(X, 540 - hy); ctx.lineTo(X, 540 + hy); }
    for (const y of GH) { const Y = snap(y, lw); ctx.moveTo(960 + xo - hx, Y); ctx.lineTo(960 + xo + hx, Y); }
    ctx.lineWidth = lw; ctx.strokeStyle = R.rgba(ICE, 0.10); ctx.stroke();
  }

  // ---- sentence ----
  function drawSentence(ctx, t) {
    ctx.save();
    ctx.beginPath(); ctx.rect(-100, -100, 2200, 876); ctx.clip();    // words rise out of / sink under y 776
    R.font(ctx, FS, 'display', 900);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ICE;
    const wo = [wordOff(0, t), wordOff(1, t), wordOff(2, t)];
    for (const g of GL) {
      if (g.ch === ' ' || wo[g.word] >= 169.9) continue;
      const own = g.stem;                                // own landing index for stems, else -1
      const y = B2 + wo[g.word] + wave(g.cx, own, t);
      if (own < 0) { ctx.fillText(g.ch, OX + g.x, y); continue; }
      const sc = stemScale(own, t);
      ctx.save(); ctx.translate(OX + g.x, y); ctx.scale(1, sc); ctx.fillText('ı', 0, 0); ctx.restore();
      // ice tittle, left on departure
      const td = TD[own];                                // the ball has cleared the tittle (setup)
      if (t >= td) {
        // pure RED imprint for two frames, then to ICE fast (outCubic), so the mix never lingers as salmon
        const pc = E.outCubic(R.prog(t, td + 1 / 30, td + 1 / 30 + 0.05)), ps = E.outBack(R.prog(t, td, td + 0.22), 2);
        const s = R.lerp(1.25, 1, ps), tcx = g.w / 2, tcy = -98.61;
        ctx.save();
        ctx.translate(OX + g.x, y - STEM_H * (sc - 1));
        ctx.translate(tcx, tcy); ctx.scale(s, s); ctx.translate(-tcx, -tcy);
        ctx.beginPath(); ctx.rect(-20, -200, g.w + 40, 200 - 81); ctx.clip();
        ctx.fillStyle = pc >= 1 ? ICE : pc <= 0 ? RED : R.mix(RED, ICE, pc);
        ctx.fillText('i', 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ---- Curve Monitor (screen space) ----
  const MX0 = 72, MX1 = 648, MY0 = 72, MY1 = 368;
  const plotX = p => 96 + 528 * p, plotY = v => 344 - (v + 0.15) / 1.5 * 194;
  let CURVES = [];
  const LB = [MX0, 90, MX1 - MX0, 46];               // the label's odometer window (logical px)
  let LBL = null;
  function labelLayer() {                            // cleared each frame; resized only if the render size changes
    const rs = R.rs, w = Math.round(LB[2] * rs), h = Math.round(LB[3] * rs);
    if (!LBL || LBL.canvas.width !== w || LBL.canvas.height !== h) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      // willReadFrequently pins this small canvas to the CPU rasteriser: Chrome otherwise may move it between
      // GPU and CPU after a number of frames, and the glyph AA would differ with render history (impure frames)
      LBL = { canvas: cv, ctx: cv.getContext('2d', { willReadFrequently: true }) };
    }
    const c = LBL.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.setTransform(rs, 0, 0, rs, -LB[0] * rs, -LB[1] * rs);
    return LBL;
  }
  function tracePlot(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
  function drawMonitor(ctx, t) {
    if (t < T31 || t >= T_AX) return;
    const wipe = E.outExpo(R.prog(t, T31, T31 + S16));
    const col = 1 - E.inExpo(R.prog(t, T_SINK, T_AX));
    if (wipe <= 0 || col <= 0) return;
    const lw = Math.max(1, Math.round(1.5 * R.rs)) / R.rs;
    ctx.save();
    ctx.translate(0, 220); ctx.scale(1, col); ctx.translate(0, -220);
    ctx.beginPath(); ctx.rect(MX0 - 2, MY0 - 2, (MX1 - MX0 + 4) * wipe, MY1 - MY0 + 4); ctx.clip();
    // panel
    ctx.fillStyle = INK2; ctx.fillRect(MX0, MY0, MX1 - MX0, MY1 - MY0);
    ctx.lineWidth = lw; ctx.strokeStyle = R.rgba(ICE, 0.3);
    ctx.strokeRect(snap(MX0, lw), snap(MY0, lw), MX1 - MX0, MY1 - MY0);
    // axes
    ctx.beginPath(); ctx.moveTo(96, snap(plotY(0), lw)); ctx.lineTo(624, snap(plotY(0), lw)); ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(96, snap(plotY(1), lw)); ctx.lineTo(624, snap(plotY(1), lw)); ctx.stroke();
    ctx.setLineDash([]);
    // which curve
    let k = -1;
    for (let i = 0; i < 5; i++) if (t >= TC[i]) k = i;
    // label odometer, rendered on a transparent canvas (greyscale AA: the opaque main canvas would give the
    // 36 px mono LCD colour fringes), then placed 1:1 inside the monitor's transform and clip
    if (k >= 0) {
      const L = labelLayer(), c = L.ctx;
      R.font(c, 36, 'mono', 500); c.fillStyle = ICE; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      const e = E.outExpo(R.prog(t, TC[k], TC[k] + 0.08));
      if (e < 1 && k > 0) c.fillText(LABELS[k - 1], 96, 124 - 48 * e);
      c.fillText(LABELS[k], 96, 124 + 48 * (1 - e));
      ctx.drawImage(L.canvas, LB[0], LB[1], LB[2], LB[3]);
    }
    if (k >= 0) {
      // curve: the new one wipes in by pen, erasing the old one ahead of it
      const r = E.outCubic(R.prog(t, TC[k], TC[k] + S32)), hx = plotX(r);
      ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = BLUE;
      if (r < 1 && k > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(hx + 4, MY0, MX1 - hx - 4, MY1 - MY0); ctx.clip();
        ctx.globalAlpha = 0.3 * (1 - r); ctx.lineCap = 'butt';
        tracePlot(ctx, CURVES[k - 1]); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.beginPath(); ctx.rect(MX0, MY0, hx - MX0, MY1 - MY0); ctx.clip();
      tracePlot(ctx, CURVES[k]); ctx.stroke(); ctx.restore();
      if (r < 1) {                                       // the pen nib while it draws
        ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(hx, plotY(F[k](r)), 4.5, 0, R.TAU); ctx.fill();
      }
      // tracker: same function, same clock as the stem
      const p = R.prog(t, TC[k], TC[k] + WIN[k]), tx = plotX(p), ty = plotY(F[k](p));
      ctx.fillStyle = LIME;
      ctx.fillRect(snap(tx, lw) - lw / 2, 150, lw, 194);
      ctx.beginPath(); ctx.arc(tx, ty, 6, 0, R.TAU); ctx.fill();
    }
    ctx.restore();
  }

  Reel.scene({
    id: 's2', name: 'Timing',
    start: T0, end: 5.625,
    layer: 1,
    setup(R) {
      const c = document.createElement('canvas').getContext('2d');
      R.font(c, FS, 'display', 900);
      const g = R.glyphs(c, SENT, 0);
      let word = 0;
      GL = g.chars.map((ch, i) => {
        if (ch.ch === ' ') word++;
        const si = STEM_IDX.indexOf(i);
        return { ch: ch.ch, x: ch.x, w: ch.w, cx: OX + ch.x + ch.w / 2, word, stem: si };
      });
      XI = STEM_IDX.map(i => OX + g.chars[i].x + g.chars[i].w / 2);
      {                                                  // the notch: centre-column top of the stem, at 4x
        const S = 4, cv = document.createElement('canvas'); cv.width = 80 * S; cv.height = 120 * S;
        const x = cv.getContext('2d'); x.scale(S, S); R.font(x, FS, 'display', 900);
        x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; x.fillText('ı', 10, 100);
        const w = x.measureText('ı').width, col = Math.round((10 + w / 2) * S), d = x.getImageData(0, 0, cv.width, cv.height).data;
        let cov = 0; for (let y = 0; y < 100 * S; y++) cov += d[(y * cv.width + col) * 4 + 3] / 255;   // ink above B2
        if (cov > 60 * S && cov < STEM_H * S) VALLEY = cov / S;
      }
      for (let i = 0; i < 4; i++) LX[i] = XI[i];
      // Each tittle appears once the leaving ball no longer overlaps where it will sit (no one-frame double blob):
      // centre distance >= ball radius along its stretch + the 1.25x tittle's half-width. Scanned at 1 ms.
      for (let k = 0; k < 4; k++) {
        let tt = TC[k] + CW;
        for (; tt < TC[k] + CW + 0.06; tt += 0.001) {
          const b = ball(tt), sc = stemScale(k, tt), ty = B2 + stemYOff(k, tt) - 98.61 - STEM_H * (sc - 1);
          const kk = 1 + (Math.min(b.kMax, 1 + Math.hypot(b.vx, b.vy) / 4000) - 1) * b.k;
          if (Math.hypot(b.x - XI[k], b.y - ty) >= b.d / 2 * kk + 1.25 * 19.1) break;
        }
        TD[k] = tt;
      }
      labelLayer();                                  // allocate the blur layer up front (no first-use hitch)
      CURVES = F.map(f => Array.from({ length: 97 }, (_, i) => [plotX(i / 96), plotY(f(i / 96))]));
    },
    draw(ctx, t, lt, R) {
      // ---- post-FX (s2 owns from 3.75) ----
      if (t >= T31) {
        const fx = R.fx;
        fx.bloom = 0.15; fx.threshold = 0.8; fx.vignette = 0.35; fx.grain = 0.045;
        const wa = TC[2] + CW, wb = TC[3] - CW;
        if (t >= wa && t < wb) { fx.chroma = 3 * Math.sin(Math.PI * R.prog(t, wa, wb)); fx.chromaAngle = 0; }
        if (t >= TC[4]) fx.bloom += 0.3 * Math.exp(-8 * (t - TC[4]));
        if (t >= T_AX) { fx.chroma = 4; fx.chromaAngle = 0; }
      }
      const xo = xOff(t);
      drawGrid(ctx, t, xo);
      // the ball: motion-blurred on its three fast flights (launch, whip-hop, flight home)
      const FL = [[T31, TC[0] - CW], [TC[2] + CW, TC[3] - CW], [T_FLY, T_AX]];
      const fl = FL.find(([a, b]) => t >= a && t < b);
      const home = t >= T_FLY;                          // the full stop leaves from behind the g, not across it
      const paintBall = () => {
        if (!fl) { ctx.save(); ctx.translate(xo, 0); drawBall(ctx, t); ctx.restore(); return; }
        drawStreak(ctx, t, fl[0]);                     // continuous trailing streak over [t - 1/60, t]
        ctx.save(); ctx.translate(xo, 0); drawBall(ctx, t); ctx.restore();   // the head, solid
      };
      if (home) paintBall();
      ctx.save();
      ctx.translate(xo, 0);
      if (t >= T31 && t < SINK[0] + S16) drawSentence(ctx, t);
      ctx.restore();
      if (!home) paintBall();
      // the axle
      if (t >= T_AX) {
        const p = E.outQuart(R.prog(t, T_AX, T_AXE));   // outQuart: ~30% of the width on the first frame, not 46%
        const w = R.lerp(24, 1296, p), h = R.lerp(24, 8, p);
        ctx.fillStyle = RED;
        R.roundRect(ctx, 960 + xo - w / 2, 540 - h / 2, w, h, h / 2);
        ctx.fill();
      }
      drawMonitor(ctx, t);
    },
  });
})();
