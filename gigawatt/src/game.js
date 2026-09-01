/**
 * Gigawatt: the simulation.
 *
 * State in, state out. This file uses a canvas, a DOM and a timer for nothing.
 * The interface calls `tick` on a clock, calls `build`, `upgrade` and
 * `restart` on a click, and reads `snapshot` to draw. tools/balance.js drives
 * the same functions with a robot in place of a person.
 */

import {
  KIND, PLANT, DC, FAN, MODEL, START_MONEY, GIGAWATT_MW, RESTART_BELOW, LINK_RANGE, MAX_LINES,
  buildCost, upgradeCost, landMultiplier, transmission, coolingRate, spec, topLevel,
} from './rules.js';
import { coolScore, distance, isBuildable, buildableTiles } from './world.js';

export function newGame() {
  return {
    money: START_MONEY,
    modelLevel: 1,
    buildings: [],       // { id, kind, x, y, level, heat, dark }
    links: [],           // { from: plantId, to: dcId }
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

/**
 * The cooling a tile actually offers: what the ground gives, plus every fan
 * standing beside it. Land price stays on the ground alone, so a fan buys you
 * cooling and never a cheaper plot.
 */
export function siteCooling(g, x, y) {
  let sum = coolScore(x, y);
  for (const b of g.buildings) {
    if (b.kind !== KIND.FAN) continue;
    if (Math.abs(b.x - x) <= 1 && Math.abs(b.y - y) <= 1 && !(b.x === x && b.y === y)) {
      sum += FAN.levels[b.level - 1].cool;
    }
  }
  return sum;
}
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
  autoWire(g, b);
  return b;
}

// ---------------------------------------------------------------------------
// Power lines
// ---------------------------------------------------------------------------

/**
 * A datacenter eats what its lines bring it. A plant splits its output across
 * the datacenters it feeds, in proportion to what each one draws, so power
 * goes where the work is. Every tile past the second burns 7% of what the line
 * carries, which is why a short line beats a long one.
 *
 * Lines cost nothing. Distance is the whole price.
 */
export const byId = (g, id) => g.buildings.find((b) => b.id === id);

export const linksOf = (g, b) => g.links.filter((l) => l.from === b.id || l.to === b.id);

export const linesFree = (g, b) => MAX_LINES - linksOf(g, b).length;

export const linked = (g, plant, dc) =>
  g.links.some((l) => l.from === plant.id && l.to === dc.id);

export function canLink(g, plant, dc) {
  if (!plant || !dc) return false;
  if (plant.kind !== KIND.PLANT || dc.kind !== KIND.DC) return false;
  if (distance(plant, dc) > LINK_RANGE) return false;
  if (linked(g, plant, dc)) return true;           // already drawn, so removable
  return linesFree(g, plant) > 0 && linesFree(g, dc) > 0;
}

/** Draws a line, or removes the one already there. Returns what it did. */
export function toggleLink(g, plant, dc) {
  if (!canLink(g, plant, dc)) return null;
  const at = g.links.findIndex((l) => l.from === plant.id && l.to === dc.id);
  if (at >= 0) { g.links.splice(at, 1); return 'cut'; }
  g.links.push({ from: plant.id, to: dc.id });
  return 'drawn';
}

/** A new building wires itself to the 2 closest partners it can reach. */
export function autoWire(g, b) {
  if (b.kind === KIND.FAN) return;
  const want = b.kind === KIND.PLANT ? KIND.DC : KIND.PLANT;
  const partners = g.buildings
    .filter((o) => o.kind === want && distance(o, b) <= LINK_RANGE)
    .sort((p, q) => distance(p, b) - distance(q, b));
  for (const p of partners) {
    const [plant, dc] = b.kind === KIND.PLANT ? [b, p] : [p, b];
    if (linked(g, plant, dc) || linesFree(g, b) <= 0) continue;
    if (canLink(g, plant, dc)) g.links.push({ from: plant.id, to: dc.id });
  }
}

/** Removing a building takes its lines with it. */
export function cutLinks(g, b) {
  g.links = g.links.filter((l) => l.from !== b.id && l.to !== b.id);
}

export function priceToUpgrade(g, b) {
  return upgradeCost(b.kind, b.level);
}

export function canUpgrade(g, b) {
  return b.level < topLevel(b.kind) && g.money >= priceToUpgrade(g, b);
}

/**
 * Moving is free. The clock is the only thing a misplaced building costs you,
 * which is the currency this game already scores. Lines that no longer reach
 * are cut, and the panel says so before you let go.
 */
export function canMove(g, b, x, y) {
  return isBuildable(x, y) && !at(g, x, y);
}

export function move(g, b, x, y) {
  if (!canMove(g, b, x, y)) return false;
  b.x = x;
  b.y = y;
  g.links = g.links.filter((l) => {
    if (l.from !== b.id && l.to !== b.id) return true;
    const other = byId(g, l.from === b.id ? l.to : l.from);
    return other && distance(b, other) <= LINK_RANGE;
  });
  return true;
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
 * Restarting is free. It waits until heat falls to 60%, and the site decides
 * how long that takes. A machine on the coast returns in 7 seconds. One in the
 * sand sits dark for 34 seconds, every time. That is the price of cheap land.
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
    supply += PLANT.levels[p.level - 1].mw;
    upkeep += PLANT.levels[p.level - 1].upkeep;
  }
  const fans = g.buildings.filter((b) => b.kind === KIND.FAN);
  for (const f of fans) upkeep += FAN.levels[f.level - 1].upkeep;

  let demand = 0;
  const wire = new Map();          // datacenter id -> what its lines bring it
  for (const d of dcs) {
    if (d.dark) continue;
    demand += DC.levels[d.level - 1].draw;
    wire.set(d.id, 0);
  }

  // A plant fills its closest datacenter first, then the next, and keeps what
  // nobody needs. So the short line gets served, and the long one gets the
  // leftovers if there are any.
  const need = new Map(dcs.filter((d) => !d.dark)
    .map((d) => [d.id, DC.levels[d.level - 1].draw]));
  let routed = 0;
  let delivered = 0;
  const lines = [];
  for (const p of plants) {
    let left = PLANT.levels[p.level - 1].mw;
    const outs = g.links
      .filter((l) => l.from === p.id)
      .map((l) => byId(g, l.to))
      .filter((d) => d && need.has(d.id))
      .sort((a, b) => distance(p, a) - distance(p, b));
    for (const d of outs) {
      const eff = transmission(distance(p, d));
      const send = Math.min(left, need.get(d.id) / eff);
      const got = send * eff;
      left -= send;
      routed += send;
      delivered += got;
      need.set(d.id, need.get(d.id) - got);
      wire.set(d.id, wire.get(d.id) + got);
      lines.push({ from: p, to: d, eff, got });
    }
  }

  // What each datacenter can do with what arrived.
  const live = [];
  let grid = 0;
  let tokens = 0;
  for (const d of dcs) {
    if (d.dark) continue;
    const draw = DC.levels[d.level - 1].draw;
    const got = wire.get(d.id);
    const work = Math.min(1, got / draw);
    grid += Math.min(got, draw);
    const made = DC.levels[d.level - 1].tokens * work;
    tokens += made;
    live.push({ b: d, got, draw, work, tokens: made });
  }

  const tier = MODEL.tiers[g.modelLevel - 1];
  const used = Math.min(tokens, tier.cap);
  const income = used * tier.rate;

  return {
    supply, demand, grid, upkeep,
    lostInLines: routed - delivered,
    spare: (supply - routed) + (delivered - grid),
    tokens, tokensUsed: used, tokensDropped: tokens - used,
    income, profit: income - upkeep,
    live, lines, plants, dcs, fans, tier,
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
    const shed = (coolingRate(siteCooling(g, d.x, d.y), g.modelLevel) * d.heat) / 100;
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
