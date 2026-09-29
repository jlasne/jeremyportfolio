/* s7: End card. The camera whips up after the flung drop; CLAUDE slams onto the rule (now the reel's own
   timeline, cut into chapters, with a lime playhead); the drop settles top-right, tenses, and lands on the
   final downbeat as the full stop of CLAUDE. Then a hold, two cursor blinks and the grid retract.
   Also registers the HUD (id 'hud', layer 10): chapters, SMPTE timecode, bar.beat, for the whole reel. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', LIME = '#d7ff3a', ICE = '#eaf4fb', BLUE = '#5fa8d3';
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16;

  // ---- times (all on the grid) ----
  const T_PINCH = R.at(7, 2, 4);      // 12.0703125  scene start, whip up starts, drop handed over (H6)
  const T_C = R.at(7, 3);             // 12.1875     CLAUDE contact
  const T_SPEC = R.at(7, 3, 3);       // 12.421875   specular gone, dot settled; `Motion`
  const T_DES = R.at(7, 3, 4);        // 12.5390625  `Designer`
  const T_GRID = R.at(7, 3, 2);       // 12.3046875  grid draws on
  const T_LINE = R.at(7, 4);          // 12.65625    the line
  const T_TENSE = R.at(7, 4, 3);      // 12.890625   dot tenses
  const T_DROP = R.at(7, 4, 4);       // 13.0078125  dot drops
  const T_HIT = R.at(8, 1);           // 13.125      FINAL HIT
  const BLINKS = [[R.at(8, 3), R.at(8, 3, 3)], [R.at(8, 4), R.at(8, 4, 3)]];
  const T_RET = R.at(8, 4);           // 14.53125    grid retract
  const RISE_D = 3 * S32;             // 0.17578125 word rises

  // ---- layout (measured in setup; the spec values are the fallbacks) ----
  const CL_FS = 318.109, CL_X = 61.82, B7 = 530, AX = 960;
  let X_E = 1497.44, E_INK_R = 248.52; // origin of the E, its ink right edge
  let CODE_KERN = 0;                  // the mono period sits centred in its cell: pulled in (measured in setup)
  const DOT_X = 1804.42, DOT_Y = 490.24, DOT_D = 87.16, FLOOR = DOT_Y + DOT_D / 2;   // 533.82
  const RULE_Y = 544, RULE_H = 18, GAPS = [294, 516, 738, 960, 1182, 1348.5, 1515];
  const MD_Y = 690, MD_CLIP = 720, LN_Y = 812, LN_CLIP = 830;   // line at 68 px (spec 56): readable in the phone player
  let MD_X = [78, 407.28];            // Motion, Designer origins (ink aligned to x 72)
  let LN_X = [75, 0, 0, 0];           // Every, frame, was, code. origins
  let CODE_W = 163.2;                 // advance of `code` in JetBrains Mono 700 68 px
  const LN_FS = 68, LN_RISE = 86;
  const LN_W = ['Every', 'frame', 'was'];
  const xTrue = t => 72 + 1776 * t / 15;

  // ---- shared grammar (1.7) ----
  function slam(t, tc) {
    const A = S16;
    if (t < tc) {
      const p = E.inQuart(R.prog(t, tc - A, tc));
      return { s: R.lerp(2.2, 1, p), dy: R.lerp(-120, 0, p), sx: 1, sy: 1, a: R.prog(t, tc - A, tc - A + 0.05) };
    }
    const q = 1 - R.spring(t - tc, 1024, 17.9);
    return { s: 1, dy: 0, sx: 1 + 0.04 * q, sy: 1 - 0.18 * q, a: 1 };
  }
  const ruleDip = tau => tau < 0 ? 0 : 14 * Math.exp(-9 * tau) * Math.sin(28 * tau);
  const w2 = t => E.whip(R.prog(t, T_PINCH, T_C));
  const worldY = t => -1080 * (1 - w2(t));

  // local dip of the rule under the landing (8.1)
  const localDip = (x, t) => {
    const tau = t - T_HIT;
    if (tau < 0 || tau > 1.2) return 0;
    const g = (x - 1804) / 160;
    return 8 * Math.exp(-9 * tau) * Math.sin(26 * tau) * Math.exp(-g * g);
  };
  const eNudgeRaw = t => { const tau = t - T_HIT; return tau < 0 ? 0 : -6 * Math.exp(-10 * tau) * Math.sin(24 * tau); };
  const landQ7 = t => t < T_HIT ? 0 : 1 - R.spring(t - T_HIT, 420, 14.3);
  // the E nudges after the dot lands; while the dot's squash would reach into it, the dot shoves it (4 px gap)
  const eNudge = t => {
    const n = eNudgeRaw(t);
    if (t < T_HIT) return n;
    const dotLeft = DOT_X - (1 + 0.6 * landQ7(t)) * DOT_D / 2;
    return Math.min(n, dotLeft - 4 - (X_E + E_INK_R));
  };

  // ---- the drop / dot: one state function of t ----
  const P0 = [1718.7, 320], P1 = [1740, 182], P2 = [DOT_X, 200];
  const W2 = 28, W3 = 54;             // liquid wobble modes l = 2, 3 (omega ratio ~1.94, as for a real drop)
  const ANG_END = Math.atan2(P2[1] - P1[1], P2[0] - P1[0]);
  function dotAt(t) {
    const st = { x: DOT_X, y: DOT_Y, d: DOT_D, k: 1, ang: 0, m3: 0, ph3: 0, sx: 1, sy: 1, bottom: false, spec: 0, on: true };
    if (t < T_C) {                                          // flung along the Bezier, screen space (H6)
      const p = R.prog(t, T_PINCH, T_C), u = E.outQuad(p), v = 1 - u;
      st.x = v * v * P0[0] + 2 * v * u * P1[0] + u * u * P2[0];
      st.y = v * v * P0[1] + 2 * v * u * P1[1] + u * u * P2[1];
      const tx = 2 * v * (P1[0] - P0[0]) + 2 * u * (P2[0] - P1[0]), ty = 2 * v * (P1[1] - P0[1]) + 2 * u * (P2[1] - P1[1]);
      st.ang = Math.atan2(ty, tx);
      st.d = 2 * R.lerp(26, 30, u);
      st.k = R.lerp(1.35, 1.1, u);
      st.spec = 0.6;
      return st;
    }
    if (t < T_DROP) {                                       // settle, bob, then tense
      const tau = t - T_C;
      st.d = R.lerp(60, DOT_D, E.outBack(R.prog(t, T_C, T_SPEC), 1.4));
      st.spec = 0.6 * (1 - R.prog(t, T_C, T_SPEC));
      const wgt = 1 - R.prog(t, T_TENSE, T_TENSE + S32);   // ring fades when the anticipation starts (1.7)
      const env = Math.exp(-8 * tau) * wgt;
      st.k = 1 + 0.1 * env * Math.cos(W2 * tau);
      st.ang = ANG_END;
      st.m3 = 0.1 * env * Math.sin(W3 * tau);
      st.ph3 = -Math.PI / 2;
      const bob = -6 * Math.sin(R.TAU * tau / 0.9375) * (1 - R.prog(t, T_LINE, T_TENSE));
      if (t < T_TENSE) { st.y = 200 + bob; return st; }
      const a = E.outSine(R.prog(t, T_TENSE, T_DROP));
      st.y = 200 - 20 * a; st.sx = 1 - 0.15 * a; st.sy = 1 + 0.3 * a; st.bottom = true;
      return st;
    }
    if (t < T_HIT) {                                        // the drop
      const p = R.prog(t, T_DROP, T_HIT), rel = E.outQuad(R.prog(t, T_DROP, T_DROP + S32));
      st.y = R.lerp(180, DOT_Y, E.inCubic(p));
      const v = (DOT_Y - 180) * 3 * p * p / S16;
      st.k = Math.min(1.7, 1 + v / 4000); st.ang = Math.PI / 2;
      st.sx = R.lerp(0.85, 1, rel); st.sy = R.lerp(1.3, 1, rel); st.bottom = true;
      const r = st.d / 2, bottom = st.y + r + st.sy * r * (st.k - 1);   // the stretched dot never enters the rule
      if (bottom > FLOOR) st.y -= bottom - FLOOR;
      return st;
    }
    const q = landQ7(t);                                    // the full stop lands, anchored at 1804.42
    st.sx = 1 + 0.6 * q; st.sy = 1 - 0.45 * q; st.bottom = true;
    for (const [a, b] of BLINKS) if (t >= a && t < b) st.on = false;
    return st;
  }

  const N_BLOB = 56, UNIT = Array.from({ length: N_BLOB }, (_, i) => { const a = i / N_BLOB * R.TAU; return [Math.cos(a), Math.sin(a), a]; });
  function shapePts(st, rr) {
    const c = Math.cos(st.ang), s = Math.sin(st.ang), kx = st.k, ky = 1 / Math.sqrt(st.k);
    return UNIT.map(([ux, uy, a]) => {
      const m = rr * (1 + st.m3 * Math.cos(3 * (a - st.ph3)));
      const px = ux * m, py = uy * m;
      const lx = (px * c + py * s) * kx, ly = (-px * s + py * c) * ky;   // into the stretch axis and back
      return [lx * c - ly * s, lx * s + ly * c];
    });
  }
  function drawDrop(c, st) {
    if (!st.on) return;
    const r = st.d / 2;
    c.save();
    c.translate(st.x, st.bottom ? st.y + r : st.y);
    c.scale(st.sx, st.sy);
    if (st.bottom) c.translate(0, -r);
    c.fillStyle = RED;
    if (st.k === 1 && st.m3 === 0) { c.beginPath(); c.arc(0, 0, r, 0, R.TAU); }
    else R.traceSmooth(c, shapePts(st, r), true);
    c.fill();
    c.restore();
    drawSpec(c, st);
  }
  function drawSpec(c, st) {                                // 2 px ice specular arc, upper left, 6 px inside
    if (!st.on || st.spec <= 0.003) return;
    const r = st.d / 2;
    c.save();
    c.translate(st.x, st.bottom ? st.y + r : st.y);
    c.scale(st.sx, st.sy);
    if (st.bottom) c.translate(0, -r);
    const pts = shapePts(st, r - 6), i0 = Math.round(N_BLOB * 0.56), i1 = Math.round(N_BLOB * 0.70);
    c.beginPath(); c.moveTo(pts[i0][0], pts[i0][1]);
    for (let i = i0 + 1; i <= i1; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.strokeStyle = R.rgba(ICE, st.spec); c.lineWidth = 2; c.lineCap = 'round'; c.stroke();
    c.restore();
  }

  // ---- CLAUDE with the slam and whip, applied inside (so motion blur samples carry them) ----
  function drawClaude(c, t) {
    const o = slam(t, T_C);
    c.translate(0, worldY(t));
    c.translate(AX, B7 + o.dy); c.scale(o.s * o.sx, o.s * o.sy); c.translate(-AX, -B7);
    c.globalAlpha *= o.a;
    R.font(c, CL_FS, 'display', 900);
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = ICE;
    c.fillText('CLAUD', CL_X, B7);
    c.fillText('E', X_E + eNudge(t), B7);
  }

  // ---- grid: centre-out draw-on, centre-in retract (1.5) ----
  const VP = [[948, 972], [822, 1098], [798, 1122], [672, 1248], [648, 1272], [522, 1398], [498, 1422], [372, 1548], [348, 1572], [222, 1698], [198, 1722], [72, 1848]];
  const HP = [[528, 552], [392, 688], [368, 712], [232, 848], [208, 872], [72, 1008]];
  const pairFrac = (t, n, count) => {
    const on = E.outExpo(R.prog(t, T_GRID + n * S64, T_GRID + n * S64 + 0.3515625));
    const m = count - 1 - n, a = T_RET + m * S64;
    return on * (1 - E.inExpo(R.prog(t, a, a + S16)));
  };
  function drawGrid(ctx, t) {
    const rs = R.rs, dw = Math.max(1, Math.round(1.5 * rs)), lw = dw / rs, off = dw % 2 ? 0.5 / rs : 0;
    const snap = v => Math.round(v * rs) / rs + off;
    ctx.beginPath();
    let any = false;
    VP.forEach((pr, n) => {
      const f = pairFrac(t, n, VP.length); if (f <= 0.0005) return;
      for (const x of pr) { const X = snap(x); ctx.moveTo(X, 540 - 468 * f); ctx.lineTo(X, 540 + 468 * f); }
      any = true;
    });
    HP.forEach((pr, n) => {
      const f = pairFrac(t, n, HP.length); if (f <= 0.0005) return;
      for (const y of pr) { const Y = snap(y); ctx.moveTo(960 - 888 * f, Y); ctx.lineTo(960 + 888 * f, Y); }
      any = true;
    });
    if (!any) return;
    ctx.strokeStyle = R.rgba(ICE, 0.12); ctx.lineWidth = lw; ctx.lineCap = 'butt';
    ctx.stroke();
  }

  // ---- the rule / scrubber ----
  function drawRule(ctx, t, dy) {
    const gw = GAPS.map((g, i) => i < GAPS.length - 1 ? 4 : 4 * E.outExpo(R.prog(t, T_C, T_C + S32)));
    const segs = [];
    let x0 = 72;
    GAPS.forEach((g, i) => { if (gw[i] > 0.05) { segs.push([x0, g - gw[i] / 2]); x0 = g + gw[i] / 2; } });
    segs.push([x0, 1848]);
    const tau = t - T_HIT, local = tau >= 0 && tau < 1.2;
    const y0 = RULE_Y + dy;
    ctx.beginPath();
    for (const [a, b] of segs) {
      if (!local || b < 1804 - 520) { ctx.rect(a, y0, b - a, RULE_H); continue; }
      const xs = [a];
      for (let x = Math.ceil(a / 8) * 8; x < b; x += 8) if (x > a) xs.push(x);
      xs.push(b);
      ctx.moveTo(a, y0 + localDip(a, t));
      for (const x of xs) ctx.lineTo(x, y0 + localDip(x, t));
      for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], y0 + RULE_H + localDip(xs[i], t));
      ctx.closePath();
    }
    ctx.fillStyle = RED; ctx.fill();
  }

  // ---- the lime playhead, with an analytic speed streak ----
  const PH_H = 28;                    // 4 x 28 (spec 40): keeps 5 px clear of the resting full stop
  const playX = t => t < T_C ? null : R.lerp(72, xTrue(t), E.outExpo(R.prog(t, T_C, T_C + 0.234375)));
  function drawPlayhead(ctx, t, dy) {
    const x = playX(t); if (x === null) return;
    const yc = RULE_Y + RULE_H / 2 + dy + localDip(x, t);
    const xp = playX(Math.max(T_C, t - 1 / 60));
    if (x - xp > 8) {                                       // speed trail: the bar's own tips, never over the red
      const g = ctx.createLinearGradient(xp, 0, x, 0);
      g.addColorStop(0, R.rgba(LIME, 0)); g.addColorStop(1, R.rgba(LIME, 0.3));
      ctx.fillStyle = g;
      ctx.fillRect(xp, yc - PH_H / 2, x - xp, PH_H / 2 - RULE_H / 2);
      ctx.fillRect(xp, yc + RULE_H / 2, x - xp, PH_H / 2 - RULE_H / 2);
    }
    ctx.fillStyle = LIME;
    ctx.fillRect(x - 2, yc - PH_H / 2, 4, PH_H);
  }

  // ---- words rising out of clips ----
  function drawRisers(ctx, t) {
    // Motion Designer
    ctx.save();
    ctx.beginPath(); ctx.rect(0, RULE_Y + RULE_H + 12, 1920, MD_CLIP - (RULE_Y + RULE_H + 12)); ctx.clip();
    R.font(ctx, 120, 'serif', 400, 'italic'); ctx.fillStyle = BLUE; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    [['Motion', T_SPEC], ['Designer', T_DES]].forEach(([w, t0], i) => {
      if (t < t0) return;
      const y = MD_Y + 124 * (1 - E.outExpo(R.prog(t, t0, t0 + RISE_D)));
      ctx.fillText(w, MD_X[i], y);
    });
    ctx.restore();
    // Every frame was code.
    if (t < T_LINE) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, MD_CLIP, 1920, LN_CLIP - MD_CLIP); ctx.clip();
    for (let k = 0; k < 4; k++) {
      const t0 = T_LINE + k * S64;
      if (t < t0) continue;
      const y = LN_Y + LN_RISE * (1 - E.outExpo(R.prog(t, t0, t0 + RISE_D)));
      if (k < 3) { R.font(ctx, LN_FS, 'sans', 500); ctx.fillStyle = ICE; ctx.fillText(LN_W[k], LN_X[k], y); }
      else { R.font(ctx, LN_FS, 'mono', 700); ctx.fillStyle = LIME; ctx.fillText('code', LN_X[3], y); ctx.fillText('.', LN_X[3] + CODE_W - CODE_KERN, y); }
    }
    ctx.restore();
  }

  function drawRipple(ctx, t) {
    const tau = t - T_HIT; if (tau < 0 || tau >= 0.35) return;
    const p = E.outExpo(tau / 0.35);
    const lw = 6 * (1 - p), a = 0.8 * (1 - p);
    if (lw < 0.05 || a < 0.01) return;
    ctx.beginPath(); ctx.arc(DOT_X, DOT_Y, 44 + 256 * p, 0, R.TAU);
    ctx.strokeStyle = R.rgba(ICE, a); ctx.lineWidth = lw; ctx.stroke();
  }

  // ---- blur shutters: cap by speed so the samples stay close enough to read as a smear, not a comb ----
  const baseY = tt => worldY(tt) + B7 + slam(tt, T_C).dy;          // CLAUDE's baseline on screen
  function claudeShutter(t) {
    const h = 1 / 240, a = Math.min(t - h / 2, T_C - h), b = a + h;
    const ds = Math.abs(slam(b, T_C).s - slam(a, T_C).s) / h, dy = Math.abs(baseY(b) - baseY(a)) / h;
    const v = Math.hypot(888 * ds, dy + 240 * ds);                   // fastest edge: the E's right edge / the cap tops
    return Math.min(1 / 60, 110 / Math.max(v, 1));                   // 10 x 2 sub-samples, <= ~6 px apart
  }
  function dropShutter(t, lim) {
    const h = 1 / 240, a = Math.min(t - h / 2, lim - h), p = dotAt(a), q = dotAt(a + h);
    const v = Math.hypot(q.x - p.x, q.y - p.y) / h;
    return Math.min(1 / 60, 40 / Math.max(v, 1));                    // the velocity stretch carries the rest
  }

  Reel.poster = 14.5;

  Reel.scene({
    id: 's7', name: 'End card', start: T_PINCH, end: 15, layer: 3,
    setup(R) {
      const c = document.createElement('canvas').getContext('2d');
      R.font(c, CL_FS, 'display', 900);
      const g = R.glyphs(c, 'CLAUDE');
      X_E = CL_X + g.chars[5].x;
      E_INK_R = c.measureText('E').actualBoundingBoxRight;
      R.font(c, 120, 'serif', 400, 'italic');
      const mdL = c.measureText('Motion').actualBoundingBoxLeft;
      MD_X = [72 + mdL, 72 + mdL + c.measureText('Motion ').width];
      R.font(c, LN_FS, 'sans', 500);
      const eL = c.measureText('E').actualBoundingBoxLeft;       // negative: ink starts right of the origin
      const x0 = 72 + eL;
      LN_X = [x0, x0 + c.measureText('Every ').width, x0 + c.measureText('Every frame ').width, x0 + c.measureText('Every frame was ').width];
      R.font(c, LN_FS, 'mono', 700);
      const mc = c.measureText('code'), md = c.measureText('.');
      CODE_W = mc.width;
      // air between the e's ink and the period's ink, brought down to a proportional face's ~5 px
      const air = (CODE_W - md.actualBoundingBoxLeft) - mc.actualBoundingBoxRight;
      CODE_KERN = R.clamp(air - 5 * LN_FS / 56, 0, 17);
    },
    draw(ctx, t, lt, R) {
      // ---- post (s7 owns FX for its whole window) ----
      const fx = R.fx;
      fx.bloom = 0.15; fx.threshold = 0.8; fx.vignette = 0.35; fx.grain = 0.045;
      let chroma = 0;
      if (t < T_C) chroma += 12 * Math.sin(Math.PI * w2(t));
      const tc = t - T_C, th = t - T_HIT;
      if (tc >= 0) {
        chroma += 8 * Math.exp(-14 * tc);
        fx.bloom += 0.6 * Math.exp(-8 * tc);
        fx.zoom = Math.max(fx.zoom, 1 + 0.05 * (1 - E.outExpo(R.prog(t, T_C, T_C + 0.234375))));
        R.flash(t, T_C, { amount: 0.2, decay: 25, color: ICE });
        R.impact(t, T_C, { amount: 18, decay: 10 });
      }
      if (th >= 0) {
        chroma += 6 * Math.exp(-12 * th);                     // spec 10: at 10 the type reads doubled for 3 frames
        fx.bloom += 0.5 * Math.exp(-6 * th);
        // trimmed from the spec's zoom 1.04 / flash 0.35: the landing is carried by local motion, the type stays still
        fx.zoom = Math.max(fx.zoom, 1 + 0.015 * (1 - E.outExpo(R.prog(t, T_HIT, T_HIT + 0.234375))));
        R.flash(t, T_HIT, { amount: 0.18, decay: 32, color: ICE });   // gone in 3 frames: no grey veil on the card
        R.impact(t, T_HIT, { amount: 8, decay: 16 });
      }
      fx.chroma = chroma; fx.chromaAngle = Math.PI / 2;

      const wy = worldY(t);
      const ruleDy = wy + ruleDip(t - T_C);

      // grid (world; it only draws after the whip has landed)
      drawGrid(ctx, t);
      // rule with its chapter gaps (crisp from the contact frame; through the whip it rides CLAUDE's shutter below)
      if (t >= T_C) drawRule(ctx, t, ruleDy);
      // CLAUDE and the rule: blurred through the approach only (as s1), crisp from the contact frame
      if (t < T_C) {
        const sh = claudeShutter(t), last = Math.min(t + sh / 2, T_C - 1e-4);
        // nothing on canvas yet: skip (an empty blur layer can blit stale pixels in Chromium)
        // each of the 10 samples draws 2 interleaved sub-samples at half weight: 20 positions, <= ~6 px apart.
        // The rule (y 544 + worldY) never overlaps the letters (bottom 530 + dy + worldY, dy <= 0), so 'lighter' stays exact.
        const q4 = sh / 36;                                  // a quarter of the sample spacing (sh / 9)
        // (R.quality < 1: motionBlur draws once, straight onto the frame, so draw a single opaque pass)
        const subs = R.quality < 1 ? [0] : [-q4, q4];
        if (baseY(last) > -12 || RULE_Y + worldY(last) > -RULE_H) R.motionBlur(ctx, t, (c, tt) => {
          c.globalAlpha /= subs.length;
          for (const d of subs) {
            const u = Math.min(tt + d, T_C - 1e-4);
            c.save(); drawRule(c, u, worldY(u)); c.restore();
            c.save(); drawClaude(c, u); c.restore();
          }
        }, { samples: 10, shutter: sh, name: 's7:mbC' });
      } else { ctx.save(); drawClaude(ctx, t); ctx.restore(); }
      drawRisers(ctx, t);
      drawPlayhead(ctx, t, ruleDy);
      drawRipple(ctx, t);
      // the dot (screen space during the whip)
      if (t < T_C) {
        // the flung drop: s6's 1/60 shutter (clamped at the contact), 10 x 2 interleaved sub-samples = 20 positions
        // ~4 px apart, so it reads as the same continuous smear as s6's jet tip on f724. The specular is drawn once,
        // crisp, with s6's specArc rule (it fades as the smear outgrows the drop).
        const lim = T_C - 1e-4, sh = Math.min(1 / 60, 2 * (lim - t)), q4 = sh / 36, subs = R.quality < 1 ? [0] : [-q4, q4];
        R.motionBlur(ctx, t, (c, tt) => {
          c.globalAlpha /= subs.length;
          for (const d of subs) { const st = dotAt(Math.min(tt + d, lim)); st.spec = 0; drawDrop(c, st); }
        }, { samples: 10, shutter: sh, name: 's7:mbD' });
        const st = dotAt(t), a = dotAt(Math.min(t - sh / 2, lim)), b = dotAt(Math.min(t + sh / 2, lim));
        const travel = Math.hypot(b.x - a.x, b.y - a.y);
        st.spec = 0.6 * Math.min(1, st.d * st.k / Math.max(travel, 1e-6));
        drawSpec(ctx, st);
      } else if (t >= T_DROP && t < T_HIT) {
        // samples never cross a contact (no pre-echo); 10 x 2 interleaved sub-samples, a smear instead of onion skins
        const lim = T_HIT - 1e-4, sh = dropShutter(t, lim), q4 = sh / 36, subs = R.quality < 1 ? [0] : [-q4, q4];
        R.motionBlur(ctx, t, (c, tt) => {
          c.globalAlpha /= subs.length;
          for (const d of subs) drawDrop(c, dotAt(Math.min(tt + d, lim)));
        }, { samples: 10, shutter: sh, name: 's7:mbD' });
      }
      else drawDrop(ctx, dotAt(t));
    },
  });

  // =====================================================================================
  // HUD: the persistent system (3.8). Screen space, margins only, never touches R.fx.
  // =====================================================================================
  const HUD_FS = 30, ADV = 19;                     // JetBrains Mono 500 30 px: 18 px advance + 1 px tracking
  const ICE55 = R.rgba(ICE, 0.55), INK60 = R.rgba('#050b16', 0.6);
  const CH_T = [0, R.at(2, 1), R.at(3, 1), R.at(4, 1), R.at(4, 3), R.at(5, 1), R.at(6, 1), R.at(6, 4), T_PINCH];
  const CH_L = ['00 / COUNT-IN', '01 / TYPE', '02 / TIMING', '03 / DEPTH', '04 / PARTICLES', '05 / DATA', '06 / INTERFACE', '07 / LIQUID', ''];
  const TYPE0 = [S16, S16 + S64, S16 + 2 * S64];   // TL, TR, BR type-on starts
  const ROLL_CH = S16, ROLL_BEAT = 0.08, STAG = 0.01, ROLL_DY = 34;
  const TS0 = 7.03125, TS_DEAD = 7.3828125, PICK = 7.425, PICK_E = 7.5, T51 = R.at(5, 1);
  const w1 = t => E.whip(R.prog(t, 10.8984375, 11.015625));

  const barLabel = n => `BAR ${Math.floor(n / 4) + 1}.${n % 4 + 1}`;
  const pad = (v, n = 2) => String(v).padStart(n, '0');
  const timecode = t => {
    const f = Math.floor(t * 60 + 1e-6), s = Math.floor(f / 60);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % 60)}`;
  };

  // one character in the HUD grid
  const ch = (ctx, c, x0, j, y, col) => { if (c === ' ' || !c) return; ctx.fillStyle = col; ctx.fillText(c, x0 + j * ADV, y); };

  // type-on: one character per 64th, cursor block while typing
  function typeOn(ctx, str, x0, y, t0, t, colOf) {
    if (t < t0) return;
    const n = Math.min(str.length, Math.floor((t - t0) / S64 + 1e-7) + 1);
    for (let j = 0; j < n; j++) ch(ctx, str[j], x0, j, y, colOf(j, 0));
    if (n < str.length) { ctx.fillStyle = colOf(n, 0); ctx.fillRect(x0 + n * ADV + 1, y - 22, 16, 25); }
  }

  // odometer roll: changed characters roll up inside a clip, staggered left to right
  function roll(ctx, oldS, newS, x0, y, t0, dur, t, colOf) {
    const L = Math.max(oldS.length, newS.length);
    let nCh = 0;
    for (let j = 0; j < L; j++) if ((oldS[j] || ' ') !== (newS[j] || ' ')) nCh++;
    const stag = nCh > 1 ? Math.min(STAG, 0.045 / (nCh - 1)) : 0;   // the whole label turns over in <= 45 ms
    let k = 0, clipped = false;
    for (let j = 0; j < L; j++) {
      const a = oldS[j] || ' ', b = newS[j] || ' ';
      if (a === b) { ch(ctx, b, x0, j, y, colOf(j, 1)); continue; }
      const s = t0 + k * stag; k++;
      const p = E.outExpo(R.prog(t, s, s + dur));
      if (p >= 1) { ch(ctx, b, x0, j, y, colOf(j, 1)); continue; }
      if (!clipped) { ctx.save(); ctx.beginPath(); ctx.rect(0, y - 28, 1920, 36); ctx.clip(); clipped = true; }
      ch(ctx, a, x0, j, y - ROLL_DY * p, colOf(j, 0));
      ch(ctx, b, x0, j, y + ROLL_DY * (1 - p), colOf(j, 1));
    }
    if (clipped) ctx.restore();
  }

  const hudOff = [0, 0, 0];                        // TL, TR, BR vertical insets, set by the hud scene each frame
  function drawHud(ctx, t, onIce) {
    const base = onIce ? INK60 : ICE55;
    const plain = () => base;
    R.font(ctx, HUD_FS, 'mono', 500);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // top-left: chapter
    let i = 0; while (i + 1 < CH_T.length && t >= CH_T[i + 1]) i++;
    ctx.save(); ctx.translate(0, hudOff[0]);
    if (i === 0) typeOn(ctx, CH_L[0], 72, 46, TYPE0[0], t, plain);
    else roll(ctx, CH_L[i - 1], CH_L[i], 72, 46, CH_T[i], ROLL_CH, t, plain);
    ctx.restore();

    // top-right: SMPTE timecode (keeps ticking through everything, dims on the end card)
    const tc = timecode(t), tcx = 1848 - (tc.length * ADV - 1);
    const tcCol = t >= T_PINCH && !onIce ? R.rgba(ICE, 0.55 - 0.15 * R.prog(t, T_PINCH, T_PINCH + S16)) : base;
    ctx.save(); ctx.translate(0, hudOff[1]);
    typeOn(ctx, tc, tcx, 46, TYPE0[1], t, () => tcCol);
    ctx.restore();

    // bottom-right: BAR b.k
    const n = Math.floor(t / B + 1e-7), cur = barLabel(n), bx = 1848 - (cur.length * ADV - 1);
    const limeA = t < TS_DEAD ? 1 : (t >= PICK && t < PICK_E) ? 1 : 0.3;
    // which = 0 for the outgoing character, 1 for the incoming one
    const colBR = (j, which) => {
      if (j < 4) return base;
      if (t >= TS0 && t < T51) return which === 0 && t < TS0 + 0.2 ? base : R.rgba(LIME, limeA);   // frozen: the live signal
      if (t >= T51 && t < T51 + 0.2 && which === 0) return R.rgba(LIME, limeA);   // 4.4 rolling out
      return base;
    };
    ctx.save(); ctx.translate(0, hudOff[2]);
    if (n === 0) typeOn(ctx, cur, bx, 1052, TYPE0[2], t, plain);
    else if (t >= T_PINCH) roll(ctx, cur, '', bx, 1052, T_PINCH, ROLL_CH, t, colBR);
    else roll(ctx, barLabel(n - 1), cur, bx, 1052, n * B, ROLL_BEAT, t, colBR);
    ctx.restore();
  }

  // where the frame under the HUD is ice: s4's iris, s5's field, s5 whipping away
  function icePath(t) {
    if (t >= 9.2578125 && t < 9.375) {
      const r = 1150 * E.inExpo(R.prog(t, 9.2578125, 9.366667));
      if (r < 700) return null;                            // nowhere near a corner yet
      return c => { c.moveTo(960 + r, 540); c.arc(960, 540, r, 0, R.TAU); };
    }
    if (t >= 9.375 && t < 11.015625) {
      const yb = 1080 * (1 - w1(t));
      if (yb >= 1080) return 'all';
      if (yb <= 0) return null;
      return c => c.rect(0, 0, 1920, yb);
    }
    return null;
  }

  Reel.scene({
    id: 'hud', start: 0, end: 15, layer: 10,
    draw(ctx, t) {
      // s3's tape stop rolls the lens (-0.035 rad, held until 7.5): keep the margins level so the ticking timecode
      // (the proof that the freeze is live code) stays on the frame. Shakes and the other lens effects still apply.
      // The roll pulls two source edges into the frame (lens edge clamp beyond them), so the two corners under those
      // edges step in just enough to stay on real pixels (about 11 px at TL, 7 px at BR, at the full roll).
      hudOff[0] = hudOff[1] = hudOff[2] = 0;
      const rot = t >= 7.03125 && t < 7.5 ? R.fx.rot : 0;
      if (rot) {
        ctx.translate(960, 540); ctx.rotate(-rot); ctx.translate(-960, -540);
        const lift = 888 * Math.abs(rot);                  // how far in the lens pulls a source edge at x 72 / 1848
        if (rot < 0) { hudOff[0] = Math.max(0, lift - 20); hudOff[2] = -Math.max(0, lift - 24); }
        else hudOff[1] = Math.max(0, lift - 20);
      }
      const ice = icePath(t);
      if (!ice) return drawHud(ctx, t, false);
      if (ice === 'all') return drawHud(ctx, t, true);
      ctx.save(); ctx.beginPath(); ice(ctx); ctx.clip(); drawHud(ctx, t, true); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1920, 1080); ice(ctx); ctx.clip('evenodd'); drawHud(ctx, t, false); ctx.restore();
    },
  });
})();
