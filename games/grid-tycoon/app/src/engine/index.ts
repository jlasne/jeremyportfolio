// Public API of the engine. Every other part of the app (UI, bots, the
// multiplayer edge function, scripts) imports from here only.
//
// STUBS: the signatures below are the contract (see DESIGN.md). The engine
// track replaces each body with the real implementation, split into modules
// (rng.ts, demand.ts, allocation.ts, stock.ts, finance.ts, resolve.ts,
// validate.ts, bots.ts, projection.ts...), and keeps these exports unchanged.

import balance from '../../config/balance.json'
import type {
  BuildOrder,
  Building,
  Company,
  CompanyPreview,
  CompanySeed,
  ComputePool,
  Config,
  Decision,
  GameState,
  LinkUse,
  PoolId,
  PowerPool,
  Projection,
  RiskView,
  Tile,
  ValidationResult,
  Warning,
} from './types'

export * from './types'

export const defaultConfig: Config = balance

export const POOLS: PoolId[] = ['citizens', 'otherDc', 'cloud', 'btc', 'ai']
export const POWER_POOLS: PowerPool[] = ['citizens', 'otherDc']
export const COMPUTE_POOLS: ComputePool[] = ['cloud', 'btc', 'ai']

const todo = (name: string): never => {
  throw new Error(`engine: ${name} not implemented`)
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Standard normal (Box-Muller, two uniforms per draw). */
  normal(): number
  /** Current internal state, to store in GameState.rngState. */
  state(): number
}

/** mulberry32 seeded from a 32-bit seed, or resumed from a stored state. */
export function createRng(seedOrState: number): Rng {
  return todo('createRng') && (seedOrState as never)
}

/** A fresh game: every company gets the start kit, pools start at startPerCompany × companies. */
export function createGame(opts: { seed: number; companies: CompanySeed[] }, config: Config = defaultConfig): GameState {
  return todo('createGame') && (opts as never) && (config as never)
}

/** Solo: the player ('you') plus Volta Utility, Nimbus Compute and Hashfield Mining. */
export function createSoloGame(opts: { seed: number; playerName: string }, config: Config = defaultConfig): GameState {
  return todo('createSoloGame') && (opts as never) && (config as never)
}

/**
 * Resolve one round for everyone. Pure: returns a new state, never mutates the input.
 * Missing decisions use defaultDecision; bots without a decision use botDecision.
 * Every decision is sanitized first, so a bad decision never throws.
 */
export function resolveRound(state: GameState, decisions: Record<string, Decision>, config: Config = defaultConfig): GameState {
  return todo('resolveRound') && (state as never) && (decisions as never) && (config as never)
}

/** Strict check used by the UI before lock in and by the server before accepting a decision. */
export function validateDecision(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): ValidationResult {
  return todo('validateDecision') && (state as never) && (companyId as never) && (decision as never) && (config as never)
}

/** Clamp and drop whatever validateDecision would reject, so the result always validates. */
export function sanitizeDecision(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Decision {
  return todo('sanitizeDecision') && (state as never) && (companyId as never) && (decision as never) && (config as never)
}

/** All zeros, no builds, no finance. */
export function emptyDecision(): Decision {
  return todo('emptyDecision')
}

/**
 * Last round's allocations (power, compute, rent), no builds, no finance, sanitized to this round's
 * capacity. In a losing round it also picks the forced sales. Used for timer misses and as the
 * starting draft of every decision phase. Round 1: everything on the internal link, compute on AI.
 */
export function defaultDecision(state: GameState, companyId: string, config: Config = defaultConfig): Decision {
  return todo('defaultDecision') && (state as never) && (companyId as never) && (config as never)
}

/** The bot rules of SPEC.md for the company's bot style. Deterministic, uses no RNG, sees only public info. */
export function botDecision(state: GameState, companyId: string, config: Config = defaultConfig): Decision {
  return todo('botDecision') && (state as never) && (companyId as never) && (config as never)
}

/** The company once the draft's forced sales, finance and builds are applied (treasury left, capacities). */
export function previewCompany(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): CompanyPreview {
  return todo('previewCompany') && (state as never) && (companyId as never) && (decision as never) && (config as never)
}

/** Estimated next-round profit from the draft, using last round demand (the top bar's projection line). */
export function projectRound(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Projection {
  return todo('projectRound') && (state as never) && (companyId as never) && (decision as never) && (config as never)
}

/** Warning chips for the draft: idle above 20%, link short, rent over import link, loan due within 2 rounds... */
export function warnings(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Warning[] {
  return todo('warnings') && (state as never) && (companyId as never) && (decision as never) && (config as never)
}

/** Annual rate a new loan would get now: 12% - 8% × stability score (+4 points under stress). */
export function loanRate(state: GameState, companyId: string, config: Config = defaultConfig): number {
  return todo('loanRate') && (state as never) && (companyId as never) && (config as never)
}

/** The risk view shown under the loan stepper, for the draft's decision.loans.take. */
export function riskView(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): RiskView {
  return todo('riskView') && (state as never) && (companyId as never) && (decision as never) && (config as never)
}

export interface AllocationResult {
  reserved: Record<string, number>
  open: Record<string, number>
  used: Record<string, number>
  idle: Record<string, number>
}

/** The per-pool allocation algorithm of SPEC.md (80% incumbent rule). */
export function allocatePool(
  demand: number,
  offers: Record<string, number>,
  lastUsed: Record<string, number>,
  incumbentShare: number,
): AllocationResult {
  return todo('allocatePool') && (demand as never) && (offers as never) && (lastUsed as never) && (incumbentShare as never)
}

/** f(c) = (e^{kc} - 1) / (e^k - 1). */
export function debtDragFactor(c: number, k: number): number {
  return todo('debtDragFactor') && (c as never) && (k as never)
}

export interface StockReturnInput {
  revenue: number
  /** null on the first round: no revenue growth term. */
  prevRevenue: number | null
  /** Share of last round's revenue from each pool. */
  weights: Record<PoolId, number>
  growth: Record<PoolId, number>
  expected: Record<PoolId, number>
  /** 1 - used / online, 0 to 1. */
  idle: number
}

/** Step 1 of the stock price: r = 0.5 clamp(dRev) + sum w (g - E) - P_idle. */
export function stockReturn(
  input: StockReturnInput,
  config: Config = defaultConfig,
): { r: number; revenueGrowth: number; demandMiss: Record<PoolId, number>; idle: number } {
  return todo('stockReturn') && (input as never) && (config as never)
}

/** Online MW (upgrading buildings count at their current 2 MW) and carrying link MW (roundsLeft 0). */
export function capacity(company: Company): { plantMw: number; dcMw: number; links: Record<LinkUse, number> } {
  return todo('capacity') && (company as never)
}

/** First free lot, row by row, 4 per row. */
export function findFreeTile(company: Company, taken: Tile[] = [], config: Config = defaultConfig): Tile {
  return todo('findFreeTile') && (company as never) && (taken as never) && (config as never)
}

/** Lot rows to draw: at least plot.startRows, and always one free row under the last building. */
export function plotRows(company: Company, extra: Tile[] = [], config: Config = defaultConfig): number {
  return todo('plotRows') && (company as never) && (extra as never) && (config as never)
}

export function buildCost(order: BuildOrder, config: Config = defaultConfig): number {
  return todo('buildCost') && (order as never) && (config as never)
}

export function upgradeCost(building: Building, config: Config = defaultConfig): number {
  return todo('upgradeCost') && (building as never) && (config as never)
}

/** 30% of price paid, upgrades included. */
export function sellValue(building: Building, config: Config = defaultConfig): number {
  return todo('sellValue') && (building as never) && (config as never)
}

export function totalDebt(company: Company): number {
  return todo('totalDebt') && (company as never)
}

export function companyById(state: GameState, id: string): Company {
  return todo('companyById') && (state as never) && (id as never)
}

/** Last round's revenue split per building id (plants: power sales, datacenters: compute), for the coin effects. */
export function revenueByBuilding(state: GameState, companyId: string): Record<string, number> {
  return todo('revenueByBuilding') && (state as never) && (companyId as never)
}

/** Company ids by share price, highest first; bankrupt last. */
export function rankCompanies(state: GameState): string[] {
  return todo('rankCompanies') && (state as never)
}

/** Round 1 to 4 maps to spring, summer, autumn, winter, and so on. */
export function seasonOf(round: number): 0 | 1 | 2 | 3 {
  return todo('seasonOf') && (round as never)
}

/** Rounds money to 2 decimals, the way every resolution step does. */
export function round2(x: number): number {
  return todo('round2') && (x as never)
}
