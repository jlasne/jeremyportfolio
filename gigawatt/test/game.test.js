import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { KIND, DC, PLANT, FAN, MODEL, GIGAWATT_MW, START_MONEY, RESTART_BELOW, MAX_LINES, LINK_RANGE, coolingRate } from '../src/rules.js';
import { coolScore, buildableTiles, distance } from '../src/world.js';

/** A cold coastal tile and a baking desert one, picked off the real map. */
const COAST = { x: 12, y: 10 };        // beside the lake and the ridge, cooling +10.5
const NEXT_TO_COAST = { x: 13, y: 10 };
const DESERT = { x: 22, y: 10 };       // the middle of the sand, cooling -8
const NEXT_TO_DESERT = { x: 22, y: 9 };

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
  assert.equal(G.build(g, KIND.PLANT, 6, 2), null, 'mountain');
  assert.ok(G.build(g, KIND.PLANT, 7, 8));
  assert.equal(G.build(g, KIND.DC, 7, 8), null, 'occupied');
});

test('you cannot spend money you do not have', () => {
  const g = G.newGame();
  g.money = 0;
  assert.equal(G.build(g, KIND.PLANT, 7, 8), null);
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
  G.build(g, KIND.PLANT, 7, 8);
  run(g, 10);
  assert.ok(g.elapsed >= 9.5);
});

test('the grid is what the lines actually deliver', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, 7, 8);         // 1 MW of supply
  G.build(g, KIND.DC, 8, 8);            // 2 MW of demand
  let s = G.snapshot(g);
  assert.equal(s.supply, 1);
  assert.equal(s.demand, 2);
  assert.equal(s.grid, 1, 'one plant feeds half a datacenter');
  assert.equal(s.live[0].work, 0.5, 'so it runs at half speed');

  G.build(g, KIND.PLANT, 7, 9);
  G.build(g, KIND.PLANT, 6, 8);
  s = G.snapshot(g);
  assert.equal(s.supply, 3);
  assert.equal(s.grid, 2, 'the third megawatt has nowhere to go');
  assert.equal(s.spare, 1);
  assert.equal(s.live[0].work, 1);
});

test('half the power makes half the tokens', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, 7, 8);
  G.build(g, KIND.DC, 8, 8);
  const half = G.snapshot(g);
  G.build(g, KIND.PLANT, 7, 9);
  const full = G.snapshot(g);
  assert.ok(Math.abs(full.tokens - 2 * half.tokens) < 1e-9);
});

test('a long line costs power, a short one costs nothing', () => {
  const near = G.newGame(); near.money = 1e9;
  G.build(near, KIND.PLANT, 7, 8);
  G.build(near, KIND.DC, 8, 8);
  const far = G.newGame(); far.money = 1e9;
  G.build(far, KIND.PLANT, 16, 9);
  G.build(far, KIND.DC, 22, 9);          // 6 tiles away
  assert.equal(far.links.length, 1, 'still in reach');
  assert.ok(G.snapshot(far).grid < G.snapshot(near).grid);
  assert.ok(G.snapshot(far).grid > 0);
  assert.ok(G.snapshot(far).lostInLines > 0);
});

test('a datacenter out of reach of every plant stays dark on the meter', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.PLANT, 7, 8);
  G.build(g, KIND.DC, 22, 9);             // 15 tiles away
  assert.equal(g.links.length, 0);
  const s = G.snapshot(g);
  assert.equal(s.grid, 0);
  assert.equal(s.tokens, 0);
});

test('a new building wires itself to what it can reach', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 7, 8);
  const d = G.build(g, KIND.DC, 8, 8);
  assert.ok(G.linked(g, p, d), 'the datacenter finds the plant on its own');
});

test('a line can be drawn and cut by hand', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 7, 8);
  const d = G.build(g, KIND.DC, 8, 8);
  assert.equal(G.toggleLink(g, p, d), 'cut');
  assert.equal(g.links.length, 0);
  assert.equal(G.toggleLink(g, p, d), 'drawn');
  assert.equal(g.links.length, 1);
});

test('a line reaches 6 tiles and stops', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 16, 9);
  const near = G.build(g, KIND.DC, 22, 9);
  const away = G.build(g, KIND.DC, 23, 9);
  assert.equal(LINK_RANGE, 6);
  assert.ok(G.canLink(g, p, near));
  assert.equal(G.canLink(g, p, away), false);
});

test('a building carries 4 lines', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 18, 9);
  const dcs = [[17, 9], [19, 9], [17, 8], [18, 8], [19, 8]]
    .map(([x, y]) => G.build(g, KIND.DC, x, y));
  assert.equal(G.linksOf(g, p).length, MAX_LINES);
  assert.equal(G.linesFree(g, p), 0);
  assert.equal(G.canLink(g, p, dcs[4]), false, 'the fifth line has nowhere to plug in');
});

test('a plant fills its closest datacenter first', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 18, 9);
  p.level = 2;                              // 3 MW
  const close = G.build(g, KIND.DC, 19, 9);   // draws 2, one tile away
  const away = G.build(g, KIND.DC, 18, 4);    // draws 2, five tiles away
  const s = G.snapshot(g);
  const got = (b) => s.live.find((l) => l.b === b).got;
  assert.equal(got(close), 2, 'the near one is filled');
  assert.ok(got(away) < 1, 'the far one gets the leftovers, minus line loss');
});

test('tokens above what the model can digest are dropped', () => {
  const g = G.newGame();
  g.money = 1e9;
  const tiles = cluster(10);
  tiles.slice(0, 4).forEach((t) => { G.build(g, KIND.PLANT, t.x, t.y).level = 3; });
  tiles.slice(4).forEach((t) => { G.build(g, KIND.DC, t.x, t.y).level = 2; });
  for (const p of g.buildings.filter((b) => b.kind === KIND.PLANT)) {
    for (const d of g.buildings.filter((b) => b.kind === KIND.DC)) G.canLink(g, p, d) && !G.linked(g, p, d) && G.toggleLink(g, p, d);
  }
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
  const expected = 100 * DC.levels[0].heat / coolingRate(coolScore(COAST.x, COAST.y), 1);
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
  G.build(g, KIND.PLANT, 7, 8);
  const after = G.snapshot(g);
  assert.equal(after.income, 0);
  assert.equal(after.upkeep, PLANT.levels[0].upkeep);
  assert.ok(after.profit < before);
});

test('money never goes below zero', () => {
  const g = G.newGame();
  G.build(g, KIND.PLANT, 7, 8);
  run(g, 5000);
  assert.equal(g.money, 0);
});

test('a gigawatt of running capacity wins, and stops the clock', () => {
  const g = G.newGame();
  g.money = 1e9;
  g.modelLevel = 5;
  G.build(g, KIND.PLANT, 7, 8).level = 5;
  const dc = G.build(g, KIND.DC, 8, 8);
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

// ---------------------------------------------------------------------------
// Fans and moving
// ---------------------------------------------------------------------------

test('a fan cools the 8 tiles around it, and nothing further', () => {
  const g = G.newGame();
  g.money = 1e9;
  const ground = coolScore(DESERT.x, DESERT.y);
  G.build(g, KIND.FAN, DESERT.x + 1, DESERT.y);
  assert.equal(G.siteCooling(g, DESERT.x, DESERT.y), ground + FAN.levels[0].cool);
  assert.equal(G.siteCooling(g, DESERT.x - 2, DESERT.y), coolScore(DESERT.x - 2, DESERT.y));
});

test('fans stack, and a bigger fan cools more', () => {
  const g = G.newGame();
  g.money = 1e9;
  const ground = coolScore(DESERT.x, DESERT.y);
  const a = G.build(g, KIND.FAN, DESERT.x + 1, DESERT.y);
  G.build(g, KIND.FAN, DESERT.x - 1, DESERT.y);
  assert.equal(G.siteCooling(g, DESERT.x, DESERT.y), ground + 2 * FAN.levels[0].cool);
  G.upgrade(g, a);
  assert.equal(G.siteCooling(g, DESERT.x, DESERT.y), ground + FAN.levels[1].cool + FAN.levels[0].cool);
});

test('a fan costs money every second and moves no power', () => {
  const g = G.newGame();
  g.money = 1e9;
  G.build(g, KIND.FAN, 7, 8);
  const s = G.snapshot(g);
  assert.equal(s.upkeep, FAN.levels[0].upkeep);
  assert.equal(s.supply, 0);
  assert.equal(s.demand, 0);
  assert.equal(g.links.length, 0, 'a fan takes no lines');
});

test('fans keep a hot datacenter alive', () => {
  const hot = G.newGame(); hot.money = 1e9;
  G.build(hot, KIND.PLANT, NEXT_TO_DESERT.x, NEXT_TO_DESERT.y).level = 5;
  const a = G.build(hot, KIND.DC, DESERT.x, DESERT.y);
  a.level = 3;
  assert.ok(runUntil(hot, () => a.dark), 'sand alone kills a level 3');

  const cooled = G.newGame(); cooled.money = 1e9;
  G.build(cooled, KIND.PLANT, NEXT_TO_DESERT.x, NEXT_TO_DESERT.y).level = 5;
  const b = G.build(cooled, KIND.DC, DESERT.x, DESERT.y);
  b.level = 3;
  for (const [dx, dy] of [[1, 0], [-1, 0], [1, 1]]) {
    const f = G.build(cooled, KIND.FAN, DESERT.x + dx, DESERT.y + dy);
    if (f) { f.level = 3; }
  }
  run(cooled, 900);
  assert.equal(b.dark, false, 'three chiller towers hold it');
});

test('land price ignores fans', () => {
  const g = G.newGame();
  g.money = 1e9;
  const before = G.priceToBuild(g, KIND.DC, DESERT.x, DESERT.y);
  G.build(g, KIND.FAN, DESERT.x + 1, DESERT.y).level = 3;
  assert.equal(G.priceToBuild(g, KIND.DC, DESERT.x, DESERT.y), before);
});

test('a building can be picked up and put down somewhere else', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 7, 8);
  p.level = 3;
  assert.equal(G.canMove(g, p, 0, 0), false, 'water is still water');
  assert.ok(G.move(g, p, 6, 8));
  assert.equal(p.x, 6);
  assert.equal(p.level, 3, 'it keeps what it was');
});

test('moving out of reach cuts the lines that no longer reach', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 16, 9);
  const d = G.build(g, KIND.DC, 17, 9);
  assert.equal(g.links.length, 1);
  G.move(g, p, 7, 8);
  assert.equal(g.links.length, 0, 'the line was 10 tiles long by then');
});

test('a building cannot be moved on top of another', () => {
  const g = G.newGame();
  g.money = 1e9;
  const p = G.build(g, KIND.PLANT, 7, 8);
  G.build(g, KIND.DC, 8, 8);
  assert.equal(G.canMove(g, p, 8, 8), false);
});

test('a new game starts with enough to make the first two moves', () => {
  const g = G.newGame();
  assert.equal(g.money, START_MONEY);
  assert.ok(G.build(g, KIND.PLANT, 7, 8));
  assert.ok(G.build(g, KIND.DC, 8, 8));
});
