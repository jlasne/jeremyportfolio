import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { KIND, DC, PLANT, MODEL, GIGAWATT_MW, START_MONEY, RESTART_BELOW } from '../src/rules.js';
import { coolScore, buildableTiles, distance } from '../src/world.js';

/** A cold coastal tile and a baking desert one, picked off the real map. */
const COAST = { x: 6, y: 6 };     // beside the lake and the ridge
const NEXT_TO_COAST = { x: 5, y: 6 };
const DESERT = { x: 13, y: 6 };   // the middle of the sand
const NEXT_TO_DESERT = { x: 13, y: 7 };

/** n buildable tiles that are all within reach of each other. */
const cluster = (n) => {
  const tiles = buildableTiles();
  const seed = tiles.find((t) => coolScore(t.x, t.y) > 0);
  return tiles.filter((t) => distance(t, seed) <= 3).slice(0, n);
};

const run = (g, seconds, dt = 0.25) => {
  for (let t = 0; t < seconds; t += dt) G.tick(g, dt);
  return G.snapshot(g);
};

const runUntil = (g, done, limit = 3000, dt = 0.25) => {
  for (let t = 0; t < limit && !done(); t += dt) G.tick(g, dt);
  return done();
};

test('the map tiles the tests rely on are the ones they think they are', () => {
  assert.ok(coolScore(COAST.x, COAST.y) >= 5, 'COAST should be cold');
  assert.ok(coolScore(DESERT.x, DESERT.y) <= -6, 'DESERT should be hostile');
  for (const t of [COAST, NEXT_TO_COAST, DESERT, NEXT_TO_DESERT]) {
    assert.ok(buildableTiles().some((b) => b.x === t.x && b.y === t.y), `${t.x},${t.y} buildable`);
  }
});

test('you cannot build on water, on mountains, or on top of yourself', () => {
  const g = G.newGame();
  assert.equal(G.build(g, KIND.PLANT, 0, 0), null, 'water');
  assert.equal(G.build(g, KIND.PLANT, 6, 1), null, 'mountain');
  assert.ok(G.build(g, KIND.PLANT, 4, 6));
  assert.equal(G.build(g, KIND.DC, 4, 6), null, 'occupied');
});

test('you cannot spend money you do not have', () => {
  const g = G.newGame();
  g.money = 0;
  assert.equal(G.build(g, KIND.PLANT, 4, 6), null);
  assert.equal(g.money, 0);
});

test('good land costs more than bad land', () => {
  const g = G.newGame();
  assert.ok(G.priceToBuild(g, KIND.DC, COAST.x, COAST.y) >
            G.priceToBuild(g, KIND.DC, DESERT.x, DESERT.y));
});

test('the clock does not start until the first building goes down', () => {
  const g = G.newGame();
  run(g, 10);
  assert.equal(g.elapsed, 0);
  G.build(g, KIND.PLANT, 4, 6);
  run(g, 10);
  assert.ok(g.elapsed >= 9.5);
});

test('the grid is whichever side of the chain is smaller', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, 4, 6);           // 1 MW of supply
  G.build(g, KIND.DC, 5, 6);              // 2 MW of demand
  let s = G.snapshot(g);
  assert.equal(s.supply, 1);
  assert.equal(s.demand, 2);
  assert.equal(s.grid, 1, 'too few plants: the grid is what the plants make');
  assert.equal(s.load, 0.5, 'and everything runs at half speed');

  G.build(g, KIND.PLANT, 4, 7);
  G.build(g, KIND.PLANT, 5, 7);
  s = G.snapshot(g);
  assert.equal(s.supply, 3);
  assert.equal(s.grid, 2, 'too few datacenters: the spare megawatt is wasted');
  assert.equal(s.load, 1);
});

test('a brownout slows tokens and money in step', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, 4, 6);
  G.build(g, KIND.DC, 5, 6);
  const half = G.snapshot(g);
  G.build(g, KIND.PLANT, 4, 7);
  const full = G.snapshot(g);
  assert.ok(Math.abs(full.tokens - 2 * half.tokens) < 1e-9);
});

test('distance from a plant costs a datacenter output, but never all of it', () => {
  const near = G.newGame(); near.money = 1e9;
  G.build(near, KIND.PLANT, 4, 6);
  G.build(near, KIND.DC, 5, 6);
  const far = G.newGame(); far.money = 1e9;
  G.build(far, KIND.PLANT, 4, 6);
  G.build(far, KIND.DC, 16, 8);
  assert.ok(G.snapshot(far).tokens < G.snapshot(near).tokens);
  assert.ok(G.snapshot(far).tokens > 0);
});

test('tokens above what the model can digest are dropped', () => {
  const g = G.newGame();
  g.money = 1e9;
  const tiles = cluster(10);
  tiles.slice(0, 4).forEach((t) => { G.build(g, KIND.PLANT, t.x, t.y).level = 3; });
  tiles.slice(4).forEach((t) => { G.build(g, KIND.DC, t.x, t.y).level = 2; });
  const s = G.snapshot(g);
  assert.ok(s.tokens > MODEL.tiers[0].cap);
  assert.equal(s.tokensUsed, MODEL.tiers[0].cap);
  assert.ok(s.tokensDropped > 0);
  assert.equal(s.income, MODEL.tiers[0].cap * MODEL.tiers[0].rate);
});

test('heat settles at a temperature you could have worked out in advance', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, NEXT_TO_COAST.x, NEXT_TO_COAST.y).level = 3;   // ample power
  const dc = G.build(g, KIND.DC, COAST.x, COAST.y);
  run(g, 600);
  const expected = 100 * DC.levels[0].heat /
    ((4.0 + 0.42 * coolScore(COAST.x, COAST.y)) * MODEL.tiers[0].cool);
  assert.ok(Math.abs(dc.heat - expected) < 1, `${dc.heat} vs ${expected}`);
});

test('a big datacenter in the desert overheats, goes dark, and has to cool off', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, NEXT_TO_DESERT.x, NEXT_TO_DESERT.y).level = 5;
  const dc = G.build(g, KIND.DC, DESERT.x, DESERT.y);
  dc.level = 4;
  assert.ok(runUntil(g, () => dc.dark), 'it should have shut itself down');
  assert.equal(G.snapshot(g).demand, 0, 'a dark datacenter draws nothing');
  assert.equal(G.restart(g, dc), false, 'and cannot be restarted while it is still hot');

  const wentDarkAt = g.elapsed;
  assert.ok(runUntil(g, () => G.canRestart(dc)), 'it cools down on its own');
  assert.ok(g.elapsed - wentDarkAt > 30, 'but in the desert that takes a good while');
  assert.ok(G.restart(g, dc), 'once cool, a click brings it back');
  assert.ok(!dc.dark);
  assert.ok(g.darkSeconds > 30, 'and the downtime is on the record');
});

test('the same datacenter on the coast never goes dark at all', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, NEXT_TO_COAST.x, NEXT_TO_COAST.y).level = 5;
  const dc = G.build(g, KIND.DC, COAST.x, COAST.y);
  dc.level = 4;
  g.modelLevel = 3;
  run(g, 900);
  assert.ok(!dc.dark);
});

test('upgrading the model cools every datacenter on the island', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, NEXT_TO_COAST.x, NEXT_TO_COAST.y);
  const dc = G.build(g, KIND.DC, COAST.x, COAST.y);
  run(g, 400);
  const hot = dc.heat;
  g.modelLevel = 5;
  run(g, 400);
  assert.ok(dc.heat < hot);
});

test('idle plants cost money and earn nothing', () => {
  const g = G.newGame();
  const before = G.snapshot(g).profit;
  G.build(g, KIND.PLANT, 4, 6);
  const after = G.snapshot(g);
  assert.equal(after.income, 0);
  assert.equal(after.upkeep, PLANT.levels[0].upkeep);
  assert.ok(after.profit < before);
});

test('money never goes below zero', () => {
  const g = G.newGame();
  G.build(g, KIND.PLANT, 4, 6);
  run(g, 5000);
  assert.equal(g.money, 0);
});

test('a gigawatt of running capacity wins, and stops the clock', () => {
  const g = G.newGame();
  g.money = 1e9;
  g.modelLevel = 5;
  G.build(g, KIND.PLANT, 4, 6).level = 5;
  const dc = G.build(g, KIND.DC, 5, 6);
  dc.level = 5;
  run(g, 1);
  assert.ok(!g.won, 'a big plant alone is not a grid');

  for (const t of buildableTiles()) {
    const b = G.build(g, G.countOf(g, KIND.PLANT) <= G.countOf(g, KIND.DC) ? KIND.PLANT : KIND.DC, t.x, t.y);
    if (b) b.level = 5;
    if (G.snapshot(g).grid >= GIGAWATT_MW) break;
  }
  run(g, 2);
  const s = G.snapshot(g);
  assert.ok(s.grid >= GIGAWATT_MW, `grid was ${s.grid}`);
  assert.ok(g.won);
  assert.ok(g.winTime > 0);
  const frozen = g.winTime;
  run(g, 30);
  assert.equal(g.winTime, frozen, 'the clock stops when you win');
});

test('a new game starts with enough to make the first two moves', () => {
  const g = G.newGame();
  assert.equal(g.money, START_MONEY);
  assert.ok(G.build(g, KIND.PLANT, 4, 6));
  assert.ok(G.build(g, KIND.DC, 5, 6));
});
