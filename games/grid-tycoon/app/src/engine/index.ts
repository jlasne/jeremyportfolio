// Public API of the engine. Every other part of the app (UI, bots, the
// multiplayer edge function, scripts) imports from here only. The rules live in
// the modules next to this file; see DESIGN.md section 2 for the contract.

import * as allocation from './allocation'
import * as assets from './assets'
import * as bots from './bots'
import { defaultConfig as balanceConfig } from './config'
import * as create from './create'
import * as decision from './decision'
import * as defaults from './defaults'
import * as money from './money'
import * as projection from './projection'
import * as ranking from './ranking'
import * as resolve from './resolve'
import * as rng from './rng'
import * as sanitize from './sanitize'
import * as stock from './stock'
import * as validate from './validate'
import * as warn from './warnings'
import type {
  BuildOrder,
  Building,
  Company,
  CompanyPreview,
  CompanySeed,
  Config,
  Decision,
  GameState,
  LinkUse,
  PoolId,
  Projection,
  RiskView,
  Tile,
  ValidationResult,
  Warning,
} from './types'

export * from './types'
export { POOLS, POWER_POOLS, COMPUTE_POOLS } from './constants'
export type { Rng } from './rng'
export type { AllocationResult } from './allocation'
export type { StockReturnInput } from './stock'
export { BOT_NAMES } from './create'

export const defaultConfig: Config = balanceConfig

/** mulberry32 seeded from a 32-bit seed, or resumed from a stored state. */
export function createRng(seedOrState: number): rng.Rng {
  return rng.createRng(seedOrState)
}

/** A fresh game: every company gets the start kit, pools start at startPerCompany × companies. */
export function createGame(opts: { seed: number; companies: CompanySeed[] }, config: Config = defaultConfig): GameState {
  return create.createGame(opts, config)
}

/** Solo: the player ('you') plus Volta Utility, Nimbus Compute and Hashfield Mining. */
export function createSoloGame(opts: { seed: number; playerName: string }, config: Config = defaultConfig): GameState {
  return create.createSoloGame(opts, config)
}

/**
 * Resolve one round for everyone. Pure: returns a new state, never mutates the input.
 * Missing decisions use defaultDecision; bots without a decision use botDecision.
 * Every decision is sanitized first, so a bad decision never throws.
 */
export function resolveRound(state: GameState, decisions: Record<string, Decision>, config: Config = defaultConfig): GameState {
  return resolve.resolveRound(state, decisions, config)
}

/** Strict check used by the UI before lock in and by the server before accepting a decision. */
export function validateDecision(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): ValidationResult {
  return validate.validateDecision(state, companyId, decision, config)
}

/** Clamp and drop whatever validateDecision would reject, so the result always validates. */
export function sanitizeDecision(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Decision {
  return sanitize.sanitizeDecision(state, companyId, decision, config)
}

/** All zeros, no builds, no finance. */
export function emptyDecision(): Decision {
  return decision.emptyDecision()
}

/**
 * Last round's allocations (power, compute, rent), no builds, no finance, sanitized to this round's
 * capacity. In a losing round it also picks the forced sales. Used for timer misses and as the
 * starting draft of every decision phase. Round 1: everything on the internal link, compute on AI.
 */
export function defaultDecision(state: GameState, companyId: string, config: Config = defaultConfig): Decision {
  return defaults.defaultDecision(state, companyId, config)
}

/** The bot rules of SPEC.md for the company's bot style. Deterministic, uses no RNG, sees only public info. */
export function botDecision(state: GameState, companyId: string, config: Config = defaultConfig): Decision {
  return bots.botDecision(state, companyId, config)
}

/** The company once the draft's forced sales, finance and builds are applied (treasury left, capacities). */
export function previewCompany(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): CompanyPreview {
  return projection.previewCompany(state, companyId, decision, config)
}

/** Estimated next-round profit from the draft, using last round demand (the top bar's projection line). */
export function projectRound(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Projection {
  return projection.projectRound(state, companyId, decision, config)
}

/** Warning chips for the draft: idle above 20%, link short, rent over import link, loan due within 2 rounds... */
export function warnings(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): Warning[] {
  return warn.warnings(state, companyId, decision, config)
}

/** Annual rate a new loan would get now: 12% - 8% × stability score (+4 points under stress). */
export function loanRate(state: GameState, companyId: string, config: Config = defaultConfig): number {
  return projection.loanRate(state, companyId, config)
}

/** The risk view shown under the loan stepper, for the draft's decision.loans.take. */
export function riskView(state: GameState, companyId: string, decision: Decision, config: Config = defaultConfig): RiskView {
  return projection.riskView(state, companyId, decision, config)
}

/** The per-pool allocation algorithm of SPEC.md (80% incumbent rule). */
export function allocatePool(
  demand: number,
  offers: Record<string, number>,
  lastUsed: Record<string, number>,
  incumbentShare: number,
): allocation.AllocationResult {
  return allocation.allocatePool(demand, offers, lastUsed, incumbentShare)
}

/** f(c) = (e^{kc} - 1) / (e^k - 1). */
export function debtDragFactor(c: number, k: number): number {
  return stock.debtDragFactor(c, k)
}

/** Step 1 of the stock price: r = 0.5 clamp(dRev) + sum w (g - E) - P_idle. */
export function stockReturn(
  input: stock.StockReturnInput,
  config: Config = defaultConfig,
): { r: number; revenueGrowth: number; demandMiss: Record<PoolId, number>; idle: number } {
  return stock.stockReturn(input, config)
}

/** Online MW (upgrading buildings count at their current 2 MW) and carrying link MW (roundsLeft 0). */
export function capacity(company: Company): { plantMw: number; dcMw: number; links: Record<LinkUse, number> } {
  return assets.capacity(company)
}

/** First free lot, row by row, 4 per row. */
export function findFreeTile(company: Company, taken: Tile[] = [], config: Config = defaultConfig): Tile {
  return assets.findFreeTile(company, taken, config)
}

/** Lot rows to draw: at least plot.startRows, and always one free row under the last building. */
export function plotRows(company: Company, extra: Tile[] = [], config: Config = defaultConfig): number {
  return assets.plotRows(company, extra, config)
}

export function buildCost(order: BuildOrder, config: Config = defaultConfig): number {
  return assets.buildCost(order, config)
}

export function upgradeCost(building: Building, config: Config = defaultConfig): number {
  return assets.upgradeCost(building, config)
}

/** 30% of price paid, upgrades included. */
export function sellValue(building: Building, config: Config = defaultConfig): number {
  return assets.sellValue(building, config)
}

export function totalDebt(company: Company): number {
  return assets.totalDebt(company)
}

export function companyById(state: GameState, id: string): Company {
  return assets.companyById(state, id)
}

/** Last round's revenue split per building id (plants: power sales, datacenters: compute), for the coin effects. */
export function revenueByBuilding(state: GameState, companyId: string): Record<string, number> {
  return projection.revenueByBuilding(state, companyId)
}

/** Company ids by share price, highest first; bankrupt last. */
export function rankCompanies(state: GameState): string[] {
  return ranking.rankCompanies(state)
}

/** Round 1 to 4 maps to spring, summer, autumn, winter, and so on. */
export function seasonOf(round: number): 0 | 1 | 2 | 3 {
  return ranking.seasonOf(round)
}

/** Rounds money to 2 decimals, the way every resolution step does. */
export function round2(x: number): number {
  return money.round2(x)
}
