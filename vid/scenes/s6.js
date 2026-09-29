/* s6: Scroll and hero. The page scrolls back to the top in one whip: it dips 30 px, then streams at up to 22,000 px/s through the reel's own
   colours run backwards (apps sky, CreatorMatch black, wlns lime) as pre-smeared sprites, lands with a small bounce on the site's own hero
   (avatar, name, URL, credit), and on the final hit a glint crosses the name while each letter hops as it passes. Then a hold that stays alive.
   Owns R.fx from 11.484375. Every frame is a pure function of t (the sprite and its smear levels are built once in setup). */
(() => {
  const R = Reel, E = R.ease;
  R.preload({ ridge: '/vid/assets/ridge.jpg', me: '/vid/assets/avatar.webp', fox: '/vid/assets/kaught-512.png', soon: '/vid/assets/soon.svg', brain: '/vid/assets/brain.svg' });

  const B = 0.46875, S16 = B / 4, S32 = B / 8;
  const q = (tau, k = 320, c = 15) => tau < 0 ? 0 : 1 - R.spring(tau, k, c);      // impact ring: 1 at contact, rings to 0

  // ---- colours ----
  const ICE = '#eaf4fb', BLUE = '#5fa8d3', URLC = '#9ecae5', ACID = '#c8ff3d', SHOP = '#0a0a0a', CM = '#070a12', CMW = '#eff0ee', PINK = '#F5C9D1', BROWN = '#A8704E';

  // ---- Y(t): the page scroll, copied verbatim into s5 and s6 (contract H5) ----
  const T_A = 11.484375, T_W = 11.6015625, T_L = 12.1875, DIST = 4320;
  function Y(t) {
    if (t < T_A) return 0;
    if (t < T_W) return -30 * E.outQuad(R.prog(t, T_A, T_W));                          // anticipation: the page dips 30 px up
    if (t < T_L) return -30 + (DIST + 30) * E.inOutCubic(R.prog(t, T_W, T_L));         // the whip: 4350 px in 0.586 s, peak 22,270 px/s at t 11.895
    const tau = t - T_L; return DIST + 18 * Math.exp(-9 * tau) * Math.sin(28 * tau);   // landing: +11.4 px at 12.233, within 0.5 px by 12.59
  }
  const speedPF = t => Math.abs(Y(t + 1 / 120) - Y(t - 1 / 120));                     // px moved in one frame

  // ---- times on the grid ----
  const T_F0 = 698 / 60, T_F1 = 700 / 60;                    // sprite window fades in over frames 698 to 700 (0, .5, 1)
  const T_SW0 = 12.1333, T_SW1 = 12.1667;                    // sprite hero -> live hero swap (frames 728 to 730)
  const T_UL = R.at(7, 3, 2);                                // 12.3047 underline and credit
  const T_FINAL = R.at(8, 1);                                // 13.125 final hit
  const T_HOLD = 13.4, T_END = 14.9833;

  // ---- shapes ----
  function rr4(ctx, x, y, w, h, r) {
    const [a, b, c, d] = r.map(v => Math.max(0, Math.min(v, w / 2, h / 2)));
    ctx.moveTo(x + a, y); ctx.lineTo(x + w - b, y); if (b) ctx.arcTo(x + w, y, x + w, y + b, b); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - c); if (c) ctx.arcTo(x + w, y + h, x + w - c, y + h, c); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + d, y + h); if (d) ctx.arcTo(x, y + h, x, y + h - d, d); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + a); if (a) ctx.arcTo(x, y, x + a, y, a); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  const ARR = new Path2D('M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z');
  const HL = new Path2D('M31 9.5c-3.2-2.6-8.6-2.1-10.6 1.6-5-.7-9 3.2-8.2 8.1-4.4 2-5.6 7.6-2.6 11.2-2.9 3.4-1.8 9 2.3 10.8-.3 5 3.9 8.6 8.8 7.6 2.2 3.9 7.7 4.9 10.3 1.4z');
  const HR = new Path2D('M33 9.5c3.2-2.6 8.6-2.1 10.6 1.6 5-.7 9 3.2 8.2 8.1 4.4 2 5.6 7.6 2.6 11.2 2.9 3.4 1.8 9-2.3 10.8.3 5-3.9 8.6-8.8 7.6-2.2 3.9-7.7 4.9-10.3 1.4z');
  const FOLDS = ['M20.5 18.5c3.2.2 5.4 2.6 5.3 5.8', 'M13.5 31c3.8-1.2 7.4.6 8.6 4.2', 'M20 42.5c.2-3 2.6-5.2 5.6-5.1',
    'M43.5 18.5c-3.2.2-5.4 2.6-5.3 5.8', 'M50.5 31c-3.8-1.2-7.4.6-8.6 4.2', 'M44 42.5c-.2-3-2.6-5.2-5.6-5.1'].map(d => new Path2D(d));

  // ---- the hero (drawn twice: once into the sprite, once live) ----
  const NAME = 'Jeremy Lasne', URL = 'jeremylasne.com', CREDIT = 'Motion design by Claude';
  let NG = null, UG = null, HALO = null;                      // glyph tables of the name and the URL, and one soft halo sprite per glyph (setup)
  const HP = 30, HB = 250, HH = 330;                          // halo sprite padding, baseline row and height
  function measureHero() {
    const c = document.createElement('canvas').getContext('2d');
    R.font(c, 220, 'sans', 700); NG = R.glyphs(c, NAME, -5.5);
    R.font(c, 100, 'sans', 500); UG = R.glyphs(c, URL, -1);
    // the glint's halo is static per glyph (only the hop and the squash move), so it is stroked once here, never per frame
    HALO = NG.chars.map(g => {
      if (g.ch === ' ') return null;
      const cv = mkCanvas(Math.ceil(g.w) + 2 * HP, HH), x = cv.getContext('2d');
      R.font(x, 220, 'sans', 700); x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
      x.strokeStyle = 'rgba(200,230,255,.30)'; x.lineWidth = 22; x.strokeText(g.ch, HP, HB);
      x.strokeStyle = 'rgba(215,236,255,.50)'; x.lineWidth = 8; x.strokeText(g.ch, HP, HB);
      return cv;
    });
  }
  function heroGlow(c, dy, k) {
    const a = .40 * k;
    const g = c.createRadialGradient(960, 250 + dy, 0, 960, 250 + dy, 300);
    g.addColorStop(0, `rgba(95,168,211,${a.toFixed(4)})`); g.addColorStop(1, 'rgba(95,168,211,0)');
    c.fillStyle = g; c.fillRect(560, -100 + dy, 800, 700);
  }
  function heroAvatar(c, dy) {
    const im = R.img('me');
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.beginPath(); c.arc(960, 250 + dy, 140, 0, R.TAU); c.clip();
    if (im && im.naturalWidth) c.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 820, 110 + dy, 280, 280);
    c.restore();
    c.strokeStyle = 'rgba(234,244,251,.14)'; c.lineWidth = 3; c.beginPath(); c.arc(960, 250 + dy, 141.5, 0, R.TAU); c.stroke();
  }
  // the name glyph by glyph; `hop(i)` gives { lift, sx, sy } for glyph i (live hero only)
  function heroName(c, dy, hop, fill, halo) {
    R.font(c, 220, 'sans', 700); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = fill;
    const left = 960 - NG.width / 2, base = 650 + dy;
    NG.chars.forEach((g, k) => {
      if (g.ch === ' ') return;
      if (!hop) { c.fillText(g.ch, left + g.x, base); return; }
      const h = hop(g);
      c.save(); c.translate(left + g.x + g.w / 2, base - h.lift); c.scale(h.sx, h.sy);
      if (halo) c.drawImage(HALO[k], -g.w / 2 - HP, -HB);
      c.fillText(g.ch, -g.w / 2, 0); c.restore();
    });
  }
  function heroUrl(c, dy) {
    R.font(c, 100, 'sans', 500); c.textBaseline = 'alphabetic'; c.fillStyle = URLC;
    R.text(c, URL, 960, 815 + dy, { align: 'center', tracking: -1 });
  }
  function heroScrim(c, dy) {                                 // contrast for the URL and the credit over the night
    const sg = c.createLinearGradient(0, 560 + dy, 0, 1000 + dy);
    sg.addColorStop(0, 'rgba(5,11,22,0)'); sg.addColorStop(1, 'rgba(5,11,22,.40)');
    c.fillStyle = sg; c.fillRect(0, 560 + dy, 1920, 1200);
  }
  function drawHeroStatic(c, dy) {                            // the sprite's hero: scrim, glow, avatar, name, URL (no underline, no credit)
    heroScrim(c, dy); heroGlow(c, dy, 1); heroAvatar(c, dy); heroName(c, dy, null, ICE); heroUrl(c, dy);
  }

  // ---- the panels of the page (stand-ins for the four upper ones: they are motion-blurred, so right colours in the right places) ----
  const XS = [300, 740, 1180, 1620];
  function panelApps(c) {                                     // page [-1080, 0): the sky recipe at z = 1, the four tiles at rest, their labels
    const im = R.img('ridge');
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.translate(960, 1080);
    if (im && im.naturalWidth) c.drawImage(im, 0, 0, 1536, 1024, -960, -1280, 1920, 1280);
    c.restore();
    const g = c.createLinearGradient(0, 380, 0, 1080);
    g.addColorStop(0, 'rgba(5,11,22,0)'); g.addColorStop(.38, 'rgba(5,11,22,.55)'); g.addColorStop(.70, 'rgba(5,11,22,.86)'); g.addColorStop(1, 'rgba(5,11,22,.94)');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
    c.save(); c.globalCompositeOperation = 'lighter';
    const mg = c.createRadialGradient(1627.5, 172.5, 0, 1627.5, 172.5, 160);
    mg.addColorStop(0, 'rgba(210,225,255,.20)'); mg.addColorStop(1, 'rgba(210,225,255,0)');
    c.fillStyle = mg; c.fillRect(1467, 12, 320, 320); c.restore();
    const T = 320, YC = 450;
    // tile shadows (a soft dark ellipse stand-in, no shadowBlur needed at this scale: the panel is blurred)
    for (let i = 0; i < 4; i++) {
      const sg = c.createRadialGradient(XS[i], YC + 30, 40, XS[i], YC + 30, 230);
      sg.addColorStop(0, 'rgba(3,8,20,.40)'); sg.addColorStop(1, 'rgba(3,8,20,0)');
      c.fillStyle = sg; c.fillRect(XS[i] - 240, YC - 210, 480, 480);
    }
    if (R.drawIdy) R.drawIdy(c, XS[0], YC, T);
    else { c.fillStyle = '#f78a1a'; c.beginPath(); rr4(c, XS[0] - 160, YC - 160, T, T, [71.6, 71.6, 71.6, 71.6]); c.fill(); }
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; R.drawIcon(c, 'fox', XS[1], YC, T); c.restore();
    for (const i of [2, 3]) {
      c.fillStyle = CM; c.beginPath(); rr4(c, XS[i] - 160, YC - 160, T, T, [71.6, 71.6, 71.6, 71.6]); c.fill();
      R.drawIcon(c, 'soon', XS[i], YC, T);
      c.beginPath(); rr4(c, XS[i] - 158.5, YC - 158.5, T - 3, T - 3, [70, 70, 70, 70]); c.strokeStyle = 'rgba(234,244,251,.30)'; c.lineWidth = 3; c.stroke();
    }
    c.fillStyle = 'rgba(234,244,251,.9)'; R.font(c, 72, 'sans', 700); c.textBaseline = 'alphabetic';
    ['i dare you', 'Kaught', 'Soon', 'Soon'].forEach((s, i) => R.text(c, s, XS[i], 716, { align: 'center' }));
  }
  function panelCM(c) {                                       // page [-2160, -1080): CreatorMatch's black, the mark at rest, name and line
    c.fillStyle = CM; c.fillRect(0, 0, 1920, 1080);
    const cc = 833, sc = 1087, CY = 470, RC = 101.5;
    c.fillStyle = CMW; c.beginPath(); c.arc(cc, CY, 220, 0, R.TAU); rr4(c, sc - 220, CY - 220, 440, 440, [RC, RC, RC, RC]); c.fill('evenodd');
    c.save(); c.beginPath(); c.arc(cc, CY, 220, 0, R.TAU); c.clip(); c.beginPath(); rr4(c, sc - 220, CY - 220, 440, 440, [RC, RC, RC, RC]); c.clip();
    const g = c.createLinearGradient(0, 250, 0, 690); g.addColorStop(0, '#1a4fb8'); g.addColorStop(1, '#3f86e0');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); c.restore();
    c.textBaseline = 'alphabetic';
    c.fillStyle = CMW; R.font(c, 170, 'sans', 800); R.text(c, 'CreatorMatch', 960, 858, { align: 'center', tracking: -5.1 });
    c.fillStyle = 'rgba(234,244,251,.72)'; R.font(c, 72, 'sans', 500); R.text(c, 'I build mobile apps with influencers.', 960, 950, { align: 'center' });
  }
  let TAGX = null;                                            // chunk offsets of s1's tagline (measured)
  function panelShop(c) {                                     // page [-3240, -2160): wlns.shop's lime world, s1's rest layout (no ink bar)
    c.fillStyle = ACID; c.fillRect(0, 0, 1920, 1080);
    const g = c.createRadialGradient(960, 470, 0, 960, 470, 1100);
    g.addColorStop(0, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(0,0,0,.06)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = SHOP; c.beginPath(); rr4(c, 86, 373, 147, 147, [33.3, 33.3, 33.3, 33.3]); rr4(c, 159.5 - 31, 446.5 - 31, 62, 62, [18.4, 18.4, 18.4, 18.4]); c.fill('evenodd');
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    R.font(c, 195, 'display', 900); c.fillText('WLNS.SHOP', 273, 520);
    R.font(c, 79.5, 'sans', 700);
    ['The link-in-bio', 'shop for', 'wellness creators.'].forEach((s, i) => c.fillText(s, 273 + TAGX[i], 660));
  }
  function panelPersonal(c) {                                 // page [0, 1080): s5's end state, built from the numbers of 3.5
    const ha = .34 * (1 + .04 * Math.sin(R.TAU * (700 / 60 - 10.546875) / .9375)) * (1 + .6 * Math.exp(-(700 / 60 - 10.95703125) / .12));
    const g = c.createRadialGradient(1500, 514, 0, 1500, 514, 420);
    g.addColorStop(0, `rgba(245,201,209,${ha.toFixed(4)})`); g.addColorStop(1, 'rgba(245,201,209,0)');
    c.fillStyle = g; c.fillRect(1080, 94, 840, 840);
    c.beginPath(); rr4(c, 140, 299, 1640, 430, [67, 67, 67, 67]);
    c.fillStyle = 'rgba(245,201,209,.13)'; c.fill(); c.strokeStyle = 'rgba(245,201,209,.38)'; c.lineWidth = 3; c.stroke();
    const im = R.img('brain');
    if (im && im.naturalWidth) c.drawImage(im, 256 - 58, 407 - 50.75, 116, 101.5);
    c.textBaseline = 'alphabetic';
    R.font(c, 84, 'sans', 700); c.fillStyle = PINK; R.text(c, 'Brain', 382, 427, { tracking: -.84 });
    R.font(c, 72, 'sans', 400); c.fillStyle = 'rgba(234,244,251,.72)';
    c.fillText('A folder that gets smarter', 382, 531); c.fillText('every time you feed it.', 382, 627);
    c.save(); c.translate(1700, 407); c.scale(4.8, 4.8); c.translate(-8, -8); c.fillStyle = 'rgba(234,244,251,.46)'; c.fill(ARR, 'evenodd'); c.restore();
    // the big brain, joined, all six folds
    const k = 380 / 64;
    c.save(); c.translate(1500 - 32 * k, 514 - 32 * k); c.scale(k, k); c.lineJoin = 'round'; c.lineCap = 'round';
    for (const P of [HL, HR]) { c.fillStyle = PINK; c.fill(P); c.strokeStyle = BROWN; c.lineWidth = 3; c.stroke(P); }
    c.strokeStyle = BROWN; c.lineWidth = 2.6; for (const P of FOLDS) c.stroke(P);
    c.restore();
  }

  // ---- the sprite and its smear levels ----
  const LV = [0, 30, 90, 200, 380];                           // smear in full-resolution px; 0 is the sprite itself
  let levels = null, heroFull = null;
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // vertical box blur of `px` sprite px as 2^k equally spaced copies (about 1.5 px apart or less), made by doubling (k draws, never stacked copies).
  // Two scratch canvases are ping-ponged and reused for every level so phones never hold more than the finals plus two.
  function smear(src, px, scr) {
    const k = Math.max(4, Math.ceil(Math.log2(px / 1.5))), d = px / ((1 << k) - 1);
    let cur = src, nxt = scr[0];
    for (let i = 0; i < k; i++) {
      const x = nxt.getContext('2d');
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, nxt.width, nxt.height);
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = .5;
      x.drawImage(cur, 0, 0); x.drawImage(cur, 0, d * (1 << i));
      cur = nxt; nxt = (nxt === scr[0]) ? scr[1] : scr[0];
    }
    const out = mkCanvas(src.width, src.height), o = out.getContext('2d');
    o.drawImage(cur, 0, -px / 2);                             // centre the comb
    return out;
  }
  function buildSprite() {
    const sp = mkCanvas(960, 2700), sc = sp.getContext('2d');
    const panel = (slot, fn) => {
      sc.save(); sc.beginPath(); sc.rect(0, slot * 540, 960, 540); sc.clip();
      sc.translate(0, slot * 540); sc.scale(.5, .5);
      sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
      fn(sc); sc.restore();
    };
    panel(0, c => drawHeroStatic(c, 0));
    panel(1, panelShop); panel(2, panelCM); panel(3, panelApps); panel(4, panelPersonal);
    heroFull = mkCanvas(1920, 1080); drawHeroStatic(heroFull.getContext('2d'), 0);
    const scr = [mkCanvas(960, 2700), mkCanvas(960, 2700)];
    levels = [sp];
    for (let i = 1; i < LV.length; i++) levels.push(smear(sp, LV[i] / 2, scr));
    scr[0].width = scr[1].width = 0;
  }

  // ---- the sprite window: the page as it is on this frame, panel by panel, two smear levels blended ----
  // The two levels are ADDED ('lighter') at alphas 1 - w and w into a layer, so coverage interpolates: opaque panels stay at coverage 1 and
  // translucent pixels (plate, halo, glow) keep their own opacity instead of being composited twice (source-over at 1 and w reaches 2x).
  function drawRows(ctx, im, scale, r0, r1, sy0, alpha) {     // sprite rows [r0, r1) of the window that starts at sprite row sy0
    const a = Math.max(r0, sy0), b = Math.min(r1, sy0 + 540);
    if (b <= a || alpha <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, 0, a * scale, 960 * scale, (b - a) * scale, 0, (a - sy0) * 2, 1920, (b - a) * 2);
    ctx.globalAlpha = 1;
  }
  function windowPass(ctx, t, doOther, doHero) {
    const y = Y(t), S = speedPF(t), sy0 = (DIST - y) * .5;
    let i = 0; while (i < 3 && S >= LV[i + 1]) i++;
    const w = R.clamp((S - LV[i]) / (LV[i + 1] - LV[i]));
    const wo = i === 0 ? Math.min(1, S / 10) : w;              // every panel but the hero is never drawn unsmeared above about 10 px per frame
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
    if (doOther) { drawRows(ctx, levels[i], 1, 540, 2700, sy0, 1 - wo); drawRows(ctx, levels[i + 1], 1, 540, 2700, sy0, wo); }
    if (doHero) {
      if (i === 0) drawRows(ctx, heroFull, 2, 0, 540, sy0, 1 - w); else drawRows(ctx, levels[i], 1, 0, 540, sy0, 1 - w);
      drawRows(ctx, levels[i + 1], 1, 0, 540, sy0, w);
    }
    ctx.restore();
  }

  // ---- the live hero ----
  // One clock for glint and hop: the band's centre moves LINEARLY at the spec's own hop-wave speed (1346.7 px in .35 s), from 60 px left of the name,
  // and each glyph lifts as the centre reaches its left edge, so the light and the letter it lifts travel together.
  const SWEEP = 1346.7 / .35, LIFT = 20;
  const hopOf = (t) => (g) => {
    const Ti = T_FINAL + (g.x + 60) / SWEEP;
    const p = R.prog(t, Ti, Ti + .176), lift = LIFT * Math.sin(Math.PI * p), l = q(t - (Ti + .176), 320, 15);
    return { lift, sx: 1 + .06 * l, sy: 1 - .10 * l };
  };
  function drawLive(ctx, t, dy, a) {
    ctx.save(); ctx.globalAlpha = a;
    if (a >= 1 || t >= T_L) heroScrim(ctx, dy);                 // (before the swap completes the sprite underneath carries the scrim and the glow)
    let gk = 1 + .06 * Math.sin(R.TAU * (t - T_L) / 1.875);
    if (t >= T_L) gk *= 1 + .5 * Math.exp(-(t - T_L) / .25);
    if (a >= 1 || t >= T_L) heroGlow(ctx, dy, gk);              // (before the swap completes the sprite underneath carries the glow)
    heroAvatar(ctx, dy);
    heroName(ctx, dy, t >= T_FINAL ? hopOf(t) : null, ICE);
    heroUrl(ctx, dy);
    // underline draws on left to right
    const ux = 960 - UG.width / 2, up = E.swift(R.prog(t, T_UL, T_UL + .35));
    if (up > 0) { ctx.fillStyle = BLUE; ctx.fillRect(ux, 844 + dy, UG.width * up, 6); }
    // the credit rises through a mask
    const cp = E.outExpo(R.prog(t, T_UL, T_UL + .176));
    if (cp > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(560, 985 + dy - 56, 800, 56 + 12); ctx.clip();
      R.font(ctx, 56, 'mono', 500); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(234,244,251,.75)';
      R.text(ctx, CREDIT, 960, 985 + dy + 60 * (1 - cp), { align: 'center' }); ctx.restore();
    }
    ctx.restore();
  }
  function drawGlint(ctx, t, dy) {
    const left = 960 - NG.width / 2, xc = left - 60 + SWEEP * (t - T_FINAL);
    if (t < T_FINAL || xc > left + NG.width + 200) return;
    const L = R.layer('s6:glint'), c = L.ctx;
    heroName(c, dy, hopOf(t), '#fff', true);   // the halo is what makes a glint read on letters that are already near white
    c.globalCompositeOperation = 'destination-in';
    c.save(); c.translate(xc, 650 + dy); c.transform(1, 0, -Math.tan(25 * Math.PI / 180), 1, 0, 0);
    const g = c.createLinearGradient(-95, 0, 95, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.38, 'rgba(255,255,255,1)'); g.addColorStop(.62, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(-95, -300, 190, 420); c.restore();
    c.globalCompositeOperation = 'source-over';
    R.blit(ctx, L, .55, 'lighter');
  }
  function drawRing(ctx, t, dy) {
    const tau = t - T_FINAL;
    if (tau < 0 || tau >= .5) return;
    ctx.save(); ctx.strokeStyle = ICE; ctx.lineWidth = 3; ctx.globalAlpha = .5 * (1 - tau / .5);
    ctx.beginPath(); ctx.arc(960, 250 + dy, 140 + 160 * E.outExpo(tau / .5), 0, R.TAU); ctx.stroke(); ctx.restore();
  }

  // ---- post-FX ----
  function fx(t) {
    const f = R.fx;
    f.bloom = .30; f.threshold = .62;
    let zoom = 1;
    if (t >= T_W && t < T_L) {                                 // the whip
      const p = R.prog(t, T_W, T_L), s = Math.sin(Math.PI * p), v = 89087 * Math.min(p, 1 - p) ** 2;
      f.chroma = 17.8 * R.clamp((v - 12000) / 10270); f.chromaAngle = Math.PI / 2;
      f.distort = .03 * s; zoom += .032 * s; f.vignette += .08 * s;
    }
    if (t >= T_L) {                                            // the landing
      const tau = t - T_L;
      R.flash(t, T_L, { amount: .40, decay: 30, color: ICE });
      R.impact(t, T_L, { amount: 12, decay: 9, freq: 28, rot: .012 });
      f.chroma = 8 * Math.exp(-tau / .05); f.chromaAngle = 0;
      f.bloom += .5 * Math.exp(-8 * tau);
      zoom += .04 * (1 - E.outExpo(R.prog(t, T_L, 12.4219)));
    }
    if (t >= T_FINAL) {                                        // the final hit: a soft bloom pulse and a small kick, no flash, shake or chroma
      f.bloom += .18 * Math.sin(Math.PI * R.prog(t, T_FINAL, T_FINAL + .5));
      zoom += .03 * (1 - E.outExpo(R.prog(t, T_FINAL, T_FINAL + .234)));
    }
    if (t >= T_HOLD) zoom += .03 * E.inOutSine(R.prog(t, T_HOLD, T_END));
    f.zoom = Math.max(zoom, 1 + 1.05 * f.distort);
  }

  R.scene({
    id: 's6', name: 'Scroll and hero', start: T_A, end: 15, layer: 3,
    setup() {
      const mc = document.createElement('canvas').getContext('2d');
      R.font(mc, 79.5, 'sans', 700);
      const w = ['The link-in-bio', 'shop for', 'wellness creators.'].map(s => mc.measureText(s).width), sp = mc.measureText(' ').width;
      TAGX = [0, w[0] + sp, w[0] + sp + w[1] + 40];
      measureHero();
      buildSprite();
    },
    draw(ctx, t) {
      fx(t);
      const dy = Y(t) - DIST;
      if (t >= T_F0 && t < T_L) {
        const A = R.prog(t, T_F0, T_F1);
        const swap = R.prog(t, T_SW0, T_SW1);                  // 0 -> 1 across frames 728 to 730
        const heroRows = swap < 1;
        const L = R.layer('s6:win');                           // always through a layer ('lighter' must not touch the world); A is the two-frame hand-off from s5
        windowPass(L.ctx, t, true, heroRows);
        R.blit(ctx, L, A);
        if (swap > 0) drawLive(ctx, t, dy, swap);
      } else if (t >= T_L) {
        drawLive(ctx, t, dy, 1);
        drawGlint(ctx, t, dy);
        drawRing(ctx, t, dy);
      }
    },
  });
})();
