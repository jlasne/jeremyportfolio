/**
 * Gigawatt: the drawing.
 *
 * The world is painted into a 448 by 272 buffer at 1 art pixel per pixel, then
 * blown up by a whole number. So every pixel on screen is a hard square.
 *
 * Terrain holds still, so it is baked once. Coolant, pipe flow, lines, smoke,
 * fan blades, lights and heat are redrawn each frame.
 */

import { TILE, KIND, DC, RESTART_BELOW, LINK_RANGE } from './rules.js';
import { WIDTH, HEIGHT, tileAt, isBuildable, buildableTiles } from './world.js';
import { PALETTE, BLINK, PLANT_SPRITES, DC_SPRITES, FAN_SPRITES, SPRITE_SIZE } from './sprites.js';

export const TILE_PX = 16;
const ART_W = WIDTH * TILE_PX;
const ART_H = HEIGHT * TILE_PX;
const INSET = (TILE_PX - SPRITE_SIZE) / 2;

const centre = (b) => ({ x: b.x * TILE_PX + TILE_PX / 2, y: b.y * TILE_PX + TILE_PX / 2 });

/**
 * The whole world is one factory. Outside the fence is bare steel deck, laid
 * in plates and darker the further out it goes. Inside is poured concrete,
 * baked yard, coolant basins, heat sinks and pipe racks.
 */
const C = {
  deckFar: '#12141b', deckMid: '#191d26', deckNear: '#222633', seam: '#0d0f15', rivet: '#2e3442',
  hazard: '#e0a91c', hazardDark: '#23252e',
  slab: '#98a2ae', slabDark: '#828c99', slabLight: '#b2bcc8', joint: '#6e7885',
  yard: '#b8a077', yardDark: '#9c8562', yardLight: '#d0ba8e',
  coolDeep: '#166a77', coolMid: '#1f8b9a', coolShallow: '#2fadbc', coolFoam: '#7fe2ec',
  rim: '#5b6470',
  fin: '#8a95a3', finDark: '#69727f', finShadow: '#4c545f', finLight: '#b6c1cd', finTop: '#e4ecf4',
  pipe: '#4e5a69', pipeDark: '#2c3542', pipeFlange: '#6c7a8b', pipeFlow: '#8fd8e6',
};

/** Deterministic per-tile noise, so the island looks the same every time. */
function hash(x, y, k = 0) {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(k + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const land = (x, y) => tileAt(x, y) !== TILE.WATER;

/**
 * How far each tile is from dry land, so the sea can shelve away from the
 * shore instead of arriving in squares. Land is zero; the open ocean counts up.
 */
function distanceField(inside) {
  const d = new Int16Array(WIDTH * HEIGHT).fill(99);
  const queue = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) if (!inside(x, y)) { d[y * WIDTH + x] = 0; queue.push([x, y]); }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
      if (d[ny * WIDTH + nx] <= d[y * WIDTH + x] + 1) continue;
      d[ny * WIDTH + nx] = d[y * WIDTH + x] + 1;
      queue.push([nx, ny]);
    }
  }
  return d;
}

const SEA_DEPTH = distanceField((x, y) => !land(x, y));

/** Water inside the pad is a coolant basin. Water outside it is open deck. */
const BASINS = [];
const PIPES = [];
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    if (tileAt(x, y) === TILE.WATER && SEA_DEPTH[y * WIDTH + x] <= 2) BASINS.push({ x, y });
    if (tileAt(x, y) === TILE.FOREST) {
      const east = tileAt(x + 1, y) === TILE.FOREST || tileAt(x - 1, y) === TILE.FOREST;
      PIPES.push({ x, y, across: east || !(tileAt(x, y + 1) === TILE.FOREST || tileAt(x, y - 1) === TILE.FOREST) });
    }
  }
}

/** The same trick for rock: how deep into the range each tile sits. */
const RIDGE = distanceField((x, y) => tileAt(x, y) === TILE.MOUNTAIN);

/** Reads a tile field at a point between centres, so its bands curve. */
function sample(field, px, py) {
  const fx = px / TILE_PX - 0.5, fy = py / TILE_PX - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const at = (x, y) => field[Math.max(0, Math.min(HEIGHT - 1, y)) * WIDTH + Math.max(0, Math.min(WIDTH - 1, x))];
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
         (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = ART_W; buf.height = ART_H;
  const b = buf.getContext('2d');

  const terrain = document.createElement('canvas');
  terrain.width = ART_W; terrain.height = ART_H;
  bakeTerrain(terrain.getContext('2d'));

  let scale = 3;

  function resize() {
    const pad = 24;
    const fit = Math.min(
      (window.innerWidth - pad * 2) / ART_W,
      (window.innerHeight - pad * 2) / ART_H,
    );
    scale = Math.max(2, Math.min(5, Math.floor(fit)));
    canvas.width = ART_W * scale;
    canvas.height = ART_H * scale;
    canvas.style.width = `${ART_W * scale}px`;
    canvas.style.height = `${ART_H * scale}px`;
    ctx.imageSmoothingEnabled = false;
  }

  /** Screen pixel -> tile, or null if the pointer is off the island. */
  function tileFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (scale * TILE_PX));
    const y = Math.floor((e.clientY - r.top) / (scale * TILE_PX));
    return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT ? { x, y } : null;
  }

  /** Where a tile sits on screen, for hanging DOM labels off it. */
  function tileRect(x, y) {
    const r = canvas.getBoundingClientRect();
    return {
      left: r.left + x * TILE_PX * scale,
      top: r.top + y * TILE_PX * scale,
      size: TILE_PX * scale,
    };
  }

  function draw(g, snap, view, t) {
    b.clearRect(0, 0, ART_W, ART_H);
    b.drawImage(terrain, 0, 0);
    drawWater(b, t);
    drawBasins(b, t);
    drawPipeFlow(b, t);
    drawLines(b, g, snap, t);

    const night = nightness(g.elapsed);
    for (const bl of g.buildings) drawBuilding(b, bl, g, t, night);
    drawTokens(b, snap, t);
    if (night > 0.02) {
      b.globalAlpha = night * 0.5;
      b.fillStyle = '#1b2a5c';
      b.fillRect(0, 0, ART_W, ART_H);
      b.globalAlpha = 1;
      for (const bl of g.buildings) drawLights(b, bl, t, night);
    }

    drawPointer(b, g, view, t);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buf, 0, 0, ART_W, ART_H, 0, 0, canvas.width, canvas.height);
  }

  return { resize, draw, tileFromEvent, tileRect, get scale() { return scale; } };
}

/** A day runs 150 game seconds, so it keeps pace with the speed control. */
export const nightness = (t) => {
  const phase = (t / 150) % 1;
  return Math.max(0, Math.sin(phase * Math.PI * 2 - Math.PI / 2)) ** 2;
};

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

function bakeTerrain(g) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const px = x * TILE_PX, py = y * TILE_PX;
      const tile = tileAt(x, y);
      if (tile === TILE.WATER) {
        if (SEA_DEPTH[y * WIDTH + x] <= 2) paintBasin(g, px, py, x, y);
        else paintDeck(g, px, py, x, y);
        continue;
      }

      if (tile === TILE.MOUNTAIN) { drawHeatSink(g, px, py); continue; }
      if (tile === TILE.FOREST) { paintSlab(g, px, py, x, y, C.slab); drawPipeBed(g, px, py, x, y); continue; }
      paintSlab(g, px, py, x, y, tile === TILE.DESERT ? C.yard : C.slab);

      // Every buildable tile is a marked bay: joints ruled, corners pegged.
      if (isBuildable(x, y)) {
        g.globalAlpha = 0.5;
        g.fillStyle = C.joint;
        if (isBuildable(x, y - 1)) g.fillRect(px, py, TILE_PX, 1);
        if (isBuildable(x - 1, y)) g.fillRect(px, py, 1, TILE_PX);
        g.globalAlpha = 0.55;
        g.fillStyle = '#f2f6fa';
        for (const [cx, cy] of [[0, 0], [TILE_PX - 1, 0], [0, TILE_PX - 1], [TILE_PX - 1, TILE_PX - 1]]) {
          g.fillRect(px + cx, py + cy, 1, 1);
        }
        g.globalAlpha = 1;
      }

      // Hazard stripes wherever the pad meets the deck.
      paintHazard(g, px, py, x, y);
    }
  }
}

/** Poured concrete, or sun-baked yard, with a scatter of wear. */
function paintSlab(g, px, py, x, y, base) {
  const dark = base === C.yard ? C.yardDark : C.slabDark;
  const light = base === C.yard ? C.yardLight : C.slabLight;
  // Bays were poured on different days.
  g.fillStyle = hash(x, y, 77) > 0.62 ? dark : hash(x, y, 78) > 0.88 ? light : base;
  g.fillRect(px, py, TILE_PX, TILE_PX);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = hash(x, y, i + 200) < 0.5 ? dark : light;
    g.fillRect(px + Math.floor(hash(x, y, i + 300) * TILE_PX),
               py + Math.floor(hash(x, y, i + 400) * TILE_PX), 2, 1);
  }
}

/** Diagonal yellow and black, painted on the pad side of the edge. */
function paintHazard(g, px, py, x, y) {
  const edges = [
    [!land(x, y - 1), 0, 0, TILE_PX, 2],
    [!land(x, y + 1), 0, TILE_PX - 2, TILE_PX, 2],
    [!land(x - 1, y), 0, 0, 2, TILE_PX],
    [!land(x + 1, y), TILE_PX - 2, 0, 2, TILE_PX],
  ];
  for (const [on, ox, oy, w, h] of edges) {
    if (!on) continue;
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        g.fillStyle = ((px + ox + i + py + oy + j) % 6) < 3 ? C.hazard : C.hazardDark;
        g.fillRect(px + ox + i, py + oy + j, 1, 1);
      }
    }
  }
}

/** A basin of coolant, rimmed in steel. */
function paintBasin(g, px, py, x, y) {
  for (let j = 0; j < TILE_PX; j++) {
    for (let i = 0; i < TILE_PX; i++) {
      const d = sample(SEA_DEPTH, px + i, py + j) + (hash(px + i, py + j, 7) - 0.5) * 0.25;
      g.fillStyle = d < 0.7 ? C.coolShallow : d < 1.5 ? C.coolMid : C.coolDeep;
      g.fillRect(px + i, py + j, 1, 1);
    }
  }
  g.fillStyle = C.rim;
  if (land(x, y - 1)) g.fillRect(px, py, TILE_PX, 1);
  if (land(x, y + 1)) g.fillRect(px, py + TILE_PX - 1, TILE_PX, 1);
  if (land(x - 1, y)) g.fillRect(px, py, 1, TILE_PX);
  if (land(x + 1, y)) g.fillRect(px + TILE_PX - 1, py, 1, TILE_PX);
}

/** Steel plate, laid in 4 tile sheets, darker the further from the pad. */
function paintDeck(g, px, py, tx, ty) {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const d = sample(SEA_DEPTH, px + x, py + y) + (hash(px + x, py + y, 7) - 0.5) * 0.3;
      g.fillStyle = d < 1.5 ? C.deckNear : d < 3.2 ? C.deckMid : C.deckFar;
      g.fillRect(px + x, py + y, 1, 1);
    }
  }
  const gx = (tx % 4 === 0), gy = (ty % 4 === 0);
  g.fillStyle = C.seam;
  if (gx) g.fillRect(px, py, 1, TILE_PX);
  if (gy) g.fillRect(px, py, TILE_PX, 1);
  g.fillStyle = C.rivet;
  if (gx && gy) { g.fillRect(px + 2, py + 2, 1, 1); g.fillRect(px + TILE_PX - 3, py + 2, 1, 1); }
  if (hash(tx, ty, 31) > 0.86) g.fillRect(px + 6, py + 9, 2, 1);
}

/** Stacked aluminium fins. Light catches the top of every rib. */
function drawHeatSink(g, px, py) {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const h = sample(RIDGE, px + x, py + y) * 1.6 + 0.35 + (hash(px + x, py + y, 21) - 0.5) * 0.25;
      const rib = y % 3;
      g.fillStyle = h < 0.7 ? C.finShadow
        : rib === 0 ? C.finLight
        : rib === 1 ? (h > 2.6 ? C.finTop : C.fin)
        : C.finDark;
      g.fillRect(px + x, py + y, 1, 1);
    }
  }
}

/** The bed a pipe run sits in. The coolant inside is drawn every frame. */
function drawPipeBed(g, px, py, x, y) {
  // A run follows its neighbours where it has them, so racks join up.
  const east = tileAt(x + 1, y) === TILE.FOREST || tileAt(x - 1, y) === TILE.FOREST;
  const across = east || !(tileAt(x, y + 1) === TILE.FOREST || tileAt(x, y - 1) === TILE.FOREST);
  g.fillStyle = C.pipeDark;
  if (across) g.fillRect(px, py + 3, TILE_PX, 10);
  else g.fillRect(px + 3, py, 10, TILE_PX);
  g.fillStyle = C.pipe;
  if (across) g.fillRect(px, py + 5, TILE_PX, 6);
  else g.fillRect(px + 5, py, 6, TILE_PX);
  g.fillStyle = C.pipeFlange;
  for (let i = 1; i < TILE_PX; i += 5) {
    if (across) g.fillRect(px + i, py + 3, 1, 10);
    else g.fillRect(px + 3, py + i, 10, 1);
  }
}

function speckle(g, px, py, base, dark, light, x, y) {
  g.fillStyle = base;
  g.fillRect(px, py, TILE_PX, TILE_PX);
  for (let i = 0; i < 10; i++) {
    const h = hash(x, y, i + 200);
    g.fillStyle = h < 0.5 ? dark : light;
    g.fillRect(px + Math.floor(hash(x, y, i + 300) * TILE_PX),
               py + Math.floor(hash(x, y, i + 400) * TILE_PX), 2, 1);
  }
}

/**
 * A ridge is one lump of rock, not a row of boulders. Height comes from how
 * far into the range a pixel sits, so the mass rises toward its middle and the
 * snow finds the top by itself. Light falls from the north-west.
 */
function drawRock(g, px, py) {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const h = sample(RIDGE, px + x, py + y) * 1.6 + 0.35
        + (hash(px + x, py + y, 21) - 0.5) * 0.4
        - (x + y) * 0.012;                       // light falls from the north-west
      g.fillStyle = h < 0.55 ? C.stoneShadow
        : h < 1.15 ? C.stoneDark
        : h < 1.95 ? C.stone
        : h < 2.75 ? C.stoneLight
        : C.snow;
      g.fillRect(px + x, py + y, 1, 1);
    }
  }
}

/** Sea colour comes from how far the open water is from anything solid. */
function paintSea(g, px, py, tx, ty) {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const d = sample(SEA_DEPTH, px + x, py + y) + (hash(px + x, py + y, 7) - 0.5) * 0.28;
      g.fillStyle = d < 0.66 ? C.foam : d < 1.45 ? C.shallow : d < 2.7 ? C.mid : C.deep;
      g.fillRect(px + x, py + y, 1, 1);
    }
  }
}

function drawWater(g, t) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (tileAt(x, y) !== TILE.WATER) continue;
      if (sample(SEA_DEPTH, x * TILE_PX + 8, y * TILE_PX + 8) > 2.4) continue;
      const px = x * TILE_PX, py = y * TILE_PX;
      for (let i = 0; i < 2; i++) {
        const seed = hash(x, y, i + 11);
        const drift = Math.sin(t * 0.9 + seed * 7) * 3;
        g.fillStyle = i ? C.rivet : C.hazardDark;
        g.globalAlpha = 0.25 + 0.18 * Math.sin(t * 1.7 + seed * 9);
        g.fillRect(px + Math.floor(2 + seed * 8 + drift), py + Math.floor(3 + seed * 10), 3, 1);
      }
    }
  }
  g.globalAlpha = 1;
}

/** Coolant moving through the basins that sit inside the pad. */
function drawBasins(g, t) {
  for (const b of BASINS) {
    const px = b.x * TILE_PX, py = b.y * TILE_PX;
    for (let i = 0; i < 3; i++) {
      const seed = hash(b.x, b.y, i + 60);
      g.globalAlpha = 0.4 + 0.3 * Math.sin(t * 1.6 + seed * 9);
      g.fillStyle = i === 2 ? C.coolFoam : C.coolShallow;
      g.fillRect(px + Math.floor(2 + seed * 9 + Math.sin(t + seed * 7) * 2),
                 py + Math.floor(2 + seed * 11), 2 + Math.floor(seed * 3), 1);
    }
  }
  g.globalAlpha = 1;
}

/** A pulse of coolant running along every pipe rack. */
function drawPipeFlow(g, t) {
  for (const p of PIPES) {
    const px = p.x * TILE_PX, py = p.y * TILE_PX;
    const at = ((t * 0.5 + hash(p.x, p.y, 12)) % 1) * TILE_PX;
    g.globalAlpha = 0.75;
    g.fillStyle = C.pipeFlow;
    if (p.across) g.fillRect(px + Math.round(at), py + 7, 3, 2);
    else g.fillRect(px + 7, py + Math.round(at), 2, 3);
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Power lines
// ---------------------------------------------------------------------------

/**
 * Every line is drawn, and the ones carrying power carry a bead of light along
 * them. A dim line is one the plant has nothing left to send down, which is
 * the thing to look at when a datacenter runs slow.
 */
function drawLines(g, game, snap, t) {
  const flow = new Map(snap.lines.map((l) => [`${l.from.id}>${l.to.id}`, l]));
  for (const link of game.links) {
    const from = game.buildings.find((b) => b.id === link.from);
    const to = game.buildings.find((b) => b.id === link.to);
    if (!from || !to) continue;
    const a = centre(from), z = centre(to);
    const carrying = flow.get(`${from.id}>${to.id}`);
    const power = carrying && carrying.got > 0.01;

    g.globalAlpha = power ? 0.9 : 0.55;
    g.fillStyle = power ? '#c08f2a' : '#5d6785';
    plot(g, a, z, 1);
    g.globalAlpha = 1;
    if (!power) continue;

    // One bead per 8 tiles of line, so a long line reads as a long line.
    const span = Math.hypot(z.x - a.x, z.y - a.y);
    const beads = Math.max(2, Math.round(span / 24));
    for (let i = 0; i < beads; i++) {
      const at = ((t * 0.42 + i / beads + from.id * 0.07) % 1);
      g.fillStyle = '#ffe08c';
      g.fillRect(Math.round(a.x + (z.x - a.x) * at), Math.round(a.y + (z.y - a.y) * at), 2, 2);
    }
  }
}

/**
 * Tokens leaving the racks. One mote per 20 tokens a second, capped at 5, so a
 * busy datacenter visibly steams and an idle one sits still.
 */
function drawTokens(g, snap, t) {
  for (const l of snap.live) {
    if (l.tokens < 0.2) continue;
    const motes = Math.min(5, 1 + Math.floor(l.tokens / 18));
    const cx = l.b.x * TILE_PX + 7;
    const top = l.b.y * TILE_PX + 3;
    for (let i = 0; i < motes; i++) {
      const age = (t * 0.65 + i / motes + l.b.id * 0.31) % 1;
      const x = Math.round(cx + Math.sin(age * 5 + l.b.id) * 3);
      const y = Math.round(top - age * 11);
      g.globalAlpha = 0.9 * (1 - age) ** 0.6;
      g.fillStyle = '#0d3b38';
      g.fillRect(x, y, 3, 3);
      g.fillStyle = '#8bfbec';
      g.fillRect(x, y, 2, 2);
    }
  }
  g.globalAlpha = 1;
}

/** Bresenham, so a line is made of whole pixels like everything else. */
function plot(g, a, z, w) {
  let x = Math.round(a.x), y = Math.round(a.y);
  const x1 = Math.round(z.x), y1 = Math.round(z.y);
  const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 512; guard++) {
    g.fillRect(x, y, w, w);
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

/**
 * Plants and datacenters share one set of greys, and then plants get warmed up
 * on the way to the screen. Two industries, two temperatures, no second
 * palette to keep in step.
 */
const WARM = { 1: '#6f5c4e', 2: '#a48b71', 3: '#cdc4b4', 4: '#f2eee6' };
const CHILL = { 1: '#3f5e6d', 2: '#6f9dae', 3: '#b6d6e2', 4: '#e6f5fa' };
const SKIN = { [KIND.PLANT]: WARM, [KIND.FAN]: CHILL };
const SET = { [KIND.PLANT]: PLANT_SPRITES, [KIND.DC]: DC_SPRITES, [KIND.FAN]: FAN_SPRITES };

/**
 * Painting a building a pixel at a time costs 144 fills, and a full island
 * costs eleven thousand of them every frame. So each of the twenty sprites is
 * painted once into its own little canvas and stamped from then on. Lights are
 * left out and drawn live, because they blink.
 */
const STAMPS = new Map();

function stamp(kind, level, dark) {
  const key = `${kind}${level}${dark ? 'd' : ''}`;
  let cached = STAMPS.get(key);
  if (cached) return cached;

  cached = document.createElement('canvas');
  cached.width = cached.height = SPRITE_SIZE;
  const c = cached.getContext('2d');
  const sprite = SET[kind][level - 1];
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = sprite[y][x];
      if (ch === '.') continue;
      if (BLINK.has(ch) && !dark) continue;
      const paint = (SKIN[kind] && SKIN[kind][ch]) || PALETTE[ch];
      c.fillStyle = dark && ch !== 's' ? shade(paint) : paint;
      c.fillRect(x, y, 1, 1);
    }
  }
  STAMPS.set(key, cached);
  return cached;
}

function drawBuilding(g, bl, game, t, night) {
  const px = bl.x * TILE_PX + INSET;
  const py = bl.y * TILE_PX + INSET;

  if (bl.kind === KIND.PLANT) drawSmoke(g, bl, t);

  const pop = bl.placedAt != null ? Math.max(0, 1 - (t - bl.placedAt) * 5) : 0;
  if (pop > 0) {
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    const r = Math.round(pop * 4);
    g.fillRect(px - r, py - r, SPRITE_SIZE + r * 2, SPRITE_SIZE + r * 2);
  }

  g.drawImage(stamp(bl.kind, bl.level, bl.dark), px, py);
  if (!bl.dark) drawLights(g, bl, t, night);
  if (bl.kind === KIND.DC) drawHeat(g, bl, t);
  if (bl.kind === KIND.FAN) drawBlades(g, bl, t);
}

/** The blades turn faster the bigger the fan, so a chiller reads as a chiller. */
function drawBlades(g, bl, t) {
  const cx = bl.x * TILE_PX + INSET + 5.5;
  const cy = bl.y * TILE_PX + INSET + (bl.level === 1 ? 5.5 : bl.level === 2 ? 4.5 : 5.5);
  const reach = bl.level === 1 ? 1.6 : 2.4;
  const spin = t * (2.4 + bl.level * 1.6) + bl.id;
  g.fillStyle = '#dff2fa';
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    g.fillRect(Math.round(cx + Math.cos(a) * reach), Math.round(cy + Math.sin(a) * reach), 2, 2);
  }
  g.fillStyle = '#7fa6b8';
  g.fillRect(Math.round(cx), Math.round(cy), 1, 1);
}

/** Lights are drawn on top so they can blink and glow after dark. */
function drawLights(g, bl, t, night = 0) {
  if (bl.dark) return;
  const px = bl.x * TILE_PX + INSET;
  const py = bl.y * TILE_PX + INSET;
  for (const [x, y, ch] of litPixels(bl.kind, bl.level)) {
    const seed = hash(bl.x * 13 + x, bl.y * 17 + y, bl.id);
    const on = ch === 'y' || Math.sin(t * (0.6 + seed * 2.4) + seed * 30) > -0.35;
    g.fillStyle = on ? PALETTE[ch] : PALETTE[1];
    g.fillRect(px + x, py + y, 1, 1);
    if (on && night > 0.15) {
      g.globalAlpha = night * 0.35;
      g.fillRect(px + x - 1, py + y - 1, 3, 3);
      g.globalAlpha = 1;
    }
  }
}

const LIT = new Map();
function litPixels(kind, level) {
  const key = `${kind}${level}`;
  let found = LIT.get(key);
  if (found) return found;
  found = [];
  const sprite = SET[kind][level - 1];
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) if (BLINK.has(sprite[y][x])) found.push([x, y, sprite[y][x]]);
  }
  LIT.set(key, found);
  return found;
}

function drawSmoke(g, bl, t) {
  const cx = bl.x * TILE_PX + (bl.level >= 3 ? 4 : 9);
  const top = bl.y * TILE_PX + (bl.level >= 2 ? 2 : 4);
  const puffs = Math.min(4, bl.level + 1);
  for (let i = 0; i < puffs; i++) {
    const age = ((t * 0.4 + i / puffs + bl.id * 0.13) % 1);
    const rise = age * 13;
    const size = 1 + Math.round(age * 3);
    g.globalAlpha = 0.75 * (1 - age) ** 0.7;
    g.fillStyle = '#dfe4ee';
    g.fillRect(Math.round(cx + Math.sin(age * 4 + bl.id) * 2), Math.round(top - rise), size, size);
  }
  g.globalAlpha = 1;
}

/** Warm at first, then an angry shimmer, then nothing at all. */
function drawHeat(g, bl, t) {
  const px = bl.x * TILE_PX, py = bl.y * TILE_PX;
  if (bl.dark) {
    const ready = bl.heat <= RESTART_BELOW;
    g.globalAlpha = ready ? 0.35 + 0.25 * Math.sin(t * 4) : 0.3;
    g.fillStyle = ready ? '#7ee06a' : '#3a3550';
    g.fillRect(px + 1, py + 1, TILE_PX - 2, 1);
    g.fillRect(px + 1, py + TILE_PX - 2, TILE_PX - 2, 1);
    g.fillRect(px + 1, py + 1, 1, TILE_PX - 2);
    g.fillRect(px + TILE_PX - 2, py + 1, 1, TILE_PX - 2);
    g.globalAlpha = 1;
    return;
  }
  const warm = Math.max(0, (bl.heat - 30) / 70);
  if (warm <= 0) return;
  g.globalAlpha = warm * 0.42;
  g.fillStyle = bl.heat > 72 ? '#ff4b2e' : '#ff9a3d';
  g.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
  g.globalAlpha = 1;
  if (bl.heat > 72) {
    g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 9 + bl.id);
    g.fillStyle = '#ffd9c0';
    for (let i = 0; i < 2; i++) {
      const wob = Math.round(Math.sin(t * 5 + i * 2 + bl.id) * 2);
      g.fillRect(px + 3 + wob, py - 1 - i * 2, 8, 1);
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// What the pointer is doing
// ---------------------------------------------------------------------------

function drawPointer(g, game, view, t) {
  const { hover, armed, selected } = view;

  // Holding a tool lights every tile it can stand on.
  if (armed) {
    const pulse = 0.22 + 0.06 * Math.sin(t * 3);
    for (const p of buildableTiles()) {
      if (game.buildings.some((b) => b.x === p.x && b.y === p.y)) continue;
      const px = p.x * TILE_PX, py = p.y * TILE_PX;
      g.globalAlpha = pulse;
      g.fillStyle = '#ffffff';
      g.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
      g.globalAlpha = pulse * 1.7;
      g.fillStyle = '#fff6d8';
      g.fillRect(px + 1, py + 1, 3, 1);
      g.fillRect(px + 1, py + 1, 1, 3);
      g.fillRect(px + TILE_PX - 4, py + TILE_PX - 2, 3, 1);
      g.fillRect(px + TILE_PX - 2, py + TILE_PX - 4, 1, 3);
    }
    g.globalAlpha = 1;
  }

  const anchor = view.dragFrom || selected;
  if (selected) outline(g, selected.x, selected.y, '#ffffff', 0.9);
  if (anchor) {
    for (const p of view.reachable || []) outline(g, p.x, p.y, '#ffd97a', 0.55);
    if (view.dragFrom && hover) {
      g.globalAlpha = 0.7;
      g.fillStyle = view.wireTo ? '#ffd97a' : '#5b6580';
      plot(g, centre(anchor), {
        x: hover.x * TILE_PX + TILE_PX / 2, y: hover.y * TILE_PX + TILE_PX / 2,
      }, 1);
      g.globalAlpha = 1;
    }
  }

  if (hover && armed) {
    const ok = view.affordable && isBuildable(hover.x, hover.y) &&
      !game.buildings.some((b) => b.x === hover.x && b.y === hover.y);
    const px = hover.x * TILE_PX, py = hover.y * TILE_PX;
    g.globalAlpha = 0.32 + 0.08 * Math.sin(t * 5);
    g.fillStyle = ok ? '#ffffff' : '#ff4b2e';
    g.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
    g.globalAlpha = 1;
    outline(g, hover.x, hover.y, ok ? '#ffffff' : '#ff4b2e', 0.95);
    if (ok) drawGhost(g, hover, armed);
  } else if (hover) {
    outline(g, hover.x, hover.y, '#ffffff', 0.4);
  }
}

function drawGhost(g, tile, kind) {
  const sprite = (kind === KIND.PLANT ? PLANT_SPRITES : DC_SPRITES)[0];
  const px = tile.x * TILE_PX + INSET, py = tile.y * TILE_PX + INSET;
  g.globalAlpha = 0.55;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = sprite[y][x];
      if (ch === '.' || ch === 's') continue;
      g.fillStyle = PALETTE[ch];
      g.fillRect(px + x, py + y, 1, 1);
    }
  }
  g.globalAlpha = 1;
}

function outline(g, x, y, colour, alpha) {
  const px = x * TILE_PX, py = y * TILE_PX;
  g.globalAlpha = alpha;
  g.fillStyle = colour;
  g.fillRect(px, py, TILE_PX, 1);
  g.fillRect(px, py + TILE_PX - 1, TILE_PX, 1);
  g.fillRect(px, py, 1, TILE_PX);
  g.fillRect(px + TILE_PX - 1, py, 1, TILE_PX);
  g.globalAlpha = 1;
}

const shade = (hex) => {
  if (hex.length > 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = 0.34;
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};
