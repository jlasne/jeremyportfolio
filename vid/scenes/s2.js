/* s2: CreatorMatch. The lime cuts to the CreatorMatch black on the exact geometry s1 left behind: the block is a white rounded square, the
   circle a white circle, and their overlap is a window (the lens) onto the sky (s7). The circle presses into the square on a spring, the
   wordmark builds letter by letter while its weight swells, the mark clicks, the tagline follows word by word, a glint crosses the lens,
   the two shapes converge, the lockup sinks by masks, and the mark winds down and is flung apart in a rubber-band pull-back that s3 slams shut.
   Every frame is a pure function of t. Owns R.fx from 1.875 to 4.453125. */
(() => {
  const R = Reel, E = R.ease;

  const O = [960, 470], D = 440, RC = 101.5, CY = 470;
  const CM = '#070a12', CMW = '#eff0ee', ICE = '#eaf4fb';
  const T_START = 1.875, T_END = 4.453125;
  const T_CLICK = R.at(2, 2), T_BUILD = R.at(2, 1, 3);                    // 2.34375, 2.109375
  const T_WORDS = [R.at(2, 2, 3), R.at(2, 2, 4), R.at(2, 3)];             // 2.578125 2.6953 2.8125
  const T_GLINT = R.at(2, 3, 2);                                          // 2.9297
  const T_SINK = R.at(3, 1), T_SINK_W = R.at(3, 1) + R.BEAT / 8;          // 3.75; 3.8086
  const BEATS = [R.at(2, 3), R.at(2, 4), R.at(3, 1), R.at(3, 2)];         // 2.8125 3.28125 3.75 4.21875
  const S32 = R.BEAT / 8;

  /* ---- shared with s2 (byte-identical): the one definition of the mark's separation for every t >= 2.8125 ---- */
  const T_REL = 4.5845, T_LOCK = 4.6875;
  function sep(t) {
    if (t < 2.8125)  return 254;
    if (t < 3.75)    return 254 - 90 * E.inOutCubic(R.prog(t, 2.8125, 3.75));       // slow convergence (max 4.8 px per frame), 164
    if (t < 4.21875) return 164 - 18 * E.inOutSine(R.prog(t, 3.75, 4.21875));        // wind-down, 146
    if (t < T_REL)   return 146 + 154 * E.outQuad(R.prog(t, 4.21875, T_REL));        // rubber-band pull-back to 300 in 22 frames (wider than the logo)
    if (t < T_LOCK)  return 300 * (1 - E.inQuad(R.prog(t, T_REL, T_LOCK)));          // the slam: fastest AT contact, 5,780 px/s (48 px per frame per piece)
    const tau = t - T_LOCK;                                                          // the lock rings once and is exactly concentric from 4.7875
    return tau < .1 ? -10.1 * Math.sin(Math.PI * tau / .1) * Math.exp(-8 * tau) : 0;
  }
  /* ---- end of shared code ---- */

  const q = (tau, k = 320, c = 15) => tau < 0 ? 0 : 1 - R.spring(tau, k, c);        // impact ring: 1 at contact, rings to 0

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
    if (R.quality < 1) { c.save(); c.fillStyle = '#fff'; draw(c, t); c.restore(); }      // slow devices: one crisp draw, like R.motionBlur
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

  /* ---- the mark: circle centre cc, square centre sc ---- */
  // phase A (the press, settled long before 2.8125): the circle arrives with the roll's speed (2083 px/s) carried by the spring's v0.
  // The square takes the hit as its own, quicker ring (a 14.5 px swing that peaks at 7.5 px) and squashes 4 percent in x, anchored on its left edge,
  // as the press bottoms out (2.03); both are 0 for good by 2.8125, so the convergence starts from the exact rest state.
  function pieces(t) {
    if (t < 2.8125) {
      const tau = t - T_START, u = Math.max(0, t - 1.975);
      return [647 + 186 * R.spring(tau, 260, 20, 1, 11.2), 1087 + 14.5 * Math.exp(-7.5 * tau) * Math.sin(15 * tau),
        D * (1 - .07 * Math.exp(-9 * u) * Math.sin(22 * u))];
    }
    const s = sep(t);
    return [960 - s / 2, 960 + s / 2, D];
  }
  // ONE transform for the whole glyph: the click pulse, the beat pulses (the pieces breathe with the kick), about O
  const kAt = t => {
    let k = 1 + .045 * q(t - T_CLICK, 300, 16);
    for (const T of BEATS) k += .02 * q(t - T, 320, 18);
    return k;
  };
  const glyphXf = (c, k) => { c.translate(O[0], O[1]); c.scale(k, k); c.translate(-O[0], -O[1]); };
  // circle(cc) and rounded square(sc) as ONE path (both clockwise: nonzero fill = union, evenodd fill = XOR)
  const markPath = (c, cc, sc, sw = D) => {
    c.beginPath();
    c.arc(cc, CY, D / 2, 0, R.TAU);
    rr4(c, sc - D / 2, CY - D / 2, sw, D, [RC, RC, RC, RC]);
  };
  // the lens: circle AND square, as a clip
  const lensClip = (c, cc, sc, sw = D) => {
    c.beginPath(); c.arc(cc, CY, D / 2, 0, R.TAU); c.clip();
    c.beginPath(); rr4(c, sc - D / 2, CY - D / 2, sw, D, [RC, RC, RC, RC]); c.clip();
  };
  const vel = t => { const e = 1 / 240, a = pieces(t - e), b = pieces(t + e); return Math.hypot((b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)); };

  /* ---- type (measured in setup with measureText) ---- */
  const WORD = 'CreatorMatch';
  const TAGW = ['I build', 'mobile apps', 'with influencers.'];
  let slot = [], tagX = [399.65, 599.65, 999.65], tagW = [184.6, 383.5, 520.6];
  const wFont = (ctx, w) => R.font(ctx, 170, 'sans', w);
  const TR = -1.7;                                                                 // -.02em: Inter Tight 800 fuses at -.03em (e/a shared 22 px of ink)
  function measure() {
    const c = document.createElement('canvas').getContext('2d');
    wFont(c, 800);
    // kern-aware slots: the origin of letter i is the width of the prefix THROUGH i minus the width of i (R.glyphs leaves the kern pair before i out)
    const wid = s => c.measureText(s).width, total = wid(WORD) + (WORD.length - 1) * TR, left = 960 - total / 2;
    slot = Array.from(WORD, (ch, i) => left + wid(WORD.slice(0, i + 1)) - wid(ch) + i * TR + wid(ch) / 2);
    R.font(c, 72, 'sans', 500);
    const ws = TAGW.map(s => c.measureText(s).width);                              // the words sit on the site's word spaces, 16 px here
    const tt = ws[0] + ws[1] + ws[2] + 32, l = 960 - tt / 2;
    tagX = [l, l + ws[0] + 16, l + ws[0] + ws[1] + 32]; tagW = ws;
  }

  /* ---- post-FX ---- */
  function fx(t) {
    const f = R.fx, tau = t - T_START;
    f.bloom = .30; f.vignette = .35;
    const ch = 9 * Math.exp(-tau / .05);
    f.chroma = ch > .02 ? ch : 0; f.chromaAngle = 0;                                  // the flip: 9 frames
    if (tau < 1) R.impact(t, T_START, { amount: 14, decay: 10, freq: 30, rot: .012 });
    const tc = t - T_CLICK;
    if (tc > 0) f.bloom += .10 * Math.exp(-8 * tc);
  }

  /* ---- pieces of the picture ---- */
  function drawLens(ctx, t, cc, sc, k, sw) {
    // the sheet: CM black over the frame, the UNION of both shapes cleared (the world shows through), then the white XOR pieces over it
    const L = R.layer('s2:sheet'), c = L.ctx;
    c.fillStyle = CM; c.fillRect(0, 0, 1920, 1080);
    c.globalCompositeOperation = 'destination-out';
    c.save(); glyphXf(c, k); markPath(c, cc, sc, sw); c.fill(); c.restore();
    c.globalCompositeOperation = 'source-over';
    // the press: while the circle is still at speed its white is smeared (the roll's blur carried through the cut). The smear goes into the
    // sheet layer and the crisp lens is punched back out, so the window itself never hazes.
    const v = vel(t), sh = R.shutterFor(v, 10, 14), blur = t < 2.4 && v * sh > 4;
    if (blur) {
      maskBlur(c, t, (b, tt) => { const [a, s2, w2] = pieces(tt); b.save(); glyphXf(b, kAt(tt)); markPath(b, a, s2, w2); b.fill('evenodd'); b.restore(); }, CMW, { shutter: sh, name: 's2:mbMark' });
      c.save(); c.globalCompositeOperation = 'destination-out'; glyphXf(c, k); lensClip(c, cc, sc, sw); c.fillRect(0, 0, 1920, 1080); c.restore();
    }
    R.blit(ctx, L);
    return blur;
  }
  function drawWhite(ctx, t, cc, sc, k, sw) {
    ctx.save(); ctx.fillStyle = CMW;
    glyphXf(ctx, k); markPath(ctx, cc, sc, sw); ctx.fill('evenodd');
    ctx.restore();
  }

  function drawGlint(ctx, t, cc, sc, k, sw) {
    const p = R.prog(t, T_GLINT, T_GLINT + .35);
    if (p <= 0 || p >= 1) return;
    const x0 = sc - D / 2 - 45, x1 = cc + D / 2 + 45, gx = R.lerp(x0, x1, E.inOutSine(p));   // a sheen, centred on the whoosh (peak 3.175)
    ctx.save(); glyphXf(ctx, k); lensClip(ctx, cc, sc, sw);
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(gx, CY); ctx.transform(1, 0, -Math.tan(20 * Math.PI / 180), 1, 0, 0);
    const g = ctx.createLinearGradient(-45, 0, 45, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.22, 'rgba(255,255,255,.42)'); g.addColorStop(.78, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-45, -260, 90, 520);
    ctx.restore();
  }

  // the glass: a faint inner rim on the lens edge (clipped to the lens, so it is the window's own edge and never spills onto the white)
  // (it fades out over 3.95 to 4.3 so that s3, which has none, matches the last frame exactly: H2)
  function drawRim(ctx, t, cc, sc, k, sw) {
    const a = 1 - R.prog(t, 3.95, 4.3);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; glyphXf(ctx, k); lensClip(ctx, cc, sc, sw);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(234,244,251,.16)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cc, CY, D / 2, 0, R.TAU); ctx.stroke();
    ctx.beginPath(); rr4(ctx, sc - D / 2, CY - D / 2, sw, D, [RC, RC, RC, RC]); ctx.stroke();
    ctx.restore();
  }

  function drawClick(ctx, t) {
    const tc = t - T_CLICK;
    if (tc <= 0 || tc >= .3) return;
    ctx.save(); ctx.globalCompositeOperation = 'difference';                        // light on black, dark on the white pieces: never vanishes on cream
    ctx.strokeStyle = ICE; ctx.lineWidth = 3.5; ctx.globalAlpha = .7 * (1 - tc / .3);
    ctx.beginPath(); ctx.arc(O[0], O[1], 60 + 260 * E.outExpo(tc / .3), 0, R.TAU); ctx.stroke();
    ctx.restore();
  }

  function drawWordmark(ctx, t) {
    if (t < T_BUILD) return;
    const ps = R.prog(t, T_SINK_W, T_SINK_W + .1627), sink = E.inCubic(ps);      // solid type dropping through the mask, not a dim
    if (ps >= 1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(300, 858 - 130, 1320, 136); ctx.clip();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.fillStyle = CMW;
    for (let i = 0; i < 12; i++) {
      const T = T_BUILD + i * S32, p = R.prog(t, T, T + .22);
      if (p <= 0) continue;
      const w = Math.round((200 + 600 * E.outCubic(R.prog(t, T, T + .234))) / 10) * 10;
      ctx.globalAlpha = Math.min(1, 2.5 * p) * (1 - E.inCubic(ps));
      wFont(ctx, w);
      ctx.fillText(WORD[i], slot[i], 858 + 70 * (1 - E.outExpo(p)) + 130 * sink);
    }
    ctx.restore();
  }

  function drawTagline(ctx, t) {
    if (t < T_WORDS[0]) return;
    const ps = R.prog(t, T_SINK, T_SINK + .117), sink = E.inQuad(ps);            // 90 px: the mask alone must hide the ascenders (55 px + the 24 px clip margin)
    if (ps >= 1) return;
    ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const T = T_WORDS[i], p = R.prog(t, T, T + .176);
      if (p <= 0) continue;
      const wt = Math.round((100 + 400 * E.outCubic(R.prog(t, T, T + .234))) / 10) * 10;
      ctx.save();
      ctx.beginPath(); ctx.rect(tagX[i] - 30, 950 - 74, tagW[i] + 60, 74 + 24); ctx.clip();
      ctx.globalAlpha = 1 - E.inCubic(ps); ctx.fillStyle = 'rgba(234,244,251,.72)';
      R.font(ctx, 72, 'sans', wt);
      ctx.fillText(TAGW[i], tagX[i] + tagW[i] / 2, 950 + 40 * (1 - E.outExpo(p)) + 90 * sink);
      ctx.restore();
    }
    ctx.restore();
  }

  Reel.scene({
    id: 's2', name: 'CreatorMatch',
    start: T_START, end: T_END, layer: 2,
    setup() { measure(); },
    draw(ctx, t) {
      fx(t);
      const [cc, sc, sw] = pieces(t), k = kAt(t);
      if (!drawLens(ctx, t, cc, sc, k, sw)) drawWhite(ctx, t, cc, sc, k, sw);
      drawRim(ctx, t, cc, sc, k, sw);
      drawClick(ctx, t);
      drawGlint(ctx, t, cc, sc, k, sw);
      drawWordmark(ctx, t);
      drawTagline(ctx, t);
    },
  });
})();
