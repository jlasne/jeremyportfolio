/**
 * Gigawatt: the site.
 *
 * One hand-drawn map, written as the picture it is. Edit the art, get a new
 * world. 28 tiles across, 17 down, 148 of them buildable.
 *
 * The buildable ground is 1 connected pad, so the whole factory reads at a
 * glance. Fin stacks wall the north, a coolant basin and 2 more sit inside the
 * floor, and 29 tiles of baked yard fill the east. Cooling runs from +10.5 at
 * a basin edge to -8 in the middle of the yard, and land is priced to match.
 *
 * The characters keep their old names, so the map still reads as a picture:
 * ~ coolant, . concrete, f pipe rack, ^ heat sink, : hot yard.
 */

import { TILE, TILE_INFO } from './rules.js';

export const ISLAND = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~ff^^^^^^^ff~~~~~~~~~~~',
  '~~~~ff^^^^^^^^^^^ff~~~~~~~~~',
  '~~~ff^^...^^^...^^^ff~~~~~~~',
  '~~~f~~....^^^.......ff~~~~~~',
  '~~ff~~.....f........:ff~~~~~',
  '~~~f~~....~~~~......::ff~~~~',
  '~~~f~....~~~~~~f.....::f~~~~',
  '~~~ff....~~~~~~......:::ff~~',
  '~~~~f.....~~~~.f.....::::f~~',
  '~~~~f..........f......:::f~~',
  '~~~~ff....f^^^.......:::ff~~',
  '~~~~~ff....^^^....:::::ff~~~',
  '~~~~~~ff.........::::::f~~~~',
  '~~~~~~~fff.....ffffffff~~~~~',
  '~~~~~~~~~ffffffff~~~~~~~~~~~',
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
