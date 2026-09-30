/* s4: four apps. The drop lights the hushed picture; four cards open by iris onto i dare you, Kaught and the two Soon tiles; a spotlight
   walks along them (2.5 / 2.5 / 1 beats): the letters of IDY hop, a gust of leaves blows through Kaught, the two question marks erase and
   redraw; the labels sink, the four tiles shrink their icons and wipe into the list's hover plate, and the last question mark's dot flies
   to the first row's bullet. Every frame is a pure function of t. Owns R.fx from 5.625 to 9.375. */
(() => {
  const R = Reel, E = R.ease;
  R.preload({ fox: '/vid/assets/kaught-512.png' });

  const B = R.BEAT, S16 = B / 4, S32 = B / 8, S64 = B / 16;
  const ICE = '#eaf4fb', BLUE = '#5fa8d3', INK = '#050b16';
  const TAU = R.TAU;
  const q = (tau, k = 320, c = 15) => tau < 0 ? 0 : 1 - R.spring(tau, k, c);           // impact ring: 1 at contact, rings to 0

  /* ---- times ---- */
  const T_DROP = R.at(4, 1);                                                             // 5.625
  const RV = [R.at(4, 1), R.at(4, 1, 2), R.at(4, 1, 3), R.at(4, 1, 4)];                  // reveals 5.625 5.7422 5.8594 5.9766
  const SL = [[R.at(4, 2), R.at(4, 4, 3)], [R.at(4, 4, 3), R.at(5, 3)], [R.at(5, 3), R.at(5, 3) + B], [R.at(5, 3), R.at(5, 3) + B]];   // spotlights
  const T_CLAP = SL[0][0], T_BASS = SL[1][0], T_FMAJ = SL[2][0];
  const T_MERGE = R.at(5, 4, 2), T_DOT = R.at(5, 4, 3), T_LSINK = R.at(5, 4) - S32;      // 9.0234 9.1406 8.8477
  const T_MEND = 562 / 60;                                                               // last frame of the scene (t 9.36667): m = 1
  const T_END = R.at(6, 1);

  /* ---- layout ---- */
  const XS = [300, 740, 1180, 1620], YC = 450, T = 320, RAD = .2237 * T;
  const BASE = ['#f78a1a', '#487041', '#070a12', '#070a12'];
  const RING = ['#FFA51F', '#78BE5A', ICE, ICE];
  const LABELS = ['i dare you', 'Kaught', 'Soon', 'Soon'];

  // rounded rect with four radii [tl, tr, br, bl]. Does NOT call beginPath.
  function rr4(ctx, x, y, w, h, r) {
    const [a, b, c, d] = r.map(v => Math.max(0, Math.min(v, w / 2, h / 2)));
    ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); if (b) ctx.arcTo(x + w, y, x + w, y + b, b); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c); if (c) ctx.arcTo(x + w, y + h, x + w - c, y + h, c); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + d, y + h); if (d) ctx.arcTo(x, y + h, x, y + h - d, d); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + a); if (a) ctx.arcTo(x, y, x + a, y, a); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  // a flat shape blurred as a white coverage mask, coloured afterwards (dark or translucent colours cannot go through R.motionBlur in 8 bits)
  function maskBlur(ctx, t, draw, colour, { samples = 10, subs = 2, shutter, name }) {
    const L = R.layer(name), c = L.ctx, gap = shutter / (samples - 1);
    if (R.quality < 1 || shutter < .0004) { c.save(); c.fillStyle = '#fff'; draw(c, t); c.restore(); }      // slow devices / no smear left: one crisp draw
    else {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < samples; i++) for (let j = 0; j < subs; j++) {
        const tt = t - shutter * (i / (samples - 1) - .5) + gap * ((j + .5) / subs - .5);
        c.save(); c.globalAlpha = 1 / (samples * subs); c.fillStyle = '#fff'; draw(c, tt); c.restore();
      }
    }
    c.globalCompositeOperation = 'source-in'; c.fillStyle = colour; c.fillRect(0, 0, 1920, 1080);
    c.globalCompositeOperation = 'source-over';
    R.blit(ctx, L);
  }

  /* ---- the pre-blurred card shadow (built once, in setup) ---- */
  let shadow = null;
  function buildShadow() {
    const c = document.createElement('canvas'); c.width = 440; c.height = 440;
    const x = c.getContext('2d');
    x.shadowOffsetX = -1000; x.shadowBlur = 44; x.shadowColor = 'rgba(3,8,20,.45)'; x.fillStyle = '#000';
    R.roundRect(x, 220 + 1000 - 160, 220 - 160, 320, 320, 71.6); x.fill();
    return c;
  }
  function drawShadow(ctx, cx, cy, s, a) {
    if (!shadow || a <= .002) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.drawImage(shadow, cx - 220 * s, cy + 20 * s - 220 * s, 440 * s, 440 * s);
    ctx.restore();
  }

  /* ---- focus, merge, dimming ---- */
  const foc = (i, t) => {
    const [a, b] = SL[i];
    return t < a ? 0 : R.spring(t - a, 260, 19) * (1 - E.outQuad(R.prog(t, b - S16, b)));
  };
  const SOON_DIM = .5;                                   // the two Soon tiles take half the dimming: their question marks must stay waiting, not disabled
  const mergeM = t => E.inOutCubic(R.prog(t, T_MERGE, T_MEND));
  const dimAlpha = (t, f1, fi, m) =>
    (.18 + .12 * Math.min(1, f1)) * Math.max(0, 1 - fi) * E.outQuad(R.prog(t, T_CLAP, T_CLAP + .1171875)) * (1 - m);

  /* ---- IDY: letters hop I, D, Y; all three hop together, smaller, on 4.3 ---- */
  function idyLetters(t) {
    const H = 26 * 192 / 320, o = {};
    ['I', 'D', 'Y'].forEach((k, j) => {
      const a = T_CLAP + j * S16, u = R.prog(t, a, a + .234), s = Math.sin(Math.PI * u);
      let dy = 0, sx = 1, sy = 1;
      if (t >= a && u < 1) { dy = -H * 4 * u * (1 - u); sy = 1 + .06 * s; sx = 1 - .04 * s; }      // stretch in the air
      const l = q(t - (a + .234), 320, 15); if (l) { sy *= 1 - .18 * l; sx *= 1 + .12 * l; }        // squash on landing
      const b = R.at(4, 3), ub = R.prog(t, b, b + .176);
      if (t >= b && ub < 1) dy += -H * .5 * 4 * ub * (1 - ub);                                      // the shared hop on 4.3
      const l2 = q(t - (b + .176), 320, 15); if (l2) { sy *= 1 - .10 * l2; sx *= 1 + .07 * l2; }
      o[k] = { dy, sx, sy };
    });
    return o;
  }

  /* ---- Soon: the question mark (hook + dot) that draws itself, erases and redraws ---- */
  const HOOK = new Path2D('M188 200a68 68 0 1 1 100 60c-22 12-32 26-32 50');
  function soonState(i, t) {
    const rv = RV[i], e0 = R.at(5, 3) + (i - 2) * S16;
    const fall = (d0, dur) => {                                    // the dot drops from the hook's tail, lands with a squash
      if (t < d0) return null;
      const u = R.prog(t, d0, d0 + dur), l = q(t - (d0 + dur), 500, 16);
      return { dy: -70 * (1 - E.inQuad(u)), sc: 1, sx: 1 + .35 * l, sy: 1 - .30 * l };
    };
    if (t < e0) return { hook: E.outCubic(R.prog(t, rv + S32, rv + 2 * S16)), dot: fall(rv + 2 * S16, S16) };
    const r0 = e0 + S32, ed = E.inQuad(R.prog(t, e0, r0));
    if (t < r0) return { hook: 1 - ed, dot: { dy: 0, sc: 1 - ed, sx: 1, sy: 1 } };
    return { hook: E.outCubic(R.prog(t, r0, r0 + S16)), dot: fall(r0 + S16, S32) };
  }
  function soonGlyph(c, i, t, noDot) {
    const st = soonState(i, t);
    c.save(); c.scale(T / 512, T / 512); c.translate(-256, -256);
    if (st.hook > .004) {
      c.strokeStyle = ICE; c.lineWidth = 40 * Math.min(1, st.hook / .06); c.lineCap = 'round'; c.lineJoin = 'round';   // a zero-length round dash would paint a 40 px dot: the stroke slims to nothing instead
      R.dashProgress(c, 350.18, st.hook); c.stroke(HOOK); c.setLineDash([]);
    }
    if (!noDot && st.dot && st.dot.sc > .003) {
      const d = st.dot;
      c.translate(256, 404 + d.dy); c.scale(d.sx, d.sy);                  // anchored at the dot's bottom
      c.fillStyle = ICE; c.beginPath(); c.arc(0, -24, 24 * d.sc, 0, TAU); c.fill();
    }
    c.restore();
  }

  /* ---- the icon of tile i, centred at the origin, T px wide ---- */
  function iconContent(c, i, t, noDot) {
    if (i === 0) Reel.drawIdy(c, 0, 0, T, { letters: idyLetters(t) });
    else if (i === 1) { c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; R.drawIcon(c, 'fox', 0, 0, T); c.restore(); }
    else soonGlyph(c, i, t, noDot);
  }
  const ringStroke = (c, x, y, w, h, r, a) => {                          // the Soon ring: 3 px, inset 1.5 px
    c.beginPath(); rr4(c, x + 1.5, y + 1.5, w - 3, h - 3, r.map(v => Math.max(0, v - 1.5)));
    c.strokeStyle = `rgba(234,244,251,${(.30 * a).toFixed(3)})`; c.lineWidth = 3; c.stroke();
  };

  /* ---- a tile before the merge ---- */
  function drawTile(ctx, i, t, f, f1) {
    const pop = 1 + .10 * q(t - RV[i], 320, 15);
    const s = pop * (1 + .12 * f), cy = YC - 14 * f;
    const rot = i === 1 ? f * .035 * Math.sin(TAU * (t - T_BASS) / .9375) : 0;
    const iris = 226 * E.outCubic(R.prog(t, RV[i], RV[i] + .176)), open = t >= RV[i] + .176;
    ctx.save();
    ctx.translate(XS[i], cy); if (rot) ctx.rotate(rot); ctx.scale(s, s);
    if (i < 2) {
      if (!open) { ctx.fillStyle = BASE[i]; ctx.beginPath(); rr4(ctx, -T / 2, -T / 2, T, T, [RAD, RAD, RAD, RAD]); ctx.fill(); }
      if (iris > .5) {
        ctx.save();
        if (!open) { ctx.beginPath(); ctx.arc(0, 0, iris, 0, TAU); ctx.clip(); }
        iconContent(ctx, i, t, false);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = BASE[i]; ctx.beginPath(); rr4(ctx, -T / 2, -T / 2, T, T, [RAD, RAD, RAD, RAD]); ctx.fill();
      if (t >= RV[i] + S32) iconContent(ctx, i, t, false);
      ringStroke(ctx, -T / 2, -T / 2, T, T, [RAD, RAD, RAD, RAD], 1);
    }
    const da = dimAlpha(t, f1, f, 0) * (i >= 2 ? SOON_DIM : 1);
    if (da > .002) { ctx.fillStyle = `rgba(5,11,22,${da.toFixed(3)})`; ctx.beginPath(); rr4(ctx, -T / 2, -T / 2, T, T, [RAD, RAD, RAD, RAD]); ctx.fill(); }
    ctx.restore();
    return { s, cy };
  }

  /* ---- the merge: four opaque slabs become the plate ---- */
  const PLATE = [140, 299, 1640, 322];
  function slab(i, m) {                                                  // slice i of the merge at m: rect and the four radii
    const x0 = R.lerp(XS[i] - 160, 140 + 410 * i, m), x1 = R.lerp(XS[i] + 160, 140 + 410 * (i + 1), m);
    const y0 = R.lerp(290, 299, m), y1 = R.lerp(610, 621, m);
    const ro = R.lerp(RAD, 67, m), ri = R.lerp(RAD, 0, m);
    return { x0, x1, y0, y1, radii: [i === 0 ? ro : ri, i === 3 ? ro : ri, i === 3 ? ro : ri, i === 0 ? ro : ri] };
  }
  const iconScale = (i, m) => 1 - E.inBack(R.prog(m, .04 * (3 - i), .5 + .04 * (3 - i)), 1.2);
  function drawPlate(ctx, borderA) {
    ctx.beginPath(); rr4(ctx, PLATE[0], PLATE[1], PLATE[2], PLATE[3], [67, 67, 67, 67]);
    ctx.fillStyle = 'rgba(234,244,251,.10)'; ctx.fill();
    ctx.strokeStyle = `rgba(234,244,251,${(.16 * borderA).toFixed(3)})`; ctx.lineWidth = 3; ctx.stroke();
  }
  function drawMerge(ctx, t, f1) {
    const m = mergeM(t);
    if (m >= .999) { drawPlate(ctx, 1); return; }
    const edge = R.lerp(100, 1860, R.prog(m, .40, 1));      // m is already an inOutCubic of time: one ease, so the wipe is seen crossing the row (about 10 frames)
    for (let i = 0; i < 4; i++) drawShadow(ctx, XS[i], YC, 1, .40 * (1 - R.prog(m, 0, .4)));
    const geo = [0, 1, 2, 3].map(i => slab(i, m));
    // the plate-style fill (ICE .10) behind the wipe, as ONE path so abutting slabs never show a seam; 40 px feather
    if (edge + 20 > 140) {
      const g = ctx.createLinearGradient(edge - 20, 0, edge + 20, 0);
      g.addColorStop(0, 'rgba(234,244,251,.10)'); g.addColorStop(1, 'rgba(234,244,251,0)');
      ctx.beginPath(); for (const o of geo) rr4(ctx, o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0, o.radii);
      ctx.fillStyle = g; ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const { x0, x1, y0, y1, radii } = geo[i];
      ctx.save();
      ctx.beginPath(); rr4(ctx, x0, y0, x1 - x0, y1 - y0, radii); ctx.clip();
      if (edge - 20 < x1) {                               // slab colour, opaque until the wipe reaches it
        const g = ctx.createLinearGradient(edge - 20, 0, edge + 20, 0);
        g.addColorStop(0, R.rgba(BASE[i], 0)); g.addColorStop(1, R.rgba(BASE[i], 1));
        ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      // the icon shrinks (opaque, right to left) about the centre of its own slab, so it stays centred while the slab widens; it never fades
      const sc = iconScale(i, m);
      if (sc > .003) {
        ctx.save(); ctx.translate((x0 + x1) / 2, (y0 + y1) / 2); ctx.scale(sc, sc);
        iconContent(ctx, i, t, i === 3 && t >= T_DOT);
        ctx.restore();
      }
      const da = dimAlpha(t, f1, 0, m) * (i >= 2 ? SOON_DIM : 1);
      if (da > .002) { ctx.fillStyle = `rgba(5,11,22,${da.toFixed(3)})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      if (i >= 2) { const a = 1 - R.prog(m, 0, .55); if (a > .004) ringStroke(ctx, x0, y0, x1 - x0, y1 - y0, radii, a); }
      ctx.restore();
    }
    // the plate's border grows in over the last frames along the OUTER edges only (no seams between slabs)
    const ba = R.prog(m, .85, 1);
    if (ba > .004) {
      for (let i = 0; i < 4; i++) {
        const { x0, x1, y0, y1, radii } = slab(i, m);
        ctx.save();
        ctx.beginPath(); ctx.rect(i > 0 ? x0 + 1.5 : 0, 0, (i < 3 ? x1 - 1.5 : 1920) - (i > 0 ? x0 + 1.5 : 0), 1080); ctx.clip();
        ctx.beginPath(); rr4(ctx, x0, y0, x1 - x0, y1 - y0, radii);
        ctx.strokeStyle = `rgba(234,244,251,${(.16 * ba).toFixed(3)})`; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* ---- the dot: leaves its tile, flies along a hop, lands as the first bullet ---- */
  // where the dot sits inside its own (shrinking, re-centred) icon when it detaches: continuous with the merge, whatever the slab does
  const M_DOT = mergeM(T_DOT), S_DOT = slab(3, M_DOT), SC_DOT = iconScale(3, M_DOT);
  const P0 = [(S_DOT.x0 + S_DOT.x1) / 2, (S_DOT.y0 + S_DOT.y1) / 2 + 77.5 * SC_DOT], P1 = [256, 407], HOP_H = 90;
  const FLY = T_MEND - T_DOT;
  const dotU = t => R.prog(t, T_DOT, T_MEND);                            // linear: radius, alpha, shutter and wake schedules
  // the position rides an inOutSine of u (it leaves the icon gently, is fastest mid-flight, and settles into the bullet); the arc is the same parabola
  function dotPos(t) {
    const u = dotU(t), ue = E.inOutSine(u), dudt = u > 0 && u < 1 ? Math.PI / 2 * Math.sin(Math.PI * u) / FLY : 0;
    const dx = P1[0] - P0[0], dy = P1[1] - P0[1];
    return { x: P0[0] + dx * ue, y: P0[1] + dy * ue - 4 * HOP_H * ue * (1 - ue),
             vx: dx * dudt, vy: (dy - 4 * HOP_H * (1 - 2 * ue)) * dudt };
  }
  const dotRad = u => u > .8 ? R.lerp(22, 14.5, E.inOutQuad(R.prog(u, .8, 1))) : R.lerp(15 * SC_DOT, 22, E.outQuad(R.prog(u, 0, .25)));
  const dotStretch = tt => {
    const p = dotPos(tt), u = dotU(tt), sp = Math.hypot(p.vx, p.vy);
    return 1 + (Math.min(2.2, 1 + sp / 2500) - 1) * (1 - E.inQuad(R.prog(u, .85, 1)));
  };
  function drawWake(ctx, t) {
    const u = dotU(t), fade = 1 - E.inQuad(R.prog(u, .8, 1));
    if (t <= T_DOT + 1 / 120 || fade <= .01) return;
    const p = dotPos(t), sp = Math.hypot(p.vx, p.vy), span = Math.min(6 / 60, 420 / sp), r = dotRad(u), N = 14, pts = [];
    for (let k = 0; k <= N; k++) { const tt = Math.max(T_DOT, t - span * k / N), pp = dotPos(tt); pts.push([pp.x, pp.y]); }
    const L = [], Rr = [];
    for (let k = 0; k <= N; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N, k + 1)];
      let tx = a[0] - b[0], ty = a[1] - b[1]; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;   // head-ward tangent
      const w = r * .92 * Math.pow(1 - k / N, 1.15);
      L.push([pts[k][0] - ty * w, pts[k][1] + tx * w]); Rr.push([pts[k][0] + ty * w, pts[k][1] - tx * w]);
    }
    const head = pts[0], tail = pts[N];
    if (Math.hypot(head[0] - tail[0], head[1] - tail[1]) < 3) return;
    const g = ctx.createLinearGradient(head[0], head[1], tail[0], tail[1]);
    g.addColorStop(0, R.rgba(BLUE, 0)); g.addColorStop(.12, R.rgba(BLUE, .5 * fade)); g.addColorStop(1, R.rgba(BLUE, 0));   // fades in from the head: no seam behind the dot
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (let k = 1; k <= N; k++) ctx.lineTo(L[k][0], L[k][1]);
    for (let k = N; k >= 0; k--) ctx.lineTo(Rr[k][0], Rr[k][1]);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawFlyingDot(ctx, t) {
    if (t < T_DOT) return;
    const u = dotU(t), p = dotPos(t), sp = Math.hypot(p.vx, p.vy);
    const alpha = u > .8 ? 1 - .70 * R.prog(u, .8, 1) : 1;
    const shutter = R.shutterFor(sp, 10, 14) * (1 - E.inQuad(R.prog(u, .8, 1)));
    maskBlur(ctx, t, (c, tt) => {
      const pp = dotPos(tt), r = dotRad(dotU(tt)), k = dotStretch(tt);
      c.translate(pp.x, pp.y); c.rotate(Math.atan2(pp.vy, pp.vx)); c.scale(k, 1);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    }, `rgba(234,244,251,${alpha.toFixed(3)})`, { samples: 10, subs: 3, shutter, name: 's4:mbDot' });
  }

  /* ---- the gust of leaves (Kaught) ---- */
  const frontFade = t => 1 - E.inQuad(R.prog(t, 8.203125, 8.4375));
  const gustFade = t => 1 - E.inQuad(R.prog(t, 8.3, 8.9));
  const LEAVES = (() => {
    const rng = R.rng(5150), out = [];
    for (let k = 0; k < 16; k++) {
      const z = rng();                                    // depth: 0 far and slow, 1 near, big and fast
      out.push({ z, L: 70 + z * z * 210, x0: -300 - rng() * 500, y0: 120 + rng() * 620, vx: 900 + 1700 * z, vy: 60 + 160 * rng(),
                 ph: rng() * 6.28, sw: 40 + 90 * rng(), w: 2 + 4 * rng(), rot0: rng() * 6.28, wf: .34 + rng() * .08, d: rng() * .25 });
    }
    return out;
  })();
  function drawLeaf(ctx, l, t, a = 1) {                  // t = the time this copy is drawn at (smear copies pass t - k/480)
    const tau = t - T_BASS - l.d; if (tau < 0) return;
    const x = l.x0 + l.vx * tau, y = l.y0 + l.vy * tau + l.sw * Math.sin(l.w * tau + l.ph); if (x > 2300) return;
    const al = .96 * a * gustFade(t) * (l.z >= .5 ? frontFade(t) : 1); if (al <= .003) return;
    const rot = l.rot0 + 3.2 * tau * (1 + l.z) + .5 * Math.sin(l.w * tau + l.ph * 2);
    const sy = Math.max(.25, Math.abs(Math.cos(.9 * rot + l.ph)));                     // tumble: the leaf turns edge-on and back
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, sy);
    const g = ctx.createLinearGradient(0, 0, l.L, 0); g.addColorStop(0, '#2e5a33'); g.addColorStop(1, '#8dbb6f');
    ctx.fillStyle = g; ctx.globalAlpha = al;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(l.L * .22, -l.L * l.wf, l.L * .72, -l.L * l.wf * .9, l.L, 0);
    ctx.bezierCurveTo(l.L * .72, l.L * l.wf * .9, l.L * .22, l.L * l.wf, 0, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(12,36,16,.5)'; ctx.lineWidth = Math.max(1.5, l.L * .012);
    ctx.beginPath(); ctx.moveTo(l.L * .04, 0); ctx.lineTo(l.L * .9, 0); ctx.stroke(); ctx.restore();
  }
  // eight copies 1/480 s apart (about 5 px on the fastest leaf) so the smear is a continuous streak, not three stacked outlines;
  // weights are per-copy alphas that composite to about .95 in the leaf's body and fall off softly at the head and tail
  const SMEAR = Array.from({ length: 16 }, (_, k) => .40 - .22 * k / 15);   // 16 copies 1/960 s apart (2.7 px on the fastest leaf): no visible steps
  function drawLeaves(ctx, t, front) {
    if (t < T_BASS || t > 8.9) return;
    for (const l of LEAVES) {
      if ((l.z >= .5) !== front) continue;
      if (l.z > .6) for (let k = SMEAR.length - 1; k >= 0; k--) drawLeaf(ctx, l, t - k / 960, SMEAR[k]);   // near leaves smear: oldest copy first, the crisp one on top
      else drawLeaf(ctx, l, t);
    }
  }

  /* ---- type: labels, pills, reader lines ---- */
  const RISE = 76;      // travel of a masked rise or sink: taller than an ascender plus the 18 px of clip below the baseline, so nothing is left half-visible
  function drawLabels(ctx, t, fs) {
    R.font(ctx, 72, 'sans', 700); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < 4; i++) {
      const a = RV[i] + S16; if (t < a) continue;
      const Ts = T_LSINK + (3 - i) * S64, sink = RISE * E.inQuart(R.prog(t, Ts, Ts + .117));
      if (sink >= RISE) continue;
      const y = 716 + RISE * (1 - E.outExpo(R.prog(t, a, a + .176))) + sink;
      ctx.save();
      ctx.beginPath(); ctx.rect(XS[i] - 260, 716 - 90, 520, 90 + 18); ctx.clip();
      ctx.globalAlpha = Math.min(1, .78 + .22 * fs[i]); ctx.fillStyle = ICE;
      ctx.fillText(LABELS[i], XS[i], y);
      ctx.restore();
    }
  }
  function drawPill(ctx, text, cx, t, a0, sinkA, sinkB) {
    if (t < a0 || t >= sinkB) return;
    R.font(ctx, 72, 'sans', 600);
    const tw = ctx.measureText(text).width, w = tw + 72, h = 100, x0 = Math.max(96, cx - w / 2), pcx = x0 + w / 2, pcy = 826;
    const pop = .6 + .4 * R.spring(t - a0, 320, 15), sp = R.prog(t, sinkA, sinkB);
    const alpha = R.prog(t, a0, a0 + .1171875) * (1 - sp), dy = 44 * E.inQuart(sp);
    if (alpha <= .003) return;
    ctx.save(); ctx.translate(pcx, pcy + dy); ctx.scale(pop, pop); ctx.globalAlpha = alpha;
    ctx.beginPath(); R.roundRect(ctx, -w / 2, -h / 2, w, h, 50);
    ctx.fillStyle = 'rgba(5,11,22,.60)'; ctx.fill();
    ctx.strokeStyle = 'rgba(234,244,251,.30)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = ICE; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 0, 852 - pcy);
    ctx.restore();
  }
  function drawReader(ctx, t, text, a0, s0, s1) {
    if (t < a0 || t >= s1) return;
    const y = 976 + RISE * (1 - E.outExpo(R.prog(t, a0, a0 + .176))) + RISE * E.inQuart(R.prog(t, s0, s1));
    R.font(ctx, 72, 'sans', 500); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 976 - 90, 1920, 90 + 18); ctx.clip();
    ctx.globalAlpha = .92; ctx.fillStyle = ICE; ctx.fillText(text, 960, y);
    ctx.restore();
  }

  /* ---- post-FX ---- */
  function fx(t) {
    const f = R.fx, tau = t - T_DROP, kr = E.inOutCubic(R.prog(t, 9.125, T_MEND));
    f.bloom = R.lerp(.25, .30, kr); f.threshold = R.lerp(.70, .62, kr); f.vignette = .30;
    // the drop lights the hushed picture: a hard step to colour and light
    R.flash(t, T_DROP, { amount: .30, decay: 34, color: ICE });
    R.impact(t, T_DROP, { amount: 14, decay: 12, freq: 30, rot: .012 });
    f.chroma = 10 * Math.exp(-tau / .045); f.chromaAngle = 0;
    f.bloom += .5 * Math.exp(-8 * tau);
    f.exposure = 1 + .20 * Math.exp(-tau / .12);
    f.saturation = 1 + .15 * Math.exp(-tau / .15);
    f.contrast = 1;
    f.distort = .05 * Math.exp(-tau / .12);
    f.zoom = Math.max(1 + .06 * (1 - E.outExpo(R.prog(t, T_DROP, 5.859375))), 1 + 1.05 * f.distort);
    f.vignette = .30 + .25 * Math.exp(-tau / .25) + .05 * E.inOutCubic(R.prog(t, T_DOT, T_MEND));
    for (const T0 of [RV[1], RV[2], RV[3]]) R.impact(t, T0, { amount: 2, decay: 16 });
    for (const T0 of [T_CLAP, T_BASS, T_FMAJ]) R.impact(t, T0, { amount: 3, decay: 16 });
  }

  Reel.scene({
    id: 's4', name: 'Four apps',
    start: T_DROP, end: T_END, layer: 2,
    setup() { shadow = buildShadow(); R.layer('s4:mbDot'); },
    draw(ctx, t) {
      fx(t);
      const fs = [0, 1, 2, 3].map(i => foc(i, t)), f1 = fs[1];
      const merging = t >= T_MERGE;

      // auras (behind the tiles)
      const AUR = [['#FFA51F', .55], ['#78BE5A', .50], [ICE, .30], [ICE, .30]];
      for (let i = 0; i < 4; i++) {
        const a = Math.min(1, fs[i]) * AUR[i][1]; if (a <= .004) continue;
        const g = ctx.createRadialGradient(XS[i], 436, 0, XS[i], 436, 400);
        g.addColorStop(0, R.rgba(AUR[i][0], a)); g.addColorStop(1, R.rgba(AUR[i][0], 0));
        ctx.fillStyle = g; ctx.fillRect(XS[i] - 400, 36, 800, 800);
      }

      drawLeaves(ctx, t, false);

      if (!merging) {
        const st = [];
        for (let i = 0; i < 4; i++) {
          const pop = 1 + .10 * q(t - RV[i], 320, 15), s = pop * (1 + .12 * fs[i]);
          drawShadow(ctx, XS[i], YC - 14 * fs[i], s, .40);
        }
        const order = [0, 1, 2, 3].sort((a, b) => fs[a] - fs[b] || a - b);      // the focused tile draws last
        for (const i of order) drawTile(ctx, i, t, fs[i], f1);
      } else drawMerge(ctx, t, f1);

      drawLeaves(ctx, t, true);

      drawLabels(ctx, t, fs);
      drawPill(ctx, 'With @ayade369', 300, t, R.at(4, 3), R.at(5, 1) - S16, R.at(5, 1));
      drawPill(ctx, 'Creator wanted', 740, t, R.at(5, 1), R.at(5, 3) - S32, R.at(5, 3) + S32);
      drawReader(ctx, t, 'Film the dare, or dare them back.', T_CLAP + 2 * S64, T_BASS - S32, T_BASS + S32);
      drawReader(ctx, t, 'Name any wild animal with your camera.', R.at(5, 1) - 3 * S32, R.at(5, 3) - S32, R.at(5, 3) + S32);

      // reveal rings (additive)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const tau = t - RV[i]; if (tau < 0 || tau >= .35) continue;
        ctx.strokeStyle = R.rgba(RING[i], .8 * (1 - tau / .35)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(XS[i], YC, 200 + 260 * E.outExpo(tau / .35), 0, TAU); ctx.stroke();
      }
      ctx.restore();

      if (t >= T_DOT) { drawWake(ctx, t); drawFlyingDot(ctx, t); }
    },
  });
})();
