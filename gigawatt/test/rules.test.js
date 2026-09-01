import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KIND, PLANT, DC, MODEL, TILE_INFO, GIGAWATT_MW,
  buildCost, upgradeCost, landMultiplier, transmission, coolingRate, restingHeat,
  LAND_PRICE_RANGE, MIN_EFFICIENCY, FREE_RADIUS,
} from '../src/rules.js';

test('every building has five levels', () => {
  assert.equal(PLANT.levels.length, 5);
  assert.equal(DC.levels.length, 5);
  assert.equal(MODEL.tiers.length, 5);
});

test('output roughly triples and consumption roughly doubles per level', () => {
  for (let i = 1; i < 5; i++) {
    const out = PLANT.levels[i].mw / PLANT.levels[i - 1].mw;
    assert.ok(out >= 2.5 && out <= 3.5, `plant output x${out}`);
    const cost = PLANT.levels[i].upkeep / PLANT.levels[i - 1].upkeep;
    assert.ok(cost >= 1.8 && cost <= 3.2, `plant upkeep x${cost}`);
  }
  for (let i = 1; i < 5; i++) {
    const out = DC.levels[i].tokens / DC.levels[i - 1].tokens;
    assert.ok(out >= 2.5 && out <= 3.5, `dc tokens x${out}`);
    const draw = DC.levels[i].draw / DC.levels[i - 1].draw;
    assert.ok(draw >= 1.8 && draw <= 3.0, `dc draw x${draw}`);
  }
});

const perMw = {
  [KIND.PLANT]: { build: (n) => buildCost(KIND.PLANT, n) / PLANT.levels[0].mw,
                  up: (l) => upgradeCost(KIND.PLANT, l) / (PLANT.levels[l].mw - PLANT.levels[l - 1].mw) },
  [KIND.DC]:    { build: (n) => buildCost(KIND.DC, n) / DC.levels[0].draw,
                  up: (l) => upgradeCost(KIND.DC, l) / (DC.levels[l].draw - DC.levels[l - 1].draw) },
};

test('once land runs out, upgrading beats building — at every level', () => {
  // The island holds 78 buildings. By the twenty-fifth of a kind, one more
  // costs more per megawatt than any upgrade does, so a full island is a
  // puzzle rather than a dead end.
  for (const kind of [KIND.PLANT, KIND.DC]) {
    const { build, up } = perMw[kind];
    for (let level = 1; level < 5; level++) {
      assert.ok(up(level) < build(25), `${kind} L${level}: ${up(level)} vs ${build(25)}`);
    }
  }
});

test('but early on, spreading out is the better buy', () => {
  // There has to be a crossover, or half the game has no decision in it. It
  // should land while the island is still mostly empty.
  for (const kind of [KIND.PLANT, KIND.DC]) {
    const { build, up } = perMw[kind];
    const cheapestUpgrade = Math.min(...[1, 2, 3, 4].map(up));
    assert.ok(build(1) < cheapestUpgrade, `${kind}: second building should be the bargain`);
    let crossover = 1;
    while (build(crossover) < cheapestUpgrade) crossover++;
    assert.ok(crossover >= 4 && crossover <= 14, `${kind} crossover at ${crossover}`);
  }
});

test('each building of a kind costs more than the last', () => {
  for (const kind of [KIND.PLANT, KIND.DC]) {
    for (let n = 0; n < 20; n++) {
      assert.ok(buildCost(kind, n + 1) > buildCost(kind, n));
    }
  }
});

test('a maxed building cannot be upgraded further', () => {
  assert.equal(upgradeCost(KIND.PLANT, 5), 0);
  assert.equal(upgradeCost(KIND.DC, 5), 0);
});

test('cool land costs more, within bounds', () => {
  assert.ok(landMultiplier(8) > landMultiplier(0));
  assert.ok(landMultiplier(0) > landMultiplier(-8));
  assert.equal(landMultiplier(-99), LAND_PRICE_RANGE[0]);
  assert.equal(landMultiplier(99), LAND_PRICE_RANGE[1]);
});

test('electricity is free nearby and never worthless far away', () => {
  assert.equal(transmission(0), 1);
  assert.equal(transmission(FREE_RADIUS), 1);
  assert.ok(transmission(FREE_RADIUS + 1) < 1);
  assert.ok(transmission(6) > transmission(10));
  assert.equal(transmission(999), MIN_EFFICIENCY);
  assert.equal(transmission(Infinity), 0);   // no plant on the island at all
});

test('water and rock cool, sand bakes', () => {
  assert.ok(TILE_INFO['~'].cool > 0);
  assert.ok(TILE_INFO['^'].cool > 0);
  assert.ok(TILE_INFO[':'].cool < 0);
  assert.ok(coolingRate(6, 1) > coolingRate(0, 1));
  assert.ok(coolingRate(0, 1) > coolingRate(-6, 1));
});

test('a better model cools every datacenter on the island', () => {
  for (let m = 2; m <= 5; m++) assert.ok(coolingRate(0, m) > coolingRate(0, m - 1));
});

test('a top-tier datacenter cannot live in the desert, but can on the coast', () => {
  assert.ok(restingHeat(5, -7, 5) > 100, 'desert should be fatal at level 5');
  assert.ok(restingHeat(5, 8, 5) < 100, 'good coast should be survivable at level 5');
  assert.ok(restingHeat(1, -7, 1) < 100, 'the desert is fine for a server closet');
});

test('the model is the only thing that makes the top tier possible anywhere', () => {
  assert.ok(restingHeat(5, 8, 1) > 100, 'level 5 anywhere on tier-1 model');
  assert.ok(restingHeat(5, 8, 5) < 100);
});

test('a gigawatt is a thousand megawatts', () => assert.equal(GIGAWATT_MW, 1000));
