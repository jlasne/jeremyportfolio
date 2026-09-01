/**
 * Gigawatt — the balance harness.
 *
 * Plays the game with a robot that always takes the obvious choice. It reads
 * the same three signals the heads-up display shows a person — the lights are
 * dim, there is spare power, tokens are going to waste — and fixes whichever
 * one it can afford, cheapest first. It never plans and never gambles, so its
 * time is roughly the slowest a paying-attention human should post.
 *
 * Target: about thirty minutes.
 *
 *   node tools/balance.js            one run, with a timeline
 *   node tools/balance.js --quiet    just the headline
 */

import { KIND, MODEL, DC, PLANT, TILE, restingHeat } from '../src/rules.js';
import { coolScore, buildableTiles, distance, tileAt } from '../src/world.js';
import * as G from '../src/game.js';

const DT = 0.25;
const DECIDE_EVERY = 0.5;
const HEAT_CEILING = 90;      // the robot will not build itself an oven

/**
 * Three players. The careful one obeys both land rules. The other two each
 * ignore one, and the gap between them is the evidence that the rule is doing
 * something. If a rule can be ignored for free, it is decoration.
 */
export const PLAYERS = {
  careful:  { heat: true,  place: 'cool'   },
  reckless: { heat: false, place: 'cheap'  },  // chases cheap land, ignores heat
  sprawler: { heat: true,  place: 'any'    },  // ignores distance
  sunbaked: { heat: false, place: 'desert' },  // will not leave the sand
};
const MAX_SECONDS = 4 * 3600;

let STYLE = { heat: true, place: true };
const free = (g) => buildableTiles().filter((p) => !G.at(g, p.x, p.y));
const nearestBuilding = (g, p, kind) => {
  let d = Infinity;
  for (const b of g.buildings) if (!kind || b.kind === kind) d = Math.min(d, distance(b, p));
  return d;
};

/** Cheapest way to add a megawatt: a bigger plant, or one more plant. */
function addPower(g) {
  const options = [];
  for (const b of g.buildings) {
    if (b.kind !== KIND.PLANT || b.level >= 5) continue;
    const gain = PLANT.levels[b.level].mw - PLANT.levels[b.level - 1].mw;
    options.push({ cost: G.priceToUpgrade(g, b), gain, do: () => G.upgrade(g, b), label: `upgrade plant ${b.x},${b.y}` });
  }
  // Plants do not care about heat, so they belong on the land nobody wants —
  // as long as they stay within reach of the compute.
  const sites = free(g)
    .filter((p) => !g.buildings.length || STYLE.place === 'any' || nearestBuilding(g, p, KIND.DC) <= 3)
    .sort((a, b) => coolScore(a.x, a.y) - coolScore(b.x, b.y))
    .slice(0, 6);
  for (const p of sites) {
    options.push({ cost: G.priceToBuild(g, KIND.PLANT, p.x, p.y), gain: PLANT.levels[0].mw,
      do: () => G.build(g, KIND.PLANT, p.x, p.y), label: `build plant ${p.x},${p.y}` });
  }
  return options;
}

/** Cheapest way to add a megawatt of demand: a bigger datacenter, or one more. */
function addCompute(g) {
  const options = [];
  for (const b of g.buildings) {
    if (b.kind !== KIND.DC || b.level >= 5) continue;
    if (STYLE.heat && restingHeat(b.level + 1, coolScore(b.x, b.y), g.modelLevel) > HEAT_CEILING) continue;
    const gain = DC.levels[b.level].draw - DC.levels[b.level - 1].draw;
    options.push({ cost: G.priceToUpgrade(g, b), gain, do: () => G.upgrade(g, b), label: `upgrade dc ${b.x},${b.y}` });
  }
  // Datacenters want the coldest ground they can reach, because cold ground is
  // the only thing that lets them grow later.
  const sites = free(g)
    .filter((p) => !g.buildings.length || STYLE.place === 'any' || nearestBuilding(g, p, KIND.PLANT) <= 3)
    .filter((p) => STYLE.place !== 'desert' || tileAt(p.x, p.y) === TILE.DESERT)
    .sort((a, b) => (STYLE.place === 'cool'
      ? coolScore(b.x, b.y) - coolScore(a.x, a.y)
      : G.priceToBuild(g, KIND.DC, a.x, a.y) - G.priceToBuild(g, KIND.DC, b.x, b.y)))
    .slice(0, 6);
  for (const p of sites) {
    options.push({ cost: G.priceToBuild(g, KIND.DC, p.x, p.y), gain: DC.levels[0].draw,
      do: () => G.build(g, KIND.DC, p.x, p.y), label: `build dc ${p.x},${p.y}` });
  }
  return options;
}

const cheapestPer = (options, money) => options
  .filter((o) => o.cost <= money && o.gain > 0)
  .sort((a, b) => a.cost / a.gain - b.cost / b.gain)[0];

export function play({ log = () => {}, style = PLAYERS.careful } = {}) {
  const g = G.newGame();
  STYLE = style;
  let since = 0;
  const marks = new Set();

  for (let t = 0; t < MAX_SECONDS && !g.won; t += DT) {
    since += DT;
    if (since >= DECIDE_EVERY) {
      since = 0;
      for (const b of g.buildings) if (b.dark) G.restart(g, b);

      const s = G.snapshot(g);
      const nextTier = MODEL.tiers[g.modelLevel];
      const saturated = nextTier && s.tokens >= 0.85 * s.tier.cap;

      let move = null;
      if (saturated && g.money >= nextTier.cost) {
        move = { label: `model -> ${nextTier.label}`, cost: nextTier.cost, do: () => G.upgradeModel(g) };
      } else if (!saturated) {
        // The opening: one plant, then one datacenter beside it.
        const wantPower = s.dcs.length === 0 ? s.plants.length === 0 : s.load < 0.995 || s.supply === 0;
        move = cheapestPer(wantPower ? addPower(g) : addCompute(g), g.money);
      }
      if (move) { move.do(); log('buy', g, move); }
    }

    const s = G.tick(g, DT);
    const hundred = Math.floor(s.grid / 100) * 100;
    if (hundred > 0 && !marks.has(hundred)) { marks.add(hundred); log('mark', g, { hundred }); }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('balance.js');
if (invokedDirectly) {
  const quiet = process.argv.includes('--quiet');
  if (process.argv.includes('--all')) {
    const mm = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    for (const [name, style] of Object.entries(PLAYERS)) {
      const r = play({ style });
      const s2 = G.snapshot(r);
      const dark = s2.dcs.filter((d) => d.dark).length;
      console.log(`${name.padEnd(9)} ${(r.won ? mm(r.winTime) : `dnf, peak ${Math.round(r.peakGrid)} MW`).padEnd(18)}` +
        `${r.buildings.length} buildings   grid ${Math.round(s2.grid)} MW   ${dark} dark   ${Math.round(r.darkSeconds)}s lost to heat`);
    }
    process.exit(0);
  }
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const g = play({
    log: (ev, g, d) => {
      if (quiet) return;
      if (ev === 'mark') console.log(`${mmss(g.elapsed)}  ${'─'.repeat(8)} ${d.hundred} MW ${'─'.repeat(8)}`);
      else console.log(`${mmss(g.elapsed)}  ${d.label.padEnd(26)} $${Math.round(d.cost)}`);
    },
  });

  const s = G.snapshot(g);
  console.log('\n' + '─'.repeat(58));
  console.log(g.won ? `WON in ${mmss(g.winTime)}` : `no gigawatt in ${mmss(g.elapsed)} — peak ${Math.round(g.peakGrid)} MW`);
  console.log(`${g.buildings.length} buildings (${s.plants.length} plants, ${s.dcs.length} datacenters) on ${buildableTiles().length} tiles   model ${s.tier.label}`);
  console.log(`supply ${Math.round(s.supply)}   demand ${Math.round(s.demand)}   grid ${Math.round(s.grid)} MW`);
  console.log(`income $${s.income.toFixed(0)}/s   upkeep $${s.upkeep.toFixed(0)}/s (${(100 * s.upkeep / (s.income || 1)).toFixed(0)}% of gross)   dropped ${s.tokensDropped.toFixed(0)} tok/s`);

}
