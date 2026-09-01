import { test } from 'node:test';
import assert from 'node:assert/strict';
import { play, PLAYERS } from '../tools/balance.js';
import * as G from '../src/game.js';

/**
 * The economy, held to the thing it was tuned for. A robot that always takes
 * the obvious choice should reach a gigawatt in about half an hour — long
 * enough to be a run, short enough to be an evening. If a number anywhere in
 * rules.js moves far enough to break this, the game is a different game.
 */
const MINUTES = 60;
const runs = Object.fromEntries(
  Object.entries(PLAYERS).map(([name, style]) => [name, play({ style })]),
);

test('the obvious way to play reaches a gigawatt in about half an hour', () => {
  const g = runs.careful;
  assert.ok(g.won, 'the careful player must be able to win at all');
  assert.ok(g.winTime > 20 * MINUTES, `won in ${g.winTime}s — too quick to be a game`);
  assert.ok(g.winTime < 35 * MINUTES, `won in ${g.winTime}s — too long for one sitting`);
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

test('winning fills most of the island but does not need all of it', () => {
  const used = runs.careful.buildings.length;
  assert.ok(used > 40, `${used} buildings — the island never feels tight`);
  assert.ok(used < 78, `${used} buildings — no room for a mistake`);
});

test('ignoring cooling costs you the run', () => {
  assert.ok(runs.reckless.winTime > runs.careful.winTime,
    'chasing cheap desert land should be slower than building on the coast');
  assert.ok(runs.reckless.darkSeconds > 500, 'and it should cost real downtime');
  assert.equal(runs.careful.darkSeconds, 0, 'while careful play never goes dark at all');
});

test('ignoring distance costs you the run', () => {
  assert.ok(runs.sprawler.winTime > runs.careful.winTime * 1.08,
    'building wherever there is room should be meaningfully slower');
});

test('at the finish, both halves of the chain are near a gigawatt', () => {
  const s = G.snapshot(runs.careful);
  assert.ok(s.supply >= 1000 && s.demand >= 1000, 'you cannot win on plants alone');
  assert.ok(s.supply < 1500, 'nor by drowning the island in spare capacity');
});
