/* The ocean behind jeremylasne.com: sharks and narwhals seen from above,
   drawn as a grid of characters, after the koi pond of daoho.dev.

   Each animal is a spine of points that follows its head, so the body bends
   along the path it swims, and a wave runs down it to the tail. Every frame
   the body, the fins and the narwhal's tusk are laid on one fixed grid of
   square cells: a cell inside the body gets a fill and a character that stays
   with the body as it moves (the narwhal's spots, the shark's gills and the
   ridge down its back), a fin is drawn as strokes in the direction it points,
   and the eyes are an "o".

   Sharks come to the cursor; narwhals keep their distance. A tap on the water
   sends a ripple and scatters whoever swims near it. Text marked data-ocean
   fades whatever passes under it (to data-fade, 0 hides it), and "avoid"
   also steers the animals away, so the words stay readable. The page sets data-theme on <html> and fires
   "themechange" when it flips. A visitor who asks for less motion gets one
   still frame. */
(function () {
  "use strict";
  var cv = document.getElementById("ocean");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var root = document.documentElement;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;

  /* ── colours, per theme ─────────────────────────────────────────────── */
  var THEMES = {
    dark: {
      shark:   { body: "#3a5470", hi: "#48647f", rim: "#22324a", ch: "#9cb6cf", rimCh: "#5a7590", fin: "#314963", finCh: "#6f8ba7", ridge: "#2f73a3", ridgeCh: "#bfe6ff", gill: "#0b1420" },
      hammer:  { body: "#435468", hi: "#516479", rim: "#263345", ch: "#a7b7c8", rimCh: "#62778c", fin: "#38495c", finCh: "#7890a6", ridge: "#3a76a0", ridgeCh: "#c4e7fd", gill: "#0b1420" },
      narwhal: { body: "#5a6a7c", hi: "#68798c", rim: "#283443", ch: "#b9c7d4", rimCh: "#66798c", fin: "#4b5a6b", finCh: "#8798aa", spot: "#2b3848", spotCh: "#7f92a6", tusk: "#e9dcbd", tuskCh: "#8f7f60" },
      eye: "#eaf4fb", eyeBg: "#060c17", alpha: .92, fin: .9, fade: .1, dust: "#5fa8d3", dustA: .32, ripple: "#5fa8d3"
    },
    light: {
      shark:   { body: "#7f95ab", hi: "#94a8bc", rim: "#b9c7d4", ch: "#25374a", rimCh: "#62778c", fin: "#9aacbe", finCh: "#4b5f74", ridge: "#4f93c2", ridgeCh: "#0b3a5a", gill: "#22364a" },
      hammer:  { body: "#8b9caf", hi: "#9fafc0", rim: "#c0ccd8", ch: "#2b3b4c", rimCh: "#687c90", fin: "#a3b2c2", finCh: "#53667a", ridge: "#5a98c3", ridgeCh: "#0e3c5b", gill: "#22364a" },
      narwhal: { body: "#b2bfcc", hi: "#c3ced9", rim: "#d6dee6", ch: "#3c4c5d", rimCh: "#8293a5", fin: "#c0cbd6", finCh: "#6b7d8f", spot: "#76889a", spotCh: "#253342", tusk: "#c9a66b", tuskCh: "#6e5126" },
      eye: "#0b1626", eyeBg: "#f4f7fa", alpha: .9, fin: .9, fade: .12, dust: "#2a76a8", dustA: .28, ripple: "#2a76a8"
    }
  };
  var T = THEMES.dark;
  function theme() { T = THEMES[root.getAttribute("data-theme") === "light" ? "light" : "dark"]; }

  /* ── the animals, seen from above ───────────────────────────────────────
     s runs along the spine from the snout (0) to the tail (1). Widths and
     fin points are in units of the body length L; a fin point is [s, side],
     side measured from the spine, and a mirrored fin is drawn on both sides.
     Points past s = 1 continue behind the tail. */
  var KINDS = {
    shark: {
      len: 450, speed: 46, amp: .045, wave: 5.5, env: 1.6, beat: 4.2, radius: .8,
      S: [0, .03, .08, .15, .25, .35, .48, .6, .72, .84, 1],
      W: [0, .028, .058, .084, .1, .1, .085, .062, .04, .022, .012],
      eye: { s: .07, side: .78 }, gills: [.16, .24], ridge: [.33, .48],
      fins: [
        { p: [[.21, .085], [.44, .285], [.475, .275], [.36, .088]], mirror: true },
        { p: [[.62, .055], [.71, .11], [.725, .095], [.69, .045]], mirror: true },
        { p: [[.88, .018], [1.16, .07], [1.13, .035], [1.0, 0]] },
        { p: [[.92, -.012], [1.0, 0], [1.07, -.045]] }
      ]
    },
    hammer: {
      len: 430, speed: 42, amp: .045, wave: 5.5, env: 1.6, beat: 4, radius: .8,
      S: [0, .06, .1, .15, .25, .35, .48, .6, .72, .84, 1],
      W: [.02, .035, .055, .08, .095, .095, .082, .06, .038, .02, .012],
      eye: { s: .05, side: 0, at: .212 }, gills: [.17, .25], ridge: [.34, .49],
      head: [[-.01, 0], [.005, .12], [.03, .218], [.075, .21], [.088, .05], [.088, -.05], [.075, -.21], [.03, -.218], [.005, -.12]],
      fins: [
        { p: [[.22, .085], [.44, .27], [.475, .26], [.36, .088]], mirror: true },
        { p: [[.62, .055], [.71, .105], [.725, .09], [.69, .045]], mirror: true },
        { p: [[.88, .018], [1.16, .068], [1.13, .034], [1.0, 0]] },
        { p: [[.92, -.012], [1.0, 0], [1.07, -.043]] }
      ]
    },
    narwhal: {
      len: 370, speed: 30, amp: .016, wave: 4, env: 2, beat: 2.4, radius: .9,
      S: [0, .03, .08, .18, .32, .46, .6, .72, .82, .9, 1],
      W: [.06, .09, .116, .14, .146, .136, .11, .08, .05, .03, .025],
      eye: { s: .085, side: .76 }, tusk: { len: .62, side: .03 },
      fins: [
        { p: [[.14, .125], [.22, .138], [.32, .235], [.28, .25]], mirror: true },
        { p: [[.87, .032], [.93, .13], [.965, .255], [1.03, .235], [1.065, .12], [1.025, 0]], mirror: true, pulse: true }
      ]
    }
  };

  /* ── the grid, the animals, the water ─────────────────────────────── */
  var W = 0, H = 0, C = 14, dpr = 1, scale = 1;
  var fish = [], dust = [], ripples = [], rects = [], marks = [];
  var ptr = null, time = 0, lastW = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  /* a number from 0 to 1 that stays the same for the same cell of the same body */
  function hash(a, b, c) {
    var n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1103515245);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  /* a stroke that points along an angle: - \ | / (y runs down) */
  function stroke(a) {
    a = ((a % Math.PI) + Math.PI) % Math.PI;
    return a < Math.PI / 8 || a >= 7 * Math.PI / 8 ? "-" : a < 3 * Math.PI / 8 ? "\\" : a < 5 * Math.PI / 8 ? "|" : "/";
  }
  function widthAt(K, s) {
    var S = K.S, Wd = K.W;
    if (s <= 0) return Wd[0];
    for (var i = 1; i < S.length; i++) if (s <= S[i]) return Wd[i - 1] + (Wd[i] - Wd[i - 1]) * (s - S[i - 1]) / (S[i] - S[i - 1]);
    return Wd[Wd.length - 1];
  }

  function make(kind, x, y, ang) {
    var K = KINDS[kind], L = K.len * scale * rnd(.88, 1.1), N = 24, seg = L / N;
    var v0 = K.speed * Math.sqrt(scale) * rnd(.85, 1.15);
    var a = {
      kind: kind, K: K, L: L, N: N, seg: seg, ang: ang, om: 0, v0: v0, v: v0, boost: 0,
      phase: rnd(0, TAU), seed: (Math.random() * 1e9) | 0,
      f1: rnd(.05, .11), f2: rnd(.13, .23), r1: rnd(0, TAU), r2: rnd(0, TAU),
      maxTurn: v0 / (K.radius * L), flee: null, p: []
    };
    for (var i = 0; i <= N; i++) a.p.push({ x: x - Math.cos(ang) * seg * i, y: y - Math.sin(ang) * seg * i });
    return a;
  }

  /* where to put an animal: in sight, clear of the text, far from the others */
  function spot() {
    var best = null, bestD = -1;
    for (var k = 0; k < 40; k++) {
      var x = rnd(W * .08, W * .92), y = rnd(H * .1, H * .9), d = 1e9;
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (r.steer && x > r.l - 40 && x < r.r + 40 && y > r.t - 40 && y < r.b + 40) d = 0;
      }
      for (var j = 0; j < fish.length; j++) d = Math.min(d, Math.hypot(fish[j].p[0].x - x, fish[j].p[0].y - y));
      if (d > bestD) { bestD = d; best = { x: x, y: y }; }
    }
    return best;
  }

  /* The animals cross from one page to the next: where each one swam is kept for the
     tab on the way out, and the next page picks them up if the screen is the same width. */
  var KEEP = "ocean";
  function keep() {
    try {
      sessionStorage.setItem(KEEP, JSON.stringify({ w: W, t: time, fish: fish.map(function (a) {
        return { kind: a.kind, L: a.L, ang: a.ang, om: a.om, v0: a.v0, phase: a.phase, seed: a.seed, f1: a.f1, f2: a.f2, r1: a.r1, r2: a.r2,
          p: a.p.map(function (q) { return [Math.round(q.x), Math.round(q.y)]; }) };
      }) }));
    } catch (e) {}
  }
  function kept() {
    try {
      var k = JSON.parse(sessionStorage.getItem(KEEP) || "null");
      if (!k || !k.fish || !k.fish.length || Math.abs(k.w - W) > W * .1) return false;
      fish = k.fish.filter(function (o) { return KINDS[o.kind] && o.p && o.p.length === 25; }).map(function (o) {
        var a = make(o.kind, o.p[0][0], o.p[0][1], o.ang);
        ["L", "om", "v0", "phase", "seed", "f1", "f2", "r1", "r2"].forEach(function (key) { if (typeof o[key] === "number") a[key] = o[key]; });
        a.seg = a.L / a.N; a.v = a.v0; a.maxTurn = a.v0 / (a.K.radius * a.L);
        a.p = o.p.map(function (q) { return { x: q[0], y: q[1] }; });
        return a;
      });
      time = k.t || 0;
      return fish.length > 0;
    } catch (e) { return false; }
  }

  function populate() {
    fish = [];
    var kinds = W < 600 ? ["shark", "narwhal", "hammer"] : ["shark", "narwhal", "hammer", "narwhal"];
    measure();
    if (!kept()) kinds.forEach(function (k) { var p = spot(); fish.push(make(k, p.x, p.y, rnd(0, TAU))); });
    dust = [];
    var n = Math.round(W * H / 30000);
    for (var i = 0; i < n; i++) dust.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-5, 5), vy: rnd(-4, 4), ch: ".·.°"[i % 4], a: rnd(.35, 1) });
  }

  function resize() {
    W = cv.clientWidth; H = cv.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    /* the grid and the animals grow with the screen: 10px cells on a phone, 14 at 1440px, 18 on a 2K display */
    C = Math.round(clamp(W / 102, 10, 18));
    scale = clamp(Math.min(W, H * 1.4) / 1260, .5, 1.5);
    /* a phone's toolbar changes the height all the time: only a new width brings new animals */
    if (!fish.length || Math.abs(W - lastW) > lastW * .2) populate();
    lastW = W;
    if (still) draw();
  }

  /* the text on the page, in screen coordinates */
  function measure() {
    rects = [];
    for (var i = 0; i < marks.length; i++) {
      var el = marks[i], b = el.getBoundingClientRect();
      if (b.bottom < -40 || b.top > H + 40 || !b.width) continue;
      var f = parseFloat(el.getAttribute("data-fade"));
      rects.push({ l: b.left, t: b.top, r: b.right, b: b.bottom, steer: el.getAttribute("data-ocean") === "avoid", f: isNaN(f) ? null : f });
    }
  }

  /* ── swimming ─────────────────────────────────────────────────────── */
  function swim(a, dt) {
    var h = a.p[0], cos = Math.cos(a.ang), sin = Math.sin(a.ang);
    var sx = 0, sy = 0, i, d;

    /* the edges of the screen push back, a little past them more */
    var z = Math.min(W, H) * .14 + a.L * .2;
    if (h.x < z) sx += (z - h.x) / z;
    if (h.x > W - z) sx -= (h.x - W + z) / z;
    if (h.y < z) sy += (z - h.y) / z;
    if (h.y > H - z) sy -= (h.y - H + z) / z;

    /* text: look ahead, and turn away from what is there */
    var ax = h.x + cos * a.L * .35, ay = h.y + sin * a.L * .35, pad = 20 + a.L * .12;
    for (i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!r.steer) continue;
      var qx = clamp(ax, r.l - pad, r.r + pad), qy = clamp(ay, r.t - pad, r.b + pad);
      d = Math.hypot(ax - qx, ay - qy);
      if (d === 0) {
        var cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2, dd = Math.hypot(ax - cx, ay - cy) || 1;
        sx += (ax - cx) / dd * 2.2; sy += (ay - cy) / dd * 2.2;
      } else if (d < 90) { sx += (ax - qx) / d * (1 - d / 90) * 1.6; sy += (ay - qy) / d * (1 - d / 90) * 1.6; }
    }

    /* the others: room to swim */
    for (i = 0; i < fish.length; i++) {
      var b = fish[i];
      if (b === a) continue;
      var bx = b.p[b.N >> 1].x, by = b.p[b.N >> 1].y, R = (a.L + b.L) * .42;
      d = Math.hypot(h.x - bx, h.y - by);
      if (d < R && d > 0) { sx += (h.x - bx) / d * (1 - d / R) * 1.4; sy += (h.y - by) / d * (1 - d / R) * 1.4; }
    }

    /* the cursor: sharks come and circle it, narwhals swim off */
    if (ptr) {
      d = Math.hypot(ptr.x - h.x, ptr.y - h.y) || 1;
      if (a.kind === "narwhal") {
        if (d < 200) { sx -= (ptr.x - h.x) / d * (1 - d / 200) * 2; sy -= (ptr.y - h.y) / d * (1 - d / 200) * 2; }
      } else if (d < 340) {
        var pull = d > 70 ? .5 + (1 - d / 340) : 0;
        sx += (ptr.x - h.x) / d * pull - (ptr.y - h.y) / d * .5;
        sy += (ptr.y - h.y) / d * pull + (ptr.x - h.x) / d * .5;
      }
    }

    /* a ripple: away from it, fast */
    if (a.flee) {
      if (time > a.flee.until) a.flee = null;
      else { d = Math.hypot(h.x - a.flee.x, h.y - a.flee.y) || 1; sx += (h.x - a.flee.x) / d * 3; sy += (h.y - a.flee.y) / d * 3; }
    }

    /* wander, and turn toward whatever pushes */
    var turn = (Math.sin(time * a.f1 * TAU + a.r1) * .6 + Math.sin(time * a.f2 * TAU + a.r2) * .4) * a.maxTurn * .6;
    var mag = Math.hypot(sx, sy);
    if (mag > .001) turn += clamp(wrapAngle(Math.atan2(sy, sx) - a.ang), -1, 1) * Math.min(mag, 1.5) * a.maxTurn * 1.6;
    var cap = a.maxTurn * (a.flee ? 2.6 : 1.5);
    a.om += (clamp(turn, -cap, cap) - a.om) * Math.min(1, dt * 2.5);
    a.ang = wrapAngle(a.ang + a.om * dt);

    a.boost *= Math.exp(-dt * 1.1);
    a.v = a.v0 * (1 + a.boost);
    h.x += Math.cos(a.ang) * a.v * dt;
    h.y += Math.sin(a.ang) * a.v * dt;
    for (i = 1; i <= a.N; i++) {
      var p = a.p[i], q = a.p[i - 1], dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1;
      p.x = q.x + dx / l * a.seg; p.y = q.y + dy / l * a.seg;
    }
    a.phase += dt * a.K.beat * (.55 + .45 * a.v / a.v0);

    /* lost far off screen: back in from the other side */
    var far = a.L * 1.6;
    if (h.x < -far || h.x > W + far || h.y < -far || h.y > H + far) {
      var n = make(a.kind, h.x < -far ? W + a.L * .3 : h.x > W + far ? -a.L * .3 : clamp(h.x, 0, W),
        h.y < -far ? H + a.L * .3 : h.y > H + far ? -a.L * .3 : clamp(h.y, 0, H), 0);
      n.ang = Math.atan2(H / 2 - n.p[0].y, W / 2 - n.p[0].x);
      fish[fish.indexOf(a)] = make(a.kind, n.p[0].x, n.p[0].y, n.ang);
    }
  }

  /* ── drawing ──────────────────────────────────────────────────────── */
  /* the spine as drawn: the swimming spine with the wave down it */
  function body(a) {
    var N = a.N, K = a.K, X = new Float32Array(N + 1), Y = new Float32Array(N + 1);
    var NX = new Float32Array(N + 1), NY = new Float32Array(N + 1), i, tx, ty, l;
    for (i = 0; i <= N; i++) {
      var j0 = Math.max(0, i - 1), j1 = Math.min(N, i + 1);
      tx = a.p[j0].x - a.p[j1].x; ty = a.p[j0].y - a.p[j1].y; l = Math.hypot(tx, ty) || 1;
      var s = i / N, off = K.amp * a.L * Math.sin(a.phase - s * K.wave) * Math.pow(s, K.env);
      X[i] = a.p[i].x - ty / l * off; Y[i] = a.p[i].y + tx / l * off;
    }
    for (i = 0; i <= N; i++) {
      var k0 = Math.max(0, i - 1), k1 = Math.min(N, i + 1);
      tx = X[k0] - X[k1]; ty = Y[k0] - Y[k1]; l = Math.hypot(tx, ty) || 1;
      NX[i] = -ty / l; NY[i] = tx / l;
    }
    return { X: X, Y: Y, NX: NX, NY: NY };
  }
  /* a point of the body: s along the spine, side across it, both in L */
  function at(a, B, s, side) {
    var N = a.N, x, y, nx, ny;
    if (s <= 0) { nx = B.NX[0]; ny = B.NY[0]; x = B.X[0] + ny * -s * a.L; y = B.Y[0] - nx * -s * a.L; }
    else if (s >= 1) { nx = B.NX[N]; ny = B.NY[N]; x = B.X[N] - ny * (s - 1) * a.L; y = B.Y[N] + nx * (s - 1) * a.L; }
    else {
      var f = s * N, i = Math.floor(f), t = f - i;
      x = B.X[i] + (B.X[i + 1] - B.X[i]) * t; y = B.Y[i] + (B.Y[i + 1] - B.Y[i]) * t;
      nx = B.NX[i] + (B.NX[i + 1] - B.NX[i]) * t; ny = B.NY[i] + (B.NY[i + 1] - B.NY[i]) * t;
    }
    return { x: x + nx * side * a.L, y: y + ny * side * a.L };
  }
  function inside(px, py, P) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++)
      if ((P[i].y > py) !== (P[j].y > py) && px < (P[j].x - P[i].x) * (py - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c;
    return c;
  }

  /* one animal onto the grid: cells keyed by column and row, each with its
     fill, its character and how much it counts against the others */
  function cells(a) {
    var K = a.K, B = body(a), N = a.N, L = a.L, out = new Map(), i;
    var col = T[a.kind];
    function put(gx, gy, c) {
      var key = gx * 4096 + gy, o = out.get(key);
      if (!o || o.z <= c.z) { c.gx = gx; c.gy = gy; out.set(key, c); }
    }

    /* the outline of every fin, in screen points */
    var fins = [];
    (K.fins || []).forEach(function (f) {
      var sides = f.mirror ? [1, -1] : [1];
      sides.forEach(function (sg) {
        var k = f.pulse ? .82 + .18 * Math.sin(a.phase * 1.2) : 1;
        var P = f.p.map(function (q) { return at(a, B, q[0], q[1] * sg * k); });
        var n = f.p.length, base = { x: (P[0].x + P[n - 1].x) / 2, y: (P[0].y + P[n - 1].y) / 2 }, tip = P[0];
        P.forEach(function (q) { if (Math.hypot(q.x - base.x, q.y - base.y) > Math.hypot(tip.x - base.x, tip.y - base.y)) tip = q; });
        fins.push({ P: P, ch: stroke(Math.atan2(tip.y - base.y, tip.x - base.x)) });
      });
    });
    var head = K.head ? K.head.map(function (q) { return at(a, B, q[0], q[1]); }) : null;

    /* what to look at: the spine, the fins, the hammer's head */
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, wMax = Math.max.apply(null, K.W) * L + C;
    for (i = 0; i <= N; i++) { x0 = Math.min(x0, B.X[i] - wMax); x1 = Math.max(x1, B.X[i] + wMax); y0 = Math.min(y0, B.Y[i] - wMax); y1 = Math.max(y1, B.Y[i] + wMax); }
    fins.concat(head ? [{ P: head }] : []).forEach(function (f) {
      f.P.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    });
    var gx0 = Math.max(0, Math.floor(x0 / C)), gx1 = Math.min(Math.ceil(W / C), Math.ceil(x1 / C));
    var gy0 = Math.max(0, Math.floor(y0 / C)), gy1 = Math.min(Math.ceil(H / C), Math.ceil(y1 / C));

    for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
      var px = (gx + .5) * C, py = (gy + .5) * C;
      /* the nearest point of the spine */
      var best = 1e18, bs = 0, side = 1;
      for (i = 0; i < N; i++) {
        var ex = B.X[i + 1] - B.X[i], ey = B.Y[i + 1] - B.Y[i], ll = ex * ex + ey * ey || 1;
        var t = clamp(((px - B.X[i]) * ex + (py - B.Y[i]) * ey) / ll, 0, 1);
        var dx = px - B.X[i] - ex * t, dy = py - B.Y[i] - ey * t, dd = dx * dx + dy * dy;
        if (dd < best) { best = dd; bs = (i + t) / N; side = ex * dy - ey * dx > 0 ? 1 : -1; }
      }
      var d = Math.sqrt(best), w = widthAt(K, bs) * L;
      if (bs > .55) w = Math.max(w, C * .5);
      var u = Math.round(bs * L / C), v = Math.round(d * side / C), r = d / (w || 1);
      if (d <= w) {
        var c = { z: 3, f: col.body, ch: "", cc: col.ch };
        if (r > .8 && w > C * .9) { c.f = col.rim; c.ch = "."; c.cc = col.rimCh; }
        else if (a.kind === "narwhal") {
          var hs = hash(u, v, a.seed), blot = hash(u >> 1, v >> 1, a.seed + 7);
          if (bs > .1 && bs < .88 && blot < .34) { c.f = col.spot; c.ch = hs < .4 ? "%" : "#"; c.cc = col.spotCh; }
          else { c.f = r < .45 ? col.hi : col.body; c.ch = hs > .82 ? ":" : hs > .62 ? "." : ""; }
        } else if (bs > K.ridge[0] && bs < K.ridge[1] && Math.abs(v) < 1) {
          c.f = col.ridge; c.cc = col.ridgeCh;
          var ti = Math.min(N - 1, Math.floor(bs * N));
          c.ch = stroke(Math.atan2(B.Y[ti] - B.Y[ti + 1], B.X[ti] - B.X[ti + 1]));
        } else if (bs > K.gills[0] && bs < K.gills[1] && r > .45) {
          var gi = Math.min(N, Math.round(bs * N));
          c.f = col.body; c.cc = col.gill; c.ch = stroke(Math.atan2(B.NY[gi], B.NX[gi]));
        } else {
          var hz = hash(u, v, a.seed);
          c.f = r < .45 ? col.hi : col.body; c.ch = hz < .3 ? "x" : hz < .55 ? "+" : hz < .75 ? ":" : "";
        }
        put(gx, gy, c);
        continue;
      }
      if (head && inside(px, py, head)) { put(gx, gy, { z: 3, f: col.body, ch: hash(gx, gy, a.seed) < .4 ? "=" : "", cc: col.ch }); continue; }
      for (i = 0; i < fins.length; i++) if (inside(px, py, fins[i].P)) { put(gx, gy, { z: 1, f: col.fin, a: T.fin, ch: fins[i].ch, cc: col.finCh }); break; }
    }

    /* the tusk: ivory out of the left of the head, its spiral in strokes */
    if (K.tusk) {
      var s0 = at(a, B, -.01, K.tusk.side), s1 = at(a, B, -.01 - K.tusk.len, K.tusk.side);
      var spiral = stroke(Math.atan2(s1.y - s0.y, s1.x - s0.x) + Math.PI / 4), steps = Math.ceil(Math.max(Math.abs(s1.x - s0.x), Math.abs(s1.y - s0.y)) / C);
      for (i = 0; i <= steps; i++) {
        var tx = s0.x + (s1.x - s0.x) * i / steps, ty = s0.y + (s1.y - s0.y) * i / steps;
        var tgx = Math.floor(tx / C), tgy = Math.floor(ty / C);
        put(tgx, tgy, i === steps ? { z: 2, f: "", ch: ".", cc: col.tusk } : { z: 2, f: col.tusk, ch: i % 2 ? spiral : "", cc: col.tuskCh });
      }
    }

    /* the eyes */
    var eyes = K.eye.at ? [at(a, B, K.eye.s, K.eye.at), at(a, B, K.eye.s, -K.eye.at)]
      : [at(a, B, K.eye.s, widthAt(K, K.eye.s) * K.eye.side), at(a, B, K.eye.s, -widthAt(K, K.eye.s) * K.eye.side)];
    eyes.forEach(function (e) { put(Math.floor(e.x / C), Math.floor(e.y / C), { z: 4, f: T.eyeBg, ch: "o", cc: T.eye }); });
    return out;
  }

  /* how much of a cell shows at this point: 1 in open water, less under text */
  function faded(x, y) {
    var m = 1;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x > r.l - 8 && x < r.r + 8 && y > r.t - 8 && y < r.b + 8) m = Math.min(m, r.f === null ? T.fade : r.f);
    }
    return m;
  }

  function draw() {
    if (!W) return;
    measure();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = Math.round(C * .78) + 'px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    /* the water: drifting specks */
    ctx.fillStyle = T.dust;
    for (var i = 0; i < dust.length; i++) {
      var p = dust[i], gx = Math.floor(p.x / C), gy = Math.floor(p.y / C), x = (gx + .5) * C, y = (gy + .5) * C;
      ctx.globalAlpha = T.dustA * p.a * Math.min(1, faded(x, y) * 3);
      ctx.fillText(p.ch, x, y);
    }

    /* the ripples */
    ripples.forEach(function (r) {
      var age = time - r.t, rad = 16 + age * 230, n = Math.max(10, Math.round(TAU * rad / C)), seen = {};
      ctx.globalAlpha = Math.max(0, 1 - age / 1.4) * .55;
      ctx.fillStyle = T.ripple;
      for (var k = 0; k < n; k++) {
        var gx = Math.floor((r.x + Math.cos(k / n * TAU) * rad) / C), gy = Math.floor((r.y + Math.sin(k / n * TAU) * rad) / C), key = gx + "," + gy;
        if (seen[key]) continue;
        seen[key] = 1;
        ctx.fillText(k % 3 ? "~" : ".", (gx + .5) * C, (gy + .5) * C);
      }
    });

    /* the animals, narwhals under sharks */
    fish.slice().sort(function (a, b) { return (a.kind === "narwhal" ? 0 : 1) - (b.kind === "narwhal" ? 0 : 1); }).forEach(function (a) {
      cells(a).forEach(function (c) {
        var x = c.gx * C, y = c.gy * C, cx = x + C / 2, cy = y + C / 2;
        var alpha = T.alpha * (c.a || 1) * faded(cx, cy);
        if (!alpha) return;
        ctx.globalAlpha = alpha;
        if (c.f) { ctx.fillStyle = c.f; ctx.fillRect(x + .5, y + .5, C - 1, C - 1); }
        if (c.ch) { ctx.fillStyle = c.cc; ctx.fillText(c.ch, cx, cy + .5); }
      });
    });
    ctx.globalAlpha = 1;
  }

  /* ── the loop: 30 frames a second is plenty for a grid ─────────────── */
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 32) return;
    var dt = Math.min(.1, (now - last) / 1000);
    last = now;
    time += dt;
    measure();
    fish.slice().forEach(function (a) { swim(a, dt); });
    dust.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0) p.x += W; if (p.x > W) p.x -= W; if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
    });
    ripples = ripples.filter(function (r) { return time - r.t < 1.4; });
    draw();
  }

  /* ── the visitor ──────────────────────────────────────────────────── */
  marks = Array.prototype.slice.call(document.querySelectorAll("[data-ocean]"));
  theme();
  window.addEventListener("themechange", function () { theme(); if (still) draw(); });
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", keep);
  if (still) window.addEventListener("scroll", draw, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (still) draw(); });
  resize();

  if (!still) {
    window.addEventListener("pointermove", function (e) { ptr = e.pointerType === "touch" ? null : { x: e.clientX, y: e.clientY }; }, { passive: true });
    document.addEventListener("pointerleave", function () { ptr = null; });
    window.addEventListener("blur", function () { ptr = null; });
    /* a tap on the water, not on a link or a phone */
    document.addEventListener("pointerdown", function (e) {
      if (e.button || e.target.closest("a, button, input, label, .bar, .tabs")) return;
      ripples.push({ x: e.clientX, y: e.clientY, t: time });
      fish.forEach(function (a) {
        if (Math.hypot(a.p[0].x - e.clientX, a.p[0].y - e.clientY) < 300) { a.flee = { x: e.clientX, y: e.clientY, until: time + 1.3 }; a.boost = 1.7; }
      });
    });
    requestAnimationFrame(function (t) { last = t; frame(t); });
  }
})();
