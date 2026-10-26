// Small read helpers over the game store and the engine state. The `select*` functions take the
// store and are safe in `useGame(select...)` (they return stored references, never new objects);
// helpers that build arrays take a GameState and belong in useMemo or useShallow.

import { rankCompanies, seasonOf } from '../engine'
import type { Company, GameState, RoundResult, RoundSummary } from '../engine'
import type { GameStore } from './game'

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const
export type SeasonName = (typeof SEASON_NAMES)[number]

// ---- store selectors (stable references) ----

export const selectState = (s: GameStore): GameState | null => s.state

export function selectMe(s: GameStore): Company | null {
  if (!s.state || !s.meId) return null
  return s.state.companies.find((c) => c.id === s.meId) ?? null
}

/** My result of the last resolved round, or null before round 1 resolves. */
export function selectLastResult(s: GameStore): RoundResult | null {
  const me = selectMe(s)
  return me && me.history.length > 0 ? me.history[me.history.length - 1] : null
}

export function selectLastSummary(s: GameStore): RoundSummary | null {
  const h = s.state?.history
  return h && h.length > 0 ? h[h.length - 1] : null
}

export const selectRound = (s: GameStore): number => s.state?.round ?? 1
export const selectRounds = (s: GameStore): number => s.state?.rounds ?? s.config.rounds
export const selectSeason = (s: GameStore): 0 | 1 | 2 | 3 => seasonOf(Math.min(s.state?.round ?? 1, s.state?.rounds ?? 40))

/** True when my company opens the phase below 0: the forced sale screen replaces the panels. */
export function selectLosingRound(s: GameStore): boolean {
  const me = selectMe(s)
  return !!me && !me.bankrupt && !s.state?.finished && me.treasury < 0
}

// ---- state helpers (build new values) ----

export function meOf(state: GameState, meId: string): Company {
  return state.companies.find((c) => c.id === meId) ?? state.companies[0]
}

export function rivalsOf(state: GameState, meId: string): Company[] {
  return state.companies.filter((c) => c.id !== meId)
}

/** 1-based share-price rank, as the ranking shows it ("#2 of 4"). */
export function rankOf(state: GameState, id: string): { rank: number; of: number } {
  const order = rankCompanies(state)
  return { rank: order.indexOf(id) + 1, of: order.length }
}

/** Price change of the last resolved round (0 before round 1 resolves). */
export function priceChange(company: Company): number {
  const last = company.history[company.history.length - 1]
  return last ? last.stock.priceAfter - last.stock.priceBefore : 0
}

/** The round number to show: the round being decided, capped at the last round once finished. */
export function displayRound(state: GameState): number {
  return Math.min(state.round, state.rounds)
}

export function seasonName(round: number): SeasonName {
  return SEASON_NAMES[seasonOf(round)]
}

export function companyColor(company: Company): string {
  return `var(--company-${company.color % 6})`
}

// ---- live-region sentences ----

const sign = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`

export function roundAnnouncement(state: GameState, meId: string): string {
  const me = meOf(state, meId)
  const r = displayRound(state)
  const head = `Round ${r} of ${state.rounds}, ${seasonName(r)}.`
  if (me.bankrupt) return `${head} Your company is bankrupt; the rivals play on.`
  if (me.treasury < 0) return `${head} Treasury is ${me.treasury.toFixed(2)}: sell buildings to get back to zero.`
  return `${head} Treasury ${me.treasury.toFixed(2)}, share price ${me.sharePrice.toFixed(2)}.`
}

export function resultAnnouncement(before: GameState, after: GameState, meId: string): string {
  const me = meOf(after, meId)
  const res = me.history[me.history.length - 1]
  const { rank, of } = rankOf(after, meId)
  if (!res) return `Round ${before.round} resolved.`
  return `Round ${res.round} resolved. Profit ${sign(res.profit)}, share price ${res.sharePrice.toFixed(2)} (${sign(res.stock.priceAfter - res.stock.priceBefore)}), rank ${rank} of ${of}.`
}
