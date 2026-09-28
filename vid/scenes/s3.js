/* s3: Depth, the lock. A software-3D cryptex locks on 128 BPM, blows into 2,800 closed-form particles,
   tape-stops dead and snaps every particle into s4's chart slots. Every frame is a pure function of t. */
(() => {
  const R = Reel, E = R.ease;
  const RED = '#ff4b1f', LIME = '#d7ff3a', ICE = '#eaf4fb', BLUE = '#5fa8d3', INK = '#050b16';
  const B = 0.46875, S16 = B / 4, S32 = B / 8, S64 = B / 16;
  const DEG = Math.PI / 180, TAU = Math.PI * 2;

  // ---- times ----
  const T0 = 5.625;                 // 4.1  hard cut in (H2)
  const TEXP = 6.5625;              // 4.3  explode
  const TANT = TEXP - S32;          // 6.5039 anticipation
  const TS0 = 7.03125, TSD = 0.3515625, TDEAD = TS0 + TSD;   // 4.4 tape stop, dead at 7.3828125
  const TDROP = 7.5;                // 5.1  snap
  const TEND = 7.6171875;           // 5.1e handoff (H3)
  const SNAP_END = TEND - 1 / 60;   // frame rule: the end state holds on the last drawn frame
  const TBLINK0 = 7.44140625, TBLINK1 = 7.5078125;
  const tapeU = t => R.clamp((t - TS0) / TSD);
  const tapeSource = t => { const u = tapeU(t); return TSD * (u - u * u / 2); };
  // local explosion clock (tape-remapped), frozen at 0.64453125 from 7.3828125
  const tauX = t => t < TS0 ? t - TEXP : B + tapeSource(t);

  // ---- the lock ----
  const FOCAL = 1100;
  const XK = [-522.5, -332.5, -142.5, 142.5, 332.5, 522.5];
  const TARGET = ['1', '2', '8', 'B', 'P', 'M'];
  const TU = [5.6836, 5.6543, 5.625, 5.625, 5.6543, 5.6836];
  const TK = [5.859375, 5.91796875, 5.9765625, 6.03515625, 6.09375, 6.15234375];
  const THETA = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25].map(f => TAU * f + 0.37);
  const POOL = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  const SLOT = TAU / 12;
  const RAIL_DX = 88, RAIL_N = 48, AX_HALF = 644, AX_PIECES = 14;
  const ICE_IN = Math.cos(11 * DEG), ICE_OUT = Math.cos(19 * DEG);   // ICE read window around the lock line (see report)

  const DRUM = XK.map((_, k) => {
    const r = R.rng(300 + k), s = [TARGET[k]];
    for (let j = 1; j < 12; j++) s.push(POOL[Math.floor(r() * POOL.length)]);
    return s;
  });

  // camera keys (frozen from 6.5625)
  const YAW = [[T0, 0], [6.09375, -28 * DEG, 'inOutCubic'], [TEXP, -6 * DEG, 'inOutSine']];
  const PITCH = [[T0, 0], [6.09375, 14 * DEG, 'inOutCubic'], [TEXP, 6 * DEG, 'inOutSine']];
  const DIST = [[T0, 1100], [6.09375, 1100], [TEXP, 1250, 'inOutSine']];
  function camAt(t) {
    const tc = Math.min(t, TEXP), yaw = R.keys(tc, YAW), pitch = R.keys(tc, PITCH);
    return { cyw: Math.cos(yaw), syw: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), D: R.keys(tc, DIST) };
  }
  // world -> camera: rotY(yaw) then rotX(pitch)
  const toCam = (C, x, y, z, o) => {
    const x1 = x * C.cyw + z * C.syw, z1 = -x * C.syw + z * C.cyw;
    o[0] = x1; o[1] = y * C.cp - z1 * C.sp; o[2] = y * C.sp + z1 * C.cp;
    return o;
  };
  // project a world point; o = [sx, sy, scale, depth]; depth <= 1 means behind the camera
  const P = (C, x, y, z, o) => {
    const x1 = x * C.cyw + z * C.syw, z1 = -x * C.syw + z * C.cyw;
    const y2 = y * C.cp - z1 * C.sp, zz = y * C.sp + z1 * C.cp + C.D;
    const s = zz > 1 ? FOCAL / zz : 0;
    o[0] = 960 + x1 * s; o[1] = 540 + y2 * s; o[2] = s; o[3] = zz;
    return o;
  };

  const drumR = (k, t) => 240 * E.outBack(R.prog(t, TU[k], TU[k] + 0.17578125), 1.6);  // The drum arrives at its detent still moving (15% linear term: terminal speed 0.15·Θ/T, 3-5 rad/s),
  // so the wobble's opposite velocity kick at T_k is a rebound: a mechanical clunk, position continuous.
  const LIN = 0.15, WOB = 0.12;
  const drumTheta = (k, t) => {
    const p = R.prog(t, T0, TK[k]);
    let th = THETA[k] * (1 - ((1 - LIN) * E.outCubic(p) + LIN * p));
    if (t >= TK[k]) { const tau = t - TK[k]; th += WOB * Math.exp(-14 * tau) * Math.sin(38 * tau); }
    return th;
  };
  // |dθ/dt| of drum k (rad/s), analytic
  const drumOmega = (k, t) => {
    if (t < TK[k]) { const p = R.prog(t, T0, TK[k]); return THETA[k] * ((1 - LIN) * 3 * (1 - p) * (1 - p) + LIN) / (TK[k] - T0); }
    const tau = t - TK[k];
    return Math.abs(WOB * Math.exp(-14 * tau) * (38 * Math.cos(38 * tau) - 14 * Math.sin(38 * tau)));
  };
  // Upper estimate of the fastest on-screen glyph speed (logical px/s): spin, unfurl and camera swing.
  const motionPx = t => {
    const h = 1e-3;
    let m = 0;
    for (let k = 0; k < 6; k++) {
      const r = drumR(k, t);
      const dr = Math.abs(drumR(k, t + h) - drumR(k, t - h)) / (2 * h);
      m = Math.max(m, drumOmega(k, t) * r + dr);
    }
    const tc = Math.min(t, TEXP - h);
    const dyaw = Math.abs(R.keys(tc + h, YAW) - R.keys(tc - h, YAW)) / (2 * h);
    const dpit = Math.abs(R.keys(tc + h, PITCH) - R.keys(tc - h, PITCH)) / (2 * h);
    return 1.35 * m + 1.3 * (dyaw * 760 + dpit * 420);
  };
  const anticip = t => 1 - 0.03 * E.inOutSine(R.prog(t, TANT, TEXP));
  const axleW = t => {
    let w = t < T0 + 0.12 ? R.keys(t, [[T0, 8], [T0 + 0.04, 12, 'outCubic'], [T0 + 0.12, 8, 'inOutSine']]) : 8;
    return w + 3 * E.inOutSine(R.prog(t, TANT, TEXP));
  };

  // per-glyph pose: anchor, affine basis, depth, facing
  const _a = [0, 0, 0, 0], _b = [0, 0, 0, 0], _c = [0, 0, 0, 0], _n = [0, 0, 0];
  function glyphPose(C, k, j, th, r) {
    const phi = th + j * SLOT, sp = Math.sin(phi), cp = Math.cos(phi);
    const x = XK[k], y = -r * sp, z = -r * cp;
    P(C, x, y, z, _a); P(C, x + 1, y, z, _b); P(C, x, y - cp, z + sp, _c);
    // outward normal (0, -sin, -cos) into camera space, and the view ray to the anchor
    toCam(C, 0, -sp, -cp, _n);
    const x1 = x * C.cyw + z * C.syw, z1 = -x * C.syw + z * C.cyw;
    const ry = y * C.cp - z1 * C.sp, rz = y * C.sp + z1 * C.cp + C.D;
    const rl = Math.hypot(x1, ry, rz) || 1;
    const facing = -(_n[0] * x1 + _n[1] * ry + _n[2] * rz) / rl;   // cos of angle to the view ray (>0 front)
    return {
      ax: _a[0], ay: _a[1], s: _a[2], zz: _a[3],
      ux: _b[0] - _a[0], uy: _b[1] - _a[1], vx: _c[0] - _a[0], vy: _c[1] - _a[1], facing, axis: cp,
    };
  }

  // ---- glyph sprites: an atlas per colour at 1.7x render scale ----
  const CHARS = [...new Set(DRUM.flat())];
  const CIDX = new Map(CHARS.map((c, i) => [c, i]));
  let CW = 180, CH = 150;            // logical cell (measured in setup)
  const BOUNDS = new Map(CHARS.map(c => [c, { l: 50, r: 50, a: 45, d: 45 }]));   // per-glyph ink box (setup)
  const TILE_PAD = 12, TILE_A = 0.94;
  let atlas = null;
  function ensureAtlas() {
    const sc = 1.7 * R.rs;
    if (atlas && atlas.sc >= sc - 1e-6) return atlas;
    const cols = 8, rows = Math.ceil(CHARS.length / cols);
    const cwp = Math.ceil(CW * sc), chp = Math.ceil(CH * sc);
    const mk = col => {
      const cv = document.createElement('canvas');
      cv.width = cols * cwp; cv.height = rows * chp;
      const x = cv.getContext('2d');
      x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
      CHARS.forEach((ch, i) => {
        x.setTransform(sc, 0, 0, sc, (i % cols + 0.5) * cwp, (Math.floor(i / cols) + 0.5) * chp);
        R.font(x, 125, 'display', 900);
        x.fillText(ch, 0, 0);
      });
      return cv;
    };
    atlas = { sc, cols, cwp, chp, ice: mk(ICE), blue: mk(BLUE), hw: cwp / sc / 2, hh: chp / sc / 2 };
    return atlas;
  }

  // ---- the cryptex at time t, drawn into c (painter's order), whole thing scaled by the anticipation ----
  const _p = [0, 0, 0, 0], _q = [0, 0, 0, 0];
  function drawCryptex(c, t) {
    const C = camAt(t), A = ensureAtlas();
    const an = anticip(t);
    c.save();
    c.translate(960, 540); c.scale(an, an); c.translate(-960, -540);

    // rails: back halves now, front halves after the glyphs
    const back = new Path2D(), front = new Path2D();
    const th = [], rr = [];
    for (let k = 0; k < 6; k++) { th.push(drumTheta(k, t)); rr.push(drumR(k, t)); }
    for (let k = 0; k < 6; k++) {
      const r = rr[k];
      if (r < 0.5) continue;
      for (const dx of [-RAIL_DX, RAIL_DX]) {
        const x = XK[k] + dx;
        let lastFront = -1;
        P(C, x, 0, -r, _p);
        for (let i = 1; i <= RAIL_N; i++) {
          const a = i / RAIL_N * TAU, am = (i - 0.5) / RAIL_N * TAU;
          P(C, x, -r * Math.sin(a), -r * Math.cos(a), _q);
          // facing of this segment's outward normal
          const sm = Math.sin(am), cm = Math.cos(am);
          toCam(C, 0, -sm, -cm, _n);
          const x1 = x * C.cyw + (-r * cm) * C.syw, z1 = -x * C.syw + (-r * cm) * C.cyw;
          const my = (-r * sm) * C.cp - z1 * C.sp, mz = (-r * sm) * C.sp + z1 * C.cp + C.D;
          const isFront = (_n[0] * x1 + _n[1] * my + _n[2] * mz) < 0 ? 1 : 0;
          const path = isFront ? front : back;
          if (lastFront !== isFront) path.moveTo(_p[0], _p[1]);
          path.lineTo(_q[0], _q[1]);
          lastFront = isFront;
          _p[0] = _q[0]; _p[1] = _q[1];
        }
      }
    }
    c.lineWidth = 1.5; c.lineJoin = 'round';
    c.strokeStyle = R.rgba(ICE, 0.12); c.stroke(back);

    // items: 72 glyphs + axle pieces, one depth sort
    const items = [];
    for (let k = 0; k < 6; k++) {
      const r = rr[k];
      if (r < 0.5) continue;
      const g = r / 240;
      for (let j = 0; j < 12; j++) {
        const q = glyphPose(C, k, j, th[k], r);
        if (q.zz <= 150) continue;
        q.g = g; q.ch = DRUM[k][j]; q.type = 0;
        items.push(q);
      }
    }
    const w = axleW(t);
    P(C, -AX_HALF, 0, 0, _p); P(C, AX_HALF, 0, 0, _q);
    let dx = _q[0] - _p[0], dy = _q[1] - _p[1];
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const nx = -dy, ny = dx;
    for (let i = 0; i < AX_PIECES; i++) {
      const xa = -AX_HALF + 2 * AX_HALF * i / AX_PIECES - (i ? 0.6 : 0);
      const xb = -AX_HALF + 2 * AX_HALF * (i + 1) / AX_PIECES + (i < AX_PIECES - 1 ? 0.6 : 0);
      const pa = P(C, xa, 0, 0, [0, 0, 0, 0]), pb = P(C, xb, 0, 0, [0, 0, 0, 0]);
      const pm = P(C, (xa + xb) / 2, 0, 0, [0, 0, 0, 0]);
      items.push({ type: 1, zz: pm[3], pa, pb, cap: i === 0 ? pa : i === AX_PIECES - 1 ? pb : null });
    }
    items.sort((a, b) => b.zz - a.zz);

    const hw = A.hw, hh = A.hh;
    for (const it of items) {
      if (it.type === 1) {
        const ha = w / 2 * it.pa[2], hb = w / 2 * it.pb[2];
        c.fillStyle = RED;
        c.beginPath();
        c.moveTo(it.pa[0] + nx * ha, it.pa[1] + ny * ha);
        c.lineTo(it.pb[0] + nx * hb, it.pb[1] + ny * hb);
        c.lineTo(it.pb[0] - nx * hb, it.pb[1] - ny * hb);
        c.lineTo(it.pa[0] - nx * ha, it.pa[1] - ny * ha);
        c.closePath();
        if (it.cap) { const rc = w / 2 * it.cap[2]; c.moveTo(it.cap[0] + rc, it.cap[1]); c.arc(it.cap[0], it.cap[1], rc, 0, TAU); }
        c.fill();
        continue;
      }
      const f = it.facing;
      const ci = CIDX.get(it.ch), sx = (ci % A.cols) * A.cwp, sy = Math.floor(ci / A.cols) * A.chp;
      c.save();
      c.transform(it.ux * it.g, it.uy * it.g, -it.vx * it.g, -it.vy * it.g, it.ax, it.ay);
      if (f <= 0) {
        c.globalAlpha = 0.25;
        c.drawImage(A.blue, sx, sy, A.cwp, A.chp, -hw, -hh, hw * 2, hh * 2);
      } else {
        // the drum face under a front glyph: an INK plate (invisible on INK) that occludes what is behind it,
        // so the axle and the mirrored back glyphs pass BEHIND the letters instead of striking through them
        const bd = BOUNDS.get(it.ch);
        c.globalAlpha = TILE_A * R.smoothstep(0, 0.3, f);
        c.fillStyle = INK;
        c.beginPath();
        c.roundRect(-bd.l - TILE_PAD, -bd.a - TILE_PAD, bd.l + bd.r + 2 * TILE_PAD, bd.a + bd.d + 2 * TILE_PAD, 10);
        c.fill();
        c.globalAlpha = 1;
        const wi = R.smoothstep(ICE_OUT, ICE_IN, it.axis);   // ICE only for the row facing the lens
        if (wi < 1) c.drawImage(A.blue, sx, sy, A.cwp, A.chp, -hw, -hh, hw * 2, hh * 2);
        if (wi > 0) { c.globalAlpha = wi; c.drawImage(A.ice, sx, sy, A.cwp, A.chp, -hw, -hh, hw * 2, hh * 2); }
      }
      c.restore();
    }
    c.strokeStyle = R.rgba(ICE, 0.30); c.stroke(front);
    c.restore();
  }

  // ---- floor: plane y = 470, drawn on by length, droops in the tape stop ----
  const FLOOR_Y = 470, NS = 24, NB = 10;
  function drawFloor(c, t) {
    const C = camAt(t);
    const droop = 60 * tapeU(t) ** 2;
    const buckets = Array.from({ length: NB + 1 }, () => new Path2D());
    const used = new Uint8Array(NB + 1);
    const pts = new Float32Array(NS * 3);
    const line = (ok) => {
      for (let i = 1; i < NS; i++) {
        const i0 = (i - 1) * 3, i1 = i * 3;
        if (pts[i0 + 2] < 150 || pts[i1 + 2] < 150) continue;
        const d = (pts[i0 + 2] + pts[i1 + 2]) / 2;
        const a = R.clamp(1 - (d - 900) / 2400);
        const b = Math.round(a * NB);
        if (!b) continue;
        buckets[b].moveTo(pts[i0], pts[i0 + 1]); buckets[b].lineTo(pts[i1], pts[i1 + 1]); used[b] = 1;
      }
    };
    // z-running lines, mirrored groups by |x|
    for (let i = 0; i <= 20; i++) {
      const x = -1500 + 150 * i, n = Math.abs(x) / 150;
      const g = E.outExpo(R.prog(t, T0 + n * S64, T0 + n * S64 + 0.234375));
      if (g <= 0) continue;
      for (let s = 0; s < NS; s++) {
        const ss = g * s / (NS - 1);
        P(C, x, FLOOR_Y, -400 + 2600 * ss, _p);
        pts[s * 3] = _p[0]; pts[s * 3 + 1] = _p[1] + droop * Math.sin(Math.PI * ss); pts[s * 3 + 2] = _p[3];
      }
      line();
    }
    // x-running lines, rows from the near side, growing from x 0 outward
    for (let n = 0; n <= 17; n++) {
      const z = -400 + 150 * n;
      const g = E.outExpo(R.prog(t, T0 + n * S64, T0 + n * S64 + 0.234375));
      if (g <= 0) continue;
      for (let s = 0; s < NS; s++) {
        const ss = 0.5 - g / 2 + g * s / (NS - 1);
        P(C, -1500 + 3000 * ss, FLOOR_Y, z, _p);
        pts[s * 3] = _p[0]; pts[s * 3 + 1] = _p[1] + droop * Math.sin(Math.PI * ss); pts[s * 3 + 2] = _p[3];
      }
      line();
    }
    c.lineWidth = 1.5;
    // while power drains the grid holds (slightly gains) on-screen luminance against the exposure dip,
    // so the wet-string sag is the one thing still moving in the dying frame
    const u = tapeU(t), lift = t >= TS0 && t < TDEAD ? (1 + 2.2 * u) / (1 - 0.65 * u * u) : 1;
    for (let b = 1; b <= NB; b++) if (used[b]) { c.strokeStyle = R.rgba(ICE, Math.min(1, 0.10 * b / NB * lift)); c.stroke(buckets[b]); }
  }

  // ---- particles (setup) ----
  const NP = 2800, NAX = 96;
  const ROWS = [20, 20, 26, 22, 28, 24, 27, 33, 30, 36, 40, 44];
  let PX0, PY0, VX, VY, PH1, PH2, SZ, COL, FX, FY, SLX, SLY;   // typed arrays
  let byCol = [[], [], []];   // 0 ICE, 1 BLUE, 2 RED
  const SP0 = 320, SP1 = 2100, LOC = 520, ISO = 300, AX_K = 0.35;   // explosion speeds (px/s), see buildParticles
  const inkCache = new Map();
  function inkPoints(ch) {
    if (inkCache.has(ch)) return inkCache.get(ch);
    const cv = document.createElement('canvas'); cv.width = cv.height = 220;
    const x = cv.getContext('2d', { willReadFrequently: true });
    R.font(x, 125, 'display', 900);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
    x.fillText(ch, 110, 110);
    const d = x.getImageData(0, 0, 220, 220).data, out = [];
    for (let y = 2; y < 220; y += 4) for (let xx = 2; xx < 220; xx += 4) if (d[(y * 220 + xx) * 4 + 3] > 128) out.push([xx - 110, y - 110]);
    inkCache.set(ch, out);
    return out;
  }
  function pick(pts, n, rnd) {          // deterministic subsample of n points (partial Fisher-Yates)
    const a = pts.slice();
    n = Math.min(n, a.length);
    for (let i = 0; i < n; i++) { const j = i + Math.floor(rnd() * (a.length - i)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a.slice(0, n);
  }
  function buildParticles() {
    const C = camAt(TEXP), an = anticip(TEXP);
    const ants = (x, y) => [960 + (x - 960) * an, 540 + (y - 540) * an];
    const list = [];   // {x, y, s, kind: 0 front glyph, 1 other glyph, 2 axle}
    // axle, the dot's own 96
    for (let i = 0; i < NAX; i++) {
      const xw = -AX_HALF + 2 * AX_HALF * (i + 0.5) / NAX;
      P(C, xw, 0, 0, _p);
      const [x, y] = ants(_p[0], _p[1]);
      list.push({ x, y, s: 4, kind: 2, xw });
    }
    const rnd = R.rng(77);
    const place = (q, pts, kind) => {
      const [gcx, gcy] = ants(q.ax, q.ay);   // the glyph's own centre: each glyph also bursts locally
      for (const [gx, gy] of pts) {
        const sx = q.ax + q.ux * gx - q.vx * gy, sy = q.ay + q.uy * gx - q.vy * gy;
        const [x, y] = ants(sx, sy);
        list.push({ x, y, s: 2.4 + 1.2 * (q.s / 1.68), kind, cx: gcx, cy: gcy });
      }
    };
    const th = XK.map((_, k) => drumTheta(k, TEXP));
    // the six front targets: up to 300 each
    let used = 0;
    for (let k = 0; k < 6; k++) {
      const q = glyphPose(C, k, 0, th[k], 240);
      const pts = pick(inkPoints(DRUM[k][0]), 300, rnd);
      place(q, pts, 0); used += pts.length;
    }
    // neighbours (slots -2, -1, +1, +2), by projected ink area, largest remainder
    const nb = [];
    for (let k = 0; k < 6; k++) for (const j of [10, 11, 1, 2]) {
      const q = glyphPose(C, k, j, th[k], 240), pts = inkPoints(DRUM[k][j]);
      nb.push({ q, pts, area: Math.abs(q.ux * q.vy - q.uy * q.vx) * pts.length, n: 0, cap: pts.length });
    }
    let remain = NP - NAX - used;
    let open = nb.slice();
    while (remain > 0 && open.length) {
      const tot = open.reduce((s, o) => s + o.area, 0);
      const quota = open.map(o => remain * o.area / tot);
      const add = quota.map(Math.floor);
      let left = remain - add.reduce((s, v) => s + v, 0);
      const order = quota.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      for (let i = 0; i < left; i++) add[order[i][1]]++;
      let spilled = 0;
      open.forEach((o, i) => { const room = o.cap - o.n, a = Math.min(room, add[i]); o.n += a; spilled += add[i] - a; });
      remain = spilled;
      open = open.filter(o => o.n < o.cap);
    }
    for (const o of nb) place(o.q, pick(o.pts, o.n, rnd), 1);

    // colours, velocities, phases
    const rc = R.rng(78), rv = R.rng(79), rl = R.rng(80), rd = R.rng(81);
    // the axle's screen line at the 6.5625 pose (with the anticipation scale)
    const pa = P(C, -AX_HALF, 0, 0, [0, 0, 0, 0]), pb = P(C, AX_HALF, 0, 0, [0, 0, 0, 0]);
    const [ax0, ay0] = ants(pa[0], pa[1]), [ax1, ay1] = ants(pb[0], pb[1]);
    const AXY = x => ay0 + (ay1 - ay0) * (x - ax0) / (ax1 - ax0);
    const n = list.length;   // 2800
    PX0 = new Float32Array(n); PY0 = new Float32Array(n); VX = new Float32Array(n); VY = new Float32Array(n);
    PH1 = new Float32Array(n); PH2 = new Float32Array(n); SZ = new Float32Array(n); COL = new Uint8Array(n);
    FX = new Float32Array(n); FY = new Float32Array(n); SLX = new Float32Array(n); SLY = new Float32Array(n);
    byCol = [[], [], []];
    const tf = tauX(TDEAD);
    for (let i = 0; i < n; i++) {
      const p = list[i];
      PX0[i] = p.x; PY0[i] = p.y; SZ[i] = p.s;
      if (p.kind === 2) COL[i] = 2;
      else { const r = rc(); COL[i] = p.kind === 0 ? (r < 0.7 ? 0 : 1) : (r < 0.7 ? 1 : 0); }
      byCol[COL[i]].push(i);
      const f1 = rv() * TAU, f2 = rv() * TAU, r1 = rv(), r2 = rv();
      // radial throw away from the AXLE (the lock blows open from its core): the offset from the axle's
      // screen line, with x compressed by AX_K so the wide, short cryptex bursts up and down as much as
      // sideways (a plain radial from (960, 540) is nearly horizontal here and empties the centre)
      const l0 = rl();
      let dx = (p.x - 960) * AX_K * Math.min(1, Math.abs(p.x - 960) / 520), dy = p.kind === 2 ? (l0 < 0.5 ? -1 : 1) * (30 + 90 * rl()) : p.y - AXY(p.x);
      let dl = Math.hypot(dx, dy);
      if (dl < 1) { dx = p.kind === 2 && p.xw < 0 ? -1 : 1; dy = 0; } else { dx /= dl; dy /= dl; }
      const a = 0.35 * (2 * r1 - 1), ca = Math.cos(a), sa = Math.sin(a), sp = SP0 + SP1 * r2 * r2;   // a slow core and a fast fringe (see report)
      // the spec's radial throw from (960, 540), plus a local burst from the particle's own glyph centre
      // (the axle's red particles burst up and down off the line) and a small isotropic kick, so the field
      // crosses the centre instead of splitting into two lobes; depth factor fd: near = bigger and faster
      const l1 = rl(), l2 = rl(), l3 = rl(), fd = 0.6 + 1.1 * rd();
      let lx, ly;
      if (p.kind === 2) { lx = 0.35 * (2 * l2 - 1); ly = l2 < 0.5 ? -1 : 1; }
      else { lx = p.x - p.cx; ly = p.y - p.cy; }
      const ll = Math.hypot(lx, ly) || 1, lv = LOC * l1, iv = ISO * l3, ps = l2 * TAU * 7.31;
      VX[i] = fd * ((dx * ca - dy * sa) * sp + lx / ll * lv + Math.cos(ps) * iv);
      VY[i] = fd * ((dx * sa + dy * ca) * sp + ly / ll * lv + Math.sin(ps) * iv) - 380;
      SZ[i] = p.kind === 2 ? 3.4 + 1.6 * (fd - 0.6) / 1.1 : p.s * fd;
      PH1[i] = f1; PH2[i] = f2;
      pos(i, tf, 1, _p); FX[i] = _p[0]; FY[i] = _p[1];
    }
    // slots (H3)
    const slot = (c, r, j) => [135 + 150 * (c - 1) - 49 + 14 * j, 923 - 14 * r];
    const ax = [], gl = [];
    for (let i = 0; i < n; i++) (COL[i] === 2 ? ax : gl).push(i);
    ax.sort((a, b) => FX[a] - FX[b] || a - b);
    let m = 0;
    for (let c = 1; c <= 12; c++) for (let j = 0; j < 8; j++) { const [x, y] = slot(c, ROWS[c - 1] - 1, j); SLX[ax[m]] = x; SLY[ax[m]] = y; m++; }
    gl.sort((a, b) => FX[a] - FX[b] || a - b);
    let o = 0;
    for (let c = 1; c <= 12; c++) {
      const cnt = 8 * (ROWS[c - 1] - 1), col = gl.slice(o, o + cnt); o += cnt;
      col.sort((a, b) => FY[a] - FY[b] || FX[a] - FX[b] || a - b);
      let q = 0;
      for (let r = ROWS[c - 1] - 2; r >= 0; r--) for (let j = 0; j < 8; j++) { const [x, y] = slot(c, r, j); SLX[col[q]] = x; SLY[col[q]] = y; q++; }
    }
  }
  // particle i at explosion time tau, with sag factor from tape u
  function pos(i, tau, u2, o) {
    if (tau < 0) tau = 0;
    const e = (1 - Math.exp(-3 * tau)) / 3;
    o[0] = PX0[i] + VX[i] * e + 60 * tau * Math.sin(1.7 * tau + PH1[i]);
    o[1] = PY0[i] + VY[i] * e + 260 * tau * tau + 60 * tau * Math.cos(2.3 * tau + PH2[i]) + 60 * u2;
    return o;
  }

  // Squares are fillRects and every streak quad is its own small fill, all grouped by colour (3 fillStyle
  // changes per frame). Measured in the headless raster, one giant multi-subpath fill per colour is 5-30x
  // slower (long overlapping edges), so the batching is by colour, not by path (see report).
  const FR = 1 / 60;
  const onScreen = (x0, y0, x1, y1, m) => !((x0 < -m && x1 < -m) || (x0 > 1920 + m && x1 > 1920 + m) || (y0 < -m && y1 < -m) || (y0 > 1080 + m && y1 > 1080 + m));
  // tapered streak: tail width w*tail at (x0,y0), head width w at (x1,y1); consistent winding
  // Streak quads are appended to the current path and filled in chunks of QCH (a few dozen small subpaths per
  // fill): far fewer fill() calls than one per quad, without the giant-path raster cost of one fill per colour.
  const QCH = 48;
  let qn = 0;
  const qBegin = c => { c.beginPath(); qn = 0; };
  const qEnd = c => { if (qn) c.fill(); qn = 0; };
  function quad(c, x0, y0, x1, y1, w, tail = 0.3) {
    let dx = x1 - x0, dy = y1 - y0;
    const l = Math.hypot(dx, dy);
    if (l < 1.5) return;
    dx /= l; dy /= l;
    const nx = dy * w / 2, ny = -dx * w / 2, tx = nx * tail, ty = ny * tail;
    c.moveTo(x0 + tx, y0 + ty); c.lineTo(x1 + nx, y1 + ny); c.lineTo(x1 - nx, y1 - ny); c.lineTo(x0 - tx, y0 - ty); c.closePath();
    if (++qn >= QCH) { c.fill(); c.beginPath(); qn = 0; }
  }
  // Streak window in frames: 1 in the early flight (spec), growing to 3 into the tape stop. In the stop the
  // trail spans p(τ(t − 3/60)) → p(τ(t)), so its length follows the remaining tape speed and dies to 0 at 7.3828.
  const trailK = t => 1 + 2 * E.inOutSine(R.prog(t, 6.75, TS0));
  function drawExplosion(c, t) {
    const td = Math.min(t, TDEAD), tp = Math.max(TEXP, td - trailK(t) * FR);
    const tau = tauX(td), taup = tauX(tp);
    const u2 = tapeU(td) ** 2, u2p = tapeU(tp) ** 2;
    const streaks = td > tp && t < TDEAD;
    const cols = [ICE, BLUE, RED];
    const a = [0, 0, 0, 0], b = [0, 0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const idx = byCol[k];
      c.fillStyle = cols[k];
      qBegin(c);
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n], s = SZ[i];
        pos(i, tau, u2, a);
        if (streaks) {
          pos(i, taup, u2p, b);
          if (!onScreen(a[0], a[1], b[0], b[1], s)) continue;
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) > s) quad(c, b[0], b[1], a[0], a[1], s);
        } else if (!onScreen(a[0], a[1], a[0], a[1], s)) continue;
        c.fillRect(a[0] - s / 2, a[1] - s / 2, s, s);
      }
      qEnd(c);
    }
  }
  const SNAP_LMAX = 190;
  function drawSnap(c, t) {
    const pe = E.outExpo(R.prog(t, TDROP, SNAP_END)), pp = E.outExpo(R.prog(t - FR, TDROP, SNAP_END));
    const pe4 = pe ** 4;   // squares grow to 8 px late, so the one-frame streaks stay thin
    // ICE->ICE, BLUE->ICE, RED->RED: the same p for every particle, so three colours
    const fills = [ICE, R.mix(BLUE, ICE, pe), RED];
    for (let k = 0; k < 3; k++) {
      const idx = byCol[k];
      c.fillStyle = fills[k];
      qBegin(c);
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n];
        const x = R.lerp(FX[i], SLX[i], pe), y = R.lerp(FY[i], SLY[i], pe);
        const s = R.lerp(SZ[i], 8, pe4);
        if (pe > pp) {
          let x0 = R.lerp(FX[i], SLX[i], pp), y0 = R.lerp(FY[i], SLY[i], pp);
          const sl = Math.hypot(x - x0, y - y0);
          if (sl > SNAP_LMAX) { const k = SNAP_LMAX / sl; x0 = x + (x0 - x) * k; y0 = y + (y0 - y) * k; }   // speed lines, not a curtain
          if (!onScreen(x0, y0, x, y, s)) continue;
          quad(c, x0, y0, x, y, Math.min(s, 4), 0.15);
        } else if (!onScreen(x, y, x, y, s)) continue;
        c.fillRect(x - s / 2, y - s / 2, s, s);
      }
      qEnd(c);
    }
  }

  function shockwave(c, t) {
    const p = R.prog(t, TEXP, TEXP + 0.3);
    if (p <= 0 || p >= 1) return;
    const e = E.outExpo(p), lw = 6 * (1 - e);
    if (lw < 0.05) return;
    c.strokeStyle = ICE; c.lineWidth = lw;
    c.beginPath(); c.arc(960, 540, 900 * e, 0, TAU); c.stroke();
  }

  // INK x 0.35: continues the exposure-0.35 black of the last tape-stop frame at exposure 1 (no lift at 7.3828)
  const BLACK_OVL = 'rgba(2,4,8,0.95)';
  const BLUR_SH = 1 / 100, BLUR_STEP = 9, BLUR_MAX = 10;
  // device-px box holding the whole cryptex over [ta, tb] (drum bounds incl. the outBack overshoot and the
  // glyph half-heights, axle discs), so each blur sample clears and composites only that box
  function blurBox(ta, tb) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const tt of [ta, tb]) {
      const C = camAt(tt), an = anticip(tt);
      for (const x of [-652, 652]) for (const y of [-285, 285]) for (const z of [-285, 285]) {
        P(C, x, y, z, _p);
        const sx = 960 + (_p[0] - 960) * an, sy = 540 + (_p[1] - 540) * an;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
    }
    const rs = R.rs, bx = Math.max(0, Math.floor((x0 - 16) * rs)), by = Math.max(0, Math.floor((y0 - 16) * rs));
    const ex = Math.min(R.rw, Math.ceil((x1 + 16) * rs)), ey = Math.min(R.rh, Math.ceil((y1 + 16) * rs));
    return [bx, by, Math.max(1, ex - bx), Math.max(1, ey - by)];
  }

  // ---- post-FX (s3 owns 5.625 -> 7.5) ----
  function fx(t) {
    if (t >= TDROP) return;
    const f = R.fx;
    f.bloom = 0.15; f.threshold = 0.8; f.vignette = 0.35; f.grain = 0.045;
    const te = t - T0;
    f.bloom += 0.8 * Math.exp(-10 * te);
    R.flash(t, T0, { amount: 0.12, decay: 25, color: ICE });
    if (t >= TEXP) {
      const tx = tauX(Math.min(t, TDEAD));          // explosion envelopes run on the tape clock
      R.flash(TEXP + tx, TEXP, { amount: 0.25, decay: 12, color: ICE });
      R.impact(TEXP + tx, TEXP, { amount: 22, decay: 7 });
      f.chroma = 10 * Math.exp(-22 * tx);   // spec 10·e^(−6τ) splits 2-5 px particles into RGB confetti (report)
      f.bloom += 0.9 * Math.exp(-4 * tx);
    }
    if (t >= TS0 && t < TDEAD) {
      const u = tapeU(t);
      f.exposure = 1 - 0.65 * u * u;
      f.rot += -0.035 * u * u;
      f.chroma += 2 * u; f.chromaAngle = Math.PI / 2;   // spec 4u: halved, 4 px splits the floor hairlines into RGB (report)
      f.saturation = 1 - 0.3 * u;
    } else if (t >= TDEAD) {
      f.exposure = 1; f.saturation = 1; f.chroma = 0; f.rot = -0.035;
    }
  }

  Reel.scene({
    id: 's3', name: 'Depth', start: T0, end: TEND, layer: 2,
    setup(R) {
      // tight common sprite cell from the real ink bounds
      const cv = document.createElement('canvas').getContext('2d');
      R.font(cv, 125, 'display', 900); cv.textAlign = 'center'; cv.textBaseline = 'middle';
      let mx = 0, my = 0;
      for (const ch of CHARS) {
        const m = cv.measureText(ch);
        BOUNDS.set(ch, { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent });
        mx =Math.max(mx, Math.abs(m.actualBoundingBoxLeft), Math.abs(m.actualBoundingBoxRight));
        my = Math.max(my, Math.abs(m.actualBoundingBoxAscent), Math.abs(m.actualBoundingBoxDescent));
      }
      CW = Math.ceil(2 * mx + 16); CH = Math.ceil(2 * my + 16);
      atlas = null; ensureAtlas();
      buildParticles();
    },
    draw(ctx, t) {
      fx(t);
      if (t < TEXP) {
        drawFloor(ctx, t);
        // Adaptive sample count: sub-frame copies never more than ~BLUR_STEP px apart (capped at BLUR_MAX),
        // and the blur stays on until the fastest glyph moves less than ~BLUR_STEP px across the shutter.
        const travel = motionPx(t) * BLUR_SH;
        const NSMP = R.quality < 1 || travel < 6 ? 1 : R.clamp(Math.ceil(travel / BLUR_STEP) + 1, 3, BLUR_MAX);
        if (NSMP < 2) { drawCryptex(ctx, t); return; }
        const SH = BLUR_SH, bb = blurBox(t - SH / 2, t + SH / 2);
        const Acc = R.layer('s3:mbA'), S = R.layer('s3:mbS'), a = Acc.ctx;
        for (let i = 0; i < NSMP; i++) {
          if (i) { S.ctx.save(); S.ctx.setTransform(1, 0, 0, 1, 0, 0); S.ctx.clearRect(bb[0], bb[1], bb[2], bb[3]); S.ctx.restore(); }
          drawCryptex(S.ctx, t - SH * (i / (NSMP - 1) - 0.5));
          a.save(); a.setTransform(1, 0, 0, 1, 0, 0);
          a.globalAlpha = 1 / NSMP; a.globalCompositeOperation = 'lighter';
          a.drawImage(S.canvas, bb[0], bb[1], bb[2], bb[3], bb[0], bb[1], bb[2], bb[3]);
          a.restore();
        }
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(Acc.canvas, bb[0], bb[1], bb[2], bb[3], bb[0], bb[1], bb[2], bb[3]);
        ctx.restore();
        return;
      }
      if (t < TDROP) {
        drawFloor(ctx, t);
        shockwave(ctx, t);
        drawExplosion(ctx, t);
        if (t >= TDEAD) { ctx.fillStyle = BLACK_OVL; ctx.fillRect(-40, -40, 2000, 1160); }
      } else {
        drawSnap(ctx, t);
      }
      if (t >= TBLINK0 && t < TBLINK1) {
        ctx.fillStyle = LIME; ctx.beginPath(); ctx.arc(960, 540, 22, 0, TAU); ctx.fill();
      }
    },
  });
})();
