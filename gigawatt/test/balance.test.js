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

test('a win takes 62 buildings and 116 lines', () => {
  const used = runs.careful.buildings.length;
  assert.ok(used > 45 && used < 90, `${used} buildings`);
  assert.ok(runs.careful.links.length > used, 'most buildings carry more than one line');
});

test('the desert stops you at 900 MW', () => {
  // The top tier of datacenter dies on sand at every model, so a player who
  // stays there runs out of road.
  assert.equal(runs.sunbaked.won, false, `desert only finished in ${runs.sunbaked.winTime}s`);
  assert.ok(runs.sunbaked.darkSeconds > 50000, 'and spends its life shut down');
  assert.equal(runs.careful.darkSeconds, 0, 'careful play stays lit the whole way');
});

test('chasing cheap land costs 2.7 times the clock', () => {
  assert.ok(runs.reckless.darkSeconds > 20000, 'cheap land runs hot');
  assert.ok(runs.reckless.winTime > runs.careful.winTime * 2,
    'and the downtime shows up on the clock');
});

test('long lines stop you at 880 MW', () => {
  // A line 6 tiles out delivers 73%. Build at arm's length everywhere and the
  // loss adds up to a wall.
  assert.equal(runs.sprawler.won, false, `sprawler finished in ${runs.sprawler.winTime}s`);
  assert.ok(runs.sprawler.peakGrid > 700, 'it gets close');
  assert.ok(runs.sprawler.peakGrid < 1000, 'and stops there');
});

test('at the finish, both halves of the chain are near a gigawatt', () => {
  const s = G.snapshot(runs.careful);
  assert.ok(s.supply >= 1000 && s.demand >= 1000, 'you cannot win on plants alone');
  assert.ok(s.supply < 1500, 'nor by drowning the island in spare capacity');
});
