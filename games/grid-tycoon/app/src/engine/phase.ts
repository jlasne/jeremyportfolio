// Decision-phase effects (DESIGN 2.2), applied to a mutable copy of one company.
// Resolution feeds sanitized decisions; the preview feeds raw drafts, so every step
// skips what it cannot apply instead of throwing, and never clamps to the treasury.

import { buildCost, isBuildingOrder, placeOrders, sellValue, takenTiles, upgradeCost } from './assets'
import { buildingSpec, upgradeSpec } from './config'
import { finite, round2 } from './money'
import type { Building, Company, Config, Decision, Loan, RoundResult } from './types'

export interface PhaseContext {
  round: number
  config: Config
  /** Annual rate a new loan (or a refinance) gets this round, fixed before the phase. */
  loanRate: number
  nextId: (prefix: 'b' | 'l' | 'n') => string
}

export interface PhaseOutcome {
  finance: RoundResult['finance']
  /** Loans due this round whose principal rolls into a new loan at step 7. */
  refinance: string[]
  /** Treasury at the start of the phase (the losing round test). */
  startTreasury: number
  /** Cash from the uncapped share issue of a losing round with nothing left to sell (RoundResult keeps only the count). */
  forcedIssueCash: number
}

/** What the share actions of a decision phase read and change. */
export type ShareBook = Pick<Company, 'marketCap' | 'shares' | 'sharePrice'>

/** Current price per share: the stored price, or the exact ratio if rounding took it to 0. */
export function currentPrice(book: ShareBook): number {
  if (book.sharePrice > 0) return book.sharePrice
  return book.shares > 0 ? book.marketCap / book.shares : 0
}

/** Shares change, market cap stays, so the price moves (DESIGN 2.2.5). */
export function withShares(book: ShareBook, shares: number): ShareBook {
  return { marketCap: book.marketCap, shares, sharePrice: round2(book.marketCap / shares) }
}

/**
 * Losing round with nothing left to sell: shares issued at the current price until the treasury is
 * back to 0, with no cap (DESIGN 2.2.1). Later share actions of the phase see the diluted book.
 * Shared by the phase, validation and sanitize so all three price the rest of the phase alike.
 */
export function forcedIssue(book: ShareBook, treasury: number): { count: number; cash: number; book: ShareBook } | null {
  const price = currentPrice(book)
  if (treasury >= 0 || price <= 0) return null
  const count = Math.ceil(-treasury / price)
  return { count, cash: round2(count * price), book: withShares(book, book.shares + count) }
}

function emptyFinance(): RoundResult['finance'] {
  return {
    forcedSaleCash: 0,
    forcedSold: [],
    forcedSharesIssued: 0,
    loanTaken: 0,
    repaid: 0,
    sharesIssued: 0,
    sharesBought: 0,
    shareCash: 0,
    buildSpend: 0,
  }
}

function setShares(company: Company, shares: number): void {
  const book = withShares(company, shares)
  company.shares = book.shares
  company.sharePrice = book.sharePrice
}

/** Returns the cash of the forced share issue, 0 when there is none. */
function applyForcedSales(company: Company, ids: string[], config: Config, finance: RoundResult['finance']): number {
  if (company.treasury >= 0) return 0
  for (const id of ids) {
    const i = company.buildings.findIndex((b) => b.id === id)
    if (i < 0) continue
    const cash = sellValue(company.buildings[i], config)
    company.buildings.splice(i, 1)
    company.treasury = round2(company.treasury + cash)
    finance.forcedSaleCash = round2(finance.forcedSaleCash + cash)
    finance.forcedSold.push(id)
  }
  if (company.buildings.length === 0) {
    const issue = forcedIssue(company, company.treasury)
    if (!issue) return 0
    setShares(company, issue.book.shares)
    company.treasury = round2(company.treasury + issue.cash)
    finance.forcedSharesIssued = issue.count
    return issue.cash
  }
  return 0
}

export function applyPhase(company: Company, decision: Decision, ctx: PhaseContext): PhaseOutcome {
  const { config, round } = ctx
  const finance = emptyFinance()
  const startTreasury = company.treasury

  // 1. Forced sales (losing round only).
  const forcedIssueCash = applyForcedSales(company, decision.forcedSales, config, finance)

  // 2. Early repayments, in loan order so the result never depends on object key order.
  for (const loan of [...company.loans]) {
    const amount = round2(Math.min(Math.max(0, finite(decision.loans.repay[loan.id])), loan.principal))
    if (amount <= 0) continue
    loan.principal = round2(loan.principal - amount)
    company.treasury = round2(company.treasury - amount)
    finance.repaid = round2(finance.repaid + amount)
  }
  company.loans = company.loans.filter((l) => l.principal > 0)

  // 3. Refinance: only loans due now, only with a non-negative treasury at the start of the phase.
  const refinance =
    startTreasury < 0
      ? []
      : [...new Set(decision.loans.refinance)].filter((id) => company.loans.some((l) => l.id === id && l.dueRound === round))

  // 4. New loan.
  const take = round2(Math.max(0, finite(decision.loans.take)))
  if (take > 0) {
    const loan: Loan = {
      id: ctx.nextId('n'),
      principal: take,
      annualRate: ctx.loanRate,
      dueRound: round + config.loan.termRounds - 1,
      takenRound: round,
    }
    company.loans.push(loan)
    company.treasury = round2(company.treasury + take)
    finance.loanTaken = take
  }

  // 5. Shares, at the current price. Market cap and business value do not move.
  const count = Math.floor(Math.max(0, finite(decision.shares.count)))
  const price = currentPrice(company)
  if (count > 0 && price > 0 && decision.shares.mode === 'issue') {
    const cash = round2(count * price)
    setShares(company, company.shares + count)
    company.treasury = round2(company.treasury + cash)
    finance.sharesIssued = count
    finance.shareCash = cash
  } else if (count > 0 && price > 0 && decision.shares.mode === 'buyback' && count < company.shares) {
    const cash = round2(count * price)
    setShares(company, company.shares - count)
    company.treasury = round2(company.treasury - cash)
    finance.sharesBought = count
    finance.shareCash = -cash
  }

  // 6. Upgrades, then builds.
  const upgraded = new Set<string>()
  for (const id of decision.upgrades) {
    const b = company.buildings.find((x) => x.id === id)
    if (!b || upgraded.has(id) || b.size !== 'small' || b.status !== 'online') continue
    upgraded.add(id)
    const cost = upgradeCost(b, config)
    b.status = 'upgrading'
    b.roundsLeft = upgradeSpec(config, b.kind).rounds
    b.pricePaid = round2(b.pricePaid + cost)
    company.treasury = round2(company.treasury - cost)
    finance.buildSpend = round2(finance.buildSpend + cost)
  }

  const tiles = placeOrders(takenTiles(company), decision.builds.filter(isBuildingOrder).map((o) => o.tile), config)
  let nextTile = 0
  for (const order of decision.builds) {
    if (order.kind === 'link') {
      const mw = Math.floor(finite(order.mw))
      if (mw < 1 || (order.use !== 'internal' && order.use !== 'town' && order.use !== 'import')) continue
      const cost = buildCost({ kind: 'link', mw }, config)
      company.links.push({ id: ctx.nextId('l'), use: order.use, mw, roundsLeft: config.link.rounds })
      company.treasury = round2(company.treasury - cost)
      finance.buildSpend = round2(finance.buildSpend + cost)
      continue
    }
    if (!isBuildingOrder(order)) continue
    const tile = tiles[nextTile++]
    const spec = buildingSpec(config, order.kind, order.size)
    const building: Building = {
      id: ctx.nextId('b'),
      kind: order.kind,
      size: order.size,
      mw: 0,
      status: 'building',
      roundsLeft: spec.rounds,
      pricePaid: spec.cost,
      tile,
      builtRound: round,
    }
    company.buildings.push(building)
    company.treasury = round2(company.treasury - spec.cost)
    finance.buildSpend = round2(finance.buildSpend + spec.cost)
  }

  return { finance, refinance, startTreasury, forcedIssueCash }
}
