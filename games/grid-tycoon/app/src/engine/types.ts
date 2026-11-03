// The engine's data model. Pure data: no functions, no classes, so a state can
// be saved to local storage, sent over the wire and compared with deep equal.
// SPEC.md gives the core model; DESIGN.md explains every field added here.

import type balance from '../../config/balance.json'

export type Config = typeof balance

export type PoolId = 'citizens' | 'otherDc' | 'cloud' | 'btc' | 'ai'
export type PowerPool = 'citizens' | 'otherDc'
export type ComputePool = 'cloud' | 'btc' | 'ai'
export type BotStyle = 'volta' | 'nimbus' | 'hashfield'
export type BuildingKind = 'plant' | 'dc'
/** Level 1, 2 and 3. Only small and big can be ordered; mega is reached by upgrading a big building. */
export type Size = 'small' | 'big' | 'mega'
/** Sizes a build order can name. */
export type BuildSize = 'small' | 'big'
export type LinkUse = 'internal' | 'town' | 'import'
/** A lot on the company plot: [column, row]. 4 columns per row, rows up to the company's owned land rows. */
export type Tile = [number, number]

export interface GameState {
  version: 2
  seed: number
  /** The round being decided, 1 to `rounds`. After the last round resolves it is `rounds + 1`. */
  round: number
  rounds: number
  finished: boolean
  /** mulberry32 state. All randomness comes from here, in a fixed order. */
  rngState: number
  /** Counter for deterministic ids (b1, l2, n3...). */
  nextId: number
  pools: Record<PoolId, Pool>
  companies: Company[]
  /** One entry per resolved round, oldest first. */
  history: RoundSummary[]
}

export interface Pool {
  /** Demand of the last resolved round (the start demand before round 1). For otherDc: background demand only, rent excluded. */
  demand: number
  /** g of the last resolved round (the mean before round 1). */
  growth: number
  /** E of the last resolved round (the mean before round 1). Hidden before deciding, shown after. */
  expectedGrowth: number
  /** Used MW per company id in the last resolved round. Bankrupt companies are removed. */
  lastUsed: Record<string, number>
  /** Consecutive rounds each company has served this pool (used above 0). Gives priority on open MW. */
  tenure: Record<string, number>
}

export interface Company {
  id: string
  name: string
  isBot: boolean
  bot: BotStyle | null
  bankrupt: boolean
  /** Index into the company colour list, for charts and rankings. */
  color: number
  treasury: number
  shares: number
  businessValue: number
  marketCap: number
  /** marketCap / shares, rounded to 2 decimals. */
  sharePrice: number
  buildings: Building[]
  links: Link[]
  loans: Loan[]
  /** Lot rows the company owns (plot.lotsPerRow lots each). Builds only go on owned rows. */
  landRows: number
  /** One RoundResult per resolved round, oldest first. */
  history: RoundResult[]
  /** The decision resolved last round, sanitized. Repeated (allocations only) when a player misses the timer. */
  lastDecision: Decision | null
}

export interface Building {
  id: string
  kind: BuildingKind
  size: Size
  /** MW it delivers now: 0 while building, the current level's MW while upgrading, then the new level's. */
  mw: number
  status: 'building' | 'online' | 'upgrading'
  /** Rounds until it is online (building) or one level up (upgrading). 0 when online. */
  roundsLeft: number
  /** Everything paid for it, upgrades included. Maintenance and sell-back are shares of this. */
  pricePaid: number
  tile: Tile
  /** Round the order was placed (0 for the starting buildings). */
  builtRound: number
}

export interface Link {
  id: string
  use: LinkUse
  mw: number
  /** 1 on the round it is bought, 0 from the next round on. Only links at 0 carry MW. */
  roundsLeft: number
}

export interface Loan {
  id: string
  principal: number
  annualRate: number
  /** The round whose resolution pays the principal back. Interest is paid every round up to and including it. */
  dueRound: number
  takenRound: number
}

export interface BuildOrder {
  kind: 'plant' | 'dc' | 'link'
  size?: BuildSize
  use?: LinkUse
  mw?: number
  tile?: Tile
}

export interface Decision {
  builds: BuildOrder[]
  /** Ids of online buildings to upgrade one level (small to big, big to mega). */
  upgrades: string[]
  /** Land rows to buy this round. Each one costs more than the last; usable for builds at once. */
  landRows: number
  /** Plant MW: to own datacenters (internal link), to citizens (town link), offered to the other datacenters pool. */
  power: { internal: number; town: number; otherDc: number }
  /** Datacenter MW offered to each compute pool. */
  compute: { cloud: number; btc: number; ai: number }
  /** MW rented into own datacenters through the import link. Paid whether used or not. */
  rentMw: number
  loans: { take: number; repay: Record<string, number>; refinance: string[] }
  shares: { mode: 'none' | 'issue' | 'buyback'; count: number }
  /** Building ids sold in a losing round. Only allowed when treasury is below 0. */
  forcedSales: string[]
}

export interface ValidationIssue {
  code: ValidationCode
  message: string
  /** Dotted path into Decision, e.g. 'power.town' or 'builds.2'. */
  field?: string
}

export type ValidationCode =
  | 'bankrupt'
  | 'finished'
  | 'negative'
  | 'not_integer'
  | 'issue_and_buyback'
  | 'shares_over_cap'
  | 'buyback_over_cash'
  | 'repay_unknown_loan'
  | 'repay_over_principal'
  | 'refinance_negative_treasury'
  | 'refinance_not_due'
  | 'forced_sale_not_allowed'
  | 'forced_sale_unknown'
  | 'forced_sale_short'
  | 'build_invalid'
  | 'tile_taken'
  | 'tile_out_of_plot'
  | 'upgrade_invalid'
  | 'over_treasury'
  | 'no_town_link'
  | 'over_town_link'
  | 'over_internal_link'
  | 'over_import_link'
  | 'over_plant_capacity'
  | 'over_compute_capacity'
  | 'compute_below_commitment'
  | 'rent_below_commitment'
  | 'no_land'

export interface ValidationResult {
  ok: boolean
  errors: ValidationIssue[]
}

export type WarningCode =
  | 'idle_high'
  | 'link_short'
  | 'rent_over_import'
  | 'loan_due_soon'
  | 'treasury_negative'
  | 'compute_unpowered'
  | 'no_town_link'
  | 'power_unallocated'

export interface Warning {
  code: WarningCode
  level: 'info' | 'warn' | 'critical'
  /** Short chip text, e.g. "Idle 34%". */
  label: string
  /** One sentence for the chip's tooltip / expanded view. */
  detail: string
}

export interface StockBreakdown {
  priceBefore: number
  priceAfter: number
  /** The return r and its parts, as fractions (0.05 = 5%). */
  r: number
  rParts: { revenueGrowth: number; demandMiss: Record<PoolId, number>; idle: number; stability: number }
  /** The price move split into signed parts, in price units. They add up to priceAfter - priceBefore (within rounding). */
  parts: {
    revenueGrowth: number
    demandMiss: Record<PoolId, number>
    idle: number
    /** Premium for revenue from stable clients (citizens, cloud). */
    stability: number
    fundamentals: number
    debtDrag: number
    shares: number
  }
  fv: number
  bvBefore: number
  bv: number
  /** c and f(c) of the debt drag, and debt × f(c) in money. */
  c: number
  fc: number
  debt: number
  debtDragMoney: number
  marketCap: number
}

export interface Costs {
  power: number
  rent: number
  maintenance: number
  interest: number
  /** Penalty on plant MW left unallocated: unallocatedPenalty × own power cost per MW. */
  unallocated: number
}

export interface RoundResult {
  round: number
  offered: Record<PoolId, number>
  used: Record<PoolId, number>
  revenueByPool: Record<PoolId, number>
  revenue: number
  costs: Costs
  profit: number
  /** Principal paid at its due round (not refinanced). */
  principalRepaid: number
  /** Principal rolled into a new loan at its due round. */
  refinanced: number
  rent: { requested: number; fromRivals: number; fromMarket: number }
  /** Online capacity this round, and what of it was used. Plant used = own power used, sold or consumed. */
  plantMw: number
  dcMw: number
  plantUsed: number
  dcUsed: number
  /** 1 - used / online, plants and datacenters together, 0 to 1. */
  idle: number
  /** Plant MW not routed anywhere (not sold, not consumed by own datacenters' offers). */
  unallocatedMw: number
  /** Land rows owned this round. */
  landRows: number
  /** Decision-phase cash moves, as applied. */
  finance: {
    forcedSaleCash: number
    forcedSold: string[]
    forcedSharesIssued: number
    loanTaken: number
    repaid: number
    sharesIssued: number
    sharesBought: number
    shareCash: number
    buildSpend: number
    landSpend: number
    landBought: number
  }
  treasury: number
  stock: StockBreakdown
  sharePrice: number
  marketCap: number
  businessValue: number
  shares: number
  /** 1 = highest share price. */
  rank: number
  /** Building and link ids that finished at the end of this round (online from next round). */
  completed: string[]
  /** True if the company went bankrupt this round. */
  bankrupt: boolean
}

export interface PoolSummary {
  /** Demand this round. For otherDc this includes every player's rent request. */
  demand: number
  rentDemand: number
  growth: number
  expectedGrowth: number
  /** Total used MW across companies. */
  used: number
  /** Company ids with used MW above 0, most used first. */
  ranking: string[]
  /** Offered and used MW per company id this round (public: the market terminal shows them). */
  offered: Record<string, number>
  usedBy: Record<string, number>
}

export interface RoundSummary {
  round: number
  pools: Record<PoolId, PoolSummary>
  /** Share price per company id after the round. */
  prices: Record<string, number>
  /** Company ids by share price, highest first; bankrupt companies last. */
  ranking: string[]
}

/** What the decision panels need about a company once the draft's finance and builds are applied. */
export interface CompanyPreview {
  treasuryLeft: number
  plantMw: number
  dcMw: number
  links: Record<LinkUse, number>
  /** MW that will be allocatable once pending builds finish, for display only. */
  pendingPlantMw: number
  pendingDcMw: number
  pendingLinks: Record<LinkUse, number>
  debt: number
  sharePrice: number
  shares: number
  buildSpend: number
  financeCash: number
  landRows: number
  /** Price of the next land row. */
  nextRowCost: number
  freeLots: number
}

export interface Projection {
  revenueByPool: Record<PoolId, number>
  usedByPool: Record<PoolId, number>
  revenue: number
  costs: Costs
  profit: number
  idle: number
  unallocatedMw: number
  /** Margin per MW of each allocation segment on own power (for the allocate panel). */
  marginPerMw: Record<PoolId, number>
}

export interface RiskView {
  annualRate: number
  estRevenue: number
  interestNextRound: number
  /** Interest + principal due next round, over estimated revenue (0..1, capped at 1). */
  debtCostShare: number
  /** debt × f(c), in money, with the new loan. */
  marketCapDrag: number
  nextDue: { round: number; principal: number } | null
}

export interface CompanySeed {
  id: string
  name: string
  isBot: boolean
  bot?: BotStyle | null
}
