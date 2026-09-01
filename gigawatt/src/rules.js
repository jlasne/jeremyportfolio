/**
 * Gigawatt — the rulebook.
 *
 * Every number the game runs on lives in this file, and nothing in here knows
 * that a screen exists. The chain is:
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
 * or beside it. Water and rock carry heat away; sand throws it back.
 */
export const TILE_INFO = {
  [TILE.WATER]:    { name: 'Water',    cool:  2.0, buildable: false },
  [TILE.GRASS]:    { name: 'Grass',    cool:  0.0, buildable: true  },
  [TILE.FOREST]:   { name: 'Forest',   cool:  0.5, buildable: false },
  [TILE.MOUNTAIN]: { name: 'Mountain', cool:  1.5, buildable: false },
  [TILE.DESERT]:   { name: 'Desert',   cool: -1.0, buildable: true  },
};

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export const KIND = { PLANT: 'plant', DC: 'dc' };

/**
 * Five levels each. Output roughly triples per level, consumption roughly
 * doubles, so upgrading is always the better deal per tile — which is what
 * makes a full island a puzzle instead of a dead end.
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
 * The player owns exactly one model and upgrades it through five tiers.
 * `cap` is how many tokens per second it can actually digest — tokens beyond
 * it are dropped, which is the signal to upgrade. `cool` is a global cooling
 * bonus: better models schedule work better, and that is the "help" that lets
 * top-tier datacenters live somewhere other than a lake.
 */
export const MODEL = {
  name: 'AI model',
  tiers: [
    { label: 'Ember 0.5',     cap:    6, rate: 1.50, cool: 1.00, cost:     0 },
    { label: 'Ember 1',       cap:   26, rate: 1.85, cool: 1.15, cost:   120 },
    { label: 'Ember 2',       cap:  110, rate: 2.30, cool: 1.35, cost:  1300 },
    { label: 'Ember 3',       cap:  460, rate: 2.85, cool: 1.60, cost:  7000 },
    { label: 'Ember 4 Ultra', cap: 1150, rate: 3.60, cool: 1.90, cost: 40000 },
  ],
};

// ---------------------------------------------------------------------------
// The two land rules
// ---------------------------------------------------------------------------

/** Electricity is free to move this far. */
export const FREE_RADIUS = 2;
/** …and costs this fraction of itself for every tile beyond that. */
export const LOSS_PER_TILE = 0.07;
export const MIN_EFFICIENCY = 0.35;

/** Heat radiated per second at full heat, as a function of cooling score. */
export const COOL_BASE = 4.0;
export const COOL_PER_POINT = 0.42;
export const COOL_FLOOR = 0.8;

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

export const spec = (kind) => (kind === KIND.PLANT ? PLANT : DC);

/** What the nth building of a kind costs, before the land multiplier. */
export function buildCost(kind, owned) {
  const s = spec(kind);
  return Math.round(s.baseCost * Math.pow(s.costGrowth, owned));
}

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
 * Heat settles rather than climbs forever: it rises with work and falls in
 * proportion to how hot it already is. The resting temperature is therefore
 * knowable in advance, and the interface shows it before you build. Anything
 * that rests at or above 100 will go dark.
 */
export function restingHeat(dcLevel, coolScore, modelLevel, work = 1) {
  const gain = DC.levels[dcLevel - 1].heat * work;
  return (100 * gain) / coolingRate(coolScore, modelLevel);
}
