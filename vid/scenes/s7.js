/* s7: the world under everything. The site's own photograph as a place: the cobalt sky (seen through the CreatorMatch lens and
   then the aperture), a dusk sweep that rises up the frame, the site's night, wind-blown snow, twinkling stars, the moon glow.
   Never writes R.fx. Every frame is a pure function of t (closed-form flakes and stars, images built once in setup). */
(() => {
  const R = Reel, E = R.ease;
  R.preload({ ridge: '/vid/assets/ridge.jpg' });

  const TAU = R.TAU, mod = R.mod;
  const T_SWEEP = R.at(5, 4, 2), T_NIGHT = R.at(6, 1), T_SWEEP_END = T_NIGHT - 1 / 120, T_END = 14.9833;   // 9.0234375, 9.375, 9.3666667

  // ---- the night image: the site's blur(10px) look, made by repeated halving (no canvas filter anywhere) ----
  const resize = (src, w, h) => {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height); return c;
  };
  let night = null;
  const buildNight = im => {
    let c = im, w = im.naturalWidth, h = im.naturalHeight;
    while (w / 2 >= 96) { w /= 2; h /= 2; c = resize(c, w, h); }      // 768 x 512, 384 x 256, 192 x 128, 96 x 64
    const out = resize(c, 384, 256);                                   // and once up with smoothing
    // the site's CSS is blur(10px) brightness(.5) saturate(.9): saturate(.9) is a 10 percent mix toward Rec.709 luma, done once here
    try {
      const x = out.getContext('2d'), d = x.getImageData(0, 0, out.width, out.height), q = d.data;
      const g = document.createElement('canvas'); g.width = out.width; g.height = out.height;
      const gx = g.getContext('2d'), gd = gx.createImageData(out.width, out.height), o = gd.data;
      for (let i = 0; i < q.length; i += 4) { const l = .2126 * q[i] + .7152 * q[i + 1] + .0722 * q[i + 2]; o[i] = o[i + 1] = o[i + 2] = l; o[i + 3] = 255; }
      gx.putImageData(gd, 0, 0);
      x.globalAlpha = .1; x.drawImage(g, 0, 0); x.globalAlpha = 1;
    } catch (e) { /* tainted or unavailable: keep the plain blur */ }
    return out;
  };

  // ---- flakes (closed form, the site's wind: near flakes big, fast, bright; far ones small and slow) ----
  const rng = R.rng(4242), FLAKES = [];
  for (let i = 0; i < 420; i++) {
    const z = rng() ** 1.4;
    FLAKES.push({ z, x0: rng() * 2100 - 90, y0: rng() * 1260 - 90, ph: rng() * TAU, sw: .5 + rng(), r: .6 + z * z * 2.4, a: .30 + z * .55, vx: 70 + 260 * z, vy: 30 + 90 * z });
  }
  // the four alpha buckets (edges .30 + .1375 i). Gentler than the first cut (the near flakes read as hyphens beside 72 px type):
  // alpha .34 / .46 / .58 / .66, stroke width 1.2 / 1.7 / 2.5 / 3.4 px, streak length speed * .035 (none longer than 19 px).
  // Each bucket is drawn at three quiet levels (x1, x.6, x.3): flakes thin out over the chip and the label band, never a hard edge.
  const BUCKET_A = [.34, .46, .58, .66], BUCKET_W = [1.2, 1.7, 2.5, 3.4], LEVEL = [1, .6, .3], STREAK = .035;
  for (const f of FLAKES) f.b = Math.min(3, Math.floor((f.a - .30) / .1375));
  const gust = (t, ph) => t + .55 * (6.3 / TAU) * (1 - Math.cos(TAU * t / 6.3 + ph));   // integral of 1 + .55 sin(2 pi t / 6.3 + ph)

  // ---- stars (sky phase only) ----
  const rs = R.rng(6060), STARS = [];
  for (let i = 0; i < 60; i++) STARS.push({ x: rs() * 1920, y: rs() * 520, f: .3 + rs() * .7, ph: rs() * TAU, r: 1 + rs() * .8 });
  // twelve more, seeded inside the lens window (x 850..1070, y 270..640) so the twinkle reads through the slit; a touch bigger and brighter
  const rl = R.rng(6061);
  for (let i = 0; i < 12; i++) STARS.push({ x: 850 + rl() * 220, y: 270 + rl() * 370, f: .3 + rl() * .7, ph: rl() * TAU, r: 1.4 + rl() * .6, k: 1.35 });

  // ---- the sky (z = the dolly) ----
  const zSky = t => 1 + .03 * R.prog(t, 1.875, 4.6875) + .04 * E.outCubic(R.prog(t, 4.6875, 5.625)) + .015 * R.prog(t, 5.625, 9.375);
  function drawSky(ctx, z) {
    const im = R.img('ridge');
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(960, 1080); ctx.scale(z, z);
    if (im && im.naturalWidth) ctx.drawImage(im, 0, 0, 1536, 1024, -960, -1280, 1920, 1280);   // bottom-aligned x1.25, scaled about the bottom centre
    ctx.restore();
    const g = ctx.createLinearGradient(0, 380, 0, 1080);
    g.addColorStop(0, 'rgba(5,11,22,0)'); g.addColorStop(.38, 'rgba(5,11,22,.55)'); g.addColorStop(.70, 'rgba(5,11,22,.86)'); g.addColorStop(1, 'rgba(5,11,22,.94)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    const mx = 960 + 667.5 * z, my = 1080 - 907.5 * z;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 160 * z);
    mg.addColorStop(0, 'rgba(210,225,255,.20)'); mg.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 160 * z, my - 160 * z, 320 * z, 320 * z);
    ctx.restore();
  }
  // Two soft ink scrims on top of the recipe (drawSky itself stays byte-identical to s6's copy), so type reads on the sky:
  //  - the tally chip (top left, x 96..750, y 98..174) sits above the recipe's gradient, which only starts at y 380;
  //  - the label band (y 600..790), where the snow peak brings the sky up to a 4.1:1 contrast under the labels.
  // Neither touches the lens (x 850..1070, y 270..640 is clear of the chip scrim's ellipse) or the moon.
  function drawScrims(ctx) {
    ctx.save();
    ctx.translate(430, 100); ctx.scale(2.7, 1);                      // an ellipse 700 x 260 around the chip
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
    cg.addColorStop(0, 'rgba(5,11,22,.36)'); cg.addColorStop(.55, 'rgba(5,11,22,.24)'); cg.addColorStop(1, 'rgba(5,11,22,0)');
    ctx.fillStyle = cg; ctx.fillRect(-260, -100, 520, 360);
    ctx.restore();
    const lg = ctx.createLinearGradient(0, 590, 0, 800);
    lg.addColorStop(0, 'rgba(5,11,22,0)'); lg.addColorStop(.28, 'rgba(5,11,22,.25)'); lg.addColorStop(.62, 'rgba(5,11,22,.25)'); lg.addColorStop(1, 'rgba(5,11,22,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 590, 1920, 210);
  }

  // ---- the night (zn = the slow push) ----
  const zNight = t => 1 + .03 * R.prog(Math.max(t, T_NIGHT), T_NIGHT, T_END);
  function drawNight(ctx, zn) {
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(night, 0, 0, night.width, night.height, 960 + (-115 - 960) * zn, 540 + (-159 - 540) * zn, 2150 * zn, 1433 * zn);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.50)'; ctx.fillRect(0, 0, 1920, 1080);   // the site's brightness(.5) is a pure multiply, not an ink lift
    const mx = 960 + 748 * zn, my = 540 - 282 * zn;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 150 * zn);
    mg.addColorStop(0, 'rgba(210,225,255,.16)'); mg.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 150 * zn, my - 150 * zn, 300 * zn, 300 * zn);
    ctx.restore();
  }

  function drawStars(ctx, t) {
    const fade = 1 - E.inOutCubic(R.prog(t, T_SWEEP, T_SWEEP_END));
    if (fade <= 0) return;
    for (const s of STARS) {
      const a = Math.min(.85, (.25 + .35 * (.5 + .5 * Math.sin(TAU * s.f * t + s.ph))) * (s.k || 1)) * fade;
      // a soft halo that breathes with the twinkle (bigger discs only), then the ICE core
      if (s.r > 1.3) { ctx.fillStyle = `rgba(234,244,251,${(a * .16).toFixed(3)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.8, 0, TAU); ctx.fill(); }
      ctx.fillStyle = `rgba(234,244,251,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
  }

  // flakes thin out where type sits: a smooth 0..1 "quiet" field (chip, identity tag, label band), quantised to three levels
  const sm = (a, b, x) => { const u = R.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const box = (x, y, x0, x1, y0, y1, r) => sm(x0 - r, x0, x) * (1 - sm(x1, x1 + r, x)) * sm(y0 - r, y0, y) * (1 - sm(y1, y1 + r, y));
  const paths = Array.from({ length: 12 }, () => []);
  function drawSnow(ctx, t) {
    const qc = R.prog(t, 1.8, 1.95) * (1 - R.prog(t, 11.4, 11.55));      // the chip is up
    const qt = R.prog(t, 1.8, 1.95) * (1 - R.prog(t, 3.7, 3.85));        // the identity tag is up
    const ql = R.prog(t, 5.5, 5.7) * (1 - R.prog(t, 8.9, 9.1));          // the four labels are up
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) paths[i].length = 0;
    for (const f of FLAKES) {
      const x = mod(f.x0 + f.vx * gust(t, f.ph * .2) + 90, 2100) - 90;
      const y = mod(f.y0 + f.vy * t + 14 * Math.sin(t * f.sw * 2 + f.ph) + 90, 1260) - 90;
      const vx = f.vx * (1 + .55 * Math.sin(TAU * t / 6.3 + f.ph * .2)), sp = Math.hypot(vx, f.vy);
      const len = Math.max(2 * f.r, sp * STREAK), k = len / sp;
      let q = 0;
      if (qc > 0 || qt > 0 || ql > 0) {
        q = Math.max(qc * box(x, y, 96, 760, 92, 178, 44), qt * box(x, y, 1380, 1830, 92, 178, 44), ql * box(x, y, 0, 1920, 616, 764, 50));
      }
      const lv = q < .1 ? 0 : q < .6 ? 1 : 2;
      paths[f.b * 3 + lv].push(x, y, x - vx * k, y - f.vy * k);
    }
    for (let b = 0; b < 4; b++) {
      ctx.lineWidth = BUCKET_W[b];
      for (let lv = 0; lv < 3; lv++) {
        const p = paths[b * 3 + lv];
        if (!p.length) continue;
        ctx.strokeStyle = `rgba(255,255,255,${(BUCKET_A[b] * LEVEL[lv]).toFixed(3)})`;
        ctx.beginPath();
        for (let i = 0; i < p.length; i += 4) { ctx.moveTo(p[i], p[i + 1]); ctx.lineTo(p[i + 2], p[i + 3]); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  R.scene({
    id: 's7', start: 1.875, end: 15, layer: 0,
    setup() {
      const im = R.img('ridge');
      if (!(im && im.naturalWidth)) return;                            // a missing photo: ink, stars and snow still draw
      night = buildNight(im);
      // warm-up, once: the photo's texture upload at the two scales it is first drawn at, and the sweep's layer allocation
      const L = R.layer('s7:night');
      for (const z of [1, 1.1]) drawSky(L.ctx, z);
      drawNight(L.ctx, 1);
    },
    draw(ctx, t) {
      if (!night) { ctx.fillStyle = R.C.ink; ctx.fillRect(0, 0, 1920, 1080); }
      else if (t < T_SWEEP) {
        drawSky(ctx, zSky(t)); drawScrims(ctx);
      } else if (t < T_NIGHT) {
        // the dusk sweep: the night rises through a soft edge over the sky. A gradient mask, never a crossfade.
        drawSky(ctx, zSky(t)); drawScrims(ctx);
        const p = R.prog(t, T_SWEEP, T_SWEEP_END);
        const L = R.layer('s7:night'), lc = L.ctx;
        drawNight(lc, 1);
        const ys = R.lerp(1260, -160, E.inOutCubic(p));
        const m = lc.createLinearGradient(0, ys - 160, 0, ys + 40);
        m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
        lc.globalCompositeOperation = 'destination-in';
        lc.fillStyle = m; lc.fillRect(0, 0, 1920, 1080);
        lc.globalCompositeOperation = 'source-over';
        R.blit(ctx, L);
      } else {
        drawNight(ctx, zNight(t));
      }
      if (t < T_NIGHT) drawStars(ctx, t);
      drawSnow(ctx, t);
    },
  });
})();
