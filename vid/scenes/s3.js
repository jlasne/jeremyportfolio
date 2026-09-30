/* s3: the match. The two shapes of the CreatorMatch mark are released from a rubber-band pull-back and slam into a concentric lock;
   the lock rings (bell, ring, sparks, streak), the overlap becomes a round aperture onto the sky, the four corner petals turn like shutter
   blades, then travel and morph (a shrinking circular bite) into four cards in the apps' own ground colours; the sky covers the frame,
   the picture dims, and seven frames are held, hushed, for the drop (s4).
   Every frame is a pure function of t. Owns R.fx from 4.453125 to 5.625. */
(() => {
  const R = Reel, E = R.ease;

  const O = [960, 470], D = 440, RC = 101.5;
  const CM = '#070a12', CMW = '#eff0ee', ICE = '#eaf4fb', BLUE = '#5fa8d3';
  const T_START = 4.453125, T_END = 5.625;
  const T_OPEN = R.at(3, 3, 2), T_TRAVEL = R.at(3, 3, 4), T_SETTLE = R.at(3, 4, 4), T_KICK = R.at(3, 4);   // 4.8047 5.0391 5.5078 5.15625
  const T_SKY = 5.390625, T_BLURSTOP = 4.72;
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

  /* ---- the glyph: one transform for the sheet hole, the white pieces and the petals ---- */
  // beat pulse carried over from s2 (the beat at 4.21875), then the lock squash
  const kAt = t => {
    let k = 1 + .02 * q(t - 4.21875, 320, 18);
    if (t >= T_LOCK) k *= 1 - .05 * Math.exp(-(t - T_LOCK) / .04);
    return k;
  };
  const glyphXf = (c, k) => { c.translate(O[0], O[1]); c.scale(k, k); c.translate(-O[0], -O[1]); };
  // circle(cc) and rounded square(sc) as ONE path (both clockwise: nonzero fill = union, evenodd fill = XOR)
  const markPath = (c, cc, sc) => {
    c.beginPath();
    c.arc(cc, O[1], D / 2, 0, R.TAU);
    rr4(c, sc - D / 2, O[1] - D / 2, D, D, [RC, RC, RC, RC]);
  };
  const rh = t => 220 + 930 * E.inCubic(R.prog(t, T_TRAVEL, T_SKY));

  /* ---- the four petals -> four cards ---- */
  const SLOT = { TL: [300, 450], BL: [740, 450], TR: [1180, 450], BR: [1620, 450] };
  const SIGN = { TL: [-1, -1], TR: [1, -1], BL: [-1, 1], BR: [1, 1] };
  const OUTER = { TL: 0, TR: 1, BR: 2, BL: 3 };            // index of the quadrant square's outer corner in [tl, tr, br, bl]
  const BASE = { TL: '#f78a1a', BL: '#487041', TR: '#070a12', BR: '#070a12' };
  const QS = ['TL', 'TR', 'BL', 'BR'];
  const DARK = { TL: 0, BL: 0, TR: 1, BR: 1 };
  // the shutter rotation of ALL FOUR petals about O (same sense, like the blades of a lens): 0 at T_OPEN and 0 from 5.3203
  const theta = t => 14 * Math.PI / 180 * E.outCubic(R.prog(t, T_OPEN, T_TRAVEL)) * (1 - E.inOutCubic(R.prog(t, T_TRAVEL, 5.3203125)));
  const mixAt = t => E.inOutQuad(R.prog(t, T_KICK, T_SETTLE));
  const mixLit = t => E.outCubic(R.prog(t, 5.0625, 5.3125));           // orange and green take their colour with the travel, so they land in colour
  const HUSH_DARK = '#2c374d';                                          // the two dark cards stay light until the sky covers them, then settle on dark glass (the grade crushes #070a12 to 0,0,0)
  const fillOf = (t, qn) => DARK[qn] ? R.mix(CMW, R.mixArr(BASE[qn], HUSH_DARK, E.inQuad(R.prog(t, 5.28, T_SETTLE))), mixAt(t)) : R.mix(CMW, BASE[qn], mixLit(t));
  function geom(t, qn) {
    const [sx, sy] = SIGN[qn], [tx, ty] = SLOT[qn];
    const dr = E.outQuad(R.prog(t, T_OPEN, T_TRAVEL));                                   // drift along the diagonal: 110 -> 196 from O
    const hx = 960 + sx * (110 + 86 * dr), hy = 470 + sy * (110 + 86 * dr);
    const px = E.outCubic(R.prog(t, T_TRAVEL, T_SETTLE)), py = E.inOutCubic(R.prog(t, 5.078125, T_SETTLE));
    const cx = R.lerp(hx, tx, px), cy = R.lerp(hy, ty, py);                              // x leads, y lags: the cards never collide
    const es = E.outCubic(R.prog(t, T_KICK, T_SETTLE)), eb = E.inOutQuad(R.prog(t, T_TRAVEL, 5.3203125));
    const S = R.lerp(220, 320, es), rho = 220 * (1 - eb);                                // side and bite radius
    const r = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) r[k] = k === OUTER[qn] ? R.lerp(RC, .2237 * S, es) : R.lerp(0, .2237 * S, eb);
    return { cx, cy, S, rho, r, bx: cx - sx * S / 2, by: cy - sy * S / 2 };
  }
  // centre of a petal on screen (rotation and glyph scale included), for its speed
  function centre(t, qn) {
    const g = geom(t, qn), a = theta(t), k = kAt(t), c = Math.cos(a), s = Math.sin(a);
    const dx = g.cx - 960, dy = g.cy - 470;
    return [960 + (dx * c - dy * s) * k, 470 + (dx * s + dy * c) * k];
  }
  const speedOf = (t, qn) => { const a = centre(t - .004, qn), b = centre(t + .004, qn); return Math.hypot(b[0] - a[0], b[1] - a[1]) / .008; };

  // the pre-blurred card shadow (built once, in setup)
  let shadow = null;
  function buildShadow() {
    const c = document.createElement('canvas'); c.width = 440; c.height = 440;
    const x = c.getContext('2d');
    x.shadowOffsetX = -1000; x.shadowBlur = 44; x.shadowColor = 'rgba(3,8,20,.45)'; x.fillStyle = '#000';
    R.roundRect(x, 220 + 1000 - 160, 220 - 160, 320, 320, 71.6); x.fill();
    return c;
  }
  function drawShadow(ctx, t, g) {
    if (!shadow) return;
    const a = .4 * R.prog(t, T_TRAVEL, T_SETTLE); if (a <= 0) return;
    const s = g.S / 320;
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(shadow, g.cx - 220 * s, g.cy + 20 * s - 220 * s, 440 * s, 440 * s); ctx.restore();
  }
  // the petal's shape (a square minus the bite), filled or stroked, inside the blade rotation
  function petalPath(c, g) { c.beginPath(); rr4(c, g.cx - g.S / 2, g.cy - g.S / 2, g.S, g.S, g.r); }
  function petalBite(c, g) { c.beginPath(); rr4(c, g.cx - g.S / 2, g.cy - g.S / 2, g.S, g.S, g.r); c.moveTo(g.bx + g.rho, g.by); c.arc(g.bx, g.by, g.rho, 0, R.TAU); }
  function petalXf(c, t) { glyphXf(c, kAt(t)); c.translate(960, 470); c.rotate(theta(t)); c.translate(-960, -470); }
  const rimAlpha = t => .30 * E.inOutQuad(R.prog(t, T_KICK, T_SETTLE));
  function drawPetal(c, t, qn) {
    const g = geom(t, qn);
    c.save(); petalXf(c, t);
    petalPath(c, g); c.clip();
    petalBite(c, g); c.fillStyle = fillOf(t, qn); c.fill('evenodd');
    const ra = DARK[qn] ? rimAlpha(t) : 0;
    if (ra > .002) {                                    // the Soon ring: 3 px, inset 1.5 px (a 6 px stroke, half of it clipped away)
      petalBite(c, g); c.clip('evenodd');
      c.strokeStyle = `rgba(234,244,251,${ra})`; c.lineWidth = 6;
      petalPath(c, g); c.stroke();
      if (g.rho > .5) { c.beginPath(); c.arc(g.bx, g.by, g.rho, 0, R.TAU); c.stroke(); }
    }
    c.restore();
  }
  function petalCoverage(c, tt, qn, rim) {              // white coverage of the petal (or of its rim) at time tt, for maskBlur
    const g = geom(tt, qn);
    c.save(); petalXf(c, tt);
    petalPath(c, g); c.clip();
    if (!rim) { petalBite(c, g); c.fill('evenodd'); }
    else {
      petalBite(c, g); c.clip('evenodd');
      c.strokeStyle = '#fff'; c.lineWidth = 6;
      petalPath(c, g); c.stroke();
      if (g.rho > .5) { c.beginPath(); c.arc(g.bx, g.by, g.rho, 0, R.TAU); c.stroke(); }
    }
    c.restore();
  }

  /* ---- the lock: ring, sparks, streak ---- */
  const TP = [[740, 470], [1180, 470], [960, 250], [960, 690]], NRM = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const SPARKS = (() => {
    const rg = R.rng(3301), out = [];
    for (let n = 0; n < 48; n++) {
      const j = n % 4, a = Math.atan2(NRM[j][1], NRM[j][0]) + (rg() - .5) * 1.22, sp = 450 + 600 * rg(), life = .35 + .15 * rg(), size = 2.5 + 3 * rg(), ice = rg() < .7;
      out.push({ x0: TP[j][0], y0: TP[j][1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, size, ice });
    }
    return out;
  })();
  function drawLock(ctx, t) {
    const tau = t - T_LOCK;
    if (tau < 0 || tau > .5) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // the glass rings: the window catches the hit (a rim glint and a soft inner glow that die in about a tenth of a second)
    if (tau < .4) {
      const e = Math.exp(-tau / .08);
      ctx.save(); glyphXf(ctx, kAt(t));
      ctx.beginPath(); ctx.arc(O[0], O[1], 220, 0, R.TAU);
      ctx.save(); ctx.clip();
      const g = ctx.createRadialGradient(O[0], O[1], 60, O[0], O[1], 220);
      g.addColorStop(0, R.rgba(ICE, 0)); g.addColorStop(1, R.rgba(ICE, .24 * e));
      ctx.fillStyle = g; ctx.fillRect(O[0] - 220, O[1] - 220, 440, 440);
      ctx.restore();
      ctx.strokeStyle = R.rgba(ICE, .5 * e); ctx.lineWidth = 4; ctx.stroke();
      ctx.restore();
    }
    // the ring
    if (tau < .3) {
      const u = tau / .3;
      ctx.strokeStyle = R.rgba(ICE, .8 * (1 - u)); ctx.lineWidth = 3 * (1 - u);
      ctx.beginPath(); ctx.arc(O[0], O[1], 480 * E.outExpo(u), 0, R.TAU); ctx.stroke();
    }
    // the anamorphic streak: a 1400 x 6 ellipse with a soft falloff
    if (tau < .25) {
      const a = .9 * (1 - E.outQuad(tau / .25));
      for (const [hw, hh, k] of [[520, 15, .22], [700, 3, 1]]) {           // a soft halo under the 6 px core
        ctx.save(); ctx.translate(O[0], O[1]); ctx.scale(hw, hh);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, R.rgba(ICE, a * k)); g.addColorStop(.35, R.rgba(ICE, a * k * .8)); g.addColorStop(1, R.rgba(ICE, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, R.TAU); ctx.fill();
        ctx.restore();
      }
    }
    // the sparks: closed form, a streak quad from pos(tau) to pos(tau - 1/60)
    ctx.lineCap = 'round';
    for (const s of SPARKS) {
      if (tau >= s.life) continue;
      const t1 = Math.max(0, tau - 1 / 60);
      const x1 = s.x0 + s.vx * tau, y1 = s.y0 + s.vy * tau + 450 * tau * tau;
      const x0 = s.x0 + s.vx * t1, y0 = s.y0 + s.vy * t1 + 450 * t1 * t1;
      ctx.strokeStyle = R.rgba(s.ice ? ICE : BLUE, 1 - tau / s.life); ctx.lineWidth = s.size;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- post-FX ---- */
  function fx(t) {
    const f = R.fx, tau = t - T_LOCK;
    f.bloom = .30; f.vignette = .35;
    if (tau >= 0) {
      R.impact(t, T_LOCK, { amount: 6, decay: 12, freq: 30, rot: .008 });
      f.chroma = 3 * Math.exp(-tau / .03); f.chromaAngle = 0;
      f.bloom += .15 * Math.exp(-9 * tau);
    }
    f.vignette = .35 + .20 * E.inQuad(R.prog(t, 4.9219, T_SETTLE));
    f.zoom = 1 + .06 * E.inCubic(R.prog(t, T_TRAVEL, T_SETTLE));
    f.distort = .05 * E.inQuad(R.prog(t, 5.2, T_SETTLE));
    const g = E.inQuad(R.prog(t, 5.28, T_SETTLE));
    f.exposure = 1 - .22 * g; f.saturation = 1 - .45 * g; f.contrast = 1 + .04 * g;
  }

  Reel.scene({
    id: 's3', name: 'The match',
    start: T_START, end: T_END, layer: 2,
    setup() { shadow = buildShadow(); },
    draw(ctx, t) {
      fx(t);
      const k = kAt(t), opened = t >= T_OPEN;

      // 1. the sheet: CM black with the hole (union of the two shapes, then the round aperture that grows past the frame)
      if (t < T_SKY) {
        const L = R.layer('s3:sheet'), c = L.ctx;
        c.fillStyle = CM; c.fillRect(0, 0, 1920, 1080);
        c.globalCompositeOperation = 'destination-out';
        c.save(); glyphXf(c, k);
        if (!opened) { const s = sep(t); markPath(c, 960 - s / 2, 960 + s / 2); }
        else { c.beginPath(); c.arc(O[0], O[1], rh(t), 0, R.TAU); }
        c.fill();
        c.restore();
        R.blit(ctx, L);
      }

      // 2. the white: circle XOR square (motion-blurred through the slam), then the four petals
      if (!opened) {
        const draw = (c, tt) => { const s = sep(tt); c.save(); glyphXf(c, kAt(tt)); markPath(c, 960 - s / 2, 960 + s / 2); c.fill('evenodd'); c.restore(); };
        if (t >= T_REL && t < T_BLURSTOP) maskBlur(ctx, t, draw, CMW, { shutter: R.shutterFor(2900, 10, 14), name: 's3:mbMark' });
        else { ctx.save(); ctx.fillStyle = CMW; draw(ctx, t); ctx.restore(); }
      } else {
        for (const qn of QS) drawShadow(ctx, t, geom(t, qn));
        // the two outer petals are motion-blurred while they are fast; the other two move 68 px and stay crisp
        for (const qn of QS) {
          const blurred = (qn === 'TL' || qn === 'BR') && t >= T_TRAVEL && speedOf(t, qn) / 60 > 1.2;
          if (!blurred) { drawPetal(ctx, t, qn); continue; }
          const sh = R.shutterFor(speedOf(t, qn), 10, 14);
          maskBlur(ctx, t, (c, tt) => petalCoverage(c, tt, qn, false), fillOf(t, qn), { shutter: sh, name: 's3:mb' + qn });
          if (DARK[qn] && rimAlpha(t) > .004) maskBlur(ctx, t, (c, tt) => petalCoverage(c, tt, qn, true), `rgba(234,244,251,${rimAlpha(t)})`, { shutter: sh, name: 's3:mbRim' });
        }
      }

      // 3. the lock's punctuation
      drawLock(ctx, t);
    },
  });
})();
