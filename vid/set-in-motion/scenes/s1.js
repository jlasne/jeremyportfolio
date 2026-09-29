/* s1: Count-in + Type. A lime blink powers the reel on, the grid shoots out, 1 2 3 and the dot as the 4th beat;
   the modules collapse into the rule, MOTION slams onto it, splits around the title band, stretches onto the
   grid, falls away, and the camera dives through the O's counter into s2. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', LIME = '#d7ff3a', ICE = '#eaf4fb', INK = '#050b16';

  // ---- shared motion grammar (storyboard 1.7, copied exactly) ----
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16;

  // SLAM (s1 MOTION. contact 1.875, s7 CLAUDE. contact 12.1875). Anchor = the word's baseline centre.
  // Apply: translate(ax, ay + o.dy); scale(o.s * o.sx, o.s * o.sy); translate(-ax, -ay); globalAlpha *= o.a
  function slam(t, tc) {
    const A = S16;                                           // approach = one 16th, before the beat
    if (t < tc) {
      const p = R.ease.inQuart(R.prog(t, tc - A, tc));
      return { s: R.lerp(2.2, 1, p), dy: R.lerp(-120, 0, p), sx: 1, sy: 1, a: R.prog(t, tc - A, tc - A + 0.05) };
    }
    const q = 1 - R.spring(t - tc, 1024, 17.9);              // omega 32 rad/s, zeta 0.28: two visible wobbles
    return { s: 1, dy: 0, sx: 1 + 0.04 * q, sy: 1 - 0.18 * q, a: 1 };   // sx halved: keeps N and the dot apart
  }
  // the rule's follow-through after a slam: whole rule translates down by this (px)
  const ruleDip = tau => tau < 0 ? 0 : 14 * Math.exp(-9 * tau) * Math.sin(28 * tau);   // peaks ~9 px at 50 ms

  // HOP: a true parabola between two contact points (constant gravity inside the hop).
  function hop(t, t0, t1, x0, y0, x1, y1, h) {
    const T = t1 - t0, u = R.clamp((t - t0) / T);
    return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - 4 * h * u * (1 - u),
             vx: (x1 - x0) / T, vy: ((y1 - y0) - 4 * h * (1 - 2 * u)) / T };
  }

  // DOT: velocity stretch times an extra squash (sx, sy), anchored at its bottom when `anchorBottom`.
  function drawDot(ctx, x, y, d, vx, vy, sx = 1, sy = 1, color = RED, anchorBottom = false, kMax = 1.6) {
    const v = Math.hypot(vx, vy), k = Math.min(kMax, 1 + v / 4000), a = Math.atan2(vy, vx);   // s7 passes kMax 1.7
    ctx.save();
    ctx.translate(x, anchorBottom ? y + d / 2 : y);
    ctx.scale(sx, sy);
    if (anchorBottom) ctx.translate(0, -d / 2);
    ctx.rotate(a); ctx.scale(k, 1 / Math.sqrt(k)); ctx.rotate(-a);
    ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, R.TAU); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  // LANDING squash of the dot: q with spring(500, 14) (omega 22.4, zeta 0.31)
  const landQ = tau => tau < 0 ? 0 : 1 - R.spring(tau, 500, 14);   // sx = 1 + 0.45 q, sy = 1 - 0.40 q

  // ---- times (all on the grid) ----
  const T_FALL = R.at(1, 3, 2);            // 1.0546875 the dot falls
  const T_LAND = R.at(1, 4);               // 1.40625   1 2 3 .
  const T_EXIT = R.at(1, 4, 3);            // 1.640625  tableau hold ends
  const T_DANT = T_EXIT - S32;             // 1.58203125 dot anticipation
  const T_MANT = T_EXIT + S32;             // 1.69921875 modules anticipation ends
  const T_RULE = T_MANT + S16;             // 1.81640625 one rule
  const T_C = R.at(2, 1);                  // 1.875     CONTACT
  const T_REB = T_C + S64;                 // 1.904296875 rebound
  const T_REBL = R.at(2, 1, 3);            // 2.109375
  const T_SPLIT = R.at(2, 2);              // 2.34375
  const T_SPLITE = R.at(2, 2, 4);          // 2.6953125
  const T_PUSHE = T_SPLITE + S32;          // 2.75390625
  const T_STR = R.at(2, 3);                // 2.8125    STRETCH
  const T_NL = R.at(2, 3, 3);              // 3.046875  dot on the N, grid lock
  const T_DROP = R.at(2, 4);               // 3.28125
  const T_F1 = T_DROP + S64;               // 3.310546875 N T I fall, dot hangs
  const T_HANGE = R.at(2, 4, 2);           // 3.3984375 dot drops
  const T_H1 = R.at(2, 4, 3);              // 3.515625  handoff H1, dive
  const T_ZE = 224 / 60;                   // 3.7333 the last s1 frame, Z = 24
  const T_END = R.at(3, 1);                // 3.75

  // ---- layout ----
  const FS = 314.003, BASE = 688, CAP = 235.5;
  const CH = ['M', 'O', 'T', 'I', 'O', 'N'];
  let ORG = [53.16, 453.51, 759.98, 1015.89, 1134.59, 1441.05];      // glyph origins (re-measured in setup)
  let NAT = [253.3, 606.7, 891.9, 1075.2, 1287.8, 1597.3];           // advance centres (re-measured in setup)
  const SLOT = [210, 510, 810, 1110, 1410, 1710];
  const MID = 570.25;                                                 // mid cap height: the split line
  const DD = 86.04, DR = DD / 2, DOT_X = 1804.98, DOT_Y = 648.75;
  const DOT_XC = 960 + 844.98 * 1.04;     // 1838.78: the ride rule's x at contact (slam sx = 1.04 at q = 1), so the hop ends there
  const FLOOR = DOT_Y + DR;               // 691.77: the dot's bottom when resting on slot 4 / the period
  const LIME_R = 36;                      // power-on disc d 72 (spec d 44 is ~9 px on a phone; 7.2 asks for it to be seen)
  const FALL0 = [3.427734375, 0, T_F1, T_F1, T_DROP + 2 * S64, T_F1];  // own fall start (M, -, T, I, O2, N)
  const SIGN = [1, 0, -1, 1, -1, 1];
  // stretch stagger rank (M O T I O N): left-movers left-first, right-movers right-first, so no letter
  // ever runs into a neighbour that has not moved yet (the spec's pure left-to-right order drives O2 into N)
  const RANK = [0, 1, 2, 3, 5, 4];
  let RND = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const G_FALL = 2 * (DOT_Y + 60) / ((T_LAND - T_FALL) ** 2);        // ~11469 px/s^2: lands exactly on the beat
  // spec h 60 lands the dot while still rising and cuts it through the tall N; 260 clears the N stem through its
  // elastic overshoot (sy up to ~2.1) and lands downward on the stem top
  const HOP_N = 260;
  const TICKER = 'SET IN MOTION · ';
  let TICK_W = 614.4;
  const MOD_X = [210, 660, 1110];
  const RULE_T = [[72, 664], [664, 1256], [1256, 1848]];

  // O counter contour (setup): offsets from the counter centre at 314.003 px
  let INNER = null, OUTER = null;
  const CC_DY = -117.75;          // counter centre above the baseline; x = the O's advance centre
  let ready = false;

  const q10 = w => R.clamp(Math.round(w / 10) * 10, 250, 900);
  // inExpo renormalised so it starts at exactly 0 (E.inExpo(0+) = 2^-10 would make a one-frame step)
  const inExpoN = p => p <= 0 ? 0 : (E.inExpo(p) - 1 / 1024) / (1 - 1 / 1024);

  // N's right stem (the dot sits on it): centre offset from the glyph's advance centre and top above the baseline,
  // per 10-unit weight, measured in setup
  let NSTEM = null;

  // R.motionBlur, hardened. Chromium re-blits a stale snapshot of a layer that was cleared but never drawn to,
  // so the first sample always makes one real (invisible: 1 px, alpha 0.004) draw into the fresh layer.
  // Callers also skip the blur entirely when nothing would be drawn.
  function blur(ctx, t, fn, samples, shutter, name) {
    let poked = false;
    R.motionBlur(ctx, t, (c, tt) => {
      if (!poked && c !== ctx) {
        poked = true;
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(0,0,0,0.004)'; c.fillRect(0, 0, 1, 1); c.restore();
      }
      fn(c, tt);
    }, { samples, shutter, name });
  }

  // ---- the grid ----
  const VP = [[948, 972], [822, 1098], [798, 1122], [672, 1248], [648, 1272], [522, 1398], [498, 1422], [372, 1548], [348, 1572], [222, 1698], [198, 1722], [72, 1848]];
  const HP = [[528, 552], [392, 688], [368, 712], [232, 848], [208, 872], [72, 1008]];
  const GROW = 0.3515625, SETTLE = 0.234375, S256 = B / 64;
  const snapPos = (v, w) => { const rs = R.rs, dw = Math.max(1, Math.round(w * rs)); return [Math.round(v * rs) / rs + (dw % 2 ? 0.5 / rs : 0), dw / rs]; };

  function drawGrid(ctx, t) {
    if (t >= T_H1) return;
    const lock = t >= T_NL && t < T_NL + 3 / 60 ? 0.35 : 0.16;
    const line = (vertical, pos, n, t0, t1) => {
      const p = R.prog(t, t0, t0 + GROW);
      if (p <= 0) return;
      const half = vertical ? 468 : 888, ctr = vertical ? 540 : 960;
      // centre-in retract (1.5) before the dive, so nothing is left to pop on f211
      const L = half * E.outExpo(p) * (1 - inExpoN(R.prog(t, t1, t1 + S16)));
      if (L < 0.25) return;
      const s = E.outCubic(R.prog(t, t0 + GROW, t0 + GROW + SETTLE));
      const w = R.lerp(2.5, 1.5, s), a = R.lerp(0.5, lock, s);
      const [c, dw] = snapPos(pos, w);
      ctx.fillStyle = R.rgba(ICE, a);
      if (vertical) ctx.fillRect(c - dw / 2, ctr - L, dw, 2 * L);
      else ctx.fillRect(ctr - L, c - dw / 2, 2 * L, dw);
      const hl = Math.min(40 * (1 - s), L);
      if (hl > 0.5) {                                   // bright heads at both growing ends, shrinking into the line
        const hw = R.lerp(3, w, s);
        ctx.fillStyle = R.rgba(ICE, R.lerp(0.9, a, s));
        if (vertical) { ctx.fillRect(pos - hw / 2, ctr - L, hw, hl); ctx.fillRect(pos - hw / 2, ctr + L - hl, hw, hl); }
        else { ctx.fillRect(ctr - L, pos - hw / 2, hl, hw); ctx.fillRect(ctr + L - hl, pos - hw / 2, hl, hw); }
      }
    };
    // retract: pairs counted from the outside (m = 11 - n, 5 - n), pair m starts at T_DROP + m * S256, lasts S16;
    // the last vertical pair reaches length 0 at 3.4790 (gone on f209), the last horizontal at 3.4351
    for (let n = 0; n < VP.length; n++) for (const x of VP[n]) line(true, x, n, n * S64, T_DROP + (11 - n) * S256);
    for (let n = 0; n < HP.length; n++) for (const y of HP[n]) line(false, y, n, B + n * S64, T_DROP + (5 - n) * S256);
  }

  // ---- count-in modules, numerals, the rule ----
  // module k's rect during the modules -> rule interpolation
  function moduleRect(k, t) {
    const ant = E.outQuad(R.prog(t, T_EXIT, T_MANT));
    const w0 = 276 * R.lerp(1, 0.95, ant), h0 = 296 * R.lerp(1, 1.08, ant), cx = MOD_X[k];
    const mp = E.inOutExpo(R.prog(t, T_MANT, T_RULE));
    return [R.lerp(cx - w0 / 2, RULE_T[k][0], mp), R.lerp(BASE - h0, 702, mp), R.lerp(cx + w0 / 2, RULE_T[k][1], mp), R.lerp(BASE, 720, mp)];
  }
  // Analytic motion blur for the morphing rects (axis-aligned, so each edge sweeps a 1D range): the time-averaged
  // coverage along x is min(up, down), where `up` ramps 0 -> 1 across the left edge's positions over the shutter and
  // `down` 1 -> 0 across the right edge's (same along y). Drawn as gradients: smooth at any speed, where 10
  // 'lighter' samples 60 px apart would stair-step. x profile fill, then the y profile multiplied in (destination-in).
  const MB_N = 32;
  function profileStops(g, lo, hi, as, bs) {
    // as, bs: sorted positions of the low and high edges over the shutter; gradient spans [lo, hi]
    const n = as.length, span = Math.max(1e-6, hi - lo);
    const ramp = (arr, x, rising) => {
      if (x <= arr[0]) return rising ? (x < arr[0] ? 0 : (arr[0] === arr[n - 1] ? 1 : 0)) : 1;
      if (x >= arr[n - 1]) return rising ? 1 : 0;
      let i = 1; while (arr[i] < x) i++;
      const f = (i - 1 + (x - arr[i - 1]) / Math.max(1e-9, arr[i] - arr[i - 1])) / (n - 1);
      return rising ? f : 1 - f;
    };
    const pts = [...as, ...bs].sort((a, b) => a - b);
    const stop = (x, v) => g.addColorStop(R.clamp((x - lo) / span), R.rgba(RED, R.clamp(v)));
    for (const x of pts) {
      // a hard (static) edge: both sides of the jump
      stop(x, Math.min(ramp(as, x - 1e-3, true), ramp(bs, x - 1e-3, false)));
      stop(x, Math.min(ramp(as, x + 1e-3, true), ramp(bs, x + 1e-3, false)));
    }
  }
  function drawMorphBlur(ctx, t) {
    const sh = 1 / 60, S = [];
    for (let j = 0; j < MB_N; j++) S.push(R.clamp(t - sh * (j / (MB_N - 1) - 0.5), T_MANT, T_RULE - 1e-6));
    const rects = S.map(tt => [0, 1, 2].map(k => moduleRect(k, tt)));
    const col = i => (k => rects.map(r => r[k][i]).sort((a, b) => a - b));
    const ys0 = col(1)(0), ys1 = col(3)(0), ylo = ys0[0], yhi = ys1[MB_N - 1];
    const L = R.layer('s1:mod'), c = L.ctx;
    for (let k = 0; k < 3; k++) {
      const xs0 = col(0)(k), xs1 = col(2)(k), xlo = xs0[0], xhi = xs1[MB_N - 1];
      const g = c.createLinearGradient(xlo, 0, xhi, 0);
      profileStops(g, xlo, xhi, xs0, xs1);
      c.fillStyle = g; c.fillRect(xlo, ylo, xhi - xlo, yhi - ylo);
    }
    const gy = c.createLinearGradient(0, ylo, 0, yhi);
    profileStops(gy, ylo, yhi, ys0, ys1);
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = gy; c.fillRect(0, ylo, 1920, yhi - ylo);
    c.globalCompositeOperation = 'source-over';
    R.blit(ctx, L);
  }
  function drawModules(ctx, t) {
    if (t >= T_RULE) return;
    const ant = E.outQuad(R.prog(t, T_EXIT, T_MANT));
    const asx = R.lerp(1, 0.95, ant), asy = R.lerp(1, 1.08, ant);
    const morphing = t >= T_MANT;
    // squares -> bars moves up to ~600 px per frame at the inOutExpo peak: blur the flat rects so it reads as one motion
    if (morphing) drawMorphBlur(ctx, t);
    const numUp = -300 * E.inExpo(R.prog(t, T_EXIT, T_EXIT + S16));
    for (let k = 0; k < 3; k++) {
      const t0 = k * B;
      if (t < t0) continue;
      const e = E.outBack(R.prog(t, t0, t0 + 2 * S16), 2.4);
      if (e <= 0.001) continue;
      const cx = MOD_X[k];
      if (morphing && numUp <= -299) continue;
      ctx.save();
      if (morphing) {                                     // numeral (still exiting) clipped to the rect at t
        const [x0, y0, x1, y1] = moduleRect(k, t);
        ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
        ctx.translate(cx, BASE); ctx.scale(asx, asy);
      } else {
        ctx.translate(cx, BASE);
        ctx.rotate(R.lerp(-12, 0, e) * Math.PI / 180);
        ctx.scale(e * asx, e * asy);
        ctx.beginPath(); ctx.rect(-138, -296, 276, 296);
        ctx.fillStyle = RED; ctx.fill();
        ctx.clip();
      }
      // numeral: trails its module by a 32nd, scales about its own centre (0, -148)
      const ne = E.outBack(R.prog(t, t0 + S32, t0 + S32 + 2 * S16), 2.4);
      if (ne > 0.001 && numUp > -299) {
        ctx.translate(0, -148 + numUp); ctx.scale(ne, ne); ctx.translate(0, 148);
        R.font(ctx, 240, 'sans', 900);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = INK;
        ctx.fillText(String(k + 1), 0, 627.5 - BASE);
      }
      ctx.restore();
    }
  }

  function drawRule(ctx, t) {
    if (t < T_RULE || t >= T_H1) return;
    const r = inExpoN(R.prog(t, T_DROP, T_H1 - 1 / 60));   // frame rule: length 0 on f210, the last frame it draws
    const x0 = R.lerp(72, 960, r), x1 = R.lerp(1848, 960, r);
    if (x1 - x0 < 0.5) return;
    ctx.fillStyle = RED;
    ctx.fillRect(x0, 702 + ruleDip(t - T_C), x1 - x0, 18);
  }

  // ---- split band + ticker ----
  function splitOffsets(t) {
    // returns { tx, ty (top half), bx (bottom half), band (height) }
    if (t < T_SPLIT || t >= T_STR) return null;
    if (t < T_SPLITE) { const e = E.outExpo(R.prog(t, T_SPLIT, T_SPLITE)); return { tx: 280 * e, ty: -96 * e, bx: -280 * e, band: 96 * e }; }
    if (t < T_PUSHE) { const x = 280 + 18 * E.inBack(R.prog(t, T_SPLITE, T_PUSHE), 1.7); return { tx: x, ty: -96, bx: -x, band: 96 }; }
    const c = 1 - E.inExpo(R.prog(t, T_PUSHE, T_STR));
    return { tx: 298 * c, ty: -96 * c, bx: -298 * c, band: 96 * c };
  }
  function drawBand(ctx, t) {
    const so = splitOffsets(t);
    if (!so || so.band < 0.25) return;
    const y0 = MID - so.band, y1 = MID;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, 1920, so.band);
    ctx.fillStyle = RED; ctx.fill();
    ctx.clip();
    R.font(ctx, 64, 'mono', 700);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = INK;
    const off = R.mod(480 * (t - T_SPLIT), TICK_W);
    const by = (y0 + y1) / 2 + 23;
    for (let x = -off; x < 1920; x += TICK_W) ctx.fillText(TICKER, x, by);
    ctx.restore();
  }

  // ---- MOTION ----
  function letterAt(i, t) {
    const L = { cx: NAT[i], base: BASE, sx: 1, sy: 1, wt: 900, rot: 0, dy: 0 };
    if (t >= T_STR) {
      const s0 = T_STR + RANK[i] * S64, pe = E.outElastic(R.prog(t, s0, s0 + 0.30), 1, 0.4);
      L.cx = R.lerp(NAT[i], SLOT[i], pe); L.sy = R.lerp(1, 1.9, pe); L.wt = q10(900 - 650 * pe);
      if (i === 0) L.sx = R.lerp(1, 0.93, pe);
    }
    if (t >= T_DROP) {
      if (i === 1) {
        const e = E.outBack(R.prog(t, T_DROP, T_HANGE), 1.7);
        L.wt = q10(250 + 650 * e); L.sy = R.lerp(1.9, 1, e);
        // inOutQuad (peak ~3,900 px/s, 64 px per frame) instead of inOutExpo (~13,000 px/s): crisp and opaque with
        // no blur, so it clearly occludes the falling T and I. Frame rule: at rest on f210.
        const g = E.inOutQuad(R.prog(t, T_DROP, T_H1 - 1 / 60));
        L.cx = R.lerp(SLOT[1], 960, g); L.base = R.lerp(BASE, 657.75, g);
      } else {
        L.dy = -20 * E.outQuad(R.prog(t, T_DROP, T_F1));
        if (t > FALL0[i]) {
          const tau = t - FALL0[i];
          L.dy = -20 + 4500 * tau * tau;
          L.rot = SIGN[i] * (0.5 + 0.7 * RND[i]) * tau;
        }
      }
    }
    return L;
  }
  function drawLetter(c, i, L) {
    R.font(c, FS, 'display', L.wt);
    c.save();
    c.translate(L.cx, L.base + L.dy);
    if (L.rot) { const h = CAP * L.sy / 2; c.translate(0, -h); c.rotate(L.rot); c.translate(0, h); }
    c.scale(L.sx, L.sy);
    c.fillText(CH[i], 0, 0);
    c.restore();
  }
  const slamApply = (c, o) => { c.translate(960, BASE + o.dy); c.scale(o.s * o.sx, o.s * o.sy); c.translate(-960, -BASE); };

  // the whole word, weight 900, natural positions (approach, contact, split)
  function drawWordWhole(c, t) {
    const o = slam(t, T_C);
    c.save();
    c.globalAlpha *= o.a;
    slamApply(c, o);
    c.fillStyle = ICE; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const so = splitOffsets(t);
    if (!so) { for (let i = 0; i < 6; i++) drawLetter(c, i, letterAt(i, t)); }
    else {
      c.save(); c.translate(so.tx, so.ty); c.beginPath(); c.rect(-400, -400, 2720, MID + 400); c.clip();
      for (let i = 0; i < 6; i++) drawLetter(c, i, letterAt(i, t));
      c.restore();
      c.save(); c.translate(so.bx, 0); c.beginPath(); c.rect(-400, MID, 2720, 900); c.clip();
      for (let i = 0; i < 6; i++) drawLetter(c, i, letterAt(i, t));
      c.restore();
    }
    c.restore();
  }

  // dive zoom about (960, 540)
  const zoomAt = t => t < T_H1 ? 1 : 1 + 23 * inExpoN(R.prog(t, T_H1, T_ZE));
  const applyZoom = (c, Z) => { if (Z !== 1) { c.translate(960, 540); c.scale(Z, Z); c.translate(-960, -540); } };

  // is a letter (roughly) on screen at zoom Z?
  function letterVisible(L, Z) {
    const cy = L.base + L.dy - CAP * L.sy / 2, r = 0.72 * Math.max(330 * L.sx, CAP * L.sy);
    const sx = 960 + (L.cx - 960) * Z, sy = 540 + (cy - 540) * Z, sr = r * Z;
    return sx + sr > 0 && sx - sr < 1920 && sy + sr > 0 && sy - sr < 1080;
  }
  const FALLERS = [5, 2, 3, 4, 0];
  function drawFallers(c, t) {
    const Z = zoomAt(t);
    c.save();
    applyZoom(c, Z);
    c.fillStyle = ICE; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const i of FALLERS) { const L = letterAt(i, t); if (letterVisible(L, Z)) drawLetter(c, i, L); }
    c.restore();
  }
  const anyFaller = t => { const Z = zoomAt(t); return FALLERS.some(i => letterVisible(letterAt(i, t), Z)); };
  // blur the falling group only when some letter is on screen at either end of the shutter
  function blurFallers(ctx, t, samples, sh) {
    if (!anyFaller(t - sh / 2) && !anyFaller(t + sh / 2)) return;
    blur(ctx, t, drawFallers, samples, sh, 's1:fall');
  }
  // O1 as a vector ring (outer + inner contour), with its 8 px ink knockout
  function traceContour(c, pts, ox, oy, Z) {
    c.moveTo(960 + (ox + pts[0][0] - 960) * Z, 540 + (oy + pts[0][1] - 540) * Z);
    for (let k = 1; k < pts.length; k++) c.lineTo(960 + (ox + pts[k][0] - 960) * Z, 540 + (oy + pts[k][1] - 540) * Z);
    c.closePath();
  }
  function drawO1(ctx, t) {
    const L = letterAt(1, t), Z = zoomAt(t);
    if (t < T_HANGE || !INNER) {                        // glyph (weight / scale still animating)
      R.font(ctx, FS, 'display', L.wt);
      ctx.save();
      ctx.translate(L.cx, L.base); ctx.scale(L.sx, L.sy);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if (t >= T_DROP) { ctx.lineWidth = 8 / Math.sqrt(L.sx * L.sy); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText('O', 0, 0); }
      ctx.fillStyle = ICE; ctx.fillText('O', 0, 0);
      ctx.restore();
      return;
    }
    if (61.5 * Z > 1170) return;
    const ox = L.cx, oy = L.base + CC_DY;
    ctx.beginPath(); traceContour(ctx, OUTER, ox, oy, Z);
    ctx.lineWidth = 8 * Z; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
    traceContour(ctx, INNER, ox, oy, Z);
    // as the ring sweeps past the lens it dims a little, so the fly-through is not a full-frame white flash
    ctx.fillStyle = R.mix(ICE, INK, 0.45 * R.smoothstep(3, 12, Z)); ctx.fill('evenodd');
  }
  // the dive ring: blurred while the zoom rushes it outward, shutter capped to a ~60 px streak (6 px per sample);
  // skipped entirely once even the earliest sample would skip the ring (nothing to draw = no blur layer)
  function drawO1Dive(ctx, t) {
    const e = 1e-3, v = Math.abs(zoomAt(t + e) - zoomAt(t - e)) / (2 * e) * 1000;
    if (v < 1500) { drawO1(ctx, t); return; }
    const sh = Math.min(1 / 60, 60 / v);
    if (61.5 * zoomAt(t - sh / 2) > 1170) return;
    blur(ctx, t, drawO1, 10, sh, 's1:o1');
  }
  function drawInkHole(ctx, t) {
    const Z = zoomAt(t);
    if (61.5 * Z > 1170) return;
    ctx.beginPath();
    ctx.rect(-50, -50, 2020, 1180);
    traceContour(ctx, INNER, 960, 540, Z);
    ctx.fillStyle = INK; ctx.fill('evenodd');
  }

  // ---- the dot: a closed-form state for any t ----
  // the top centre of the N's right stem (at the N's centre x there is no ink at cap height: the diagonal is far lower)
  function nTop(t) {
    const L = letterAt(5, t), st = NSTEM ? NSTEM[L.wt] : { dx: 0, top: CAP };
    return [L.cx + st.dx * L.sx, BASE + L.dy - st.top * L.sy];
  }
  const LIFT = 14;                                       // the N's hop-up throws the dot this much higher: a gap opens
  const lift = t => LIFT * E.outQuad(R.prog(t, T_DROP, T_F1 + S64));
  function dotAt(t) {
    const s = { x: DOT_X, y: DOT_Y, vx: 0, vy: 0, sx: 1, sy: 1, ab: true, blur: false };
    if (t < T_FALL || t >= T_H1) return null;
    if (t < T_LAND) {                                    // falls out of the sky into slot 4
      const tau = t - T_FALL, vy = G_FALL * tau, k = Math.min(1.6, 1 + vy / 4000);
      // the stretched leading edge never passes the floor: the tip touches down, then the landing squash takes over
      const y = Math.min(-60 + 0.5 * G_FALL * tau * tau, FLOOR - DR * k);
      return Object.assign(s, { x: 1560, y, vy, ab: false, blur: true });
    }
    if (t < T_EXIT) {                                    // lands, holds, anticipates
      const q = landQ(t - T_LAND), w = 1 - R.prog(t, T_DANT, T_DANT + S32), a = E.outQuad(R.prog(t, T_DANT, T_EXIT));
      return Object.assign(s, { x: 1560, sx: (1 + 0.45 * q * w) * R.lerp(1, 1.2, a), sy: (1 - 0.40 * q * w) * R.lerp(1, 0.82, a) });
    }
    if (t < T_C) {                                       // hops to the period
      const H = hop(t, T_EXIT, T_C, 1560, DOT_Y, DOT_XC, DOT_Y, 130);
      const r = 1 - E.outQuad(R.prog(t, T_EXIT, T_EXIT + S32)), kw = E.outQuad(R.prog(t, T_EXIT, T_EXIT + 0.03));
      return Object.assign(s, { x: H.x, y: H.y, vx: H.vx * kw, vy: H.vy * kw, sx: R.lerp(1, 1.2, r), sy: R.lerp(1, 0.82, r) });
    }
    const wx = 960 + 844.98 * slam(t, T_C).sx;          // rides the word's horizontal ring
    if (t < T_STR) {
      s.x = wx;
      const qc = landQ(t - T_C), wc = 1 - R.prog(t, T_REB, T_REB + S32);
      let sx = 1 + 0.35 * qc * wc, sy = 1 - 0.30 * qc * wc;
      if (t >= T_REB && t < T_REBL) {                    // rebound thrown by the rule
        const H = hop(t, T_REB, T_REBL, wx, DOT_Y, wx, DOT_Y, 24);
        s.y = H.y; s.vy = H.vy * E.outQuad(R.prog(t, T_REB, T_REB + 0.03));
      }
      const ql = landQ(t - T_REBL);
      sx *= 1 + 0.15 * ql; sy *= 1 - 0.12 * ql;
      const a = E.outQuad(R.prog(t, T_PUSHE, T_STR));     // gets ready for the hop onto the N
      sx *= R.lerp(1, 1.14, a); sy *= R.lerp(1, 0.86, a);
      s.sx = sx; s.sy = sy;
      return s;
    }
    if (t < T_NL) {                                      // hops onto the N
      const [nx, ny] = nTop(T_NL);
      const H = hop(t, T_STR, T_NL, DOT_X, DOT_Y, nx, ny - DR, HOP_N);
      const r = 1 - E.outQuad(R.prog(t, T_STR, T_STR + S32)), kw = E.outQuad(R.prog(t, T_STR, T_STR + 0.03));
      return Object.assign(s, { x: H.x, y: H.y, vx: H.vx * kw, vy: H.vy * kw, sx: R.lerp(1, 1.14, r), sy: R.lerp(1, 0.86, r) });
    }
    if (t < T_F1) {                                      // rides the N's right stem (thrown a little by its hop-up)
      const [nx, ny] = nTop(t), q = landQ(t - T_NL);
      return Object.assign(s, { x: nx, y: ny - DR - lift(t), sx: 1 + 0.25 * q, sy: 1 - 0.22 * q });
    }
    const [xh, yt] = nTop(T_F1), yh = yt - DR - LIFT;
    if (t < T_HANGE) {                                   // hangs: the N drops away; it leans over and looks down
      const b = Math.sin(Math.PI * R.prog(t, T_F1, T_HANGE));
      return Object.assign(s, { x: xh, y: yt - DR - lift(t), sy: 1 - 0.12 * b, rot: -0.2 * b });
    }
    // drops into the counter: starts from rest in both axes (x eases in, so it falls before it swings left)
    const T = T_H1 - T_HANGE, u = R.prog(t, T_HANGE, T_H1), kw = E.outQuad(R.prog(t, T_HANGE, T_HANGE + 0.03));
    return Object.assign(s, { x: xh + (960 - xh) * u ** 1.4, y: yh + (540 - yh) * u * u,
      vx: kw * 1.4 * (960 - xh) * u ** 0.4 / T, vy: kw * 2 * (540 - yh) * u / T, ab: false, blur: true, kMax: 2.4 });
  }
  function drawDotAt(c, tt) {
    const s = dotAt(tt);
    if (!s) return;
    if (s.rot) { c.save(); c.translate(s.x, s.y + DR); c.rotate(s.rot); c.translate(-s.x, -s.y - DR); }   // lean about its bottom
    drawDot(c, s.x, s.y, DD, s.vx, s.vy, s.sx, s.sy, RED, s.ab, s.kMax || 1.6);
    if (s.rot) c.restore();
  }
  // the dot, blurred when it flies fast; the fall's samples never pass the landing (no early double exposure on f84)
  function drawDotFrame(ctx, t) {
    const d = dotAt(t);
    if (!d) return;
    if (!d.blur) { drawDotAt(ctx, t); return; }
    const cb = t < T_LAND ? (c, tt) => drawDotAt(c, Math.min(tt, T_LAND - 1e-4)) : (c, tt) => drawDotAt(c, Math.min(tt, T_H1 - 1e-4));
    blur(ctx, t, cb, 10, 1 / 60, 's1:dot');
  }

  // ---- post-FX (s1 owns 0 -> 3.75) ----
  function fx(t) {
    const f = R.fx;
    f.bloom = 0.15; f.threshold = 0.8; f.vignette = 0.35; f.grain = 0.045;
    for (const tk of [0, B, 2 * B, T_LAND]) if (t >= tk) f.bloom += 0.25 * Math.exp(-10 * (t - tk));
    if (t >= T_C) {
      const tau = t - T_C;
      R.flash(t, T_C, { amount: 0.18, decay: 30 });
      R.impact(t, T_C, { amount: 18, decay: 12, freq: 30, rot: 0.012 });
      f.chroma += 8 * Math.exp(-14 * tau); f.chromaAngle = 0;
      f.bloom += 0.6 * Math.exp(-8 * tau);
    }
    if (t >= T_SPLIT) {
      R.impact(t, T_SPLIT, { amount: 6, decay: 14 });
      f.chroma += 4 * Math.exp(-10 * (t - T_SPLIT));
    }
    if (t >= T_H1) {
      const e = inExpoN(R.prog(t, T_H1, T_ZE));
      f.distort = 0.25 * e; f.chroma += 12 * e; f.chromaAngle = 0;
    }
  }

  Reel.scene({
    id: 's1', name: 'Count-in + Type', start: 0, end: T_END, layer: 2,
    setup(R) {
      const c = document.createElement('canvas').getContext('2d');
      R.font(c, FS, 'display', 900);
      const g = R.glyphs(c, 'MOTION');
      const x0 = 53.16;
      ORG = g.chars.map(ch => x0 + ch.x);
      NAT = g.chars.map(ch => x0 + ch.x + ch.w / 2);
      R.font(c, 64, 'mono', 700);
      TICK_W = c.measureText(TICKER).width;
      const rng = R.rng(21);
      RND = CH.map(() => rng());
      // counter contour: rasterise O at 1000 px, cast 180 rays from the counter centre
      const S = 1000, W = 1200, H = 1000, ox = 100, oy = 900;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const x = cv.getContext('2d', { willReadFrequently: true });
      x.font = `900 ${S}px "${R.F.display}"`; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      x.fillText('O', ox, oy);
      const data = x.getImageData(0, 0, W, H).data;
      const A = (px, py) => {
        const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
        const at = (a, b) => (a < 0 || b < 0 || a >= W || b >= H) ? 0 : data[(b * W + a) * 4 + 3] / 255;
        return R.lerp(R.lerp(at(ix, iy), at(ix + 1, iy), fx), R.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy);
      };
      const adv = x.measureText('O').width;
      const ccx = ox + adv / 2 - 0.5, ccy = oy - 375 - 0.5;   // pixel centres sit at +0.5
      const k = FS / S, inn = [], out = [];
      for (let i = 0; i < 180; i++) {
        const a = -Math.PI / 2 + i / 180 * R.TAU, dx = Math.cos(a), dy = Math.sin(a);
        let r = 0, prev = A(ccx, ccy), rin = 0, rout = 0;
        for (r = 0.25; r < 700; r += 0.25) {
          const v = A(ccx + dx * r, ccy + dy * r);
          if (!rin && v >= 0.5 && prev < 0.5) rin = r - 0.25 + 0.25 * (0.5 - prev) / (v - prev);
          else if (rin && v < 0.5 && prev >= 0.5) { rout = r - 0.25 + 0.25 * (prev - 0.5) / (prev - v); break; }
          prev = v;
        }
        inn.push([dx * rin * k, dy * rin * k]);
        out.push([dx * rout * k, dy * rout * k]);
      }
      INNER = inn; OUTER = out;
      // N's right stem per weight: scan one row 200 px above the baseline (the rightmost ink run is the stem),
      // then walk down its centre column to find the stem's top
      const nc = document.createElement('canvas'); nc.width = 560; nc.height = 420;
      const nx = nc.getContext('2d', { willReadFrequently: true });
      const NB = 380, NO = 60;
      NSTEM = {};
      for (let wt = 250; wt <= 900; wt += 10) {
        nx.clearRect(0, 0, 560, 420);
        R.font(nx, FS, 'display', wt); nx.fillStyle = '#fff'; nx.textAlign = 'left'; nx.textBaseline = 'alphabetic';
        nx.fillText('N', NO, NB);
        const adv = nx.measureText('N').width, row = nx.getImageData(0, NB - 200, 560, 1).data;
        let r1 = -1, r0 = -1;
        for (let px = 559; px >= 0; px--) {
          const a = row[px * 4 + 3];
          if (r1 < 0) { if (a >= 128) r1 = px; } else if (a < 128) { r0 = px + 1; break; }
        }
        const cxs = (r0 + r1 + 1) / 2, col = nx.getImageData(Math.floor(cxs), 0, 1, 420).data;
        let top = CAP;
        for (let py = 0; py < 420; py++) if (col[py * 4 + 3] >= 128) { top = NB - py; break; }
        NSTEM[wt] = { dx: cxs - (NO + adv / 2), top };
      }
      // warm the browser's glyph caches so the first drawn frame rasterises text exactly like every later one
      const wc = document.createElement('canvas'); wc.width = 64; wc.height = 64;
      const w = wc.getContext('2d');
      R.font(w, 240, 'sans', 900); w.fillText('123', 0, 60);
      R.font(w, 64, 'mono', 700); w.fillText(TICKER, 0, 60);
      for (let wt = 250; wt <= 900; wt += 10) { R.font(w, FS, 'display', wt); w.fillText('MOTIN', 0, 60); }
      ready = true;
    },
    draw(ctx, t, lt, R) {
      if (!ready) return;
      fx(t);
      // same Chromium snapshot issue on the main canvas: a frame that is only the engine's full-frame background fill
      // (s1 alone on f224, where the ink, ring and letters are all past the lens) can present a stale image.
      // One invisible real draw per frame prevents it.
      ctx.fillStyle = 'rgba(0,0,0,0.004)'; ctx.fillRect(0, 0, 1, 1);

      if (t >= T_H1) {                                   // DIVE: ink with a counter-shaped hole, ring, falling letters
        drawInkHole(ctx, t);
        // the zoom multiplies the letters' screen speed: shorten the shutter as Z grows so the samples do not strobe
        // (a streak of ~60 px at most: screen speed ~ fall speed * Z + zoom rate * 1000 px)
        const Z = zoomAt(t), dZ = (zoomAt(t + 1e-3) - zoomAt(t - 1e-3)) / 2e-3;
        const sh = Math.min(1 / 60, 60 / (2500 * Z + dZ * 1000));
        blurFallers(ctx, t, 10, sh);
        drawO1Dive(ctx, t);
        return;
      }

      // power-on blink: 4 frames, hard on/off
      if (t < 4 / 60 - 1e-6) { ctx.fillStyle = LIME; ctx.beginPath(); ctx.arc(960, 540, LIME_R, 0, R.TAU); ctx.fill(); }

      drawGrid(ctx, t);
      drawModules(ctx, t);
      drawRule(ctx, t);
      drawBand(ctx, t);

      // MOTION
      if (t >= T_C - S16 && t < T_C) {
        // slam approach: 10 samples, shutter capped so neighbouring samples sit <= 15 px apart at the frame edge
        // (|ds/dt| = 1.2 * 4x^3 / S16 from slam()); samples never reach the contact state
        const rate = tt => 960 * 1.2 * 4 * R.prog(tt, T_C - S16, T_C) ** 3 / S16;
        const cap = tt => Math.min(1 / 60, 9 * 15 / Math.max(1e-6, rate(Math.min(tt, T_C))));
        const sh = cap(t + cap(t) / 2);
        // 2 interleaved sub-samples per sample at half weight: 20 positions, the same smear as CLAUDE's slam in s7
        const q4 = sh / 36, subs = R.quality < 1 ? [0] : [-q4, q4];
        blur(ctx, t, (c, tt) => { c.globalAlpha /= subs.length; for (const d of subs) drawWordWhole(c, Math.min(tt + d, T_C - 1e-4)); }, 10, sh, 's1:word');
      } else if (t >= T_C && t < T_PUSHE) drawWordWhole(ctx, t);
      else if (t >= T_PUSHE && t < T_STR) {
        // the halves slam shut (inExpo): blurred, same 15 px sample spacing cap, never past the closed state
        const rate = tt => 298 * 10 * Math.LN2 * E.inExpo(R.prog(Math.min(tt, T_STR), T_PUSHE, T_STR)) / (T_STR - T_PUSHE);
        const sh = Math.min(1 / 60, 9 * 15 / Math.max(1e-6, rate(t + 1 / 120)));
        const q4 = sh / 36, subs = R.quality < 1 ? [0] : [-q4, q4];
        blur(ctx, t, (c, tt) => { c.globalAlpha /= subs.length; for (const d of subs) drawWordWhole(c, Math.min(tt + d, T_STR - 1e-4)); }, 10, sh, 's1:word');
      } else if (t >= T_STR && t < T_DROP) {
        ctx.fillStyle = ICE; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < 6; i++) drawLetter(ctx, i, letterAt(i, t));
      } else if (t >= T_DROP) {
        if (t < T_F1) {                                  // hop-up anticipation, no blur yet
          ctx.fillStyle = ICE; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          for (const i of FALLERS) drawLetter(ctx, i, letterAt(i, t));
        } else blurFallers(ctx, t, 8, 1 / 60);
        drawDotFrame(ctx, t);                            // the dot goes INTO the O: drawn under O1 from 2.4
        drawO1(ctx, t);                                  // last of all letters, opaque, with its ink knockout
        return;
      }

      // the dot, on top
      drawDotFrame(ctx, t);
    },
  });
})();
