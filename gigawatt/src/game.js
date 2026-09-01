/**
 * Gigawatt — the simulation.
 *
 * Pure state in, pure state out. No canvas, no DOM, no timers. The interface
 * calls `tick` on a clock and `build` / `upgrade` / `restart` on a click, and
 * reads `snapshot` to draw. The balance tool in tools/balance.js drives the
 * exact same functions with a robot instead of a person.
 */

import {
  KIND, PLANT, DC, MODEL, START_MONEY, GIGAWATT_MW, RESTART_BELOW,
  buildCost, upgradeCost, landMultiplier, transmission, coolingRate, spec,
} from './rules.js';
import { coolScore, distance, isBuildable, buildableTiles } from './world.js';

export function newGame() {
  return {
    money: START_MONEY,
    modelLevel: 1,
    buildings: [],       // { id, kind, x, y, level, heat, dark }
    nextId: 1,
    elapsed: 0,          // seconds since the first building went down
    started: false,
    won: false,
    winTime: null,
    peakGrid: 0,
    darkSeconds: 0,   // total time datacenters spent shut down
  };
}

export const at = (g, x, y) => g.buildings.find((b) => b.x === x && b.y === y);
export const countOf = (g, kind) => g.buildings.filter((b) => b.kind === kind).length;

/** Price of putting the next building of `kind` on a given tile. */
export function priceToBuild(g, kind, x, y) {
  return Math.round(buildCost(kind, countOf(g, kind)) * landMultiplier(coolScore(x, y)));
}

/**
 * What the next building of a kind would cost, cheapest tile to dearest. The
 * spread is the price of good land, and putting both ends on the button is the
 * shortest way to say so.
 */
export function buildCostFor(g, kind) {
  let low = Infinity, high = 0;
  for (const t of buildableTiles()) {
    if (at(g, t.x, t.y)) continue;
    const p = priceToBuild(g, kind, t.x, t.y);
    if (p < low) low = p;
    if (p > high) high = p;
  }
  return low === Infinity ? { low: 0, high: 0 } : { low, high };
}

export function canBuild(g, kind, x, y) {
  if (!isBuildable(x, y) || at(g, x, y)) return false;
  return g.money >= priceToBuild(g, kind, x, y);
}

export function build(g, kind, x, y) {
  if (!canBuild(g, kind, x, y)) return null;
  g.money -= priceToBuild(g, kind, x, y);
  const b = { id: g.nextId++, kind, x, y, level: 1, heat: 0, dark: false };
  g.buildings.push(b);
  g.started = true;
  return b;
}

export function priceToUpgrade(g, b) {
  return upgradeCost(b.kind, b.level);
}

export function canUpgrade(g, b) {
  return b.level < spec(b.kind).levels.length && g.money >= priceToUpgrade(g, b);
}

export function upgrade(g, b) {
  if (!canUpgrade(g, b)) return false;
  g.money -= priceToUpgrade(g, b);
  b.level += 1;
  return true;
}

export function canUpgradeModel(g) {
  return g.modelLevel < MODEL.tiers.length && g.money >= MODEL.tiers[g.modelLevel].cost;
}

export function upgradeModel(g) {
  if (!canUpgradeModel(g)) return false;
  g.money -= MODEL.tiers[g.modelLevel].cost;
  g.modelLevel += 1;
  return true;
}

/**
 * Restarting is free, but you cannot do it until the thing has cooled off —
 * and how long that takes is decided entirely by where you put it. A machine
 * on the coast is back in seconds. One in the desert sits dark for half a
 * minute, every time, which is the whole price of cheap land.
 */
export const canRestart = (b) => b.kind === KIND.DC && b.dark && b.heat <= RESTART_BELOW;

export function restart(g, b) {
  if (!canRestart(b)) return false;
  b.dark = false;
  return true;
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/**
 * Everything the interface and the tick both need, computed from scratch each
 * frame. Cheap enough at this scale, and it means there is exactly one place
 * where the economy is defined.
 */
export function snapshot(g) {
  const plants = g.buildings.filter((b) => b.kind === KIND.PLANT);
  const dcs = g.buildings.filter((b) => b.kind === KIND.DC);

  let supply = 0;
  let upkeep = 0;
  for (const p of plants) {
    const lv = PLANT.levels[p.level - 1];
    supply += lv.mw;
    upkeep += lv.upkeep;
  }

  // Each datacenter is fed by its nearest plant; the walk there costs power.
  const live = [];
  let demand = 0;
  for (const d of dcs) {
    if (d.dark) continue;
    let nearest = Infinity;
    for (const p of plants) nearest = Math.min(nearest, distance(d, p));
    const eff = transmission(nearest);
    if (eff === 0) continue;              // no plant on the island yet
    const draw = DC.levels[d.level - 1].draw;
    demand += draw;
    live.push({ b: d, eff, draw });
  }

  // Not enough electricity to go round: everyone runs slow, and runs cool.
  const load = demand > 0 ? Math.min(1, supply / demand) : 0;
  const grid = Math.min(supply, demand);

  let tokens = 0;
  for (const l of live) {
    l.work = load * l.eff;
    l.tokens = DC.levels[l.b.level - 1].tokens * l.work;
    tokens += l.tokens;
  }

  const tier = MODEL.tiers[g.modelLevel - 1];
  const used = Math.min(tokens, tier.cap);
  const income = used * tier.rate;

  return {
    supply, demand, grid, load, upkeep,
    tokens, tokensUsed: used, tokensDropped: tokens - used,
    income, profit: income - upkeep,
    live, plants, dcs, tier,
    fraction: grid / GIGAWATT_MW,
  };
}

/** Advance the world by `dt` seconds. Returns the snapshot it acted on. */
export function tick(g, dt) {
  const s = snapshot(g);
  if (g.won) return s;

  if (g.started) g.elapsed += dt;
  g.money = Math.max(0, g.money + s.profit * dt);
  g.peakGrid = Math.max(g.peakGrid, s.grid);

  const work = new Map(s.live.map((l) => [l.b.id, l.work]));
  for (const d of s.dcs) {
    if (d.dark) g.darkSeconds += dt;
    const w = d.dark ? 0 : (work.get(d.id) ?? 0);
    const gain = DC.levels[d.level - 1].heat * w;
    const shed = (coolingRate(coolScore(d.x, d.y), g.modelLevel) * d.heat) / 100;
    d.heat = Math.max(0, d.heat + (gain - shed) * dt);
    if (d.heat >= 100) {
      d.heat = 100;
      d.dark = true;
    }
  }

  if (s.grid >= GIGAWATT_MW) {
    g.won = true;
    g.winTime = g.elapsed;
  }
  return s;
}
