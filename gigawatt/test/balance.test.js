import { test } from 'node:test';
import assert from 'node:assert/strict';
import { play, PLAYERS } from '../tools/balance.js';
import * as G from '../src/game.js';

/**
 * The economy, held to what it was tuned for. A robot taking obvious choices
 * reaches a gigawatt in 27 minutes. Move a number in rules.js far enough to
 * break these bounds and the game becomes a different game.
 */
const MINUTES = 60;
const runs = Object.fromEntries(
  Object.entries(PLAYERS).map(([name, style]) => [name, play({ style })]),
);

test('the obvious way to play reaches a gigawatt in about half an hour', () => {
  const g = runs.careful;
  assert.ok(g.won, 'the careful player must be able to win at all');
  assert.ok(g.winTime > 20 * MINUTES, `won in ${g.winTime}s, under the 20 minute floor`);
  assert.ok(g.winTime < 35 * MINUTES, `won in ${g.winTime}s, over the 35 minute ceiling`);
});

test('the run is a run, not a wait: something to do most minutes', () => {
  const perMinute = [];
  play({ style: PLAYERS.careful, log: (ev, g) => { if (ev === 'buy') perMinute.push(g.elapsed / 60 | 0); } });
  const counts = {};
  for (const m of perMinute) counts[m] = (counts[m] || 0) + 1;
  const minutes = Math.ceil(runs.careful.winTime / 60);
  const idle = Array.from({ length: minutes }, (_, i) => counts[i] || 0).filter((c) => c === 0);
  assert.equal(idle.length, 0, `${idle.length} minutes with nothing to do`);
  assert.ok(perMinute.length > 120, `only ${perMinute.length} decisions in a whole run`);
});

test('a win takes 78 buildings on a site of 148 tiles', () => {
  const used = runs.careful.buildings.length;
  assert.ok(used > 50 && used < 110, `${used} buildings`);
  assert.ok(runs.careful.buildings.some((b) => b.kind === 'fan'), 'and some of them are fans');
});

test('the desert stops you at 300 MW, fans and all', () => {
  // Fans buy cooling, and on deep sand they still fall short. A player who
  // stays there runs out of road at less than a third of a gigawatt.
  assert.equal(runs.sunbaked.won, false, `desert only finished in ${runs.sunbaked.winTime}s`);
  assert.ok(runs.sunbaked.peakGrid < 500, `peaked at ${runs.sunbaked.peakGrid} MW`);
  assert.ok(runs.sunbaked.darkSeconds > 2000, 'and spends its life shut down');
  assert.equal(runs.careful.darkSeconds, 0, 'careful play stays lit the whole way');
});

test('long lines cost 16% of the clock', () => {
  // A line 6 tiles out delivers 66%. Building at arm's length everywhere still
  // gets there, and pays for it in minutes.
  assert.ok(runs.sprawler.winTime > runs.careful.winTime * 1.1,
    `sprawler ${runs.sprawler.winTime}s against careful ${runs.careful.winTime}s`);
});

test('building wide without ever upgrading stops at 29 MW', () => {
  // Output triples per level. A player who only ever adds tiles gets nowhere.
  assert.equal(runs.flat.won, false, `flat finished in ${runs.flat.winTime}s`);
  assert.ok(runs.flat.peakGrid < 200, `peaked at ${runs.flat.peakGrid} MW`);
  assert.ok(runs.flat.buildings.length > 40, 'even with the site half full');
});

test('at the finish, both halves of the chain are near a gigawatt', () => {
  const s = G.snapshot(runs.careful);
  assert.ok(s.supply >= 1000 && s.demand >= 1000, 'you cannot win on plants alone');
  assert.ok(s.supply < 1500, 'nor by drowning the island in spare capacity');
});
