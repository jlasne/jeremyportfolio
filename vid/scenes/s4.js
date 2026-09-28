/* s4: Data. 2,800 streaks land in a 12-column dot-matrix chart and hold dead still; a mono counter rolls to
   2,800; the chart pumps on the kicks; the columns collapse into one vermilion line with lime vertex rings and
   a blue area; the line curls (one continuous mapping, no cut) into a polar ring that spins a quarter turn and
   collapses into the 48 px dot while an ice iris opens. Every frame is a pure function of t. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', LIME = '#d7ff3a', ICE = '#eaf4fb', BLUE = '#5fa8d3';
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16, S128 = B / 32;
  const TAU = Math.PI * 2, FR = 1 / 60;

  // ---- times (all on the grid) ----
  const T0 = R.at(5, 1);                 // 7.5        drop (s3 streaks in above until 5.1e)
  const T_DOTS = R.at(5, 1, 2);          // 7.6171875  H3: s4 draws the dots
  const T_LVL = R.at(5, 1, 3);           // 7.734375   level starts moving
  const T_BLEND = R.at(5, 1, 4);         // 7.8515625  level fully live
  const KICKS = [R.at(5, 1), R.at(5, 2), R.at(5, 3)];
  const T_CNT = R.at(5, 2);              // 7.96875    counter lands on 2,800; column labels
  const T_LINE = R.at(5, 3);             // 8.4375     freeze, collapse, line
  const T_3E = R.at(5, 3, 2);            // 8.5546875  rings, area
  const T_LINE_END = T_LINE + 3 * S32;   // 8.61328125
  const T_AREA_END = R.at(5, 3, 4);      // 8.7890625
  const T_WIND = T_AREA_END;             // 8.7890625  curl anticipation (crouch) starts
  const T_CURL = R.at(5, 4);             // 8.90625
  const T_SPIN = R.at(5, 4, 3);          // 9.140625
  const T_IRIS = R.at(5, 4, 4);          // 9.2578125
  const T_IRIS_END = 562 / 60;           // 9.366667 (frame rule: the last s4 frame is the end state)
  const T_END = R.at(6, 1);              // 9.375

  // ---- layout ----
  const ROWS = [20, 20, 26, 22, 28, 24, 27, 33, 30, 36, 40, 44];
  const XC = ROWS.map((_, i) => 135 + 150 * i);
  const BASE = 932, W = 1776, RB1 = W / TAU;          // ring base radius at s = 1: 282.66
  const slotX = (c, j) => XC[c] - 49 + 14 * j;         // c 0-based here
  const slotY = r => 923 - 14 * r;
  const CNT_X = 72, CNT_Y = 250, CNT_CLIP = 285;
  const LAB_X = 76, LAB_Y = 312, LAB_CLIP = 330;
  const LABEL = 'points. 0 misses.';
  let LAB_W = 330;                                      // measured in setup
  const COL_Y = 976, COL_CLIP = 990;

  // ---- the live level (audio-locked, closed form) ----
  const lastKick = t => t >= KICKS[2] ? KICKS[2] : t >= KICKS[1] ? KICKS[1] : KICKS[0];
  const envK = t => Math.exp(-(t - lastKick(t)) / 0.14);
  const envH = t => Math.exp(-(t - (T0 + Math.floor((t - T0) / S16 + 1e-9) * S16)) / 0.05);
  const blendOf = t => E.outCubic(R.prog(t, T_LVL, T_BLEND));
  function levelRaw(t, c) {     // c 0-based
    const f = c / 11;
    return R.clamp(0.75 + 0.25 * envK(t) * (1 - 0.5 * f) + 0.06 * envH(t) * f + 0.02 * Math.sin(TAU * (1.7 * t + 0.37 * (c + 1))), 0.3, 1);
  }
  const LF = ROWS.map((_, c) => levelRaw(T_LINE, c));   // frozen at 5.3 (a kick, blend 1)
  const level = (t, c) => t >= T_LINE ? LF[c] : R.lerp(1, levelRaw(t, c), blendOf(t));
  const nLit = (L, rows) => Math.max(1, Math.ceil(L * rows - 1e-9));
  const NLF = ROWS.map((n, c) => nLit(LF[c], n));
  const VH = NLF.map(n => BASE - slotY(n - 1));         // vertex heights above the baseline (unscaled)
  // the pump: the whole stack scales y about the baseline
  const pump = t => 1 + 0.035 * envK(t) * blendOf(t) * (1 - E.outCubic(R.prog(t, T_LINE, T_3E)));
  const colStart = c => T_LINE + c * S128;               // collapse of column c
  const colP = (t, c) => R.prog(t, colStart(c), colStart(c) + S16);

  // ---- the line: a smooth interpolating spline through (72, 932), V_1..V_12, (1848, 932), sampled densely in
  // flat (x, h) space. Monotone cubic Hermite (Steffen) instead of uniform Catmull-Rom: the uneven spacing
  // (63 px end segments vs 150 px) made Catmull-Rom overshoot 20-40 px above V_1/V_2 and past V_12, so the
  // line visibly missed its own vertex rings. Steffen passes through every vertex with no overshoot.
  const CP = [[72, 0], ...XC.map((x, c) => [x, VH[c]]), [1848, 0]];
  const LX = [], LH = [], LC = [];
  {
    const n = CP.length, dx = [], dd = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { dx.push(CP[i + 1][0] - CP[i][0]); dd.push((CP[i + 1][1] - CP[i][1]) / dx[i]); }
    const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;
    for (let i = 1; i < n - 1; i++) {
      const p = (dd[i - 1] * dx[i] + dd[i] * dx[i - 1]) / (dx[i - 1] + dx[i]);
      m[i] = (sgn(dd[i - 1]) + sgn(dd[i])) * Math.min(Math.abs(dd[i - 1]), Math.abs(dd[i]), 0.5 * Math.abs(p));
    }
    m[0] = dd[0]; m[n - 1] = dd[n - 2];
    for (let i = 0; i < n - 1; i++) {
      const [x0, h0] = CP[i], [, h1] = CP[i + 1], w = dx[i];
      const segs = Math.max(8, Math.ceil(Math.hypot(w, h1 - h0) / 5));
      for (let k = 0; k < segs; k++) {
        const u = k / segs, u2 = u * u, u3 = u2 * u;
        LX.push(x0 + w * u);
        LH.push((2 * u3 - 3 * u2 + 1) * h0 + (u3 - 2 * u2 + u) * w * m[i] + (-2 * u3 + 3 * u2) * h1 + (u3 - u2) * w * m[i + 1]);
      }
    }
    LX.push(1848); LH.push(0);
    let acc = 0;
    for (let i = 0; i < LX.length; i++) {
      if (i) acc += Math.hypot(LX[i] - LX[i - 1], LH[i] - LH[i - 1]);
      LC.push(acc);
    }
  }
  const LTOT = LC[LC.length - 1];
  // baseline samples, right to left (closes the area polygon), every ~12 px
  const BN = 148, BX = Array.from({ length: BN + 1 }, (_, i) => 1848 - 1776 * i / BN);

  // ---- the curl: (x, h) -> screen. s = 0 flat chart, s = 1 full ring of base radius 282.66 about (960, 540) ----
  const M = [0, 0, 0];
  function curl(x, h, s) {
    if (Math.abs(s) < 1e-3) { M[0] = x; M[1] = BASE - h; M[2] = 0; return M; }
    const Rb = W / (TAU * s), th = (x - 960) / Rb, ay = R.lerp(BASE, 540 - RB1, s);
    M[0] = 960 + (Rb + h) * Math.sin(th);
    M[1] = ay + Rb - (Rb + h) * Math.cos(th);
    M[2] = th;
    return M;
  }
  // Curl ease. The spec's inOutExpo put ~60% of the morph into two frames (a strobe smear); this curve
  // moves visibly on the kick frame (f535, s .024), peaks at .13 per frame and settles over ~8 frames.
  // Anticipation: over the 16th before the kick the chart crouches (s -> -ANT through the same mapping:
  // the centre dips ~17 px, the ends lift), then releases on 5.4 into the ring.
  const CURL_E = R.bezier(.35, .15, .4, 1), ANT = 0.025;
  const curlS = t => t < T_CURL ? -ANT * E.inOutCubic(R.prog(t, T_WIND, T_CURL))
    : R.lerp(-ANT, 1, CURL_E(R.prog(t, T_CURL, T_SPIN)));
  const spinA = t => (Math.PI / 2) * E.outBack(R.prog(t, T_SPIN, T_IRIS), 1.7);
  const irisP = t => R.prog(t, T_IRIS, T_IRIS_END);
  // the ring collapses into the dot: its inner circle closes from r 282.66 to the dot's radius 24 on the last
  // frame it is drawn (561); it is gone on 562, where only the 48 px dot on ice remains (H4)
  const shrink = t => t < T_IRIS ? 1 : R.lerp(1, 24 / RB1, E.inQuad(R.prog(t, T_IRIS, T_IRIS_END - FR)));
  const ringGone = t => t > T_IRIS_END - FR / 2;

  // ---- device-pixel helpers ----
  const snapPx = v => Math.round(v * R.rs) / R.rs;

  // ---- grid: hard lock-on at 22% -> 10%, centre-in retract on the curl (1.5, a = 8.90625, g = S128) ----
  const VPo = [[72, 1848], [198, 1722], [222, 1698], [348, 1572], [372, 1548], [498, 1422], [522, 1398], [648, 1272], [672, 1248], [798, 1122], [822, 1098], [948, 972]];
  const HPo = [[72, 1008], [208, 872], [232, 848], [368, 712], [392, 688], [528, 552]];
  const retract = (t, n) => 1 - E.inExpo(R.prog(t, T_CURL + n * S128, T_CURL + n * S128 + S16));
  function drawGrid(ctx, t) {
    const rs = R.rs, dw = Math.max(1, Math.round(1.5 * rs)), lw = dw / rs, off = dw % 2 ? 0.5 / rs : 0;
    const sn = v => Math.round(v * rs) / rs + off;
    ctx.beginPath();
    let any = false;
    VPo.forEach((pr, n) => {
      const f = retract(t, n); if (f <= 0.0005) return;
      for (const x of pr) { const X = sn(x); ctx.moveTo(X, 540 - 468 * f); ctx.lineTo(X, 540 + 468 * f); }
      any = true;
    });
    HPo.forEach((pr, n) => {
      const f = retract(t, n); if (f <= 0.0005) return;
      for (const y of pr) { const Y = sn(y); ctx.moveTo(960 - 888 * f, Y); ctx.lineTo(960 + 888 * f, Y); }
      any = true;
    });
    if (!any) return;
    const a = R.lerp(0.22, 0.10, E.outCubic(R.prog(t, T0, T_LVL)));
    ctx.strokeStyle = R.rgba(ICE, a); ctx.lineWidth = lw; ctx.lineCap = 'butt';
    ctx.stroke();
  }

  // ---- the dot matrix (7.6171875 until each column has collapsed) ----
  const DIM = R.rgba(ICE, 0.14);
  function drawMatrix(ctx, t) {
    if (t < T_DOTS || t >= colStart(11) + S16) return;
    const S = pump(t), Sp = pump(t - FR);
    const rs = R.rs;
    const lit = [], dim = [], red = [];
    for (let c = 0; c < 12; c++) {
      const p = colP(t, c);
      const rows = ROWS[c], nl = nLit(level(t, c), rows);
      if (p < 1) {
        const e = E.inQuad(p), ep = E.inQuad(colP(t - FR, c));
        for (let r = 0; r < rows; r++) {
          if (r === nl - 1) continue;
          const y0 = slotY(r), list = r < nl ? lit : dim;
          if (e <= 0) {
            const y = snapPx(BASE - (BASE - y0) * S - 4);
            for (let j = 0; j < 8; j++) list.push(slotX(c, j) - 4, y, 8, 8, 1);
          } else {
            // fall to the baseline and shrink to 0 (inQuad), drawn as a one-frame streak whose alpha keeps the
            // energy of one square (size / length), so a falling column reads as fast dots, not solid bars
            const y = R.lerp(BASE - (BASE - y0) * S, BASE, e), yp = R.lerp(BASE - (BASE - y0) * Sp, BASE, ep);
            const s = 8 * (1 - e);
            if (s < 0.05) continue;
            const top = Math.min(y, yp) - s / 2, h = Math.abs(y - yp) + s;
            const al = Math.min(1, 8 / h);
            for (let j = 0; j < 8; j++) list.push(slotX(c, j) - s / 2, top, s, h, al);
          }
        }
      }
      // the top lit row: RED, rides the level; on the collapse the eight squares slide into one at X_c
      if (p < 1) {
        const q = E.outCubic(p);
        const y = BASE - (BASE - slotY(nl - 1)) * S;
        for (let j = 0; j < 8; j++) {
          const x = R.lerp(slotX(c, j), XC[c], q);
          red.push(snapPx(x - 4), snapPx(y - 4), 8, 8, 1);
        }
      }
    }
    const fillAll = (arr, style) => {
      if (!arr.length) return;
      ctx.fillStyle = style;
      for (let i = 0; i < arr.length; i += 5) {
        if (arr[i + 4] !== ctx.globalAlpha) ctx.globalAlpha = arr[i + 4];
        ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);
      }
      ctx.globalAlpha = 1;
    };
    fillAll(dim, DIM);
    fillAll(lit, ICE);
    fillAll(red, RED);
  }

  const AREA = R.rgba(BLUE, 0.25), AREA_OPAQUE = R.mix(R.bg, BLUE, 0.25);
  // While a column is still collapsing, its standing lit dots are in front of the line and the area: clip both
  // out of the block of lit dots below the RED top square (it shrinks to the baseline as they fall), so the
  // line never cuts across a full column and is uncovered by the falling dots. Returns true after ctx.save().
  function blockClip(ctx, t) {
    const S = pump(t);
    let any = false;
    for (let c = 0; c < 12; c++) {
      const p = colP(t, c), nl = NLF[c];
      if (p >= 1 || nl < 2) continue;
      if (!any) { ctx.save(); ctx.beginPath(); ctx.rect(-100, -100, 2120, 1280); any = true; }
      const e = E.inQuad(p), y = R.lerp(BASE - (BASE - slotY(nl - 2)) * S, BASE, e) - 4 * (1 - e);
      ctx.rect(XC[c] - 53, y, 106, BASE + 6 - y);
    }
    if (any) ctx.clip('evenodd');
    return any;
  }

  // ---- the chart group: area, baseline rule, line, top dots, rings (all through the curl) ----
  const PX = new Float32Array(LX.length), PY = new Float32Array(LX.length);
  function drawGroup(ctx, t) {
    if (ringGone(t)) return;
    const s = curlS(t), k = R.lerp(1, 0.30, Math.max(0, s));
    ctx.save();
    const a = spinA(t), sc = shrink(t);
    // strokes keep their screen width while the ring collapses (down to a scale of .3), so it stays bold
    const wk = sc >= 1 ? 1 : Math.min(1 / sc, 1 / 0.3);
    if (a !== 0 || sc !== 1) {
      ctx.translate(960, 540); ctx.rotate(a); ctx.scale(sc, sc); ctx.translate(-960, -540);
    }
    const lineOn = t >= T_LINE;
    if (lineOn) for (let i = 0; i < LX.length; i++) { curl(LX[i], LH[i] * k, s); PX[i] = M[0]; PY[i] = M[1]; }

    // area: BLUE 25%, rises from the baseline
    const ea = E.outCubic(R.prog(t, T_3E, T_AREA_END));
    const clipped = lineOn && t < colStart(11) + S16 && blockClip(ctx, t);
    if (ea > 0) {
      ctx.beginPath();
      for (let i = 0; i < LX.length; i++) {
        curl(LX[i], LH[i] * k * ea, s);
        i ? ctx.lineTo(M[0], M[1]) : ctx.moveTo(M[0], M[1]);
      }
      for (let i = 0; i <= BN; i++) { curl(BX[i], 0, s); ctx.lineTo(M[0], M[1]); }
      ctx.closePath();
      // from the iris on, the same colour but opaque (identical over ink; the grid is gone by then), so the ring
      // stays a solid object while it contracts over the opening ice
      ctx.fillStyle = t >= T_IRIS ? AREA_OPAQUE : AREA;
      ctx.fill();
    }
    if (clipped) ctx.restore();

    // baseline rule: ICE 2 px, draws from x 960 outward on the drop, curls with the chart
    const bw = E.outExpo(R.prog(t, T0, T_DOTS - FR));
    if (bw > 0) {
      ctx.beginPath();
      if (s < 1e-3) {
        const y = BASE;
        ctx.moveTo(960 - 888 * bw, y); ctx.lineTo(960 + 888 * bw, y);
      } else {
        for (let i = 0; i <= BN; i++) { curl(BX[i], 0, s); i ? ctx.lineTo(M[0], M[1]) : ctx.moveTo(M[0], M[1]); }
        if (s > 0.999) ctx.closePath();
      }
      ctx.strokeStyle = ICE; ctx.lineWidth = 2 * wk; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      ctx.stroke();
    }

    if (!lineOn) { ctx.restore(); return; }

    // the line: RED 6 px, dash reveal inOutExpo
    const f = E.inOutExpo(R.prog(t, T_LINE, T_LINE_END));
    const clipL = f > 0 && t < colStart(11) + S16 && blockClip(ctx, t);
    if (f > 0) {
      const L = f * LTOT;
      ctx.beginPath();
      ctx.moveTo(PX[0], PY[0]);
      for (let i = 1; i < LX.length; i++) {
        if (LC[i] <= L) { ctx.lineTo(PX[i], PY[i]); continue; }
        const u = (L - LC[i - 1]) / (LC[i] - LC[i - 1]);
        ctx.lineTo(R.lerp(PX[i - 1], PX[i], u), R.lerp(PY[i - 1], PY[i], u));
        break;
      }
      if (f >= 1 && s > 0.999) ctx.closePath();
      ctx.strokeStyle = RED; ctx.lineWidth = 6 * wk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
    }
    if (clipL) ctx.restore();

    // top dots (after each column's collapse), mapped and turned with the curl
    ctx.fillStyle = RED;
    for (let c = 0; c < 12; c++) {
      if (colP(t, c) < 1) continue;
      curl(XC[c], VH[c] * k, s);
      ctx.save(); ctx.translate(M[0], M[1]); if (M[2]) ctx.rotate(M[2]);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // vertex rings: LIME r 10, 3 px, pop outBack(2)
    ctx.strokeStyle = LIME; ctx.lineWidth = 3 * wk;
    ctx.beginPath();
    let anyRing = false;
    for (let c = 0; c < 12; c++) {
      const a0 = T_3E + c * S128, rr = 10 * E.outBack(R.prog(t, a0, a0 + S16), 2);
      if (rr <= 0.2) continue;
      curl(XC[c], VH[c] * k, s);
      ctx.moveTo(M[0] + rr, M[1]); ctx.arc(M[0], M[1], rr, 0, TAU);
      anyRing = true;
    }
    if (anyRing) ctx.stroke();
    ctx.restore();
  }

  // Scene-local motion blur for the curl, the spin and the collapse. Each sample renders the whole opaque world
  // (ink, grid, iris disc, chart group) in painter's order, and the samples are combined as a running mean
  // (source-over at 1/(i+1)), so the colours are exact and the 8-bit error does not grow with n. At most 10
  // samples, shutter 1/120; the count follows the travel of the fastest point (~1 sample per 8 px).
  // the collapse uses half that shutter so the contracting red line stays solid rather than a radial haze
  const shutter = t => t >= T_IRIS ? 1 / 240 : 1 / 120;
  function blurSamples(t) {
    const SH = shutter(t), a = t - SH / 2, b = t + SH / 2;
    const px = Math.abs(curlS(b) - curlS(a)) * 1100 + Math.abs(spinA(b) - spinA(a)) * 470 + Math.abs(shrink(b) - shrink(a)) * 470;
    return Math.min(10, Math.ceil(px / 8));
  }
  function drawWorld(c, t, tf) {        // tf: the frame time; the iris disc stays sharp (drawn at tf)
    c.fillStyle = R.bg; c.fillRect(0, 0, 1920, 1080);
    drawGrid(c, t);
    drawDisc(c, tf);
    drawGroup(c, t);
  }
  function drawWorldBlurred(ctx, t, n) {
    const SH = shutter(t), A = R.layer('s4:mbA');
    drawWorld(A.ctx, t + SH / 2, t);
    for (let i = 1; i < n; i++) {
      const S = R.layer('s4:mbS');
      drawWorld(S.ctx, t + SH * (0.5 - i / (n - 1)), t);
      A.ctx.save();
      A.ctx.setTransform(1, 0, 0, 1, 0, 0);
      A.ctx.globalAlpha = 1 / (i + 1);
      A.ctx.drawImage(S.canvas, 0, 0);
      A.ctx.restore();
    }
    R.blit(ctx, A);
  }

  // ---- counter, label, column labels ----
  const fmt = v => Math.floor(v / 1000) + ',' + String(v % 1000).padStart(3, '0');
  function drawText(ctx, t) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // counter: 0,000 -> 2,800 (outExpo), exits by sinking 170 px behind a clip at y 285
    const ex = E.inExpo(R.prog(t, T_LINE, T_3E));
    if (ex < 1) {
      const v = Math.round(2800 * E.outExpo(R.prog(t, T0, T_CNT)));
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, 1920, CNT_CLIP); ctx.clip();
      R.font(ctx, 170, 'mono', 500); ctx.fillStyle = ICE;
      ctx.fillText(fmt(v), CNT_X, CNT_Y + 170 * ex);
      ctx.restore();
      // label: clip-wipe in left -> right, exits sinking 60 px behind a clip at y 330
      const w = E.outExpo(R.prog(t, T_DOTS, T_LVL));
      if (w > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, LAB_X - 4 + (LAB_W + 8) * w, LAB_CLIP); ctx.clip();
        R.font(ctx, 44, 'sans', 700); ctx.fillStyle = BLUE;
        ctx.fillText(LABEL, LAB_X, LAB_Y + 60 * ex);
        ctx.restore();
      }
    }
    // column labels 01..12: rise 12 px + fade in on 5.2 (128th stagger), sink 40 px behind y 990 on 5.4
    if (t >= T_CNT) {
      const out = E.inExpo(R.prog(t, T_CURL, T_CURL + S16));
      if (out < 1) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, 1920, COL_CLIP); ctx.clip();
        R.font(ctx, 28, 'mono', 500); ctx.textAlign = 'center';
        for (let c = 0; c < 12; c++) {
          const a0 = T_CNT + c * S128, p = E.outCubic(R.prog(t, a0, a0 + S16));
          if (p <= 0) continue;
          ctx.fillStyle = R.rgba(ICE, 0.4 * p);
          ctx.fillText(String(c + 1).padStart(2, '0'), XC[c], COL_Y + 12 * (1 - p) + 40 * out);
        }
        ctx.restore();
      }
    }
  }

  // ---- iris: the ICE disc opens UNDER the ring (so the ring visibly contracts over the ice), and the 48 px dot
  // is born from the ring as its inner circle closes (from f559, outBack(1.7), 48 on f562) ----
  const T_DOT = T_IRIS_END - 3 * FR;     // 9.316667
  const discR = t => t < T_IRIS ? 0 : 1150 * E.inExpo(irisP(t));
  function drawDisc(ctx, t) {
    const r = discR(t);
    if (r > 0.1) { ctx.fillStyle = ICE; ctx.beginPath(); ctx.arc(960, 540, r, 0, TAU); ctx.fill(); }
  }
  function drawDot(ctx, t) {
    if (t < T_DOT) return;
    const d = 48 * E.outBack(R.prog(t, T_DOT, T_IRIS_END), 1.7);
    if (d > 0.1) { ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(960, 540, d / 2, 0, TAU); ctx.fill(); }
  }

  // ---- post-FX (s4 owns 7.5 -> 9.375) ----
  function fx(t) {
    const f = R.fx, tau = t - T0;
    f.bloom = 0.15; f.threshold = 0.8; f.vignette = 0.35; f.grain = 0.045;
    // the drop's bloom, flash and chroma decay faster than the spec (tau .1 / 14 / e^-10t) so the precision hold
    // (7.6172 -> 7.7344) is still on screen, not only before post-FX: chroma .36 px, flash .02, bloom +.1 there
    f.bloom += 1.0 * Math.exp(-tau / 0.05);
    R.flash(t, T0, { amount: 0.30, decay: 22, color: ICE });
    R.impact(t, T0, { amount: 12, decay: 18 });
    f.chroma = 12 * Math.exp(-30 * tau);
    let z = 1 + 0.06 * (1 - E.outExpo(R.prog(t, T0, T0 + 3 * S32)));
    for (const kt of [KICKS[1], KICKS[2], T_CURL]) if (t >= kt) z += 0.012 * Math.exp(-12 * (t - kt));
    f.zoom = z;
    if (t >= T_IRIS) {
      // iris: chroma and bloom lift while the disc opens, then land on s5's ice baseline (bloom 0,
      // vignette .12, grain .03) and zero chroma on frame 562 so the hard cut to s5 (H4) is invisible
      // bloom goes to 0 once the disc is bigger than the ring hole, so the ice never blooms to white
      const p = irisP(t), k = E.inExpo(p);
      f.chroma += 3 * Math.sin(Math.PI * p); f.chromaAngle = 0;
      f.bloom = 0.3 * (1 - R.smoothstep(40, 120, discR(t)));
      f.vignette = R.lerp(0.35, 0.12, k);
      f.grain = R.lerp(0.045, 0.03, k);
    }
  }

  Reel.scene({
    id: 's4', name: 'Data', start: T0, end: T_END, layer: 1,
    setup(R) {
      const c = document.createElement('canvas').getContext('2d');
      R.font(c, 44, 'sans', 700);
      LAB_W = c.measureText(LABEL).width;
    },
    draw(ctx, t) {
      fx(t);
      const n = R.quality >= 1 && t > T_CURL - FR && t < T_IRIS_END ? blurSamples(t) : 1;
      if (n >= 3) drawWorldBlurred(ctx, t, n);
      else { drawGrid(ctx, t); drawMatrix(ctx, t); drawDisc(ctx, t); drawGroup(ctx, t); }
      drawText(ctx, t);
      drawDot(ctx, t);
    },
  });
})();
