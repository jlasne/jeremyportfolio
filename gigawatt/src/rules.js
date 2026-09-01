/**
 * Gigawatt: the rulebook.
 *
 * Every number the game runs on lives here. This file draws nothing. The
 * chain is:
 *
 *     money -> power plants -> electricity -> datacenters -> tokens -> model -> money
 *
 * Each link is capped by the one before it. That is the whole game.
 */

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/** Map characters. The island is authored as ASCII art in world.js. */
export const TILE = {
  WATER: '~',
  GRASS: '.',
  FOREST: 'f',
  MOUNTAIN: '^',
  DESERT: ':',
};

/**
 * `cool` is the tile's contribution to the cooling score of anything built on
 * or beside it. Coolant and fins carry heat away. The baked yard throws it
 * back, and it is the cheapest ground on the site.
 */
export const TILE_INFO = {
  [TILE.WATER]:    { name: 'Coolant basin', cool:  2.0, buildable: false },
  [TILE.GRASS]:    { name: 'Concrete',      cool:  0.0, buildable: true  },
  [TILE.FOREST]:   { name: 'Pipe rack',     cool:  0.5, buildable: false },
  [TILE.MOUNTAIN]: { name: 'Heat sink',     cool:  1.5, buildable: false },
  [TILE.DESERT]:   { name: 'Hot yard',      cool: -1.0, buildable: true  },
};

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export const KIND = { PLANT: 'plant', DC: 'dc', FAN: 'fan' };

/**
 * Five levels each. Output triples per level, consumption doubles. So one
 * upgraded tile beats two new ones once the good land runs out.
 */
export const PLANT = {
  name: 'Power plant',
  levels: [
    { label: 'Diesel shed',  mw:  1, upkeep:  0.22 },
    { label: 'Gas turbine',  mw:  3, upkeep:  0.57 },
    { label: 'Coal stack',   mw:  9, upkeep:  1.48 },
    { label: 'Nuclear pile', mw: 27, upkeep:  3.85 },
    { label: 'Fusion ring',  mw: 81, upkeep: 10.00 },
  ],
  baseCost: 22,
  costGrowth: 1.28,          // every plant after the first costs more
  upgradeCost: [0, 95, 930, 5900, 24000],
};

export const DC = {
  name: 'Datacenter',
  levels: [
    { label: 'Server closet', draw:  2, tokens:  1, heat: 0.55 },
    { label: 'Rack row',      draw:  5, tokens:  3, heat: 1.10 },
    { label: 'Cold aisle',    draw: 12, tokens:  9, heat: 2.20 },
    { label: 'Hyperscale',    draw: 30, tokens: 27, heat: 4.40 },
    { label: 'Compute mesa',  draw: 75, tokens: 81, heat: 8.80 },
  ],
  baseCost: 26,
  costGrowth: 1.28,
  upgradeCost: [0, 140, 1350, 8400, 34000],
};

/**
 * The player owns 1 model and upgrades it through 5 tiers.
 *
 * `cap` is the tokens per second it buys. Tokens above `cap` are dropped, and
 * that is the signal to upgrade. `cool` multiplies cooling across the whole
 * island, which is what lets a level 5 datacenter live away from water.
 */
/**
 * A fan cools the 8 tiles around it. It moves no power and makes no tokens, it
 * just costs money every second. That is the deal: cheap ground plus a fan and
 * its bill, or good ground and no fan.
 *
 * A level 3 fan is worth 3.5 tiles of water. Three of them turn the worst sand
 * on the site into ground a level 5 datacenter survives on.
 */
export const FAN = {
  name: 'Cooling fan',
  levels: [
    { label: 'Box fan',      cool: 2, upkeep:  1.5 },
    { label: 'Blower',       cool: 4, upkeep:  7.0 },
    { label: 'Chiller tower', cool: 7, upkeep: 32.0 },
  ],
  baseCost: 45,
  costGrowth: 1.24,
  upgradeCost: [0, 320, 4200],
};

export const MODEL = {
  name: 'AI model',
  tiers: [
    { label: 'Ember 0.5',     cap:    6, rate: 1.80, cool: 1.00, cost:     0 },
    { label: 'Ember 1',       cap:   26, rate: 2.20, cool: 1.15, cost:   120 },
    { label: 'Ember 2',       cap:  110, rate: 2.75, cool: 1.35, cost:  1300 },
    { label: 'Ember 3',       cap:  460, rate: 3.40, cool: 1.60, cost:  7000 },
    { label: 'Ember 4 Ultra', cap: 1150, rate: 4.30, cool: 1.90, cost: 40000 },
  ],
};

// ---------------------------------------------------------------------------
// The two land rules
// ---------------------------------------------------------------------------

/** A power line reaches 6 tiles. */
export const LINK_RANGE = 6;
/** Each building carries 4 lines. */
export const MAX_LINES = 4;
/** A line carries everything for 3 tiles. */
export const FREE_RADIUS = 3;
/** Past 3 tiles, each tile burns 11.5% of what passes through. */
export const LOSS_PER_TILE = 0.115;
/** So a 6 tile line delivers 66%. */
export const MIN_EFFICIENCY = 0.35;

/** Heat radiated per second at full heat, as a function of cooling score. */
export const COOL_BASE = 2.6;
export const COOL_PER_POINT = 0.42;
export const COOL_FLOOR = 0.95;

/** Good land costs more to build on. Desert is cheap because desert is bad. */
export const LAND_PRICE_PER_POINT = 0.11;
export const LAND_PRICE_RANGE = [0.65, 2.1];

export const START_MONEY = 150;
export const GIGAWATT_MW = 1000;
/** A dark datacenter has to cool to this before it will turn over again. */
export const RESTART_BELOW = 60;

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const spec = (kind) => (kind === KIND.PLANT ? PLANT : kind === KIND.FAN ? FAN : DC);

/** What the nth building of a kind costs, before the land multiplier. */
export function buildCost(kind, owned) {
  const s = spec(kind);
  return Math.round(s.baseCost * Math.pow(s.costGrowth, owned));
}

/** How many levels a kind has. */
export const topLevel = (kind) => spec(kind).levels.length;

/** Cost to take a building from `level` to `level + 1`. Zero if maxed. */
export function upgradeCost(kind, level) {
  const s = spec(kind);
  return level >= s.levels.length ? 0 : s.upgradeCost[level];
}

/** Cool land is expensive land. */
export function landMultiplier(coolScore) {
  return clamp(
    1 + LAND_PRICE_PER_POINT * coolScore,
    LAND_PRICE_RANGE[0],
    LAND_PRICE_RANGE[1],
  );
}

/** Fraction of electricity that survives the trip from the nearest plant. */
export function transmission(distance) {
  if (distance === Infinity) return 0;
  const far = Math.max(0, distance - FREE_RADIUS);
  return clamp(1 - LOSS_PER_TILE * far, MIN_EFFICIENCY, 1);
}

/** How fast a site sheds heat, per second, at 100% heat. */
export function coolingRate(coolScore, modelLevel) {
  const raw = Math.max(COOL_FLOOR, COOL_BASE + COOL_PER_POINT * coolScore);
  return raw * MODEL.tiers[modelLevel - 1].cool;
}

/**
 * Heat settles instead of climbing forever. It rises with work and falls in
 * proportion to how hot it already is. So the resting temperature is known
 * before you build, and the panel prints it. A site that rests at 100 or above
 * goes dark.
 */
export function restingHeat(dcLevel, coolScore, modelLevel, work = 1) {
  const gain = DC.levels[dcLevel - 1].heat * work;
  return (100 * gain) / coolingRate(coolScore, modelLevel);
}
