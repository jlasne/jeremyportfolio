/* s5: Personal. The site's own list at giant scale on the site's night. A selector plate that never moves, a list that snaps under it
   like a picker (rows of 1, 1, .5 and 2 beats), folds on 32nds, Bio Tracker's dot, and Brain: two hemispheres that swing shut like doors,
   fed by four dots. Owns the personal panel until 11.6667 (then s6's sprite window has it). Every frame is a pure function of t. */
(() => {
  const R = Reel, E = R.ease;
  R.preload({ brain: '/vid/assets/brain.svg' });

  const B = 0.46875, S16 = B / 4, S32 = B / 8;
  const q = (tau, k = 320, c = 15) => tau < 0 ? 0 : 1 - R.spring(tau, k, c);      // impact ring: 1 at contact, rings to 0

  // ---- colours ----
  const ICE = '#eaf4fb', BLUE = '#5fa8d3', PINK = '#F5C9D1', BROWN = '#A8704E';
  const FOCUS = R.mix(ICE, BLUE, .55);                                                 // rgba string; name colour on focus
  const FOCUS_HEX = '#9ecae5';

  // ---- time on the grid ----
  const T0 = R.at(6, 1);                                                               // 9.375   the plate and the dot (frame 563)
  const T_SNAP = [R.at(6, 2), R.at(6, 3), R.at(6, 3, 3)];                              // 9.84375 10.3125 10.546875
  const T_DOOR = R.at(6, 3, 4);                                                        // 10.6641 hemispheres swing together
  const T_DOOR_END = T_DOOR + 3 * S32;                                                 // 10.8398 the doors meet
  const T_FX_END = R.at(7, 1, 3);                                                      // 11.484375: s6 owns R.fx from here
  const END = 700 / 60 - 1e-6;                                                         // last frame is 699 (s6's sprite has the panel from 11.6333)
  const FOLD = [{ open: T0 + S32, close: T_SNAP[0] }, { open: T_SNAP[0] + S32, close: T_SNAP[1] }];
  const FEED_LAUNCH = [0, 1, 2, 3].map(n => T_SNAP[2] + n * S32);                      // 10.5469 10.6055 10.6641 10.7227
  const FEED_ARR = [10.78125, 10.78125 + S32, 10.78125 + 2 * S32, 10.78125 + 3 * S32]; // 10.7813 10.8398 10.8984 10.9570
  const T_BRAIN_IN = T_SNAP[2] + S32;                                                  // 10.6055 the big brain enters

  // ---- Y(t): the page scroll, copied verbatim into s5 and s6 (contract H5) ----
  const T_A = 11.484375, T_W = 11.6015625, T_L = 12.1875, DIST = 4320;
  function Y(t) {
    if (t < T_A) return 0;
    if (t < T_W) return -30 * E.outQuad(R.prog(t, T_A, T_W));                          // anticipation: the page dips 30 px up
    if (t < T_L) return -30 + (DIST + 30) * E.inOutCubic(R.prog(t, T_W, T_L));         // the whip: 4350 px in 0.586 s, peak 22,270 px/s at t 11.895
    const tau = t - T_L; return DIST + 18 * Math.exp(-9 * tau) * Math.sin(28 * tau);   // landing: +11.4 px at 12.233, within 0.5 px by 12.59
  }

  // ---- shapes and paths ----
  function rr4(ctx, x, y, w, h, r) {
    const [a, b, c, d] = r.map(v => Math.max(0, Math.min(v, w / 2, h / 2)));
    ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); if (b) ctx.arcTo(x + w, y, x + w, y + b, b); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c); if (c) ctx.arcTo(x + w, y + h, x + w - c, y + h, c); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + d, y + h); if (d) ctx.arcTo(x, y + h, x, y + h - d, d); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + a); if (a) ctx.arcTo(x, y, x + a, y, a); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  const CHEV = new Path2D('M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z');
  const ARR = new Path2D('M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z');

  // brain.svg paths, as absolute cubic segments so each point can be mapped per frame (the door swing)
  function parsePath(d) {
    const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
    let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
    const out = { start: null, segs: [], closed: false };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      if (cmd === 'M') { cx = +tok[i++]; cy = +tok[i++]; sx = cx; sy = cy; out.start = [cx, cy]; cmd = 'L'; }
      else if (cmd === 'c') {
        const v = tok.slice(i, i + 6).map(Number); i += 6;
        out.segs.push([cx + v[0], cy + v[1], cx + v[2], cy + v[3], cx + v[4], cy + v[5]]);
        cx += v[4]; cy += v[5];
      } else if (cmd === 'z' || cmd === 'Z') { out.closed = true; }
      else i++;
    }
    return out;
  }
  const P_HL = parsePath('M31 9.5c-3.2-2.6-8.6-2.1-10.6 1.6-5-.7-9 3.2-8.2 8.1-4.4 2-5.6 7.6-2.6 11.2-2.9 3.4-1.8 9 2.3 10.8-.3 5 3.9 8.6 8.8 7.6 2.2 3.9 7.7 4.9 10.3 1.4z');
  const P_HR = parsePath('M33 9.5c3.2-2.6 8.6-2.1 10.6 1.6 5-.7 9 3.2 8.2 8.1 4.4 2 5.6 7.6 2.6 11.2 2.9 3.4 1.8 9-2.3 10.8.3 5-3.9 8.6-8.8 7.6-2.2 3.9-7.7 4.9-10.3 1.4z');
  const FOLD_L = ['M20.5 18.5c3.2.2 5.4 2.6 5.3 5.8', 'M13.5 31c3.8-1.2 7.4.6 8.6 4.2', 'M20 42.5c.2-3 2.6-5.2 5.6-5.1'].map(parsePath);
  const FOLD_R = ['M43.5 18.5c-3.2.2-5.4 2.6-5.3 5.8', 'M50.5 31c-3.8-1.2-7.4.6-8.6 4.2', 'M44 42.5c-.2-3-2.6-5.2-5.6-5.1'].map(parsePath);
  const FOLD_LEN = [8.76, 10.68, 8.40];
  const FOLD_A = FEED_ARR.slice(0, 3);
  // door mapping about the inner edge (viewBox x = 32): a foreshortened, tapered face
  const mapPt = (x, y, th, dx) => {
    const s = Math.sin(th), c = Math.cos(th), ax = Math.abs(x - 32) / 32;
    return [32 + (x - 32) * c + dx, 32 + (y - 32) * (1 + .05 * s * ax)];
  };
  function tracePath(ctx, P, th, dx) {
    let p = mapPt(P.start[0], P.start[1], th, dx);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (const s of P.segs) {
      const a = mapPt(s[0], s[1], th, dx), b = mapPt(s[2], s[3], th, dx), e = mapPt(s[4], s[5], th, dx);
      ctx.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]);
    }
    if (P.closed) ctx.closePath();
  }

  // ---- the list ----
  const ROWS = [
    { name: 'Private equity', desc: ['Three positions of my own.'], trail: 'chev', subs: [['SaaS Health'], ['H100 datacenters'], ['Astronomy blog']] },
    { name: 'Social', desc: ['Where to find me.'], trail: 'chev', subs: [['YouTube', '@jerandmax'], ['X', '@jeremylasne'], ['Email', 'hey@jeremylasne.com']] },
    { name: 'Bio Tracker', desc: ['An energized and performing life, tracked.'], trail: 'arrow' },
    { name: 'Brain', desc: ['A folder that gets smarter', 'every time you feed it.'], trail: 'arrow' },
  ];
  let subX = null;                                   // handle x per sub row, measured after fonts load
  const spr = (t, T) => t < T ? 0 : R.spring(t - T, 260, 24);
  const focus = t => spr(t, T_SNAP[0]) + spr(t, T_SNAP[1]) + spr(t, T_SNAP[2]);
  const rowA = d => d < 1 ? 1 - .75 * d : Math.max(0, .25 * (2 - d));

  // fold envelopes (three per fold, so text is never drawn over text)
  const chevOpen = (t, k) => { const F = FOLD[k]; return t < F.close ? E.outCubic(R.prog(t, F.open, F.open + .25)) : 1 - E.inQuad(R.prog(t, F.close, F.close + .2)); };
  const subOut = (t, k) => 1 - E.outCubic(R.prog(t, FOLD[k].close - .017, FOLD[k].close + .033));
  const nextF = (t, k) => { const F = FOLD[k]; return t < F.close ? (k === 0 ? 0 : 1 - E.outCubic(R.prog(t, F.open, F.open + .06))) : E.outCubic(R.prog(t, F.close + .017, F.close + .083)); };

  const DOT_C = [234, 244, 251, .30], BLUE_C = [95, 168, 211, .95];
  const dotColor = (m) => `rgba(${Math.round(R.lerp(DOT_C[0], BLUE_C[0], m))},${Math.round(R.lerp(DOT_C[1], BLUE_C[1], m))},${Math.round(R.lerp(DOT_C[2], BLUE_C[2], m))},${R.lerp(DOT_C[3], BLUE_C[3], m).toFixed(3)})`;

  function drawRow(c, t, k, f, nx) {
    const RT = 299 + 332 * (k - f), d = Math.abs(k - f);
    let a = rowA(d);
    if (k >= 1 && k <= 2) a *= nx[k - 1];
    if (a < .004) return;
    const foc = 1 - Math.min(d, 1), sc = 1 - .14 * Math.min(d, 1);
    c.save();
    c.globalAlpha = a;
    if (k >= 1 && d > .6) { c.fillStyle = 'rgba(95,168,211,.18)'; c.fillRect(198, RT - 5, 1524, 3); }
    c.translate(198, RT + 161); c.scale(sc, sc); c.translate(-198, -(RT + 161));

    // ---- the icon cell: the site's grey dot (k 0..2) or Brain's own mark ----
    if (k < 3) {
      const cx = 256, cy = RT + 108;
      let r = 14.5, sx = 1, sy = 1, col = 'rgba(234,244,251,.30)';
      if (k === 0) {
        const tau = t - T0;
        if (tau >= 0) {
          const qq = q(tau, 500, 16); sx = 1 + .4 * qq; sy = 1 - .35 * qq;
          if (tau < .3) {                                                   // the landing ring, readable on a phone
            const u = tau / .3;
            c.save(); c.globalAlpha = a * .5 * (1 - u); c.strokeStyle = ICE; c.lineWidth = 3;
            c.beginPath(); c.arc(cx, cy, R.lerp(15, 96, E.outExpo(u)), 0, R.TAU); c.stroke(); c.restore();
          }
        }
      } else if (k === 2) {
        const tau = t - T_SNAP[1];
        if (tau >= 0) {
          r = 14.5 * (1 + .7 * (1 - R.spring(tau, 400, 14)));
          const m = E.outCubic(R.prog(tau, 0, .12)) * (1 - E.outCubic(R.prog(t, T_SNAP[2], T_SNAP[2] + .2)));
          col = dotColor(m);
          if (tau < .234) {                                                 // the ripple
            const u = tau / .234;
            c.save(); c.globalAlpha = a * R.lerp(.55, 0, u); c.strokeStyle = BLUE; c.lineWidth = 3;
            c.beginPath(); c.arc(cx, cy, R.lerp(14.5, 64, E.outExpo(u)), 0, R.TAU); c.stroke(); c.restore();
          }
        }
      }
      c.save(); c.translate(cx, cy + r); c.scale(sx, sy); c.translate(-cx, -(cy + r));
      c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, R.TAU); c.fill(); c.restore();
    } else {
      const im = R.img('brain');
      if (im && im.naturalWidth) {
        const pop = 1 + .2 * q(t - T_SNAP[2], 320, 15);
        c.save(); c.translate(256, RT + 108); c.scale(pop, pop);
        c.drawImage(im, -58, -50.75, 116, 101.5); c.restore();
      }
    }

    // ---- the name (rises through a mask on the first row), the description ----
    const accent = k === 3 ? PINK : FOCUS_HEX;
    c.textBaseline = 'alphabetic';
    const nameBase = RT + 128;
    const rise = k === 0 ? 44 * (1 - E.outExpo(R.prog(t, T0, T0 + .176))) : 0;
    c.save();
    if (rise > .01) { c.beginPath(); c.rect(340, nameBase - 96, 900, 96 + 26); c.clip(); }
    R.font(c, 84, 'sans', 700);
    c.fillStyle = R.mix(ICE, accent, foc);
    R.text(c, ROWS[k].name, 382, nameBase + rise, { tracking: -.84 });
    c.restore();
    R.font(c, 72, 'sans', 400);
    c.fillStyle = 'rgba(234,244,251,.72)';
    ROWS[k].desc.forEach((s, i) => {
      const base = RT + 232 + 96 * i;
      const dr = k === 0 ? 44 * (1 - E.outExpo(R.prog(t, FOLD[0].open, FOLD[0].open + .176))) : 0;
      if (dr > .01) { c.save(); c.beginPath(); c.rect(340, base - 84, 1300, 84 + 24); c.clip(); c.fillText(s, 382, base + dr); c.restore(); }
      else c.fillText(s, 382, base);
    });

    // ---- the trailing icon: chevron (folds) or arrow (hover nudge) ----
    {
      let alpha = 1, scl = 1, trailF = foc, accentC = BLUE;
      if (k === 0) { const p = E.outCubic(R.prog(t, FOLD[0].open, FOLD[0].open + .117)); alpha = p; scl = .6 + .4 * p; }
      if (k === 3) { trailF = 0; }                    // Brain's arrow stays ICE .46 at rest (the sprite in s6 draws it so)
      c.save();
      c.translate(1700, RT + 108); c.scale(4.8 * scl, 4.8 * scl); c.translate(-8, -8);
      if (ROWS[k].trail === 'chev') { c.translate(8, 8); c.rotate(Math.PI * (k <= 1 ? chevOpen(t, k) : 0)); c.translate(-8, -8); }
      else c.translate(trailF * 10 / 4.8, -trailF * 10 / 4.8);
      c.globalAlpha = a * alpha;
      c.fillStyle = R.mix(ICE, accentC, trailF, R.lerp(.46, 1, trailF));
      c.fill(ROWS[k].trail === 'chev' ? CHEV : ARR, 'evenodd');
      c.restore();
    }

    // ---- the fold: three sub rows under the plate ----
    if (k <= 1 && t >= FOLD[k].open) {
      const so = subOut(t, k), F = FOLD[k];
      if (so > .004) {
        const PB = RT + 322;
        ROWS[k].subs.forEach((s, j) => {
          const Tj = F.open + j * S32, p = E.outCubic(R.prog(t, Tj, Tj + .117));
          if (p <= 0) return;
          const base = PB + 100 + 118 * j + 29 * (1 - p) - 20 * (1 - so);
          c.save(); c.globalAlpha = a * p * so;
          c.fillStyle = 'rgba(234,244,251,.30)'; c.beginPath(); c.arc(390, base - 26, 9.5, 0, R.TAU); c.fill();
          R.font(c, 76, 'sans', 500); c.fillStyle = 'rgba(234,244,251,.86)'; c.fillText(s[0], 440, base);
          if (s[1]) { R.font(c, 72, 'sans', 400); c.fillText(s[1], subX[k][j], base); }
          c.restore();
        });
      }
    }
    c.restore();
  }

  // ---- the big brain ----
  function drawBrain(ctx, t) {
    if (t < T_BRAIN_IN) return;
    const tau = t - T_BRAIN_IN;
    const w = 1 - E.outBack(R.prog(t, T_DOOR, T_DOOR_END), 1.4);
    let s = .6 + .4 * R.spring(tau, 260, 19);
    for (const A of FEED_ARR) s *= 1 + .045 * q(t - A, 400, 14);
    const alpha = R.prog(tau, 0, .1);
    const k = 380 / 64 * s, th = 52 * Math.PI / 180 * w, g = 34 * w / (380 / 64 * s) ;
    const cosT = Math.cos(th);
    const shade = R.mix('#000000', PINK, .75 + .25 * cosT);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(1500 - 32 * k, 514 - 32 * k); ctx.scale(k, k);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [P, dx, th2] of [[P_HL, -g, th], [P_HR, g, -th]]) {
      tracePath(ctx, P, th2, dx); ctx.fillStyle = shade; ctx.fill();
      ctx.strokeStyle = BROWN; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.strokeStyle = BROWN; ctx.lineWidth = 2.6;
    for (let n = 0; n < 3; n++) {
      const p = E.outCubic(R.prog(t, FOLD_A[n], FOLD_A[n] + .12));
      if (p <= 0) continue;
      for (const [P, dx, th2] of [[FOLD_L[n], -g, th], [FOLD_R[n], g, -th]]) {
        tracePath(ctx, P, th2, dx);
        R.dashProgress(ctx, FOLD_LEN[n], p);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawHalo(ctx, t, bk) {
    if (bk <= 0) return;
    let a = .34 * bk * (1 + .04 * Math.sin(R.TAU * (t - T_SNAP[2]) / .9375));
    if (t >= FEED_ARR[3]) a *= 1 + .6 * Math.exp(-(t - FEED_ARR[3]) / .12);
    const g = ctx.createRadialGradient(1500, 514, 0, 1500, 514, 420);
    g.addColorStop(0, `rgba(245,201,209,${a.toFixed(4)})`); g.addColorStop(1, 'rgba(245,201,209,0)');
    ctx.fillStyle = g; ctx.fillRect(1080, 94, 840, 840);
  }
  function feedPos(n, u) {
    const p0x = 1960, p0y = 250 + 55 * n, cx = 1750, cy = 120 + 40 * n, p2x = 1500, p2y = 514, v = 1 - u;
    return [v * v * p0x + 2 * u * v * cx + u * u * p2x, v * v * p0y + 2 * u * v * cy + u * u * p2y,
      2 * v * (cx - p0x) + 2 * u * (p2x - cx), 2 * v * (cy - p0y) + 2 * u * (p2y - cy)];
  }
  function drawFeed(ctx, t) {
    for (let n = 0; n < 4; n++) {
      const t0 = FEED_ARR[n] - .2344;
      if (t < t0 || t >= FEED_ARR[n]) continue;
      const pr = R.prog(t, t0, FEED_ARR[n]), u = E.inQuad(pr), du = 2 * pr / .2344;
      const [x, y, dx, dy] = feedPos(n, u), speed = Math.hypot(dx, dy) * du;
      const k = Math.min(2, 1 + speed / 3000), ang = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 34 * k);
      gl.addColorStop(0, 'rgba(245,201,209,.38)'); gl.addColorStop(1, 'rgba(245,201,209,0)');
      ctx.fillStyle = gl; ctx.fillRect(-34 * k, -34 * k, 68 * k, 68 * k);
      ctx.fillStyle = BROWN; ctx.beginPath(); ctx.ellipse(0, 0, 14 * k, 14 / Math.sqrt(k), 0, 0, R.TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ---- the plate ----
  function drawPlate(ctx, t, bk, f) {
    let sq = 0; for (const T of T_SNAP) sq += q(t - T, 420, 18);
    const h = (322 + 108 * bk) * (1 - .05 * sq);
    const m = bk, lr = R.lerp;
    ctx.beginPath(); rr4(ctx, 140, 299, 1640, h, [67, 67, 67, 67]);
    ctx.fillStyle = `rgba(${Math.round(lr(234, 245, m))},${Math.round(lr(244, 201, m))},${Math.round(lr(251, 209, m))},${lr(.10, .13, m).toFixed(4)})`; ctx.fill();
    ctx.strokeStyle = `rgba(${Math.round(lr(234, 245, m))},${Math.round(lr(244, 201, m))},${Math.round(lr(251, 209, m))},${lr(.16, .38, m).toFixed(4)})`; ctx.lineWidth = 3; ctx.stroke();
  }

  function fx(t) {
    if (t >= T_FX_END) return;
    const f = R.fx;
    f.bloom = .30; f.threshold = .62;
    R.impact(t, T0, { amount: 2, decay: 16, rot: .002 });
    for (const T of T_SNAP) R.impact(t, T, { amount: 2, decay: 16, rot: .002 });
    if (t >= T_DOOR_END) f.bloom += .15 * Math.exp(-8 * (t - T_DOOR_END));
    if (t >= FEED_ARR[3]) f.bloom += .25 * Math.exp(-7 * (t - FEED_ARR[3]));
  }

  R.scene({
    id: 's5', name: 'Personal', start: T0, end: END, layer: 2,
    setup() {
      const mc = document.createElement('canvas').getContext('2d');
      subX = ROWS.map(r => (r.subs || []).map(s => { if (!s[1]) return 0; R.font(mc, 76, 'sans', 500); return 440 + mc.measureText(s[0]).width + 40; }));
    },
    draw(ctx, t) {
      fx(t);
      const y = Y(t), f = focus(t), bk = R.clamp(spr(t, T_SNAP[2]), 0, 1);
      const nx = [nextF(t, 0), nextF(t, 1)];

      ctx.save(); ctx.translate(0, y);
      drawHalo(ctx, t, bk);
      drawPlate(ctx, t, bk, f);
      ctx.restore();

      // the list layer: rows, sub rows, hairlines, dots, small icons; masked in screen space; smeared on the snaps
      const L = R.layer('s5:list'), c = L.ctx;
      c.save(); c.translate(0, y);
      for (let k = 3; k >= 0; k--) drawRow(c, t, k, f, nx);
      c.restore();
      c.globalCompositeOperation = 'destination-in';
      const g = c.createLinearGradient(0, 190, 0, 290);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
      c.globalCompositeOperation = 'source-over';
      const vpf = 332 * Math.abs(focus(t + 1 / 120) - focus(t - 1 / 120));         // row speed in px per frame
      if (vpf > 20 && R.quality >= 1) {
        const S = R.layer('s5:smear'), sc = S.ctx;
        sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'lighter'; sc.globalAlpha = 1 / 8;
        for (let i = 0; i < 8; i++) sc.drawImage(L.canvas, 0, (i / 7 - .5) * vpf * R.rs);
        sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over';
        R.blit(ctx, S);
      } else R.blit(ctx, L);

      ctx.save(); ctx.translate(0, y);
      drawBrain(ctx, t);
      drawFeed(ctx, t);
      ctx.restore();
    },
  });
})();
