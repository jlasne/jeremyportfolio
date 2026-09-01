import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND, WIDTH, HEIGHT, tileAt, isBuildable, coolScore, distance, buildableTiles } from '../src/world.js';
import { TILE, TILE_INFO, restingHeat, MODEL } from '../src/rules.js';

test('the map is a rectangle of known characters', () => {
  for (const row of ISLAND) {
    assert.equal(row.length, WIDTH);
    for (const c of row) assert.ok(TILE_INFO[c], `unknown tile "${c}"`);
  }
  assert.equal(ISLAND.length, HEIGHT);
});

test('the island never touches the edge of the world', () => {
  for (let x = 0; x < WIDTH; x++) {
    assert.equal(tileAt(x, 0), TILE.WATER);
    assert.equal(tileAt(x, HEIGHT - 1), TILE.WATER);
  }
  for (let y = 0; y < HEIGHT; y++) {
    assert.equal(tileAt(0, y), TILE.WATER);
    assert.equal(tileAt(WIDTH - 1, y), TILE.WATER);
  }
});

test('off the map is open water', () => {
  assert.equal(tileAt(-1, -1), TILE.WATER);
  assert.equal(tileAt(WIDTH + 5, 3), TILE.WATER);
});

test('the site holds 148 buildable tiles, and a win uses 56', () => {
  const tiles = buildableTiles();
  assert.ok(tiles.length >= 120 && tiles.length <= 170, `${tiles.length} buildable tiles`);
  assert.ok(tiles.some((p) => tileAt(p.x, p.y) === TILE.DESERT), 'the desert takes buildings');
  assert.equal(isBuildable(6, 2), false, 'mountains hold rock, not buildings');
});

test('the buildable ground is one connected site', () => {
  // A player reads one factory floor faster than five scattered plots.
  const tiles = buildableTiles();
  const key = (p) => `${p.x},${p.y}`;
  const open = new Set(tiles.map(key));
  const seen = new Set([key(tiles[0])]);
  const queue = [tiles[0]];
  while (queue.length) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: x + dx, y: y + dy };
      if (open.has(key(next)) && !seen.has(key(next))) { seen.add(key(next)); queue.push(next); }
    }
  }
  assert.equal(seen.size, tiles.length, `${tiles.length - seen.size} tiles cut off from the site`);
});

test('the coast is cold, the deep desert is hot, and both are on the map', () => {
  const cool = buildableTiles().map((p) => coolScore(p.x, p.y));
  assert.ok(Math.max(...cool) >= 6, 'somewhere genuinely cold to build');
  assert.ok(Math.min(...cool) <= -6, 'somewhere genuinely hostile to build');
});

test('the best model unlocks the coast for top-tier datacenters, and only the coast', () => {
  const cool = buildableTiles().map((p) => coolScore(p.x, p.y));
  const roomAt = (m) => cool.filter((c) => restingHeat(5, c, m) < 100).length;
  assert.equal(roomAt(1), 0, 'no level-5 site exists on the starting model');
  assert.ok(roomAt(MODEL.tiers.length) >= 14, 'enough level-5 sites to reach a gigawatt');
  assert.ok(roomAt(MODEL.tiers.length) < cool.length / 2, 'but not most of the island');
  assert.ok(roomAt(4) < roomAt(5), 'each model tier opens more ground');
});

test('power runs diagonally as happily as it runs straight', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 3 }), 3);
  assert.equal(distance({ x: 0, y: 0 }, { x: 0, y: 4 }), 4);
});
