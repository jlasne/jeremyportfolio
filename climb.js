(function () {
  "use strict";
  /* The climb so far: a pixel goat walks up a 2D mountain by itself, one flag
     per checkpoint of my life. At each flag a card tells the story; a tap makes
     the goat hop and hurry, the years under the scene jump to any flag. At the
     top the camera pulls back and the hill turns out to be the foot of a range.
     The checkpoints are the list in index.html (#climb .climb-list): edit them
     there. The sky is left empty so the ridge and the snow of the page show
     through; every sprite sits on the same pixel grid as the goat. */
  var root = document.getElementById("climb");
  if (!root) return;
  var stage = root.querySelector(".climb-stage");
  var canvas = root.querySelector(".climb-canvas");
  var ctx = canvas.getContext("2d");
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var EVENTS = Array.prototype.map.call(root.querySelectorAll(".climb-list li"), function (li) {
    var b = li.querySelector("b");
    return {
      year: +li.getAttribute("data-year"),
      icon: li.getAttribute("data-icon"),
      title: b ? b.textContent.trim() : "",
      line: li.textContent.replace(b ? b.textContent : "", "").trim()
    };
  });
  if (EVENTS.length < 2) return;
  var BIRTH = EVENTS[0].year;
  var LAST = EVENTS.length - 1;
  var AGE_NOW = EVENTS[LAST].year - BIRTH;

  /* ---------------- pixel art ---------------- */

  var GOAT_PAL = {
    a: "#fdae39", b: "#d77841", c: "#a0513c", d: "#b86f4f",
    e: "#c2856a", f: "#753d37", g: "#eab698", h: "#ebd5a8"
  };
  // drawn facing left, mirrored at load so the goat climbs to the right
  var GOAT_TOP = [
    "..ab.............",
    ".ab..cd..........",
    ".aedccc..........",
    ".eeddc........e..",
    "eefedcc........d.",
    "eeddccdc......ed.",
    "eddcccedccccccdd.",
    "edc.cdeeeeeeedcd.",
    ".gg.cdeeeeedeedc.",
    "..g.cdeddedcded..",
    ".....cddcddcddd..",
    "......ddfccfcddd.",
    "......hdf...fcdh."
  ];
  var LEGS_STAND = ["......hhc....fhh.", "......ghc....cgh."];
  function mirror(rows) { return rows.map(function (r) { return r.split("").reverse().join(""); }); }
  var GOAT_STAND = mirror(GOAT_TOP.concat(LEGS_STAND));
  var GOAT_STRIDE = mirror(GOAT_TOP.concat([".....hh.c....f.hh", ".....gh.c....c.gh"]));
  var GOAT_HOP = mirror(GOAT_TOP.concat(["......ghc....cgh.", "................."]));
  var GOAT_BLINK = mirror(GOAT_TOP.concat(LEGS_STAND).map(function (r, y) { return y === 4 ? r.replace("f", "e") : r; }));

  var TENT_PAL = { o: "#5a3b33", r: "#f2a58e", R: "#d27c69", d: "#4a3340", g: "#5fa8d3" };
  var TENT = [
    "........g........",
    "........gg.......",
    "........o........",
    ".......oro.......",
    "......orrRo......",
    ".....orrdRRo.....",
    "....orrrddRRo....",
    "...orrrrddRRRo...",
    "..orrrrrddRRRRo..",
    "ooooooooooooooooo"
  ];

  var ICON_PAL = {
    p: "#f49ab0", P: "#d0607a", w: "#ffffff", g: "#f2c84b", G: "#c09530",
    b: "#8fb6e0", B: "#5a82b4", n: "#9ccf8f", N: "#5e8f59", s: "#cfc8bc",
    S: "#8a8278", e: "#4fc3cc", k: "#7d72c0", K: "#4f4690", r: "#c48256",
    R: "#8a5636", c: "#a8e0d6"
  };
  var ICONS = {
    heart: ["........", ".PP.PP..", "PwpPppP.", "PpppppP.", ".PpppP..", "..PpP...", "...P....", "........"],
    medal: [".bB..Bb.", "..bBBb..", "...bb...", "..GGGG..", ".GgwggG.", ".GggggG.", ".GggggG.", "..GGGG.."],
    chart: ["......NN", "......nN", "...NN.nN", "...nN.nN", "NN.nN.nN", "nN.nN.nN", "nN.nN.nN", "SSSSSSSS"],
    pi: ["........", "bbbbbbbb", ".bB..bB.", ".bB..bB.", ".bB..bB.", ".bB..bB.", "bB...bbB", "........"],
    gear: ["...ss...", ".s.ss.s.", "..ssss..", "sss..ssS", "Sss..sSS", "..sSSS..", ".S.SS.S.", "...SS..."],
    robot: ["....g...", "....s...", ".ssssss.", "swwwwwws", "swewwews", "swwSSwws", ".ssssss.", "..s..s.."],
    cap: ["........", "...kk...", ".kkkkkk.", "kkkkkkkk", ".kkkkkkg", "..KKKK.g", "..KKKK.g", "........"],
    "case": ["........", "..RRRR..", "..R..R..", "RrrrrrrR", "RrrggrrR", "RrrrrrrR", "RRRRRRRR", "........"],
    phone: [".kkkkkk.", ".kcccck.", ".kgcnck.", ".kcccck.", ".kncgck.", ".kcccck.", ".kkkwkk.", "........"]
  };

  /* ---------------- the world, in goat pixels ---------------- */

  var X0 = 70, SEG = 72, LEDGE_HALF = 7;
  var STEP = [0, 30, 62, 96, 128, 164, 196, 232, 268];
  var LEDGES = EVENTS.map(function (_, i) { return i < STEP.length ? STEP[i] : STEP[STEP.length - 1] + (i - STEP.length + 1) * 34; });
  var CP_X = LEDGES.map(function (_, i) { return X0 + i * SEG; });
  var SUMMIT_X = CP_X[LAST], SUMMIT_H = LEDGES[LAST];
  var VALLEY_H = SUMMIT_H - 53;
  var PEAKS = [{ c: SUMMIT_X + 520, h: SUMMIT_H * 4, w: 400 }];
  for (var k = 1; k < 10; k++) {
    PEAKS.push({ c: SUMMIT_X + 520 + k * 330 + (hash(k, 61) - .5) * 80, h: SUMMIT_H * (2.4 + hash(k, 62) * 1.3), w: 280 + hash(k, 63) * 120 });
  }
  var GIANT = PEAKS[0];
  var GRASS_LINE = 100, FOOT_SNOW = SUMMIT_H - 18, PEAK_SNOW = SUMMIT_H * 2.25;
  var STOP_OFFSET = -5, FLAG_OFFSET = 5;
  var WALK = 30, REST = 3.2, SUMMIT_REST = 3.2, HOP = .42, ZOOM = 3.6;

  function smooth(t) { return t * t * (3 - 2 * t); }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function hash(x, y) {
    var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function terrain(x) {
    var first = CP_X[0];
    if (x <= first + LEDGE_HALF) {
      var d = first - LEDGE_HALF - x;
      if (d <= 0) return LEDGES[0];
      return LEDGES[0] + 2 * (1 - Math.cos(d * .08)) * Math.min(1, d / 24);
    }
    if (x >= SUMMIT_X - LEDGE_HALF) {
      if (x <= SUMMIT_X + LEDGE_HALF) return SUMMIT_H;
      var h = SUMMIT_H + (VALLEY_H - SUMMIT_H) * smooth(clamp01((x - SUMMIT_X - LEDGE_HALF) / 70));
      for (var p = 0; p < PEAKS.length; p++) {
        var q = Math.abs(x - PEAKS[p].c) / PEAKS[p].w;
        if (q < 1) h = Math.max(h, VALLEY_H + (PEAKS[p].h - VALLEY_H) * Math.pow(1 - q, 1.25));
      }
      var rough = clamp01((h - VALLEY_H) / 200);
      return h + (Math.sin(x * .23) * 4 + Math.sin(x * .071 + .6) * 10) * rough;
    }
    var i = Math.min(LAST - 1, Math.floor((x - first) / SEG));
    var a = CP_X[i] + LEDGE_HALF, b = CP_X[i + 1] - LEDGE_HALF;
    if (x <= a) return LEDGES[i];
    if (x >= b) return LEDGES[i + 1];
    var t = (x - a) / (b - a);
    var bump = Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 3 + i * 1.7) * 4;
    return LEDGES[i] + (LEDGES[i + 1] - LEDGES[i]) * smooth(t) + bump;
  }
  function farHeight(x) { return 40 + 16 * Math.sin(x * .021) + 10 * Math.sin(x * .047 + 1.3) + 5 * Math.sin(x * .11 + .5); }
  function midHeight(x) { return 24 + 9 * Math.sin(x * .035 + 2) + 5 * Math.sin(x * .09); }

  /* ---------------- colours: the page's ink, ice and blue ---------------- */

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    var al = Math.round((a == null ? 1 : a) * 255);
    return ((al << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
  }
  var C = {
    far: rgba("#1c3350", .5), farSnow: rgba("#eaf4fb", .38),
    mid: rgba("#0b1a2c", .78), midTree: rgba("#081422", .9),
    cloud: rgba("#eaf4fb", .9), cloudShade: rgba("#b6cde0", .85),
    grass: rgba("#86b98f"), grassDark: rgba("#5f9271"), dirt: rgba("#3d332f"), dirtDark: rgba("#2f2724"),
    rock: rgba("#4b5a6b"), rockLight: rgba("#6a7c90"), rockDark: rgba("#37434f"),
    snow: rgba("#eaf4fb"), snowShade: rgba("#b6cde0"),
    pole: rgba("#eaf4fb", .85), flagOff: rgba("#eaf4fb", .42), flagOffShade: rgba("#eaf4fb", .28),
    flag: rgba("#5fa8d3"), flagShade: rgba("#3f7fa6"), white: rgba("#ffffff"), dust: rgba("#d8dfe6", .9)
  };
  var FLOWERS = ["#f4a6b8", "#f7d774", "#ffffff", "#b9a3f0"].map(function (h) { return rgba(h); });
  var CONFETTI = ["#5fa8d3", "#f4a6b8", "#f7d774", "#9ccf8f", "#ffffff"].map(function (h) { return rgba(h); });

  function sprite(rows, pal) {
    var h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var px = new Uint32Array(w * h);
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (pal[row[x]]) px[y * w + x] = rgba(pal[row[x]]);
    });
    return { w: w, h: h, px: px };
  }
  function cloudShape(seed, w) {
    var h = Math.round(w * .42), mask = new Uint8Array(w * h), circles = [];
    var bumps = 3 + Math.floor(hash(seed, 1) * 3);
    for (var i = 0; i < bumps; i++) {
      var t = (i + .5) / bumps;
      var r = h * (.35 + .3 * Math.sin(t * Math.PI)) * (.85 + hash(seed, i + 2) * .3);
      circles.push([t * w, h - r, r]);
    }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      for (var c = 0; c < circles.length; c++) {
        var dx = x + .5 - circles[c][0], dy = y + .5 - circles[c][1];
        if (dx * dx + dy * dy <= circles[c][2] * circles[c][2]) { mask[y * w + x] = y > h * .66 ? 2 : 1; break; }
      }
    }
    return { w: w, h: h, mask: mask };
  }

  var goat = { stand: sprite(GOAT_STAND, GOAT_PAL), stride: sprite(GOAT_STRIDE, GOAT_PAL), hop: sprite(GOAT_HOP, GOAT_PAL), blink: sprite(GOAT_BLINK, GOAT_PAL) };
  var tent = sprite(TENT, TENT_PAL);
  var icons = {};
  Object.keys(ICONS).forEach(function (k) { icons[k] = sprite(ICONS[k], ICON_PAL); });
  var skyClouds = [], peakClouds = [];
  for (var i = 0; i < 7; i++) skyClouds.push({ shape: cloudShape(i + 1, 18 + Math.floor(hash(i, 21) * 18)), x: hash(i, 22) * 900, y: 60 + hash(i, 23) * 50, speed: 2 + hash(i, 24) * 3 });
  for (i = 0; i < 6; i++) peakClouds.push({ shape: cloudShape(i + 40, 70 + Math.floor(hash(i, 31) * 60)), x: GIANT.c - 150 + i * 58 + hash(i, 32) * 20, y: GIANT.h - 200 + hash(i, 33) * 90, phase: hash(i, 34) * 6.28 });

  /* ---------------- the overlays ---------------- */

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function iconSvg(name) {
    var rows = ICONS[name] || ICONS.heart, rects = "";
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (ICON_PAL[row[x]]) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + ICON_PAL[row[x]] + '"/>';
    });
    return '<svg class="climb-icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">' + rects + "</svg>";
  }
  var card = el("div", "climb-card", stage); card.hidden = true; card.setAttribute("aria-live", "polite");
  var hud = el("div", "climb-hud", stage); hud.hidden = true; hud.setAttribute("aria-hidden", "true");
  var hudCount = el("span", "climb-count", hud);
  el("span", "climb-hint", hud).textContent = "tap to hop";
  var you = el("div", "climb-marker", stage); you.textContent = "you are here"; you.hidden = true;
  var peak = el("div", "climb-marker climb-marker-peak", stage); peak.textContent = "the real summit"; peak.hidden = true;
  var end = el("div", "climb-end", stage); end.hidden = true;
  el("div", "climb-kicker", end).textContent = AGE_NOW + " years · " + EVENTS.length + " checkpoints";
  el("div", "climb-end-title", end).textContent = "Still a long way to the top.";
  var again = el("button", "climb-button", end); again.type = "button"; again.textContent = "↺ Climb again";
  var startBtn = el("button", "climb-button climb-start", stage); startBtn.type = "button"; startBtn.textContent = "▶ Start the climb"; startBtn.hidden = !still;
  var steps = root.querySelector(".climb-steps");
  var chips = EVENTS.map(function (ev, i) {
    var b = el("button", "climb-step", steps);
    b.type = "button"; b.textContent = ev.year; b.setAttribute("aria-label", ev.year + ": " + ev.title);
    b.addEventListener("click", function () { jump(i); });
    return b;
  });
  [again, startBtn].forEach(function (b) { b.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); });
  again.addEventListener("click", function () { jump(0); });
  startBtn.addEventListener("click", function () { begin(); });

  var uiShown = -2, uiPhase = "";
  function paintUi(shown, phase) {
    if (shown === uiShown && phase === uiPhase) return;
    uiShown = shown; uiPhase = phase;
    if (shown >= 0) {
      var ev = EVENTS[shown];
      card.innerHTML = iconSvg(ev.icon) + '<div class="climb-body"><div class="climb-year"></div><div class="climb-title"></div><p class="climb-line"></p></div>';
      card.querySelector(".climb-year").textContent = ev.year + " · age " + (ev.year - BIRTH);
      card.querySelector(".climb-title").textContent = ev.title;
      card.querySelector(".climb-line").textContent = ev.line;
      card.hidden = false;
      card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
      hudCount.textContent = shown + 1 + "/" + EVENTS.length;
    } else card.hidden = true;
    hud.hidden = !(phase === "play" && shown >= 0);
    end.hidden = you.hidden = peak.hidden = phase !== "end";
    if (phase !== "idle") startBtn.hidden = true;
    chips.forEach(function (b, i) {
      var state = phase === "end" || (shown >= 0 && i < shown) ? "done" : i === shown ? "now" : "";
      b.className = "climb-step" + (state ? " " + state : "");
      if (i === shown) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
  }

  /* ---------------- state ---------------- */

  var s = {
    W: 0, H: 0, img: null, buf: null, narrow: false, inView: false, raf: 0, last: 0, t: 0,
    phase: "idle", started: false, goatX: CP_X[0] + STOP_OFFSET, target: 0, shown: -1, restLeft: 0,
    boost: 0, hopT: -1, hopLift: 7, autoHopIn: 0, stepT: 0,
    cam: { x: 0, y: 0, z: 1 }, zoomT: 0, zoomFrom: null, zoomTo: null, particles: [], startTimer: 0
  };
  function uiPhaseNow() { return s.phase === "end" ? "end" : s.started ? "play" : "idle"; }

  function goatY(x) { return Math.max(terrain(x), (terrain(x - 4) + terrain(x + 4)) / 2); }
  function follow() { return { x: s.goatX + .16 * s.W, y: goatY(s.goatX) + .16 * s.H }; }
  function fitView() {
    var x0 = 20, x1 = GIANT.c + 90, y0 = -14, y1 = GIANT.h + 20;
    // the clear band between the top fade and the end card (a bottom card on phones)
    var top = .2, bottom = s.narrow ? .6 : .84;
    var z = Math.min(s.W / (x1 - x0), ((bottom - top) * s.H) / (y1 - y0));
    var span = s.W / z, center = (x0 + x1) / 2;
    // wide screens: the real summit sits right of the end card, the range fills the rest
    var x = span > (x1 - x0) * 1.05 ? Math.max(center, Math.min(GIANT.c - .1 * span, x0 + .42 * span)) : center;
    return { x: x, y: y0 + ((bottom - .5) * s.H) / z, z: z };
  }

  function resize() {
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var px = r.width < 560 ? 3 : 4;
    s.narrow = r.width < 640;
    var W = Math.ceil(r.width / px), H = Math.ceil(r.height / px);
    if (W === s.W && H === s.H) return;
    s.W = W; s.H = H;
    canvas.width = W; canvas.height = H;
    canvas.style.width = W * px + "px"; canvas.style.height = H * px + "px";
    s.img = ctx.createImageData(W, H);
    s.buf = new Uint32Array(s.img.data.buffer);
    if (s.phase === "zoom" || s.phase === "end") {
      s.zoomTo = fitView();
      if (s.phase === "end") s.cam = { x: s.zoomTo.x, y: s.zoomTo.y, z: s.zoomTo.z };
    } else {
      var f = follow();
      s.cam = { x: f.x, y: f.y, z: 1 };
    }
    render();
  }

  function burst(x, y, n, colors, speed, up, gravity, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = speed * (.4 + Math.random());
      s.particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + up, life: 0, max: life * (.6 + Math.random() * .8), color: colors[i % colors.length], big: Math.random() < .4, gravity: gravity });
    }
  }
  function sparkle(i, n) { burst(CP_X[i] + FLAG_OFFSET, LEDGES[i] + 14, n, [C.flag, C.white, C.white], 18, 10, -6, .9); }

  function arrive(i, quiet) {
    s.phase = "rest"; s.target = i; s.goatX = CP_X[i] + STOP_OFFSET;
    s.restLeft = i === LAST ? SUMMIT_REST : REST; s.shown = i;
    if (!quiet) {
      sparkle(i, 18);
      if (i === LAST) burst(CP_X[i] + FLAG_OFFSET, LEDGES[i] + 16, 46, CONFETTI, 30, 40, 48, 2);
    }
    paintUi(s.shown, uiPhaseNow());
  }
  function leave() {
    if (s.target >= LAST) {
      s.phase = "zoom"; s.zoomT = 0;
      s.zoomFrom = { x: s.cam.x, y: s.cam.y, z: s.cam.z }; s.zoomTo = fitView();
      s.shown = -1; paintUi(-1, "play");
      return;
    }
    s.target += 1; s.phase = "walk";
  }
  function begin() {
    if (s.started) return;
    s.started = true;
    arrive(0);
    if (!s.raf && s.inView) loop();
  }
  function tap() {
    if (!s.started) return begin();
    if (s.phase === "rest") s.restLeft = 0;
    else if (s.phase === "walk") {
      s.boost = Math.min(4, s.boost + 1.3);
      if (s.hopT < 0) { s.hopT = 0; s.hopLift = 7; }
    }
  }
  function jump(i) {
    s.started = true;
    s.particles = []; s.hopT = -1; s.boost = 0;
    arrive(i, true);
    sparkle(i, 10);
    if (!s.raf && s.inView) loop();
  }

  function update(dt) {
    s.t += dt;
    s.boost = Math.max(0, s.boost - dt * 1.6);
    s.autoHopIn -= dt;
    if (s.hopT >= 0) {
      s.hopT += dt;
      if (s.hopT >= HOP) {
        s.hopT = -1;
        burst(s.goatX, goatY(s.goatX), 6, [C.dust], 10, 5, 10, .45);
      }
    }
    if (s.phase === "walk") {
      // steep parts slow the goat down, and it hops up them
      var slope = (terrain(s.goatX + 3) - terrain(s.goatX - 3)) / 6;
      if (slope > .55 && s.hopT < 0 && s.autoHopIn <= 0) { s.hopT = 0; s.hopLift = 4; s.autoHopIn = .75; }
      var speed = (WALK * (1 + s.boost)) / (1 + .6 * Math.max(0, slope));
      var stop = CP_X[s.target] + STOP_OFFSET;
      s.goatX = Math.min(stop, s.goatX + speed * dt);
      s.stepT += speed * dt;
      if (s.goatX >= stop) arrive(s.target);
    } else if (s.phase === "rest") {
      s.restLeft -= dt;
      if (s.restLeft <= 0) leave();
    } else if (s.phase === "zoom") {
      s.zoomT = Math.min(1, s.zoomT + dt / ZOOM);
      if (s.zoomT >= 1) { s.phase = "end"; paintUi(-1, "end"); }
    }

    if (s.phase === "zoom" || s.phase === "end") {
      var t = s.zoomT, e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      var a = s.zoomFrom, b = s.zoomTo;
      s.cam = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e) };
    } else {
      var f = follow(), k = 1 - Math.exp(-dt * 4);
      s.cam.x += (f.x - s.cam.x) * k;
      s.cam.y += (f.y - s.cam.y) * k;
      if (s.cam.z !== 1) {
        s.cam.z += (1 - s.cam.z) * (1 - Math.exp(-dt * 3));
        if (Math.abs(1 - s.cam.z) < .004) s.cam.z = 1;
      }
    }

    s.particles.forEach(function (p) {
      p.life += dt; p.vy -= p.gravity * dt; p.vx *= 1 - dt * 1.5;
      p.x += p.vx * dt; p.y += p.vy * dt;
    });
    s.particles = s.particles.filter(function (p) { return p.life < p.max; });
  }

  /* ---------------- drawing, one pixel at a time ---------------- */

  function render() {
    var buf = s.buf;
    if (!buf) return;
    var W = s.W, H = s.H, z = s.cam.z, cx = s.cam.x, cy = s.cam.y, hw = W / 2, hh = H / 2;
    if (z === 1) { cx = Math.round(cx); cy = Math.round(cy); }
    function sx(wx) { return (wx - cx) * z + hw; }
    function sy(wy) { return hh - (wy - cy) * z; }
    function put(x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; }

    buf.fill(0);

    // a far range and a near treeline, both thin enough to let the page show through
    function layer(p, base, height, body, snowAt, trees) {
      var zl = Math.pow(z, p), lcx = cx * p, lcy = cy * p;
      for (var x = 0; x < W; x++) {
        var lx = lcx + (x + .5 - hw) / zl, top = height(lx) + base, colTop = top;
        if (trees) {
          var cell = Math.round(lx / 11);
          if (hash(cell, 51) < .65) {
            var tcx = cell * 11 + (hash(cell, 52) - .5) * 4, th = 9 + hash(cell, 53) * 5, half = th * .33, dist = Math.abs(lx - tcx);
            if (dist < half) colTop = Math.max(colTop, height(tcx) + base + th * (1 - dist / half));
          }
        }
        var y0 = Math.max(0, Math.round(hh - (colTop - lcy) * zl)), yHill = Math.round(hh - (top - lcy) * zl);
        var snowDepth = snowAt ? (top - base - snowAt) * .8 * zl : 0;
        for (var y = y0; y < H; y++) {
          buf[y * W + x] = y < yHill ? C.midTree : snowDepth > 0 && y - yHill < snowDepth ? C.farSnow : body;
        }
      }
    }
    layer(.22, -4, farHeight, C.far, 50, false);

    function cloud(shape, x0, y0, scale) {
      var dw = Math.max(1, Math.round(shape.w * scale)), dh = Math.max(1, Math.round(shape.h * scale));
      var left = Math.round(x0 - dw / 2), top = Math.round(y0 - dh / 2);
      for (var y = 0; y < dh; y++) {
        var py = top + y;
        if (py < 0 || py >= H) continue;
        var my = Math.min(shape.h - 1, Math.floor(y / scale));
        for (var x = 0; x < dw; x++) {
          var px = left + x;
          if (px < 0 || px >= W) continue;
          var m = shape.mask[my * shape.w + Math.min(shape.w - 1, Math.floor(x / scale))];
          if (m) buf[py * W + px] = m === 1 ? C.cloud : C.cloudShade;
        }
      }
    }
    var cp = .32, czl = Math.pow(z, cp);
    skyClouds.forEach(function (c) {
      var lx = ((((c.x + s.t * c.speed - cx * cp) % 900) + 900) % 900) - 450;
      cloud(c.shape, lx * czl + hw, hh - (c.y - cy * cp) * czl, czl);
    });
    layer(.5, -22, midHeight, C.mid, 0, true);

    // the mountain itself
    var b1 = Math.max(2, 1 / z), b2 = b1 + Math.max(2, 1 / z), detail = z > .6;
    for (var x = 0; x < W; x++) {
      var wx = cx + (x + .5 - hw) / z, h = terrain(wx), top = Math.round(hh - (h - cy) * z);
      if (top >= H) continue;
      var ix = Math.floor(wx);
      var grassLine = GRASS_LINE + 6 * Math.sin(wx * .09);
      var snowLine = wx > SUMMIT_X + LEDGE_HALF
        ? PEAK_SNOW + 40 * Math.sin(wx * .02) + 16 * Math.sin(wx * .13) - hash(Math.floor(wx / 7), 77) * 50
        : FOOT_SNOW + 4 * Math.sin(wx * .15);
      var grassy = h < grassLine, soilTop = grassy ? h : grassLine - 12;
      var slope = terrain(wx + 1) - terrain(wx - 1);
      for (var y = Math.max(0, top); y < H; y++) {
        var d = (y - top) / z, wy = cy + (hh - y - .5) / z, iy = Math.floor(wy);
        var jitter = detail ? hash(ix, iy >> 1) * 6 - 3 : 0, c;
        if (wy > snowLine + jitter) c = d < b1 ? C.snow : slope < -.3 ? C.snowShade : C.snow;
        else if (grassy && d < b1) c = C.grass;
        else if (grassy && d < b2) c = C.grassDark;
        else if (!grassy && d < b1 * .75) c = C.rockLight;
        else if (wy < soilTop + jitter) {
          if (detail && hash(ix >> 1, iy >> 1) < .006) c = C.rockLight;
          else if (detail && d > 34) c = hash(ix, iy) < .12 ? C.dirt : C.dirtDark;
          else c = detail && hash(ix, iy) < .1 ? C.dirtDark : C.dirt;
        } else if (detail) {
          var strata = ((((iy + ((ix * 7) >> 5)) % 10) + 10) % 10) === 0 && hash(ix >> 1, iy) < .75;
          c = strata || hash(ix, iy) < .06 ? C.rockDark : hash(ix + 11, iy) < .05 ? C.rockLight : C.rock;
        } else c = C.rock;
        buf[y * W + x] = c;
      }
      if (z === 1 && grassy && h < grassLine - 3 && top > 1 && top < H) {
        if (hash(ix, 5) < .07) { put(x, top - 1, C.grassDark); put(x, top - 2, FLOWERS[Math.floor(hash(ix, 9) * FLOWERS.length)]); }
        else if (hash(ix, 3) < .3) put(x, top - 1, C.grass);
      }
    }

    peakClouds.forEach(function (c) { cloud(c.shape, sx(c.x + Math.sin(s.t * .15 + c.phase) * 12), sy(c.y), z); });

    function blit(sp, wx, wy) {
      var sc = Math.min(1, z), dw = Math.max(1, Math.round(sp.w * sc)), dh = Math.max(1, Math.round(sp.h * sc));
      var left = Math.round(sx(wx) - dw / 2), top = Math.round(sy(wy)) - dh;
      for (var y = 0; y < dh; y++) {
        var py = top + y;
        if (py < 0 || py >= H) continue;
        var my = Math.min(sp.h - 1, Math.floor(y / sc));
        for (var x = 0; x < dw; x++) {
          var px = left + x;
          if (px < 0 || px >= W) continue;
          var c = sp.px[my * sp.w + Math.min(sp.w - 1, Math.floor(x / sc))];
          if (c) buf[py * W + px] = c;
        }
      }
    }
    blit(tent, CP_X[0] - 30, terrain(CP_X[0] - 30));

    var sc = Math.min(1, z);
    for (var i = 0; i <= LAST; i++) {
      var fx = Math.round(sx(CP_X[i] + FLAG_OFFSET)), base = Math.round(sy(LEDGES[i]));
      var poleH = Math.max(2, Math.round(16 * sc));
      for (var k = 1; k <= poleH; k++) put(fx, base - k, C.pole);
      var reached = s.started && i <= s.target - (s.phase === "walk" ? 1 : 0);
      var cw = Math.max(1, Math.round(7 * sc)), ch = Math.max(1, Math.round(5 * sc)), wave = Math.floor(s.t * 5 + i) % 2;
      for (var cx2 = 1; cx2 <= cw; cx2++) {
        var off = sc === 1 && cx2 > 3 ? wave : 0, rows = sc === 1 ? ch - Math.floor(cx2 / 3) : ch;
        for (var cy2 = 0; cy2 < rows; cy2++) {
          var shade = cy2 === rows - 1 || cx2 === cw;
          put(fx + cx2, base - poleH + cy2 + off + (sc === 1 ? Math.floor(cx2 / 6) : 0), reached ? (shade ? C.flagShade : C.flag) : shade ? C.flagOffShade : C.flagOff);
        }
      }
    }

    if (s.shown >= 0 && icons[EVENTS[s.shown].icon]) {
      blit(icons[EVENTS[s.shown].icon], CP_X[s.shown] + FLAG_OFFSET + 4, LEDGES[s.shown] + 20 + Math.round(Math.sin(s.t * 3) * 1.5));
    }

    var frame = goat.stand, lift = 0;
    if (s.hopT >= 0) { frame = goat.hop; lift = Math.sin((Math.PI * s.hopT) / HOP) * s.hopLift; }
    else if (s.phase === "walk") frame = Math.floor(s.stepT / 5) % 2 === 0 ? goat.stand : goat.stride;
    else if (s.t % 3.2 > 3.05) frame = goat.blink;
    blit(frame, s.goatX, goatY(s.goatX) + lift);

    s.particles.forEach(function (p) {
      var px = Math.round(sx(p.x)), py = Math.round(sy(p.y));
      put(px, py, p.color);
      if (p.big && p.life < p.max * .5) { put(px - 1, py, p.color); put(px + 1, py, p.color); put(px, py - 1, p.color); put(px, py + 1, p.color); }
    });

    ctx.putImageData(s.img, 0, 0);

    if (s.phase === "end") {
      you.style.left = (sx(s.goatX) / W) * 100 + "%";
      you.style.top = (sy(goatY(s.goatX) + 17) / H) * 100 + "%";
      peak.style.left = (sx(GIANT.c) / W) * 100 + "%";
      peak.style.top = (sy(GIANT.h + 10) / H) * 100 + "%";
    }
  }

  /* ---------------- running only while on screen ---------------- */

  function loop() {
    s.last = performance.now();
    function frame(now) {
      var dt = Math.min(.05, (now - s.last) / 1000);
      s.last = now;
      update(dt); render();
      s.raf = requestAnimationFrame(frame);
    }
    s.raf = requestAnimationFrame(frame);
  }
  function stop() { if (s.raf) cancelAnimationFrame(s.raf); s.raf = 0; }

  stage.addEventListener("pointerdown", tap);
  stage.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); }
  });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else addEventListener("resize", resize);
  resize();
  paintUi(-1, "idle");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      s.inView = e.isIntersecting;
      if (s.inView && !s.raf) loop();
      if (!s.inView) stop();
      if (e.intersectionRatio >= .35 && !s.started && !still && !s.startTimer) s.startTimer = setTimeout(begin, 500);
    }, { threshold: [0, .35, .7] }).observe(stage);
  } else {
    s.inView = true; loop();
    if (!still) begin();
  }
})();
