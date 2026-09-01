/**
 * Gigawatt: the balance harness.
 *
 * Plays the game with a robot that always takes the obvious choice. It reads
 * the 3 signals the display shows a person, then fixes the cheapest one it can
 * afford:
 *
 *   1. a datacenter is running under 98%
 *   2. power is going spare
 *   3. the model is dropping tokens
 *
 * It plans 0 moves ahead and takes 0 gambles, so its time marks the slow end
 * of what an attentive person posts.
 *
 * Target: 30 minutes.
 *
 *   node tools/balance.js            one run, with a timeline
 *   node tools/balance.js --quiet    just the headline
 */

import { KIND, MODEL, DC, PLANT, TILE, LINK_RANGE, restingHeat } from '../src/rules.js';
import { coolScore, buildableTiles, distance, tileAt } from '../src/world.js';
import * as G from '../src/game.js';

const DT = 0.25;
const DECIDE_EVERY = 0.5;
const HEAT_CEILING = 90;      // the robot will not build itself an oven

/**
 * Four players. `careful` obeys both land rules. The other 3 each break one.
 * The gap between their times is the evidence a rule earns its place. A rule
 * that costs 0 to break is decoration.
 */
export const PLAYERS = {
  careful:  { heat: true,  place: 'cool'   },
  reckless: { heat: false, place: 'cheap'  },  // chases cheap land, ignores heat
  sprawler: { heat: true,  place: 'far'    },  // builds at the end of the line
  sunbaked: { heat: false, place: 'desert' },  // stays on the sand
};
const MAX_SECONDS = 4 * 3600;

let STYLE = { heat: true, place: true };
const free = (g) => buildableTiles().filter((p) => !G.at(g, p.x, p.y));
const nearestBuilding = (g, p, kind) => {
  let d = Infinity;
  for (const b of g.buildings) if (!kind || b.kind === kind) d = Math.min(d, distance(b, p));
  return d;
};

/**
 * Feed the hungriest datacenter. A person asks what gets power to the one
 * running slow. Two answers: a bigger plant on a line it already has, or a new
 * plant within 6 tiles.
 */
function addPower(g, s) {
  if (g.buildings.length === 0) {
    const t = free(g).sort((a, b) => coolScore(a.x, a.y) - coolScore(b.x, b.y))[40];
    return [{ cost: G.priceToBuild(g, KIND.PLANT, t.x, t.y), gain: 1,
      do: () => G.build(g, KIND.PLANT, t.x, t.y), label: `build plant ${t.x},${t.y}` }];
  }
  const hungry = s.live.filter((l) => l.work < 0.98).sort((a, b) => a.work - b.work)[0];
  if (!hungry) return [];
  const d = hungry.b;
  const short = hungry.draw - hungry.got;
  const options = [];

  for (const l of G.linksOf(g, d)) {
    const p = G.byId(g, l.from);
    if (!p || p.level >= 5) continue;
    const gain = Math.min(short, PLANT.levels[p.level].mw - PLANT.levels[p.level - 1].mw);
    options.push({ cost: G.priceToUpgrade(g, p), gain, do: () => G.upgrade(g, p),
      label: `upgrade plant ${p.x},${p.y}` });
  }

  if (G.linesFree(g, d) > 0) {
    const site = free(g)
      .filter((t) => distance(t, d) <= LINK_RANGE)
      .sort((a, b) => (distance(a, d) - distance(b, d)) || (coolScore(a.x, a.y) - coolScore(b.x, b.y)))[0];
    if (site) {
      options.push({ cost: G.priceToBuild(g, KIND.PLANT, site.x, site.y),
        gain: Math.min(short, PLANT.levels[0].mw),
        do: () => G.build(g, KIND.PLANT, site.x, site.y),
        label: `build plant ${site.x},${site.y}` });
    }
  }
  return options;
}

/**
 * Spend spare power. Upgrade a datacenter that is already full, or put a new
 * one where a plant with a free line can reach it.
 */
function addCompute(g, s) {
  const options = [];
  for (const l of s.live) {
    const b = l.b;
    if (b.level >= 5 || l.work < 0.98) continue;
    if (STYLE.heat && restingHeat(b.level + 1, coolScore(b.x, b.y), g.modelLevel) > HEAT_CEILING) continue;
    options.push({ cost: G.priceToUpgrade(g, b),
      gain: DC.levels[b.level].draw - DC.levels[b.level - 1].draw,
      do: () => G.upgrade(g, b), label: `upgrade dc ${b.x},${b.y}` });
  }
  const reach = g.buildings.filter((p) => p.kind === KIND.PLANT && G.linesFree(g, p) > 0);
  const span = (t) => Math.min(...reach.map((p) => distance(p, t)), 99);
  const rank = {
    cool:   (a, b) => coolScore(b.x, b.y) - coolScore(a.x, a.y),
    cheap:  (a, b) => G.priceToBuild(g, KIND.DC, a.x, a.y) - G.priceToBuild(g, KIND.DC, b.x, b.y),
    far:    (a, b) => span(b) - span(a),
    desert: (a, b) => coolScore(b.x, b.y) - coolScore(a.x, a.y),
  }[STYLE.place];
  const sites = free(g)
    .filter((t) => STYLE.heat ? restingHeat(1, coolScore(t.x, t.y), g.modelLevel) <= HEAT_CEILING : true)
    .filter((t) => STYLE.place !== 'desert' || tileAt(t.x, t.y) === TILE.DESERT)
    .filter((t) => !g.buildings.length || span(t) <= LINK_RANGE)
    .sort(rank)
    .slice(0, 6);
  for (const t of sites) {
    options.push({ cost: G.priceToBuild(g, KIND.DC, t.x, t.y), gain: DC.levels[0].draw,
      do: () => G.build(g, KIND.DC, t.x, t.y), label: `build dc ${t.x},${t.y}` });
  }
  return options;
}

/**
 * Lines cost 0, so the robot draws every line that helps. A datacenter under
 * 100% gets wired to the nearest plant still in reach.
 */
function wireUp(g) {
  const s = G.snapshot(g);
  for (const l of s.live) {
    if (l.work >= 0.999) continue;
    const plant = g.buildings
      .filter((p) => p.kind === KIND.PLANT && !G.linked(g, p, l.b) && G.canLink(g, p, l.b))
      .sort((a, b) => distance(a, l.b) - distance(b, l.b))[0];
    if (plant) G.toggleLink(g, plant, l.b);
  }
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

      wireUp(g);
      const s = G.snapshot(g);
      const nextTier = MODEL.tiers[g.modelLevel];
      const saturated = nextTier && s.tokens >= 0.85 * s.tier.cap;

      let move = null;
      if (saturated && g.money >= nextTier.cost) {
        move = { label: `model -> ${nextTier.label}`, cost: nextTier.cost, do: () => G.upgradeModel(g) };
      } else if (!saturated) {
        // The opening: one plant, then one datacenter beside it.
        const starving = s.live.some((l) => l.work < 0.98);
        const opening = s.dcs.length === 0 && s.plants.length === 0;
        move = cheapestPer(opening || starving ? addPower(g, s) : addCompute(g, s), g.money)
          || cheapestPer(addCompute(g, s), g.money);
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
  console.log(g.won ? `WON in ${mmss(g.winTime)}` : `stopped at ${mmss(g.elapsed)}, peak ${Math.round(g.peakGrid)} MW`);
  console.log(`${g.buildings.length} buildings (${s.plants.length} plants, ${s.dcs.length} datacenters) on ${buildableTiles().length} tiles   model ${s.tier.label}`);
  console.log(`supply ${Math.round(s.supply)}   demand ${Math.round(s.demand)}   grid ${Math.round(s.grid)} MW`);
  console.log(`income $${s.income.toFixed(0)}/s   upkeep $${s.upkeep.toFixed(0)}/s (${(100 * s.upkeep / (s.income || 1)).toFixed(0)}% of gross)   dropped ${s.tokensDropped.toFixed(0)} tok/s`);
console.log(`of ${Math.round(s.supply)} MW made: ${Math.round(s.grid)} used, ${Math.round(s.lostInLines)} lost in lines, ${Math.round(s.spare)} spare   ${g.links.length} lines`);

}
