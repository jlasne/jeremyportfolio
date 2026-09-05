(function () {
  "use strict";
  /* Snow in a strong wind. Gusts travel across the screen as fronts, so the
     snow surges and eases in waves; eddies in the flow field roll it into
     curls on the way. Near flakes are big, fast and bright, far ones small
     and slow.
     The pointer carries a shield. The wind bends round it the way air bends
     round a post: nothing crosses the rim, and the snow speeds up along
     the sides as it slips past. Hold the button and the shield grows, and
     you push the storm back. Click and a shockwave rings out and throws
     the snow off it. */
  var c = document.getElementById("snow"), x = c.getContext("2d");
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, flakes = [], pulses = [], t = 0;
  var p = { x: -1e4, y: -1e4, vx: 0, vy: 0, down: false, on: false };
  var R = 150, R_REST = 150, R_HELD = 300;

  function flake(x0, y0, z) {
    return { x: x0, y: y0, z: z, r: .5 + z * z * 2.2, vx: 0, vy: 0, ph: Math.random() * 6.28, a: .3 + z * .55 };
  }
  function size() {
    var dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    flakes = [];
    for (var n = Math.round((W * H) / 3800); n--;) flakes.push(flake(Math.random() * W, Math.random() * H, Math.random()));
  }

  /* wind at a point: a base blow, a gust front rolling left to right, and eddies */
  function wind(px, py, z, out) {
    var front = .5 + .5 * Math.sin(px * .0035 - t * 2.1);
    var slow = Math.sin(t * .31) * .8 + Math.sin(t * .77) * .4;
    var base = 2.6 + slow * 1.3 + front * front * 4.6;
    var s = .0032;
    var e1 = Math.sin(px * s * 1.3 + t * .9) * Math.cos(py * s * .9 - t * .6);
    var e2 = Math.sin(py * s * 1.7 - t * .7 + px * s * .4);
    out[0] = (base + e1 * 1.6 + e2 * .6) * (.35 + z * .95);
    out[1] = (.4 + z * 1.1 + e2 * 1.3 - e1 * .6) * (.5 + front * .5);
  }

  var w = [0, 0];
  function frame() {
    t += .016;
    x.clearRect(0, 0, W, H);
    x.strokeStyle = x.fillStyle = "#fff"; x.lineCap = "round";
    R += ((p.down ? R_HELD : R_REST) - R) * .12;
    p.vx *= .85; p.vy *= .85;

    for (var i = 0; i < pulses.length; i++) { pulses[i].r += 13; pulses[i].life -= .022; }
    pulses = pulses.filter(function (q) { return q.life > 0; });

    for (i = flakes.length - 1; i >= 0; i--) {
      var f = flakes[i];
      if (still) { w[0] = w[1] = 0; } else wind(f.x, f.y, f.z, w);
      var tvx = w[0], tvy = w[1];

      if (p.on) {
        /* the wind as the shield sees it, bent round a cylinder of radius R:
           zero across the rim, doubled along the sides, untouched far away.
           Inside (only after a fast move) a spring eases the flake out. */
        var dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        var rx = tvx - p.vx, ry = tvy - p.vy, dd = Math.max(d, R), q = (R * R) / (dd * dd), dot = rx * ux + ry * uy;
        tvx += q * (rx - 2 * dot * ux); tvy += q * (ry - 2 * dot * uy);
        if (d < R) { var push = (R - d) * .25; tvx += ux * push; tvy += uy * push; }
      }
      for (var j = 0; j < pulses.length; j++) {
        var pu = pulses[j], px = f.x - pu.x, py = f.y - pu.y, pd = Math.hypot(px, py) || 1, gap = Math.abs(pd - pu.r);
        if (gap < 70) { var kick = (1 - gap / 70) * 9 * pu.life; f.vx += px / pd * kick; f.vy += py / pd * kick; }
      }

      var ease = .05 + f.z * .07;
      f.vx += (tvx - f.vx) * ease; f.vy += (tvy - f.vy) * ease;
      f.x += f.vx; f.y += f.vy;

      if (f.x > W + 20) { f.x = -20; f.y = Math.random() * H; }
      else if (f.x < -30) { f.x = W + 20; f.y = Math.random() * H; }
      if (f.y > H + 20) { f.y = -20; f.x = Math.random() * W; }
      else if (f.y < -30) f.y = H + 20;

      var sp = Math.hypot(f.vx, f.vy);
      x.globalAlpha = f.a * Math.max(.45, 1 - sp * .04);
      if (sp > 1.4) {
        x.lineWidth = f.r * 1.6;
        var L = Math.min(3.4, .9 + sp * .24);
        x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(f.x - f.vx * L, f.y - f.vy * L); x.stroke();
      } else {
        x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.28); x.fill();
      }
    }

    x.lineWidth = 1.5;
    for (i = 0; i < pulses.length; i++) {
      x.globalAlpha = pulses[i].life * pulses[i].life * .5;
      x.beginPath(); x.arc(pulses[i].x, pulses[i].y, pulses[i].r, 0, 6.28); x.stroke();
    }
    if (p.on && R > R_REST + 4) {
      x.globalAlpha = Math.min(.18, (R - R_REST) / (R_HELD - R_REST) * .18);
      x.lineWidth = 1;
      x.beginPath(); x.arc(p.x, p.y, R, 0, 6.28); x.stroke();
    }
    x.globalAlpha = 1;
    if (!still) requestAnimationFrame(frame);
  }

  function move(e) {
    if (p.on) { p.vx = p.vx * .6 + (e.clientX - p.x) * .4; p.vy = p.vy * .6 + (e.clientY - p.y) * .4; }
    p.x = e.clientX; p.y = e.clientY; p.on = true;
  }
  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerdown", function (e) {
    move(e); p.down = true;
    if (!still) pulses.push({ x: e.clientX, y: e.clientY, r: 10, life: 1 });
  }, { passive: true });
  addEventListener("pointerup", function () { p.down = false; });
  addEventListener("pointercancel", function () { p.down = false; });
  addEventListener("pointerleave", function () { p.on = false; p.down = false; p.x = p.y = -1e4; p.vx = p.vy = 0; });
  addEventListener("resize", size);
  size(); frame();
})();
