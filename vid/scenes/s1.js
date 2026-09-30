/* s1: wlns.shop. Lime, and already in the middle of a sentence. The wordmark WLNS.SHOP is typed by gravity (nine landings on 32nds, the first
   three already down on frame 0), the tagline rises in three chunks, an ink bar flips the colour of its last words through a mask, a wave runs
   through the letters, then everything falls out through the floor while wlns.shop's real icon crouches, hops across the frame growing from
   147 to 440 px, and a black circle rolls in from the left at constant speed. They arrive together on the downbeat of bar 2 (handoff H1: the
   next frame is CreatorMatch's world).
   Every frame is a pure function of t. Owns R.fx from 0 to 1.875. */
(() => {
  const R = Reel, E = R.ease;

  const B = R.BEAT, S16 = B / 4, S32 = B / 8, S128 = B / 32;
  const q = (tau, k = 320, c = 15) => tau < 0 ? 0 : 1 - R.spring(tau, k, c);            // impact ring: 1 at contact, rings through 0, settles at 0
  const ACID = '#c8ff3d', SHOP = '#0a0a0a';

  const T_END = 1.875;
  const T_FALL = R.at(1, 4);                                    // 1.40625  everything falls, the circle rolls, the block crouches
  const T_HOP = T_FALL + 3 * S128;                              // 1.4501953 take-off (a stagger inside the gesture that starts on 1.4)
  const T_LAND = 112 / 60;                                // 1.8666667 the block is at rest on frame 112
  const T_INK = R.at(1, 3), T_WAVE = R.at(1, 3, 3);             // 0.9375, 1.1719
  const T_TAG = [R.at(1, 1, 4), R.at(1, 2), R.at(1, 2, 2)];     // 0.3516 0.4688 0.5859 tagline chunks

  const X0 = 313, BASE = 520, TAG_BASE = 660;
  const WORD = 'WLNS.SHOP';
  // measured with R.glyphs at 195 px in the real font (the spec's table, replaced by the measurement in setup / first draw)
  let ORG = [0, 271.0, 423.3, 617.4, 787.0, 851.0, 1020.6, 1207.0, 1397.4], ADV = [271.0, 152.3, 194.0, 169.6, 64.0, 169.6, 186.4, 190.3, 163.2];
  let CH = [{ s: 'The link-in-bio', x: 0, w: 533.7 }, { s: 'shop for', x: 549.6, w: 301.6 }, { s: 'wellness creators.', x: 891.2, w: 669.2 }];
  let BAR_L = X0 + 891.2 - 18, BAR_R = X0 + 891.2 + 669.2 + 18;
  let measured = false;
  function measure() {
    if (measured) return;
    const c = document.createElement('canvas').getContext('2d');
    R.font(c, 190, 'display', 900);
    const g = R.glyphs(c, WORD, 0);
    if (g && g.chars.length === 9 && g.width > 1000) { ORG = g.chars.map(k => k.x); ADV = g.chars.map(k => k.w); }
    R.font(c, 77.5, 'sans', 700);
    const w = CH.map(k => c.measureText(k.s).width), sp = c.measureText(' ').width;
    if (w.every(v => v > 100)) {
      CH[0].x = 0; CH[0].w = w[0];
      CH[1].x = w[0] + sp; CH[1].w = w[1];
      CH[2].x = CH[1].x + w[1] + 39; CH[2].w = w[2];                       // the 40 px gap that houses the ink bar's rounded end
      BAR_L = X0 + CH[2].x - 18; BAR_R = X0 + CH[2].x + CH[2].w + 18;
    }
    CH.forEach((k, i) => { k.T = T_TAG[i]; k.fall = T_FALL + (2 - i) * S128 * 2.0; });
    measured = true;
  }
  CH.forEach((k, i) => { k.T = T_TAG[i]; k.fall = T_FALL + (2 - i) * S128 * 2.0; });   // 1.40625 / 1.4355 / 1.4648

  /* ---- the nine landings ---- */
  const TL = i => (i - 2) * S32;                                 // contact times: -.1172 -.0586 0 .0586 .1172 .1758 .2344 .2930 .3516 (grid: 32nds)
  function glyphState(i, t) {
    const T = TL(i);
    let yo = 0, sx = 1, sy = 1, rot = 0, fallp = 0;
    if (t < T) {
      const p = R.prog(t, T - .14, T);
      yo = -900 * (1 - p * p); sy = 1 + .45 * p * p; sx = 1 / Math.sqrt(sy); fallp = p;
    } else {
      const tau = t - T, qq = q(tau);
      const heavy = i === 8 ? 1.25 : 1;                          // the P lands heavier
      sx = 1 + .16 * qq * heavy; sy = 1 - .22 * qq * heavy;
      rot = (i % 2 ? -1 : 1) * .026 * Math.exp(-9 * tau) * Math.sin(30 * tau);
    }
    const wa = T_WAVE + i * S128;                                // the wave, left to right
    if (t > wa) yo += -10 * Math.sin(R.TAU * R.prog(t, wa, wa + .176));
    const T0 = T_FALL + (8 - i) * S128;                          // the fall out: P first, W last
    if (t >= T0) {
      if (t < T0 + .0586) yo += -12 * E.outQuad(R.prog(t, T0, T0 + .0586));
      else {
        const p = R.prog(t, T0 + .0586, T0 + .2786);
        yo += -12 + 900 * E.inQuad(p);
        const s2 = 1 + .6 * p; sy *= s2; sx *= 1 / Math.sqrt(s2); fallp = Math.max(fallp, p);
      }
    }
    return { yo, sx, sy, rot, fallp };
  }

  /* ---- the block: wlns.shop's real icon (an ink tile with a lime window cut out), crouching, then a plain ink square that hops ---- */
  function blockState(t) {
    let sx = 1, sy = 1, rot = 0, x = 159.5, y = 446.5, size = 147, rad = .2266, hopping = false, u = 0;
    const T = TL(0);
    if (t >= T) { const qq = q(t - T); sx = 1 + .14 * qq; sy = 1 - .20 * qq; }
    if (t > T_WAVE && t < T_WAVE + .1758) rot = 5 * Math.PI / 180 * Math.sin(R.TAU * R.prog(t, T_WAVE, T_WAVE + .1758));
    let win = 1;
    if (t >= T_FALL && t < T_HOP) {                                // the crouch: 3 frames, the window closes with it
      const p = E.outQuad(R.prog(t, T_FALL, T_HOP));
      sx = 1 + .16 * p; sy = 1 - .22 * p; rot = 0;
    }
    if (t >= T_FALL) win = 1 - E.inQuad(R.prog(t, T_FALL, T_HOP));
    if (t >= T_HOP) {
      hopping = true; win = 0; rot = 0;
      u = R.prog(t, T_HOP, T_LAND);
      x = 159.5 + 927.5 * (1 - Math.pow(1 - u, 1.25));            // eased-out x: it never touches the circle
      y = 446.5 + 23.5 * u - 4 * 228 * u * (1 - u);               // a true parabola, apex y 230
      size = 147 + 293 * E.outBack(u, 1.05);
      rad = R.lerp(.2266, .2308, u);
      const p = 1 - E.outQuad(R.prog(t, T_HOP, T_HOP + S32));
      sx = 1 + .16 * p; sy = 1 - .22 * p;
    }
    return { sx, sy, rot, x, y, size, rad, hopping, u, win };
  }
  // rounded rect with four radii, no beginPath (same helper as the storyboard's 1.6)
  function rr4(ctx, x, y, w, h, r) {
    const [a, b, c, d] = r.map(v => Math.max(0, Math.min(v, w / 2, h / 2)));
    ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); if (b) ctx.arcTo(x + w, y, x + w, y + b, b); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c); if (c) ctx.arcTo(x + w, y + h, x + w - c, y + h, c); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + d, y + h); if (d) ctx.arcTo(x, y + h, x, y + h - d, d); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + a); if (a) ctx.arcTo(x, y, x + a, y, a); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  // grow > 0 expands the silhouette (the moat); the callback never sets fillStyle
  function drawBlock(c, t, grow = 0) {
    const b = blockState(t);
    c.save();
    if (b.hopping) { c.translate(b.x, b.y); c.scale(b.sx, b.sy); c.translate(-b.x, -b.y); }
    else { c.translate(159.5, 520); c.rotate(b.rot); c.scale(b.sx, b.sy); c.translate(-159.5, -520); }
    const s = b.size + grow * 2, r = b.rad * b.size + grow;
    c.beginPath();
    rr4(c, b.x - s / 2, b.y - s / 2, s, s, [r, r, r, r]);
    if (b.win > .002 && !grow) {
      const w = 62 * b.win, wr = 18.4 * b.win;
      rr4(c, b.x - w / 2, b.y - w / 2, w, w, [wr, wr, wr, wr]);
      c.fill('evenodd');
    } else c.fill();
    c.restore();
  }
  const circX = t => -330 + 977 * R.prog(t, T_FALL, T_END);      // constant speed 2084 px/s, tangent to the block at 1.875
  const drawCircle = (c, tt, grow = 0) => { c.beginPath(); c.arc(circX(tt), 470, 220 + grow, 0, R.TAU); c.fill(); };

  // a flat shape blurred as a white coverage mask and coloured afterwards (near-black colours cannot go through R.motionBlur in 8 bits)
  function maskBlur(ctx, t, draw, colour, { samples = 10, subs = 2, shutter, name }) {
    const L = R.layer(name), c = L.ctx, gap = shutter / (samples - 1);
    if (R.quality < 1) { c.save(); c.fillStyle = '#fff'; draw(c, t); c.restore(); }
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
  const SHUT_BLOCK = R.shutterFor(2600, 10, 14), SHUT_CIRCLE = R.shutterFor(2084, 10, 14);   // both hit the 1/60 s cap

  /* ---- the tagline ---- */
  function drawChunk(c, ch, col, t) {
    const p = R.prog(t, ch.T, ch.T + .22);
    if (p <= 0) return;
    const falling = t >= ch.fall;
    const rise = 90 * (1 - E.outBack(p, .9)), k = Math.tan(8 * Math.PI / 180) * (1 - E.outExpo(p));
    const fall = falling ? 560 * E.inQuad(R.prog(t, ch.fall, ch.fall + .24)) : 0;
    if (fall > 500) return;
    c.save();
    if (!falling) { c.beginPath(); c.rect(X0 + ch.x - 20, 580, ch.w + 40, 106); c.clip(); }   // the baseline mask
    c.transform(1, 0, -k, 1, k * TAG_BASE, 0);
    R.font(c, 77.5, 'sans', 700);
    c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(ch.s, X0 + ch.x, TAG_BASE + rise + fall);
    c.restore();
  }

  function typeLayer(ctx, t) {
    const L = R.layer('s1:type'), lc = L.ctx;
    lc.textBaseline = 'alphabetic'; lc.textAlign = 'left';
    // ink bar: the right edge wipes out on whip, retracts on the fall
    let barRight = R.lerp(BAR_L, BAR_R, E.whip(R.prog(t, T_INK, T_WAVE)));
    if (t >= T_FALL) barRight = R.lerp(BAR_L, barRight, 1 - E.inQuart(R.prog(t, T_FALL, T_FALL + .117)));
    const bar = barRight > BAR_L + .5;
    if (bar) { lc.fillStyle = SHOP; R.roundRect(lc, BAR_L, 580, barRight - BAR_L, 106, 24); lc.fill(); }
    for (const ch of CH) drawChunk(lc, ch, SHOP, t);
    if (bar) { lc.save(); R.roundRect(lc, BAR_L, 580, barRight - BAR_L, 106, 24); lc.clip(); drawChunk(lc, CH[2], ACID, t); lc.restore(); }
    // contact streaks: a flat dark ripple runs out along the baseline from each landing (short, fades in 9 frames)
    lc.fillStyle = SHOP;
    for (let i = 0; i < 9; i++) {
      const tau = t - TL(i);
      if (tau < 0 || tau > .16 || t >= T_FALL) continue;
      const p = tau / .16, e = E.outCubic(p), cx = X0 + ORG[i] + ADV[i] / 2, hl = ADV[i] * .42 + 90 * e;
      lc.globalAlpha = .55 * (1 - p) * (1 - p);
      R.roundRect(lc, cx - hl, BASE + 6, hl * 2, 6 * (1 - .6 * p), 3); lc.fill();
    }
    lc.globalAlpha = 1;
    // wordmark
    R.font(lc, 190, 'display', 900);
    for (let i = 0; i < 9; i++) {
      const s = glyphState(i, t);
      if (s.yo > 1200 || s.yo < -1000) continue;
      const cx = X0 + ORG[i] + ADV[i] / 2;
      lc.fillStyle = SHOP;
      lc.save(); lc.translate(cx, BASE + s.yo); lc.rotate(s.rot); lc.scale(s.sx, s.sy); lc.translate(-cx, -BASE);
      lc.fillText(WORD[i], X0 + ORG[i], BASE); lc.restore();
    }
    // the moat: the swept silhouette of the flying block and circle, cut 10 px wider, so black never merges with black
    if (t >= T_FALL) {
      lc.globalCompositeOperation = 'destination-out'; lc.fillStyle = '#000';
      for (let k = 0; k < 5; k++) {
        const tt = t + SHUT_BLOCK * (k / 4 - .5);
        if (tt >= T_HOP) drawBlock(lc, tt, 10);
        drawCircle(lc, tt + (SHUT_CIRCLE - SHUT_BLOCK) * (k / 4 - .5), 10);
      }
      lc.globalCompositeOperation = 'source-over';
    }
    R.blit(ctx, L);
  }

  /* ---- the picture ---- */
  function fx(t) {
    const f = R.fx;
    f.bloom = .10; f.threshold = .85; f.vignette = .10; f.grain = .035;
    for (let i = 0; i < 9; i++) {
      const T = TL(i);
      if (T < 0 || t < T) continue;
      if (i === 8) R.impact(t, T, { amount: 9, decay: 9, freq: 28, rot: .01 });
      else R.impact(t, T, { amount: 3, decay: 22, freq: 30, rot: .004 });
    }
  }

  function draw(ctx, t) {
    measure();
    // the world: lime with a faint radial (stays within about 6 levels of #c8ff3d)
    ctx.fillStyle = ACID; ctx.fillRect(0, 0, 1920, 1080);
    const g = ctx.createRadialGradient(960, 470, 0, 960, 470, 1100);
    g.addColorStop(0, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    // the type layer (tagline, bar, wordmark) with the moat cut, unless every glyph has left
    if (t < T_FALL + 8 * S128 + .2786 + .02 + 0.0) typeLayer(ctx, t);
    // the block, and the circle
    ctx.fillStyle = SHOP;
    if (t >= T_HOP) maskBlur(ctx, t, (c, tt) => drawBlock(c, tt), SHOP, { shutter: SHUT_BLOCK, name: 's1:mbBlock' });
    else drawBlock(ctx, t);
    if (t >= T_FALL) maskBlur(ctx, t, (c, tt) => drawCircle(c, tt), SHOP, { shutter: SHUT_CIRCLE, name: 's1:mbCircle' });
    fx(t);
  }

  R.scene({ id: 's1', name: 'wlns.shop', start: 0, end: T_END, layer: 2, setup() { measure(); }, draw });
})();
