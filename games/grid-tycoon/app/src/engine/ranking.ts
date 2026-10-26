import type { GameState } from './types'

/** Company ids by share price, highest first; bankrupt last. Ties keep company order. */
export function rankCompanies(state: GameState): string[] {
  return state.companies
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(a.c.bankrupt) - Number(b.c.bankrupt) || b.c.sharePrice - a.c.sharePrice || a.i - b.i)
    .map((x) => x.c.id)
}

const SEASONS = 4

/** Round 1 to 4 maps to spring, summer, autumn, winter, and so on. */
export function seasonOf(round: number): 0 | 1 | 2 | 3 {
  const r = Math.floor(round) - 1
  return (((r % SEASONS) + SEASONS) % SEASONS) as 0 | 1 | 2 | 3
}
