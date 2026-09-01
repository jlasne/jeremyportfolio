/**
 * Gigawatt — the drawing.
 *
 * The world is painted into a small buffer at one art-pixel per pixel and then
 * blown up by a whole number, so every pixel on screen is a hard square. The
 * terrain never changes, so it is baked once; only the things that live —
 * water, trees, smoke, lights, heat — are redrawn each frame.
 */

import { TILE, KIND, DC, RESTART_BELOW } from './rules.js';
import { ISLAND, WIDTH, HEIGHT, tileAt, coolScore, isBuildable } from './world.js';
import { PALETTE, BLINK, PLANT_SPRITES, DC_SPRITES, SPRITE_SIZE } from './sprites.js';

export const TILE_PX = 16;
const ART_W = WIDTH * TILE_PX;
const ART_H = HEIGHT * TILE_PX;
const INSET = (TILE_PX - SPRITE_SIZE) / 2;

const C = {
  deep: '#17558f', mid: '#1e6aac', shallow: '#2f86c9', foam: '#7cc0ec',
  sand: '#edd9a3',
  grass: '#63ab45', grassDark: '#4c8c33', grassLight: '#84c95e',
  desert: '#e6cb8b', desertDark: '#d3b16b', desertLight: '#f4dfad',
  stone: '#78808f', stoneDark: '#5a6270', stoneShadow: '#434a58', stoneLight: '#a2acbb', snow: '#e2e9f3',
  canopy: '#2f7f42', canopyDark: '#22603a', canopyLight: '#48a552',
  trunk: '#6b4626',
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

  /** Trees are drawn every frame so they can lean in the wind. */
  const trees = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (tileAt(x, y) !== TILE.FOREST) continue;
      const n = 2 + Math.floor(hash(x, y, 9) * 2);
      for (let i = 0; i < n; i++) {
        trees.push({
          x: x * TILE_PX + 2 + Math.floor(hash(x, y, i) * 9),
          y: y * TILE_PX + 2 + Math.floor(hash(x, y, i + 40) * 9),
          r: hash(x, y, i + 80) < 0.4 ? 2 : 3,
          phase: hash(x, y, i + 120) * Math.PI * 2,
        });
      }
    }
  }

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

  function draw(g, view, t) {
    b.clearRect(0, 0, ART_W, ART_H);
    b.drawImage(terrain, 0, 0);
    drawWater(b, t);
    drawTrees(b, trees, t);

    const night = nightness(t);
    for (const bl of g.buildings) drawBuilding(b, bl, g, t, night);
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

/** A day is two minutes long, and mostly daylight. */
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
      if (tile === TILE.WATER) { paintSea(g, px, py, x, y); continue; }

      // Everything that is not water starts as grass, then gets its own coat.
      speckle(g, px, py, C.grass, C.grassDark, C.grassLight, x, y);
      if (tile === TILE.DESERT) speckle(g, px, py, C.desert, C.desertDark, C.desertLight, x, y);
      if (tile === TILE.MOUNTAIN) { drawRock(g, px, py); continue; }   // cliffs, not beaches
      if (tile === TILE.FOREST) {
        g.fillStyle = C.trunk;
        for (let i = 0; i < 3; i++) {
          g.fillRect(px + 3 + Math.floor(hash(x, y, i) * 9), py + 8 + Math.floor(hash(x, y, i + 40) * 5), 1, 3);
        }
      }
      // A pale rim wherever the land meets the sea.
      g.fillStyle = C.sand;
      if (!land(x, y - 1)) g.fillRect(px, py, TILE_PX, 2);
      if (!land(x, y + 1)) g.fillRect(px, py + TILE_PX - 2, TILE_PX, 2);
      if (!land(x - 1, y)) g.fillRect(px, py, 2, TILE_PX);
      if (!land(x + 1, y)) g.fillRect(px + TILE_PX - 2, py, 2, TILE_PX);
    }
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
      const px = x * TILE_PX, py = y * TILE_PX;
      for (let i = 0; i < 2; i++) {
        const seed = hash(x, y, i + 11);
        const drift = Math.sin(t * 0.9 + seed * 7) * 3;
        const len = 3 + Math.floor(seed * 4);
        g.fillStyle = i ? C.foam : C.shallow;
        g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 1.7 + seed * 9);
        g.fillRect(px + Math.floor(2 + seed * 8 + drift), py + Math.floor(3 + seed * 10), len, 1);
      }
    }
  }
  g.globalAlpha = 1;
}

function drawTrees(g, trees, t) {
  for (const tree of trees) {
    const lean = Math.round(Math.sin(t * 0.7 + tree.phase) * 0.9);
    g.fillStyle = C.canopyDark;
    g.fillRect(tree.x + lean - 1, tree.y, tree.r + 2, tree.r + 2);
    g.fillStyle = C.canopy;
    g.fillRect(tree.x + lean, tree.y, tree.r + 1, tree.r + 1);
    g.fillStyle = C.canopyLight;
    g.fillRect(tree.x + lean, tree.y, tree.r - 1, 1);
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

function spriteFor(bl) {
  return (bl.kind === KIND.PLANT ? PLANT_SPRITES : DC_SPRITES)[bl.level - 1];
}

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
  const sprite = (kind === KIND.PLANT ? PLANT_SPRITES : DC_SPRITES)[level - 1];
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = sprite[y][x];
      if (ch === '.') continue;
      if (BLINK.has(ch) && !dark) continue;
      const paint = (kind === KIND.PLANT && WARM[ch]) || PALETTE[ch];
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
  const sprite = (kind === KIND.PLANT ? PLANT_SPRITES : DC_SPRITES)[level - 1];
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

  if (selected) outline(g, selected.x, selected.y, '#ffffff', 0.9);

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
