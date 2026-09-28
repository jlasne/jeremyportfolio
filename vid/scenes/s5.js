/* s5: Interface. The reel inverts to ice: a composer types "Make me a showreel." on the 16ths while the dot hops
   into an empty toggle as its knob; "Go all out" switches ON (stretch, overshoot, lime flood, weight 500 -> 800,
   haptic buzz); the pill morphs into the sent blue bubble; a reply bubble pops and its three typing dots hop in a
   rising wave, fuse through crisp metaball necks into one drop that pushes through the bubble, pinches off and
   falls; the camera whips down after it (H5). Every frame is a pure function of t. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', LIME = '#d7ff3a', ICE = '#eaf4fb', INK = '#050b16', BLUE = '#5fa8d3';
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16, S128 = B / 32;
  const TAU = Math.PI * 2, PI = Math.PI, FR = 1 / 60;

  // ---- times (all on the grid) ----
  const T0 = R.at(6, 1);                   // 9.375      H4: ice, dot d 48 at centre
  const T_1E = R.at(6, 1, 2);              // 9.4921875  composer drawn, toggle row rises
  const T_LAND = R.at(6, 1, 3);            // 9.609375   knob lands
  const T_1A = R.at(6, 1, 4);              // 9.7265625
  const T_ON = R.at(6, 2);                 // 9.84375    toggle ON
  const T_SEND = R.at(6, 2, 3);            // 10.078125  SEND
  const T_SENDA = T_SEND - S32;            // 10.01953125 send anticipation
  const T_TAIL = R.at(6, 2, 4);            // 10.1953125 tail pops
  const T_REPLY = R.at(6, 3);              // 10.3125    reply bubble
  const HOPS = [R.at(6, 3, 2), R.at(6, 3, 3), R.at(6, 3, 4)];   // typing dot peaks
  const T_MERGE = HOPS[2];                 // 10.6640625 merge
  const T_DROP = R.at(6, 4);               // 10.78125   drop leaves
  const T_PINCH = T_DROP + S32;            // 10.83984375 pinch
  const T_WHIP = R.at(6, 4, 2);            // 10.8984375 whip down (s6 owns the drop from here)
  const T_END = R.at(6, 4, 3);             // 11.015625

  const w1 = t => E.whip(R.prog(t, T_WHIP, T_END));

  // ---- shared grammar (1.7) ----
  function hop(t, t0, t1, x0, y0, x1, y1, h) {
    const T = t1 - t0, u = R.clamp((t - t0) / T);
    return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - 4 * h * u * (1 - u),
      vx: (x1 - x0) / T, vy: ((y1 - y0) - 4 * h * (1 - 2 * u)) / T };
  }
  const landQ = tau => tau < 0 ? 0 : 1 - R.spring(tau, 500, 14);
  function drawDot(ctx, x, y, d, vx, vy, sx = 1, sy = 1, color = RED, anchorBottom = false, kMax = 1.6, kw = 1) {
    const v = Math.hypot(vx, vy), k = 1 + (Math.min(kMax, 1 + v / 4000) - 1) * kw, a = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, anchorBottom ? y + d / 2 : y);
    ctx.scale(sx, sy);
    if (anchorBottom) ctx.translate(0, -d / 2);
    ctx.rotate(a); ctx.scale(k, 1 / Math.sqrt(k)); ctx.rotate(-a);
    ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, TAU); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  // ---- layout (storyboard 3.5) ----
  const TEXT = 'Make me a showreel.';
  const TX = 432, TY = 883.5, TX2 = 882.5, TY2 = 559.5;   // text measures 605 px (spec 609): centred in the bubble, 60.5 px each side
  const PILL = [372, 800, 1548, 920, 60], BUBBLE = [822, 470, 1548, 602, 44];
  const SEND_X = 1488, SEND_Y = 860, SEND_D = 88;
  const TRACK = [1398, 668, 150, 84, 42];
  const KNOB_OFF = 1440, KNOB_ON = 1506, KNOB_Y = 710, KNOB_D = 64;
  const LABEL = 'Go all out', LABEL_X = 1370, LABEL_Y = 731;
  const REPLY = [372, 650, 648, 782, 44];
  const DOTS_X = [450, 510, 570], DOTS_Y = 716, DOT_R = 15, HOP_H = [10, 18, 26];
  const DROP_R = 26, DROP_X = 510;

  // typing: word k starts on its 16th, the non-space characters inside it follow every 128th
  const WORD_T = [T0, T_1E, T_LAND, T_1A];
  const CHAR_T = [];
  {
    let w = -1, j = 0;
    const chars = Array.from(TEXT);
    for (let i = 0; i < chars.length; i++) {
      if (i === 0 || chars[i] === ' ') { w++; j = 0; }
      CHAR_T.push(chars[i] === ' ' ? null : WORD_T[w] + j++ * S128);
    }
    for (let i = 0; i < chars.length; i++) if (CHAR_T[i] === null) CHAR_T[i] = CHAR_T[i + 1];
  }
  const T_TYPED = CHAR_T[CHAR_T.length - 1];   // 9.84375: the full stop lands on 6.2
  let G = null;                                // glyph layout of TEXT (setup)

  // ---- grid: INK 7%, centre-out draw-on from the dot (1.5) ----
  const VP = [[948, 972], [822, 1098], [798, 1122], [672, 1248], [648, 1272], [522, 1398], [498, 1422], [372, 1548], [348, 1572], [222, 1698], [198, 1722], [72, 1848]];
  const HP = [[528, 552], [392, 688], [368, 712], [232, 848], [208, 872], [72, 1008]];
  const gridF = (t, n) => E.outExpo(R.prog(t, T0 + n * S64, T0 + n * S64 + 0.3515625));
  function drawGrid(ctx, t, alpha = 0.07) {
    const rs = R.rs, dw = Math.max(1, Math.round(1.5 * rs)), lw = dw / rs, off = dw % 2 ? 0.5 / rs : 0;
    const sn = v => Math.round(v * rs) / rs + off;
    ctx.beginPath();
    VP.forEach((pr, n) => {
      const f = gridF(t, n); if (f <= 0.0005) return;
      for (const x of pr) { const X = sn(x); ctx.moveTo(X, 540 - 468 * f); ctx.lineTo(X, 540 + 468 * f); }
    });
    HP.forEach((pr, n) => {
      const f = gridF(t, n); if (f <= 0.0005) return;
      for (const y of pr) { const Y = sn(y); ctx.moveTo(960 - 888 * f, Y); ctx.lineTo(960 + 888 * f, Y); }
    });
    ctx.strokeStyle = R.rgba(INK, alpha); ctx.lineWidth = lw; ctx.lineCap = 'butt';
    ctx.stroke();
  }

  // ---- haptic: a frame-rate buzz decaying over one 16th ----
  function haptic(t) {
    const tau = t - T_ON;
    if (tau < 0 || tau >= S16) return 0;
    return 4 * Math.exp(-25 * tau) * (Math.floor(tau * 60 + 1e-6) % 2 ? -1 : 1);
  }

  // ---- the composer pill -> sent bubble ----
  const morphP = t => R.prog(t, T_SEND, T_REPLY);
  function pillRect(t) {
    const e = E.outBack(morphP(t), 1.6);
    const r = PILL.map((v, i) => R.lerp(v, BUBBLE[i], e));
    r[4] = Math.max(0, Math.min(r[4], (r[3] - r[1]) / 2, (r[2] - r[0]) / 2));
    return r;
  }
  function roundRectPath(ctx, x0, y0, x1, y1, r) { R.roundRect(ctx, x0, y0, x1 - x0, y1 - y0, r); }

  // the stroke draws on from the left: two halves from (372, 860) meeting at (1548, 860)
  function pillDrawOn(ctx, p) {
    const [x0, y0, x1, y1, r] = PILL, cy = (y0 + y1) / 2, L = PI * r / 2 * 2 + (x1 - x0 - 2 * r);
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineCap = 'round';
    R.dashProgress(ctx, L, p);
    ctx.beginPath(); ctx.arc(x0 + r, cy, r, PI, 1.5 * PI); ctx.lineTo(x1 - r, y0); ctx.arc(x1 - r, cy, r, 1.5 * PI, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0 + r, cy, r, PI, 0.5 * PI, true); ctx.lineTo(x1 - r, y1); ctx.arc(x1 - r, cy, r, 0.5 * PI, 0, true); ctx.stroke();
    ctx.setLineDash([]);
  }

  // the chat tail at the bubble's bottom-right corner: a small hook, tip at (x1, y1 + 14) so it never passes the
  // col-10 edge (x1 = 1548 for the whole morph); its base sits inside the corner arc so the union is one shape
  function tailPath(ctx, rect, s) {
    const [, , x1, y1] = rect, ax = x1 - 22, ay = y1 - 8;
    const P = (x, y) => [ax + (x - ax) * s, ay + (y - ay) * s];
    const a = P(x1 - 1, y1 - 46), c1 = P(x1, y1 - 8), tip = P(x1, y1 + 14), c2 = P(x1 - 16, y1 + 9), b = P(x1 - 36, y1 - 3);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(c2[0], c2[1], b[0], b[1]);
    ctx.closePath();
  }

  // the typed text (per glyph, kerning kept) with its caret
  function drawText(ctx, t, tx, ty) {
    R.font(ctx, 64, 'sans', 600);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = INK;
    for (let i = 0; i < G.chars.length; i++) {
      const c = G.chars[i];
      if (c.ch === ' ' || t < CHAR_T[i]) continue;
      const e = E.outCubic(R.prog(t, CHAR_T[i], CHAR_T[i] + 0.06));
      ctx.globalAlpha = e;
      ctx.fillText(c.ch, tx + c.x, ty + 7 * (1 - e));
    }
    ctx.globalAlpha = 1;
  }
  function caretX(t) {
    let x = TX + 5;
    for (let i = 0; i < G.chars.length; i++) {
      const adv = (i + 1 < G.chars.length ? G.chars[i + 1].x : G.width) - G.chars[i].x;
      x += adv * E.outExpo(R.prog(t, CHAR_T[i], CHAR_T[i] + 0.03));
    }
    return x;
  }

  // SEND feedback: while the button is pressed (the send anticipation 32nd) the pill's outline hands over to the
  // BLUE fill, so the outline is gone by 6.2& and never smears into rings during the fast part of the morph
  const fillA = t => E.outQuad(R.prog(t, T_SENDA, T_SEND + 0.16));
  const strokeA = t => 1 - E.outQuad(R.prog(t, T_SENDA, T_SEND));
  const textPos = t => { const e = E.outBack(morphP(t), 1.6); return [R.lerp(TX, TX2, e), R.lerp(TY, TY2, e)]; };
  // the sent bubble as ONE flat path (rect + tail, nonzero union) so its samples can be averaged
  function bubbleShape(ctx, t) {
    const rect = pillRect(t), [x0, y0, x1, y1, r] = rect;
    roundRectPath(ctx, x0, y0, x1, y1, r);
    const tailS = t >= T_TAIL ? E.outBack(R.prog(t, T_TAIL, T_TAIL + S16), 2) : 0;
    if (tailS > 0.001) tailPath(ctx, rect, tailS);
    ctx.fillStyle = R.mix(ICE, BLUE, fillA(t)); ctx.fill();
  }
  // the composer / sent bubble group (drawn above the toggle row)
  function drawComposer(ctx, t, hx) {
    if (t < T_SEND) {
      ctx.save(); ctx.translate(hx, 0);
      const [x0, y0, x1, y1, r] = PILL;
      roundRectPath(ctx, x0, y0, x1, y1, r); ctx.fillStyle = R.mix(ICE, BLUE, fillA(t)); ctx.fill();   // ICE knocks the grid out
      const p = E.outCubic(R.prog(t, T0, T_1E)), sa = strokeA(t);
      if (p < 1) pillDrawOn(ctx, p);
      else if (sa > 0.003) { roundRectPath(ctx, x0, y0, x1, y1, r); ctx.lineWidth = 3; ctx.strokeStyle = R.rgba(INK, sa); ctx.stroke(); }
      drawText(ctx, t, TX, TY);
      // caret: INK 4 x 56, after the last typed glyph; blinks 0.234375 on / off once idle
      const idle = t - T_TYPED;
      if (idle < 0 || Math.floor(idle / 0.234375 + 1e-6) % 2 === 0) {
        ctx.fillStyle = INK; ctx.fillRect(caretX(t), 832, 4, 56);
      }
      ctx.restore();
      return;
    }
    bubbleShape(ctx, t);
    const [px, py] = textPos(t);            // the text rides the bubble: same outBack as the rect
    drawText(ctx, t, px, py);
  }

  // ---- motion blur of the pill -> bubble morph ----
  // shape: n vector samples of the one flat path, averaged ('lighter' at 1/n is an exact average for a single flat
  // shape). text: rendered once, then box-blurred along its motion vector by log-doubling (2^m taps <= 1.25 px
  // apart), which is smooth at any speed for ~2m blits. No blur under 1.5 px of motion.
  const MORPH_SHUTTER = 1 / 90;
  const dev = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function region(x0, y0, x1, y1) {
    const rs = R.rs, bx = dev(Math.floor(x0 * rs), 0, R.rw), by = dev(Math.floor(y0 * rs), 0, R.rh);
    return [bx, by, dev(Math.ceil(x1 * rs), 0, R.rw) - bx, dev(Math.ceil(y1 * rs), 0, R.rh) - by];
  }
  // box blur of layer `src` over region g along (dx, dy) logical px by log-doubling; returns the layer holding it
  // (copies at offsets i/2^m * (dx, dy), i = 0 .. 2^m - 1, so callers pre-shift by half a tap)
  function boxBlur(src, g, dx, dy, names) {
    const rs = R.rs, len = Math.hypot(dx, dy) * rs;
    const m = Math.max(1, Math.ceil(Math.log2(len / 1.25)));
    const n = 2 ** m, sx = dx * rs / n, sy = dy * rs / n;
    let A = src, k = 0;
    const [bx, by, bw, bh] = g;
    for (let j = 0; j < m; j++) {
      const D = R.layer(names[k]); k ^= 1;
      const c = D.ctx, ox = sx * 2 ** j, oy = sy * 2 ** j;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 0.5;
      c.drawImage(A.canvas, bx, by, bw, bh, bx, by, bw, bh);
      c.globalCompositeOperation = 'lighter';
      c.drawImage(A.canvas, bx, by, bw, bh, bx + ox, by + oy, bw, bh);
      A = D;
    }
    return { L: A, step: [dx / n, dy / n] };
  }
  function drawComposerBlurred(ctx, t) {
    const ta = Math.max(T_SEND, t - MORPH_SHUTTER / 2), tb = t + MORPH_SHUTTER / 2;
    const a = pillRect(ta), b = pillRect(tb);
    const disp = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    if (disp < 1.5 || R.quality < 1) { drawComposer(ctx, t, 0); return; }
    // shape
    const n = Math.max(2, Math.min(16, Math.ceil(disp / 1.5)));
    const S = R.layer('s5:ga');
    S.ctx.globalCompositeOperation = 'lighter'; S.ctx.globalAlpha = 1 / n;
    for (let i = 0; i < n; i++) bubbleShape(S.ctx, R.lerp(ta, tb, i / (n - 1)));
    const gs = region(Math.min(a[0], b[0]) - 4, Math.min(a[1], b[1]) - 4, 1560, Math.max(a[3], b[3]) + 24);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (gs[2] > 0 && gs[3] > 0) ctx.drawImage(S.canvas, gs[0], gs[1], gs[2], gs[3], gs[0], gs[1], gs[2], gs[3]);
    ctx.restore();
    // text
    const pa = textPos(ta), pb = textPos(tb), dx = pb[0] - pa[0], dy = pb[1] - pa[1];
    if (Math.hypot(dx, dy) < 1.5) { const p = textPos(t); drawText(ctx, t, p[0], p[1]); return; }
    const T = R.layer('s5:tx');
    const gt = region(Math.min(pa[0], pb[0]) - 8, Math.min(pa[1], pb[1]) - 62, Math.max(pa[0], pb[0]) + G.width + 8, Math.max(pa[1], pb[1]) + 22);
    const m = Math.max(1, Math.ceil(Math.log2(Math.hypot(dx, dy) * R.rs / 1.25))), h = 0.5 / 2 ** m;
    drawText(T.ctx, t, pa[0] + dx * h, pa[1] + dy * h);
    const { L } = boxBlur(T, gt, dx, dy, ['s5:tb0', 's5:tb1']);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (gt[2] > 0 && gt[3] > 0) ctx.drawImage(L.canvas, gt[0], gt[1], gt[2], gt[3], gt[0], gt[1], gt[2], gt[3]);
    ctx.restore();
  }

  // ---- the send button ----
  function drawSend(ctx, t, hx) {
    const tp = T0 + S32;
    if (t < tp) return;
    let s = E.outBack(R.prog(t, tp, tp + S16), 1.7);
    if (t >= T_SENDA) s *= R.lerp(1, 0.86, E.outQuad(R.prog(t, T_SENDA, T_SEND)));
    // the press IS the anticipation: from 0.86 it just collapses (inCubic), drifting up-left after the message
    let drift = 0;
    if (t >= T_SEND) { const p = R.prog(t, T_SEND, T_SEND + 0.08); s = 0.86 * (1 - E.inCubic(p)); drift = 16 * E.outQuad(p); }
    if (s <= 0.002) return;
    ctx.save();
    ctx.translate(SEND_X + hx - drift, SEND_Y - drift); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, 0, SEND_D / 2, 0, TAU); ctx.fillStyle = RED; ctx.fill();
    ctx.strokeStyle = ICE; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(0, -17);
    ctx.moveTo(-13, -4); ctx.lineTo(0, -17); ctx.lineTo(13, -4); ctx.stroke();
    ctx.restore();
  }

  // ---- the toggle row ----
  const onP = t => R.prog(t, T_ON, T_ON + S16);
  // knob anticipation (a press before the slide), released over the first 32nd of the slide
  const knobAnt = t => t < T_ON ? E.inQuad(R.prog(t, T_ON - S32, T_ON)) : 1 - E.outQuad(R.prog(t, T_ON, T_ON + S32));
  function knobState(t) {
    const p = onP(t), ant = knobAnt(t);
    const e = E.outBack(p, 1.55);
    let x = KNOB_OFF + 66 * e - 4 * ant;
    const ring = landQ(t - T_LAND) * (1 - R.prog(t, T_ON - S32, T_ON));
    // stretch peaks at mid-travel (in distance: outBack is front-loaded); on the ~6 px overshoot the knob
    // compresses against the end of the track instead (squash), then relaxes
    const st = Math.sin(PI * R.clamp(e)), ov = Math.max(0, e - 1);
    const sx = (1 + 0.3 * ring) * (1 - 0.1 * ant) * (1 + 0.5 * st) * (1 - 1.6 * ov);
    const sy = (1 - 0.25 * ring) * (1 + 0.05 * ant) * (1 - 0.14 * st) * (1 + 0.8 * ov);
    // keep the squashed / stretched knob inside the track (up to the inside of its 3 px outline)
    const hw = KNOB_D / 2 * sx;
    x = Math.max(x, 1401 + hw); x = Math.min(x, 1544 - hw);
    return { x, y: KNOB_Y, sx, sy };
  }
  function drawToggleRow(ctx, t, hx) {
    if (t < T_1E) return;
    const a = E.outCubic(R.prog(t, T_1E, T_LAND)), dy = 12 * (1 - a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(hx, dy);
    const [tx, ty, tw, th, tr] = TRACK;
    R.roundRect(ctx, tx, ty, tw, th, tr); ctx.fillStyle = ICE; ctx.fill();
    const k = t >= T_LAND ? knobState(t) : null;
    if (t >= T_ON && k) {
      // the flood grows from the knob's own edge (r 32) and trails it across the track over ~4 frames: the spec's
      // outExpo 0 -> 180 in 0.234 s covered the whole track on the first frame after 6.2 (a cut, not a flood)
      const fr = 32 + 118 * E.outCubic(R.prog(t, T_ON, T_ON + 0.17578125));
      if (fr > 0.2) {
        ctx.save(); R.roundRect(ctx, tx, ty, tw, th, tr); ctx.clip();
        ctx.beginPath(); ctx.arc(k.x, k.y, fr, 0, TAU); ctx.fillStyle = LIME; ctx.fill();
        ctx.restore();
      }
    }
    const tick = t >= T_LAND && t < T_LAND + 2 * FR ? 2 : 0;
    R.roundRect(ctx, tx, ty, tw, th, tr); ctx.lineWidth = 3 + tick; ctx.strokeStyle = INK; ctx.stroke();
    // label: weight 500 -> 800, right-aligned at 1370
    const wgt = Math.round(R.lerp(500, 800, E.outCubic(R.prog(t, T_ON, T_ON + 0.234375))) / 10) * 10;
    R.font(ctx, 56, 'sans', wgt); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK;
    ctx.fillText(LABEL, LABEL_X, LABEL_Y);
    ctx.textAlign = 'left';
    if (k) {
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.ellipse(k.x, k.y, KNOB_D / 2 * k.sx, KNOB_D / 2 * k.sy, 0, 0, TAU);
      ctx.fillStyle = RED; ctx.fill();
    }
    ctx.restore();
  }

  // ---- the flying dot: iris centre -> knob ----
  function drawFlyingDot(c, tt) {
    tt = Math.min(tt, T_LAND - 1e-6);
    const h = hop(Math.max(tt, T0), T0, T_LAND, 960, 540, KNOB_OFF, KNOB_Y, 160);
    const u = R.prog(tt, T0, T_LAND), d = R.lerp(48, KNOB_D, E.inOutSine(u));
    const kw = E.outQuad(R.prog(tt, T0, T0 + S32));     // H4: round at 9.375, stretch ramps in
    drawDot(c, h.x, h.y, d, h.vx, h.vy, 1, 1, RED, false, 1.6, kw);
  }

  // ---- metaball neck (Paper.js technique): tangent-point Bezier bridge between two circles ----
  function neck(ctx, x1, y1, r1, x2, y2, r2, v, handle = 2.4) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (r1 < 0.3 || r2 < 0.3 || v <= 0.002 || d <= Math.abs(r1 - r2) + 0.01) return;
    let u1 = 0, u2 = 0;
    if (d < r1 + r2) {
      u1 = Math.acos(R.clamp((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d), -1, 1));
      u2 = Math.acos(R.clamp((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d), -1, 1));
    }
    const ab = Math.atan2(y2 - y1, x2 - x1), spread = Math.acos(R.clamp((r1 - r2) / d, -1, 1));
    const a1 = ab + u1 + (spread - u1) * v, a2 = ab - u1 - (spread - u1) * v;
    const a3 = ab + PI - u2 - (PI - u2 - spread) * v, a4 = ab - PI + u2 + (PI - u2 - spread) * v;
    const P = (x, y, a, r) => [x + Math.cos(a) * r, y + Math.sin(a) * r];
    const p1 = P(x1, y1, a1, r1), p2 = P(x1, y1, a2, r1), p3 = P(x2, y2, a3, r2), p4 = P(x2, y2, a4, r2);
    const tot = r1 + r2;
    const d2 = Math.min(v * handle, Math.hypot(p1[0] - p3[0], p1[1] - p3[1]) / tot) * Math.min(1, d * 2 / tot);
    const h1 = P(p1[0], p1[1], a1 - PI / 2, r1 * d2), h2 = P(p2[0], p2[1], a2 + PI / 2, r1 * d2);
    const h3 = P(p3[0], p3[1], a3 + PI / 2, r2 * d2), h4 = P(p4[0], p4[1], a4 - PI / 2, r2 * d2);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.bezierCurveTo(h1[0], h1[1], h3[0], h3[1], p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.bezierCurveTo(h4[0], h4[1], h2[0], h2[1], p2[0], p2[1]);
    ctx.closePath(); ctx.fill();
  }

  // ---- typing dots, merge, drop ----
  // merge: the outer dots are pulled into neck range at once (surface tension), then creep in while they drain
  // into the centre, so the goo reads on 4 frames (f641-f644) and the disc closes on f645-f646.
  // Distance d(p) = 60 (1 - p)(1 - 0.45 outCubic(p / 0.3)); outer r = 15 (1 - p^2.5); centre area kept:
  // r_c^2 = 225 + 2 (225 - r^2), so r_c = 26 at the end (3.5). Centre squash 1.2 x 0.8 builds over the last 32nd
  // (anticipation of the drop's launch, anchored at its bottom) and hands over to dropShape's release.
  function mergeState(t) {
    const p = R.prog(t, T_MERGE, T_DROP);
    const d = 60 * (1 - p) * (1 - 0.45 * E.outCubic(Math.min(1, p / 0.3)));
    const ro = DOT_R * (1 - Math.pow(p, 2.5)), rc = Math.sqrt(675 - 2 * ro * ro);
    const h3 = dotHop(t, 2);
    const sq = E.inQuad(R.prog(t, T_DROP - S32, T_DROP));
    return { xs: [510 - d, 510, 510 + d], ys: [DOTS_Y, DOTS_Y, DOTS_Y + h3.dy], rr: [ro, rc, ro], rc,
      sx: 1 + 0.2 * sq, sy: 1 - 0.2 * sq };
  }
  function dotHop(t, k) {
    const u = R.prog(t, HOPS[k] - S32, HOPS[k] + S32);
    if (u <= 0 || u >= 1) return { dy: 0, vy: 0 };
    return { dy: -HOP_H[k] * 4 * u * (1 - u), vy: -HOP_H[k] * 4 * (1 - 2 * u) / S16 };
  }
  // the drop's centre: launched by the merge on 6.4, caught by the bubble's membrane, pinched, then free fall.
  // Pre-pinch: cubic Hermite 716 -> 800 with v 2400 -> 600 px/s, so position AND velocity are continuous at
  // the pinch with the fall law y = 800 + 600 tau + 2000 tau^2 (which hands over (510, 842), v 834 at 6.4e).
  const HV0 = 3000, HV1 = 600;
  function dropY(t) {
    if (t >= T_PINCH) { const tau = t - T_PINCH; return 800 + 600 * tau + 2000 * tau * tau; }
    const T = T_PINCH - T_DROP, s = R.clamp((t - T_DROP) / T), s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * 716 + (s3 - 2 * s2 + s) * T * HV0 + (-2 * s3 + 3 * s2) * 800 + (s3 - s2) * T * HV1;
  }
  function dropShape(t) {
    const q0 = 1 - E.outQuad(R.prog(t, T_DROP, T_DROP + S64));         // merge squash 1.2 x 0.8 releases in a 64th
    const k = R.lerp(1, 1.25, E.inOutSine(R.prog(t, T_DROP + S64, T_PINCH)));
    const sx = (1 + 0.2 * q0) / Math.sqrt(k), sy = (1 - 0.2 * q0) * k;
    const tau = t - T_DROP, fade = 1 - E.inOutSine(R.prog(t, T_PINCH, T_WHIP - FR));
    const env = 0.08 * Math.exp(-9 * tau) * fade;
    // release wobble: the snap kicks mode 2 (taller, thinner) and it rings out before H5
    const tp = t - T_PINCH, kick = tp < 0 ? 0 : 0.07 * Math.exp(-14 * tp) * Math.sin(40 * tp + 0.9) * fade;
    return { x: DROP_X, y: dropY(t), rx: DROP_R * sx, ry: DROP_R * sy,
      a2: env * Math.sin(52 * tau) - kick, a3: env * Math.sin(78 * tau + 0.6) };
  }
  // the wobbling drop outline, grown by `g` px (the ink skin uses the same outline)
  function dropPath(ctx, d, g = 0) {
    const N = 48, pts = [];
    for (let i = 0; i < N; i++) {
      const th = -PI / 2 + i / N * TAU;
      const f = 1 + d.a2 * Math.cos(2 * th) + d.a3 * Math.cos(3 * (th - PI / 2));
      pts.push([d.x + Math.cos(th) * (d.rx * f + g), d.y + Math.sin(th) * (d.ry * f + g)]);
    }
    R.traceSmooth(ctx, pts, true);
  }
  // bubble membrane. Before the pinch the bubble's bottom edge is a sack that holds the drop: a Gaussian sag
  // (sigma 40) plus an INK skin 4 px round the drop, joined by a metaball neck whose strength runs out exactly on
  // the pinch (the waist narrows, then snaps). On the pinch the sag springs back (landQ) and the skin left on the
  // drop retracts in ~2 frames, so the drop is pure red again well before H5.
  const SKIN = 4, RN = 20;
  const sagRaw = t => { const d = dropShape(t); return R.clamp(0.5 * (d.y + d.ry + SKIN - REPLY[3]), 0, 40); };
  const SAG_P = sagRaw(T_PINCH - 1e-9);
  function sagA(t) {
    if (t < T_DROP) return 0;
    if (t < T_PINCH) return sagRaw(t);
    // landQ's spring (500, 14), released with the membrane's stored tension as initial velocity: a snapped
    // skin recoils at once instead of easing off from rest, so the release shows on the first post-pinch frame
    const tp = t - T_PINCH;
    return SAG_P * (1 - R.spring(tp, 500, 14, 1, 40));
  }
  // the skin stretches thin as the drop pulls through (4 -> 1.5 px), then is gone within a frame of the pinch
  const skinT = t => t < T_PINCH ? R.lerp(SKIN, 1.5, E.inQuad(R.prog(t, T_DROP + S64, T_PINCH)))
    : 1.5 * (1 - E.outQuad(R.prog(t, T_PINCH, T_PINCH + 0.02)));
  function drawSack(ctx, t) {
    if (t < T_DROP || t >= T_WHIP) return;
    const d = dropShape(t), s = skinT(t);
    ctx.fillStyle = INK;
    if (s > 0.05) { dropPath(ctx, d, s); ctx.fill(); }
    if (t < T_PINCH) {
      const cy = REPLY[3] + sagA(t) - RN, rs = (d.rx + d.ry) / 2 + SKIN;
      const v = 0.6 * (1 - E.inQuad(R.prog(t, T_DROP + S64, T_PINCH)));
      ctx.beginPath(); ctx.arc(DROP_X, cy, RN, 0, TAU); ctx.fill();
      neck(ctx, DROP_X, cy, RN, d.x, d.y, rs, v);
    }
  }

  function drawReply(ctx, t) {
    if (t < T_REPLY) return;
    const s = E.outBack(R.prog(t, T_REPLY, T_REPLY + S16), 2);
    if (s <= 0.002) return;
    const [x0, y0, x1, y1, r] = REPLY;
    ctx.save();
    ctx.translate(x0, y1); ctx.scale(s, s); ctx.translate(-x0, -y1);
    // bubble with the membrane bulge in its bottom edge
    const A = sagA(t), e0 = Math.exp(-(94 * 94) / 3200);
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0); ctx.arc(x1 - r, y0 + r, r, -PI / 2, 0);
    ctx.lineTo(x1, y1 - r); ctx.arc(x1 - r, y1 - r, r, 0, PI / 2);
    if (Math.abs(A) > 0.05) {
      for (let x = x1 - r; x >= x0 + r; x -= 3) {
        const g = Math.max(0, (Math.exp(-((x - DROP_X) ** 2) / 3200) - e0) / (1 - e0));
        ctx.lineTo(x, y1 + A * g);
      }
    }
    ctx.lineTo(x0 + r, y1); ctx.arc(x0 + r, y1 - r, r, PI / 2, PI);
    ctx.lineTo(x0, y0 + r); ctx.arc(x0 + r, y0 + r, r, PI, 1.5 * PI);
    ctx.closePath();
    ctx.fillStyle = INK; ctx.fill();
    drawSack(ctx, t);

    ctx.fillStyle = RED;
    if (t < T_MERGE) {
      for (let k = 0; k < 3; k++) {
        const h = dotHop(t, k);
        const q = k < 2 ? landQ(t - (HOPS[k] + S32)) : 0;
        // y is the dot's centre (drawDot); anchorBottom only moves the squash pivot to the dot's bottom
        drawDot(ctx, DOTS_X[k], DOTS_Y + h.dy, 2 * DOT_R, 0, h.vy, 1 + 0.2 * q, 1 - 0.15 * q, RED, true);
      }
    } else if (t < T_DROP) {
      const mg = mergeState(t), ringW = 1 - R.prog(t, T_MERGE, T_MERGE + S32);
      const { xs, ys, rr, rc } = mg;
      // rings of dots 1 and 2 fade out over the first 32nd of the merge (combining rule, 1.7)
      for (let k = 0; k < 3; k++) {
        const q = k < 2 ? landQ(t - (HOPS[k] + S32)) * ringW : 0;
        if (rr[k] < 0.2) continue;
        const sxk = (1 + 0.2 * q) * (k === 1 ? mg.sx : 1), syk = (1 - 0.15 * q) * (k === 1 ? mg.sy : 1);
        ctx.beginPath(); ctx.ellipse(xs[k], ys[k] + rr[k] * (1 - syk), rr[k] * sxk, rr[k] * syk, 0, 0, TAU); ctx.fill();
      }
      for (const k of [0, 2]) {
        const d = Math.hypot(xs[k] - 510, ys[k] - DOTS_Y), maxD = 2.4 * (rr[k] + rc) / 2;   // 3.5: d < 2.4 * mean r
        if (d >= maxD || rr[k] < 1) continue;
        // never a hairline: the neck appears at v 0.3 (surface tension snaps it in) and thickens to 0.55
        const v = 0.3 + 0.25 * R.smoothstep(maxD, rr[k] + rc * 0.5, d);
        neck(ctx, 510, DOTS_Y, rc, xs[k], ys[k], rr[k], v);
      }
    }
    ctx.restore();
  }

  // the merged drop: squash / stretch ellipse with two decaying radius modes; specular from 6.4
  function drawDrop(ctx, t) {
    const d = dropShape(t);
    dropPath(ctx, d);
    ctx.fillStyle = RED; ctx.fill();
    // the pinch leaves a teardrop point on the drop's top that pulls back in (gone by f653, before H5)
    const tip = 14 * (1 - E.outQuad(R.prog(t, T_PINCH, T_PINCH + 0.04)));
    if (t >= T_PINCH && tip > 0.3) {
      const ty = d.y - d.ry - tip;
      neck(ctx, d.x, d.y, (d.rx + d.ry) / 2 * 0.96, d.x, ty, 1.6, 0.45);
      ctx.beginPath(); ctx.arc(d.x, ty, 1.6, 0, TAU); ctx.fill();
    }
    specArc(ctx, d.x, d.y, d.rx, d.ry, 0.6);
  }
  // 2 px ICE arc, upper left, 6 px inside the edge of an axis-aligned ellipse (same as s6)
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

  // ---- the world (everything but the ice field and the flying dot) ----
  function drawUI(ctx, t, grid = true) {
    const hx = haptic(t);
    if (grid) drawGrid(ctx, t);
    drawToggleRow(ctx, t, hx);
    drawReply(ctx, t);
    // the composer group; motion-blurred while the morph moves (drawComposerBlurred is sharp when it is slow)
    if (t >= T_SEND && t < T_REPLY + MORPH_SHUTTER) drawComposerBlurred(ctx, t);
    else drawComposer(ctx, t, hx);
    drawSend(ctx, t, hx);
    if (t >= T_DROP && t < T_WHIP) drawDrop(ctx, t);
  }

  // ---- the whip down ----
  // Exposure over a 1/60 s shutter is a vertical box from offset o1 (shutter end, highest) to o0 (start).
  // Ice field: its bottom edge as an exact coverage gradient. Grid: analytic box blur (verticals become
  // trapezoid ramps, horizontals become faint bands). UI: rendered once into a band layer and box-blurred by
  // log-doubling (2^m taps <= 1.25 px apart, ~2m blits), so the whip reads as a smear, never as stepped copies.
  const UI_Y0 = 440, UI_Y1 = 870, UI_X0 = 356, UI_X1 = 1572;
  function drawGridWhip(ctx, lo, hi) {
    const rs = R.rs, dw = Math.max(1, Math.round(1.5 * rs)), lw = dw / rs, off = dw % 2 ? 0.5 / rs : 0;
    const sn = v => Math.round(v * rs) / rs + off, K = hi - lo, col = a => R.rgba(INK, 0.07 * a);
    if (K < 0.75) {
      ctx.save(); ctx.translate(0, Math.round(lo * rs) / rs);
      drawGrid(ctx, T_WHIP); ctx.restore(); return;
    }
    const Lv = 936, r = Math.min(K, Lv), peak = r / K, ya = 72 + lo, yd = 1008 + hi, span = yd - ya;
    const g = ctx.createLinearGradient(0, ya, 0, yd);
    g.addColorStop(0, col(0)); g.addColorStop(r / span, col(peak)); g.addColorStop(1 - r / span, col(peak)); g.addColorStop(1, col(0));
    ctx.fillStyle = g;
    for (const pr of VP) for (const x of pr) ctx.fillRect(sn(x) - lw / 2, ya, lw, span);
    ctx.fillStyle = col(lw / (K + lw));
    for (const pr of HP) for (const y of pr) ctx.fillRect(72, y + lo - lw / 2, 1776, K + lw);
  }
  function drawWhip(ctx, t) {
    const NS = 24, edges = [];
    for (let i = 0; i < NS; i++) edges.push(1080 * (1 - w1(t - FR * (i / (NS - 1) - 0.5))));
    edges.sort((a, b) => a - b);
    const e0 = Math.floor(edges[0] * R.rs) / R.rs, e1 = Math.max(e0, edges[NS - 1]);   // split on a device row: no AA seam
    ctx.fillStyle = ICE;
    if (e0 > 0) ctx.fillRect(0, 0, 1920, Math.min(1080, e0));
    if (e1 - e0 > 0.5 && e0 < 1080) {
      const g = ctx.createLinearGradient(0, e0, 0, e1);
      for (let i = 0; i < NS; i++) g.addColorStop(R.clamp((edges[i] - e0) / (e1 - e0)), R.rgba(ICE, 1 - i / (NS - 1)));
      ctx.fillStyle = g; ctx.fillRect(0, e0, 1920, Math.min(1080, e1) - e0);
    }
    const o0 = -1080 * w1(t - FR / 2), o1 = -1080 * w1(t + FR / 2), K = o0 - o1;   // o1 <= o0
    drawGridWhip(ctx, o1, o0);
    // the UI band, drawn once with its top at layer row 0 so the smear has room below it
    const L = R.layer('s5:ui'), rs = R.rs;
    L.ctx.translate(0, -UI_Y0);
    drawUI(L.ctx, t, false);
    if (K * rs < 1.5 || R.quality < 1) {
      const o = -1080 * w1(t);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas, 0, Math.round((o + UI_Y0) * rs)); ctx.restore();
      return;
    }
    const g = region(UI_X0, 0, UI_X1, UI_Y1 - UI_Y0 + K + 2);
    const { L: B, step } = boxBlur(L, g, 0, K, ['s5:wa', 's5:wb']);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dy = (UI_Y0 + o1 + step[1] / 2) * rs;
    ctx.drawImage(B.canvas, g[0], g[1], g[2], g[3], g[0], g[1] + dy, g[2], g[3]);
    ctx.restore();
  }

  Reel.scene({
    id: 's5', name: 'Interface', start: T0, end: T_END, layer: 1,
    setup(R) {
      const c = document.createElement('canvas').getContext('2d');
      R.font(c, 64, 'sans', 600);
      G = R.glyphs(c, TEXT, 0);
      // warm the offscreen layers once so the first morph / whip frame does not pay for their allocation
      for (const n of ['s5:ga', 's5:tx', 's5:tb0', 's5:tb1', 's5:ui', 's5:wa', 's5:wb', 's5:mb']) { const L = R.layer(n); L.ctx.fillRect(0, 0, 1, 1); L.ctx.drawImage(L.canvas, 0, 0, 1, 1, 0, 0, 1, 1); }
    },
    draw(ctx, t) {
      if (t < T_WHIP) {
        const f = R.fx;
        f.bloom = 0; f.threshold = 0.8; f.vignette = 0.12; f.grain = 0.03;
      }
      if (t >= T_WHIP) { drawWhip(ctx, t); return; }
      ctx.fillStyle = ICE; ctx.fillRect(0, 0, 1920, 1080);
      drawUI(ctx, t);
      if (t < T_LAND) R.motionBlur(ctx, t, drawFlyingDot, { samples: 20, shutter: FR, name: 's5:mb' });
    },
  });
})();
