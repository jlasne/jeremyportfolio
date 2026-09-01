/**
 * Gigawatt: the island.
 *
 * One hand-drawn map, written as the picture it is. Edit the art, get a new
 * world. 28 tiles across, 17 down, 162 of them buildable.
 *
 * The shape is deliberate. A ridge holds the north, 3 lakes and a bay hold the
 * middle, and 43 tiles of desert fill the east. Cooling runs from +10 beside
 * the water to -9 in the sand, and land is priced to match.
 */

import { TILE, TILE_INFO } from './rules.js';

export const ISLAND = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~ff^^^^ff~~~~~~~~~~~~~~~~',
  '~~~ff..^^^^..ff~~~ff~~~~~~~~',
  '~~ff....^^..f.fffff..ff~~~~~',
  '~~f...~~~~~....f....::ff~~~~',
  '~~f..~~~~~~~....f..:::ff~~~~',
  '~~f..~~~~~~...~~....:::f~~~~',
  '~~ff..~~~~...~~~....:::ff~~~',
  '~~~f....~.....~.....::::f~~~',
  '~~~ff....f..........:::ff~~~',
  '~~~~f...ff..~~.....::::ff~~~',
  '~~~~ff......~~~....::::f~~~~',
  '~~~~~ff......~~...::::ff~~~~',
  '~~~~~~ff...ff....:::::f~~~~~',
  '~~~~~~~fff..ff..::::fff~~~~~',
  '~~~~~~~~ffffff.::::ff~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

export const WIDTH = ISLAND[0].length;
export const HEIGHT = ISLAND.length;

/** Cooling comes from the tile itself plus its eight neighbours. */
const NEIGHBOURS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

export function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return TILE.WATER;
  return ISLAND[y][x];
}

export function isBuildable(x, y) {
  return TILE_INFO[tileAt(x, y)].buildable;
}

export function coolScore(x, y) {
  let sum = TILE_INFO[tileAt(x, y)].cool;
  for (const [dx, dy] of NEIGHBOURS) sum += TILE_INFO[tileAt(x + dx, y + dy)].cool;
  return Math.round(sum * 10) / 10;
}

/** Chebyshev: power runs diagonally as happily as it runs straight. */
export function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Every tile you are allowed to put a building on, in reading order. */
export function buildableTiles() {
  const out = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) if (isBuildable(x, y)) out.push({ x, y });
  }
  return out;
}
