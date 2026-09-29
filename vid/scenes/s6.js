/* s6: Liquid. The camera whips down after the falling drop into ink; ALL OUT stands as empty vessels, windows
   onto one hidden tank. Three drops on the kicks fill it (25 / 50 / 80%), each re-exciting one sloshing surface;
   the surface dips over the T, a jet shoots up and flings the drop out, and the camera whips up after it. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', RED_DEEP = '#b8260c', ICE = '#eaf4fb';
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16;

  // ---- times (all on the grid) ----
  const T0 = R.at(6, 4, 2);                // 10.8984375 whip down starts, the drop is ours (H5)
  const T_LAND = R.at(6, 4, 3);            // 11.015625  whip lands, drop 1 hangs at 560
  const T_S1 = R.at(7, 1);                 // 11.25      splash 1
  const T_S2 = R.at(7, 1, 3);              // 11.484375  splash 2
  const T_S3 = R.at(7, 2);                 // 11.71875   splash 3
  const T_DIP = R.at(7, 2, 2);             // 11.8359375 surface dips over the T
  const T_JET = R.at(7, 2, 3);             // 11.953125  JET
  const T_PINCH = R.at(7, 2, 4);           // 12.0703125 pinch, whip up starts (H6)
  const T_END = R.at(7, 3);                // 12.1875
  const STEP = 0.234375;                   // level steps

  const w1 = t => E.whip(R.prog(t, T0, T_LAND));
  const w2 = t => E.whip(R.prog(t, T_PINCH, T_END));
  const worldY = t => t < T_LAND ? 1080 * (1 - w1(t)) : t >= T_PINCH ? 1080 * w2(t) : 0;

  // ---- layout (storyboard 3.6; checked against R.glyphs in the real font: origins within 0.04 px) ----
  const FS = 324.028, OX = 72.97, BASE = 760, CAP = 243.02, TOP = BASE - CAP;   // cap top 516.98
  const WORD = 'ALL OUT';
  const T_X = 1718.71;                     // T stem centre
  const SX0 = 60, SX1 = 1860, SDX = 4;     // surface samples (covers the A's and T's ink overhang past 72 / 1848)
  const SPR_Y = 488, SPR_H = 300;          // cached vessel sprites cover logical y 488 .. 788

  // ---- the tank ----
  const LEVELS = [0.25, 0.5, 0.8];
  // Drop 2 falls at x 710 (spec: 780) so it passes down the L2 stem window (668 .. 752) instead of vanishing behind
  // the facade for 3 frames between the cap top and the foot; its impact moves with it.
  // Drop 1 drifts from the H5 x 510 to 532 during its fall, so it clears the L1 stem edge (x 498) and lands centred
  // in the foot instead of straddling the stem outline; splash 1 moves with it.
  const X_D1 = 510, X_S1 = 532;
  const SPL = [[T_S1, X_S1], [T_S2, 710], [T_S3, 1352]];
  const LAM = [900, 420, 230], KW = LAM.map(l => R.TAU / l), OM = [7, 11, 16], A0 = [14, 8, 5];
  // travelling impulse (spec: 18 px, sigma 60, e^-4tau): stronger and slower to decay so the front still reads at the T
  const IMP_A = 24, IMP_SIG = 64, IMP_K = 2.4;
  // anything crossing a window edge (a drop coming in, the jet going out) is drawn on top of the 4 px outline band
  const EDGE_PAD = 2.5;
  const PH = (() => { const r = R.rng(63); return SPL.map(() => [r() * R.TAU, r() * R.TAU, r() * R.TAU]); })();

  function fillAt(t) {
    let f = 0, prev = 0;
    for (let b = 0; b < 3; b++) {
      f += (LEVELS[b] - prev) * E.outExpo(R.prog(t, SPL[b][0], SPL[b][0] + STEP));
      prev = LEVELS[b];
    }
    return f;
  }
  // the dip over the T: anticipation, then the cavity collapses into the mound that feeds the jet, then relaxes
  const dipAmt = t => t < T_DIP ? 0 : R.keys(t, [[T_DIP, 0], [T_JET, 1, 'inOutCubic'], [T_JET + S32, 0.15, 'outCubic'],
    [T_PINCH, -0.3, 'inOutSine'], [T_END, 0.1, 'inOutSine']]);

  // everything about the surface that depends only on t (per frame), then y(x) is cheap
  function surfState(t) {
    const terms = [];
    for (let b = 0; b < 3; b++) {
      const tau = t - SPL[b][0];
      if (tau < 0) continue;
      terms.push({ tau, ph: PH[b], env: (1 - Math.exp(-25 * tau)) * Math.exp(-3.5 * tau),
        ic: SPL[b][1] + 1800 * tau, ia: IMP_A * Math.exp(-IMP_K * tau) });
    }
    return { lv: BASE - CAP * fillAt(t), terms, dip: dipAmt(t) };
  }
  // y (down) of the surface at x, without the meniscus
  function surfAt(S, x) {
    let y = S.lv;
    for (const m of S.terms) {
      for (let i = 0; i < 3; i++) y -= A0[i] * m.env * Math.sin(KW[i] * x - OM[i] * m.tau + m.ph[i]);
      const g = (x - m.ic) / IMP_SIG;
      y -= m.ia * Math.exp(-g * g / 2);
    }
    if (S.dip) { const g = (x - T_X) / 120; y += 40 * S.dip * Math.exp(-g * g / 2); }
    return y;
  }

  // window edges for 64 levels from the cap top to the baseline (rasterised once in setup)
  const NROW = 64, ROW_DY = CAP / (NROW - 1);
  let ROWS = null;
  function meniscus(x, y) {
    if (!ROWS || y >= BASE) return 0;
    const j = R.clamp(Math.round((y - TOP) / ROW_DY), 0, NROW - 1), ed = ROWS[j];
    let d = 99;
    for (let i = 0; i < ed.length; i++) { const dd = Math.abs(x - ed[i]); if (dd < d) d = dd; }
    return d < 14 ? 5 * (1 - d / 14) * (1 - d / 14) : 0;
  }

  // ---- bubbles (seed 61), crowns (seed 62) ----
  let BUBBLES = [], CROWN = [];
  // [impact, count, y0, v up min, v up max, sideways, r min, r max, rim half-width]. Splash 1 is the 7.1 downbeat
  // (kick + sub): spec count and seed, but bigger and faster than the spec's r 4-8 / 300-700 so the crown clearly
  // leaves the window, spawned on a rim with outward velocity. Splashes 2 and 3 land in the open L2 and U stem
  // windows, so they get smaller crowns too.
  // crown gravity matches drop 1; up-speeds scaled by sqrt(6570 / 2600) so the apex heights are unchanged
  const CROWN_SPEC = [[0, 8, 722, 731, 1431, 250, 6, 11, 22], [1, 5, 700, 636, 1303, 110, 4, 7, 12], [2, 5, 640, 636, 1303, 110, 4, 7, 12]];
  const G = 6570, CROWN_SHRINK = 0.09;
  const crownPos = (c, tt) => { const tau = tt - c.t0; return [c.x0 + c.vx * tau, c.y0 - c.vy * tau + 0.5 * G * tau * tau, c.vx, -c.vy + G * tau]; };

  // ---- the drops ----
  const DROP1_R = 26, DROP2_R = 23, DROP3_R = 21, SPLAT_R = [DROP1_R, DROP2_R, DROP3_R];
  const G2 = 11500, SHUT = 1 / 60, D1_SMEAR = 64;
  const T_D2 = T_S2 - Math.sqrt(2 * (699.2 + 60) / G2);    // 11.1210: lands on the 25% level on 7.1&
  const T_D3 = T_S3 - Math.sqrt(2 * (638.5 + 60) / G2);    // 11.3702: lands on the 50% level on 7.2
  // where drop 1 enters the L1 window: the foot's top edge, measured from the raster in setup() (spec 676, real 685)
  let FOOT1 = 685;
  // drop 1: handed over by s5 in screen space, driven by the camera curve, then falls into the L1 foot.
  // Defined for any tt (before T0 it continues s5's fall), so the shutter can straddle the handover.
  function drop1Pos(tt) {
    if (tt < T_LAND) {
      const tau = tt - T0, w = w1(tt);
      return { x: X_D1, y: R.lerp(842 + 834 * tau, 560, w), k: R.lerp(1.25, 1, w) };
    }
    const tau = tt - T_LAND, v = 6570 * tau;
    const wob = 0.07 * Math.exp(-9 * tau) * Math.sin(30 * tau);      // loose liquid jiggle as the stretch releases
    const x = R.lerp(X_D1, X_S1, E.inOutSine(R.prog(tt, T_LAND, T_S1 - S32)));
    return { x, y: 560 + 0.5 * 6570 * tau * tau, k: Math.min(1.6, 1 + v / 4000) + wob };
  }
  const rainPos = (t0, x) => tt => { const tau = Math.max(0, tt - t0); return { x, y: -60 + 0.5 * G2 * tau * tau, k: Math.min(1.6, 1 + G2 * tau / 4000) }; };
  // the jet's tip drop (p over the jet window; past the pinch the same law continues, as s7's drop does)
  function tipPos(tt) {
    const p = Math.max(0, (tt - T_JET) / (T_PINCH - T_JET));
    return { x: T_X, y: 600 - 280 * p * p, k: 1 + 0.35 * Math.min(1, p), r: R.lerp(17, 26, E.outQuad(R.clamp(p / 0.55))) };
  }
  // [pos, alive from, alive to, radius, clip line (world y; the drop is in the window below it)]
  const DROPS = [
    [drop1Pos, T0, T_S1, DROP1_R, () => FOOT1 + EDGE_PAD],
    [rainPos(T_D2, SPL[1][1]), T_D2, T_S2, DROP2_R, () => TOP + EDGE_PAD],
    [rainPos(T_D3, SPL[2][1]), T_D3, T_S3, DROP3_R, () => TOP + EDGE_PAD],
    [tipPos, T_JET, T_PINCH, 0, () => TOP + EDGE_PAD],
  ];
  // 2 px ICE arc, upper left, 6 px inside the edge of an axis-aligned ellipse
  function specArc(c, x, y, rx, ry, a) {
    const A = rx - 6, Bq = ry - 6;
    if (A < 3 || Bq < 3 || a <= 0.003) return;
    c.beginPath();
    for (let i = 0; i <= 10; i++) {
      const s = R.lerp(3.52, 4.40, i / 10), dx = Math.cos(s), dy = Math.sin(s);
      const rho = 1 / Math.sqrt((dx / A) * (dx / A) + (dy / Bq) * (dy / Bq));
      i ? c.lineTo(x + dx * rho, y + dy * rho) : c.moveTo(x + dx * rho, y + dy * rho);
    }
    c.strokeStyle = R.rgba(ICE, a); c.lineWidth = 2; c.lineCap = 'round'; c.stroke();
  }

  // ---- the jet: one smooth outline (column and neck; the tip drop is DROPS[3]) ----
  function jetAt(t, S) {
    if (t < T_JET || t >= T_END) return null;
    const baseY = surfAt(S, T_X);
    const wob = s => 1.2 * Math.sin(11 * s - 47 * t) + 0.8 * Math.sin(23 * s + 71 * t + 1.3);
    const Lp = [], Rp = [];
    const column = (yB, yT, n) => {
      for (let i = 0; i <= n; i++) {
        const s = i / n, y = R.lerp(yB, yT, s);
        const fg = (y - baseY) / 16, fil = 16 * Math.exp(-fg * fg);          // fillet into the surface
        const hw = R.lerp(17, 12, s) + wob(s) + fil;
        Lp.push([T_X - hw, y]); Rp.push([T_X + hw, y]);
      }
    };
    if (t < T_PINCH) {
      // column and neck only: the tip drop itself is drawn motion-blurred with the other drops (DROPS[3]); the neck
      // runs on up into the drop's lower half so the two stay joined under the blur
      const p = R.prog(t, T_JET, T_PINCH);
      const tp = tipPos(t), tipY = tp.y, ry = tp.r * tp.k, rx = tp.r / Math.sqrt(tp.k);
      const pinch = R.smoothstep(0.25, 1, p);
      const neckY = tipY + ry + R.lerp(3, 13, pinch);
      const hwN = R.lerp(9, 0.4, pinch);
      const colTop = neckY + R.lerp(6, 16, pinch);
      const yB = Math.max(baseY + 40, colTop + 2);
      column(yB, colTop, 10);
      const hwIn = Math.min(rx * 0.55, R.lerp(12, 3, pinch));
      const pts = [...Lp, [T_X - hwN, neckY], [T_X - hwIn, tipY + ry * 0.35], [T_X + hwIn, tipY + ry * 0.35], [T_X + hwN, neckY]];
      for (let i = Rp.length - 1; i >= 0; i--) pts.push(Rp[i]);
      return { pts };
    }
    // after the pinch: the column falls back into the T (inQuad), its torn top rounding off
    const q = E.inQuad(R.prog(t, T_PINCH, T_END));
    const top0 = 320 + 26 * 1.35 + 13 + 16;
    const top = R.lerp(top0, baseY - 4, q);
    const yB = Math.max(baseY + 40, top + 2);
    column(yB, top, 10);
    const hwT = Lp.length ? (Rp.at(-1)[0] - Lp.at(-1)[0]) / 2 : 10;
    const pts = [...Lp];
    for (let i = 1; i < 6; i++) { const a = Math.PI + i / 6 * Math.PI; pts.push([T_X + hwT * Math.cos(a), top + hwT * 0.9 * Math.sin(a)]); }
    for (let i = Rp.length - 1; i >= 0; i--) pts.push(Rp[i]);
    return { pts };
  }

  // ---- cached vessel sprites (pure caches of a static render, rebuilt only when the render size changes) ----
  let SPR = null;
  function sprites() {
    if (SPR && SPR.rw === R.rw) return SPR;
    const mk = draw => {
      const c = document.createElement('canvas');
      c.width = R.rw; c.height = Math.ceil(SPR_H * R.rs) + 2;
      const x = c.getContext('2d');
      x.setTransform(R.rs, 0, 0, R.rs, 0, -SPR_Y * R.rs);
      R.font(x, FS, 'display', 900); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      draw(x);
      return c;
    };
    SPR = {
      rw: R.rw,
      fill: mk(x => { x.fillStyle = R.rgba(ICE, 0.06); x.fillText(WORD, OX, BASE); }),
      mask: mk(x => { x.fillStyle = '#fff'; x.fillText(WORD, OX, BASE); }),
      line: mk(x => { x.fillStyle = ICE; x.fillText(WORD, OX, BASE); x.strokeStyle = ICE; x.lineWidth = 4; x.lineJoin = 'miter'; x.miterLimit = 4; x.strokeText(WORD, OX, BASE); }),
    };
    // The variable font's glyphs are built from overlapping contours (the A's bar, the L's stem and foot, the T's
    // stem), so strokeText would draw those seams. The vessel outline is the union's boundary instead:
    // dilate (fill + 4 px stroke) minus erode (the mask intersected with itself shifted round a 2 px disc).
    const er = document.createElement('canvas'); er.width = SPR.mask.width; er.height = SPR.mask.height;
    const ex = er.getContext('2d');
    ex.drawImage(SPR.mask, 0, 0);
    ex.globalCompositeOperation = 'destination-in';
    const r2 = 2 * R.rs;
    for (const [rr, n] of [[r2, 24], [r2 * 0.5, 8]]) for (let i = 0; i < n; i++) {
      const a = i / n * R.TAU;
      ex.drawImage(SPR.mask, rr * Math.cos(a), rr * Math.sin(a));
    }
    const lx = SPR.line.getContext('2d');
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.globalCompositeOperation = 'destination-out';
    lx.drawImage(er, 0, 0);
    // the empty vessels in one bitmap (interior + outline), the source of the whip-in smear
    const both = document.createElement('canvas'); both.width = SPR.fill.width; both.height = SPR.fill.height;
    const bx = both.getContext('2d');
    bx.drawImage(SPR.fill, 0, 0); bx.drawImage(SPR.line, 0, 0);
    SPR.both = both;
    return SPR;
  }
  // draw a sprite at world offset wy (device-pixel snapped so the resting frame is 1:1 crisp); oy = extra device offset
  function drawSprite(c, img, wy, op = null, oy = 0) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (op) c.globalCompositeOperation = op;
    c.drawImage(img, 0, Math.round((SPR_Y + wy) * R.rs) + oy);
    c.restore();
  }

  // Vertical motion blur by recursive doubling: the average of a shape over every offset in [0, D] below where
  // it is drawn. The shape is drawn once into a scratch layer, then each pass averages the layer with itself
  // shifted by 2^j * s at 50% ('lighter'), so m passes give 2^m evenly spaced copies (s <= 1.25 device px):
  // a true box smear, not a comb, at 50% per pass so the colour stays true.
  // draw(c, oy): draws the unblurred shape into c (logical transform already set; oy = device y offset for any
  // identity-transform draws). [x0, x1] x [y0, y1]: logical bounds of the shape at offset 0. The result is drawn
  // onto dst in device space (dst's clip is honoured).
  function smearY(dst, draw, x0, x1, y0, y1, D) {
    const rs = R.rs, RH = R.rh;
    const X0 = R.clamp(Math.floor(x0 * rs) - 2, 0, R.rw), X1 = R.clamp(Math.ceil(x1 * rs) + 2, 0, R.rw), W = X1 - X0;
    const Y0 = Math.floor(y0 * rs) - 2, H = Math.ceil(y1 * rs) + 2 - Y0, Dd = D * rs;
    if (W <= 0) return;
    const cap = Math.min(RH, RH - Y0);                        // rows past the bottom of the frame are never seen
    if (cap <= 0) return;
    let A = R.layer('s6:pa');
    A.ctx.setTransform(rs, 0, 0, rs, 0, -Y0);
    draw(A.ctx, -Y0);
    let band = Math.min(H, cap);
    if (Dd >= 1.25 && R.quality >= 1) {
      let Bq = R.layer('s6:pb');
      const m = Math.min(10, Math.ceil(Math.log2(Dd / 1.25 + 1))), s = Dd / (2 ** m - 1);
      for (let j = 0; j < m; j++) {
        const sh = s * 2 ** j, c = Bq.ctx, nb = Math.min(cap, Math.ceil(band + sh) + 1);
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        c.clearRect(X0, 0, W, nb);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
        c.drawImage(A.canvas, X0, 0, W, band, X0, 0, W, band);
        c.drawImage(A.canvas, X0, 0, W, band, X0, sh, W, band);
        band = nb;
        [A, Bq] = [Bq, A];
      }
    }
    dst.save();
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.globalAlpha = 1; dst.globalCompositeOperation = 'source-over';
    dst.drawImage(A.canvas, X0, 0, W, band, X0, Y0, W, band);
    dst.restore();
  }

  // The drops alive at t, each smeared over a 1/60 s shutter (their stretch taken at t), with the specular arc
  // drawn once on top at the shutter centre. Two screen-space layers: drop 1 (clip at the L1 foot) and the rest
  // (rain and the jet tip, clip at the cap top); each is split at its clip line into window / out-of-window parts.
  function dropLayers(t) {
    const out = [];
    const groups = [[0], [1, 2, 3]];
    for (let g = 0; g < 2; g++) {
      let L = null, clip = 0;
      for (const i of groups[g]) {
        const [pos, ta, tb, r0, clipFn] = DROPS[i];
        if (t < ta || t >= tb) continue;
        if (!L) { L = R.layer(g ? 's6:dropsB' : 's6:dropsA'); clip = clipFn(); }
        const m = pos(t), r = r0 || m.r;
        // s5 hands drop 1 over crisp: its shutter opens over the whip's first two frames so the texture carries
        const sh = SHUT * (i === 0 ? R.smoothstep(T0, T0 + 2 / 60, t) : 1);
        // the eye tracks the protagonist through the whip-in: at the whip's peak (f657-f658, ~180 px per frame) a
        // 1/60 s smear is 110-140 px on a 65 px drop and thins it to a salmon ghost, so during the whip-in its
        // shutter is shortened to cap the smear at D1_SMEAR px (about its own height: a solid vermilion core, still
        // a streak against the world's 1/60 s whip smear). Elsewhere, and on every slower frame, it stays 1/60 s.
        const span = s => [pos(Math.max(ta, t - s / 2)), pos(Math.min(tb - 1e-4, t + s / 2))];
        let [a, b] = span(sh);
        if (i === 0 && t < T_LAND) {
          const D0 = Math.abs(b.y - a.y);
          if (D0 > D1_SMEAR) [a, b] = span(sh * D1_SMEAR / D0);
        }
        const ry = r * m.k, rx = r / Math.sqrt(m.k), ylo = Math.min(a.y, b.y), D = Math.abs(b.y - a.y);
        smearY(L.ctx, c => { c.beginPath(); c.ellipse(m.x, ylo, rx, ry, 0, 0, R.TAU); c.fillStyle = RED; c.fill(); },
          m.x - rx, m.x + rx, ylo - ry, ylo + ry, D);
        specArc(L.ctx, m.x, m.y, rx, ry, 0.6 * Math.min(1, 2 * ry / Math.max(D, 1e-6)));   // smears with the body
      }
      if (L) out.push({ L, clip });
    }
    return out;
  }
  // blit a horizontal band [y0, y1) (logical) of a layer, 1:1
  function blitBand(c, L, y0, y1, alpha = 1) {
    const a = R.clamp(Math.floor(y0 * R.rs), 0, R.rh), b = R.clamp(Math.ceil(y1 * R.rs), 0, R.rh);
    if (b <= a) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = alpha;
    c.drawImage(L.canvas, 0, a, R.rw, b - a, 0, a, R.rw, b - a);
    c.restore();
  }
  // the two halves of a drop split at a clip line must meet on a device-pixel row, or both antialias into a seam
  const snapY = y => Math.round(y * R.rs) / R.rs;
  const clipBand = (c, y0, y1) => { c.beginPath(); c.rect(-10, y0, 1940, y1 - y0); c.clip(); };

  // ---- the world at time t, translated by wy ----
  // drops: the list from dropLayers(t) (screen space); only their parts below their clip line are drawn here
  function drawWorld(ctx, t, wy, S, drops) {
    const spr = sprites();
    drawSprite(ctx, spr.fill, wy);

    const hasLiquid = S.lv < BASE - 0.25;
    const jet = jetAt(t, S);
    const inWin = hasLiquid || jet || drops.length || (t >= T_S1 && t < T_S1 + S16);
    let surf = null;
    if (hasLiquid) {
      surf = [];
      for (let x = SX0; x <= SX1; x += SDX) { const y0 = surfAt(S, x); surf.push(x, y0 - meniscus(x, y0)); }
    }

    // 1. the liquid layer: body, bubbles, specular, in-window drops and jet; masked by the letters once
    if (inWin) {
      const L = R.layer('s6:liquid'), c = L.ctx;
      c.save();
      clipBand(c, SPR_Y + wy, SPR_Y + SPR_H + wy);
      c.save();
      c.translate(0, wy);
      // splats: on each hit frame the drop flattens into the surface (drop 1 onto the empty floor), so the
      // contact reads on the very frame of the kick while the level is still at the start of its outExpo
      for (let b = 0; b < 3; b++) {
        const tau = t - SPL[b][0];
        if (tau < 0 || tau >= S16) continue;
        const p = E.outQuad(tau / S16), r = SPLAT_R[b];
        const rx = r * R.lerp(1.5, 2.8, p), ry = r * R.lerp(0.6, 0.12, p);
        const y = b === 0 ? BASE - ry : surfAt(S, SPL[b][1]);
        c.beginPath(); c.ellipse(SPL[b][1], y, rx, ry, 0, 0, R.TAU); c.fillStyle = RED; c.fill();
      }
      // (drawn under the body: once the level rises past it, the gradient covers it seamlessly)
      if (surf) {
        let top = 1e9;
        c.beginPath();
        c.moveTo(SX0, BASE + 40);
        for (let i = 0; i < surf.length; i += 2) { c.lineTo(surf[i], surf[i + 1]); if (surf[i + 1] < top) top = surf[i + 1]; }
        c.lineTo(SX1, BASE + 40);
        c.closePath();
        const gr = c.createLinearGradient(0, Math.min(S.lv, BASE - 30), 0, BASE);
        gr.addColorStop(0, RED); gr.addColorStop(1, RED_DEEP);
        c.fillStyle = gr; c.fill();
        // bubbles and the specular hairline live only inside the liquid
        c.globalCompositeOperation = 'source-atop';
        c.strokeStyle = R.rgba(ICE, 0.3); c.lineWidth = 1.5;
        c.beginPath();
        for (const b of BUBBLES) {
          const y = BASE - R.mod(b.v * t + b.o, CAP);
          if (y < top - 8) continue;
          const x = b.x + 3 * Math.sin(t * b.f + b.p);
          c.moveTo(x + b.r, y); c.arc(x, y, b.r, 0, R.TAU);
        }
        c.stroke();
        c.beginPath();
        for (let i = 0; i < surf.length; i += 2) i ? c.lineTo(surf[i], surf[i + 1] + 6) : c.moveTo(surf[i], surf[i + 1] + 6);
        c.strokeStyle = R.rgba(ICE, 0.6); c.lineWidth = 2; c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
      if (jet) {
        // only the part above the surface: below it the column is the tank itself (no seam against the gradient)
        c.save(); clipBand(c, -2000, surfAt(S, T_X) + 5);
        c.fillStyle = RED; R.traceSmooth(c, jet.pts, true); c.fill();
        c.restore();
      }
      c.restore();
      // drops below their clip line (screen space)
      for (const d of drops) { const y = snapY(d.clip + wy); c.save(); clipBand(c, y, 2000); blitBand(c, d.L, y, 1080); c.restore(); }
      // the letters are the windows
      drawSprite(c, spr.mask, wy, 'destination-in');
      c.restore();
      blitBand(ctx, L, SPR_Y + wy, SPR_Y + SPR_H + wy);
    }

    // 2. vessel outlines
    drawSprite(ctx, spr.line, wy);

    // 3. out of the windows: crown droplets and the jet above the cap top (over the outline band it crosses)
    ctx.save();
    ctx.translate(0, wy);
    ctx.fillStyle = RED;
    for (const cd of CROWN) {
      if (t < cd.t0 || t >= cd.tDie) continue;
      const [x, y, vx, vy] = crownPos(cd, t);
      const v = Math.hypot(vx, vy), k = Math.min(1.6, 1 + v / 4000), a = Math.atan2(vy, vx);
      const grow = E.outQuad(R.prog(t, cd.t0, cd.t0 + 0.04)) * (1 - E.inQuad(R.prog(t, cd.tDie - CROWN_SHRINK, cd.tDie)));
      if (grow <= 0.02) continue;
      ctx.beginPath(); ctx.ellipse(x, y, cd.r * k * grow, cd.r / Math.sqrt(k) * grow, a, 0, R.TAU); ctx.fill();
    }
    if (jet) {
      ctx.save();
      clipBand(ctx, -2000, snapY(TOP + EDGE_PAD));
      ctx.fillStyle = RED; R.traceSmooth(ctx, jet.pts, true); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // drops above their clip line: screen space, on top of everything
  function drawDropsOut(ctx, drops, wy) {
    for (const d of drops) { const y = snapY(d.clip + wy); ctx.save(); clipBand(ctx, -2000, y); blitBand(ctx, d.L, 0, y); ctx.restore(); }
  }

  // Whip blur: the world (a cached bitmap here) smeared by recursive doubling over the camera's travel inside a
  // 1/60 s shutter. drawAt(c, y, oy) draws the world at offset y; [y0, y1] is its logical band at offset 0.
  function whipBlur(ctx, t, y0, y1, drawAt) {
    const a = worldY(t - SHUT / 2), b = worldY(t + SHUT / 2), lo = Math.min(a, b), D = Math.abs(b - a);
    if (D * R.rs < 1.25 || R.quality < 1) { drawAt(ctx, worldY(t), 0); return; }
    smearY(ctx, (c, oy) => drawAt(c, lo, oy), 0, 1920, y0 + lo, y1 + lo, D);
  }

  Reel.scene({
    id: 's6', name: 'Liquid',
    start: T0, end: T_END,
    layer: 2,
    setup(R) {
      // window edges per level: rasterise the word once at 1x
      const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 280;
      const x = cv.getContext('2d');
      R.font(x, FS, 'display', 900); x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
      x.fillText(WORD, OX, BASE - 500);
      const data = x.getImageData(0, 0, 1920, 280).data;
      const spansAt = y => {
        const yy = Math.round(y) - 500, out = [];
        let on = false, a = 0;
        for (let X = 0; X < 1920; X++) {
          const v = data[(yy * 1920 + X) * 4 + 3] > 127;
          if (v && !on) { a = X; on = true; } else if (!v && on) { out.push([a, X]); on = false; }
        }
        return out;
      };
      // the L1 foot's top edge under drop 1 (flat there): the first ink row below the cap top in its column
      const inkAt = (X, y) => data[((Math.round(y) - 500) * 1920 + X) * 4 + 3] > 127;
      for (let y = Math.ceil(TOP) + 4; y < BASE; y++) if (inkAt(X_S1, y)) { FOOT1 = y; break; }
      ROWS = [];
      for (let j = 0; j < NROW; j++) {
        const sp = spansAt(Math.min(BASE - 1, TOP + 1 + j * ROW_DY));
        ROWS.push(sp.flat());
      }
      // bubbles: 40, inside the lower windows
      const lowSp = spansAt(724).filter(s => s[1] - s[0] > 30);
      const tot = lowSp.reduce((a, s) => a + s[1] - s[0] - 16, 0);
      const rb = R.rng(61);
      BUBBLES = Array.from({ length: 40 }, () => {
        let u = rb() * tot, x = lowSp[0][0] + 8;
        for (const s of lowSp) { const w = s[1] - s[0] - 16; if (u < w) { x = s[0] + 8 + u; break; } u -= w; }
        return { x, r: 3 + 4 * rb(), v: 60 + 80 * rb(), o: rb() * CAP, f: 5 + 4 * rb(), p: rb() * R.TAU };
      });
      // crown droplets: ballistic, culled the first time they fall back under the (analytic) surface
      const rc = R.rng(62);
      CROWN = [];
      for (const [b, n, y0, v0a, v0b, side, ra, rb2, rim] of CROWN_SPEC) {
        const [t0, xb] = SPL[b];
        for (let i = 0; i < n; i++) {
          const s = (i + 0.5) / n * 2 - 1;                                 // spread evenly, jittered
          const vx = side * R.clamp(s + (rc() - 0.5) * 0.35, -1, 1);
          const vy = R.lerp(v0a, v0b, rc()), r = R.lerp(ra, rb2, rc());
          // on the rim of the crater, the side matching its outward velocity (the faster up, the nearer the centre)
          const cd = { t0, x0: xb + Math.sign(vx || 1) * rim * (0.55 + 0.45 * Math.abs(s)), y0, vx, vy, r, tDie: T_END };
          const tApex = t0 + vy / G;
          for (let tt = tApex; tt < T_END; tt += 1 / 480) {
            const [px, py] = crownPos(cd, tt);
            if (py > surfAt(surfState(tt), px) - 2 || py > BASE) { cd.tDie = tt; break; }
          }
          CROWN.push(cd);
        }
      }
    },
    draw(ctx, t, lt, R) {
      // ---- post-FX (s6 owns 10.8984375 -> 12.0703125) ----
      if (t < T_PINCH) {
        const fx = R.fx;
        // Full ink baseline (1.8), set explicitly every frame so nothing is inherited from s5. During the whip-in
        // it is reached with the camera: w1 is also the share of the frame that is already ink, so the still ice
        // frame on the first whip frames keeps s5's ice values (bloom 0, vignette 0.12, grain 0.03) instead of
        // blowing out to white with grey corners before anything has moved. Bloom waits until the ice has almost
        // left the frame (the last whip frames): on the smeared ice band it clips the tint to neutral white.
        const wi = t < T_LAND ? w1(t) : 1;
        fx.bloom = 0.15 * R.smoothstep(0.8, 1, wi); fx.threshold = 0.8; fx.vignette = R.lerp(0.12, 0.35, wi); fx.grain = R.lerp(0.03, 0.045, wi);
        if (t < T_LAND) { fx.chroma = 12 * Math.sin(Math.PI * wi); fx.chromaAngle = Math.PI / 2; }
        for (const [tb] of SPL) R.impact(t, tb, { amount: 5, decay: 16 });
      }

      const wy = worldY(t);
      const S = surfState(t);
      const drops = dropLayers(t);

      if (t < T_LAND) {
        // whip in: the empty vessels, smeared along the whip
        const spr = sprites();
        whipBlur(ctx, t, SPR_Y, SPR_Y + SPR_H, (c, y, oy) => drawSprite(c, spr.both, y, null, oy));
      } else if (t >= T_PINCH) {
        // whip up: render the world once, then smear its band along the whip
        const Wl = R.layer('s6:world');
        drawWorld(Wl.ctx, t, 0, S, []);
        const a = Math.floor(280 * R.rs), h = Math.ceil(520 * R.rs);
        whipBlur(ctx, t, 280, 800, (c, y, oy) => {
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
          c.drawImage(Wl.canvas, 0, a, R.rw, h, 0, a + Math.round(y * R.rs) + oy, R.rw, h);
          c.restore();
        });
      } else {
        drawWorld(ctx, t, wy, S, drops);
      }
      drawDropsOut(ctx, drops, wy);
    },
  });
})();
