// Finance panel (SPEC "Debt and shares"): the loan stepper with the risk view right under it, the
// current loans with early repayment and refinance, and issue / buy back as one toggle with its
// price impact. Treasury left after every draft action sits at the top. All changes go through the
// draft store helpers (undoable).

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { POOLS, riskView, sellValue } from '../../engine'
import type { Decision, Loan, PoolId } from '../../engine'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { Icon, Money, NumberTween, POOL_META, Panel, Segmented, Toggle, fmtMoney, fmtPct } from '../kit'
import { Note, TreasuryStrip, usePanelCtx } from './common'
import { PanelStepper } from './PanelStepper'

const LOAN_STEP = 5
const LOAN_BIG_STEP = 25

/** Debt cost as a share of revenue → a word, so the bar never relies on colour alone. */
function costLevel(c: number): { word: string; level: 'ok' | 'warn' | 'critical' } {
  if (c < 0.2) return { word: 'Low', level: 'ok' }
  if (c < 0.5) return { word: 'Moderate', level: 'warn' }
  return { word: 'High', level: 'critical' }
}

function Fact({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rv-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {sub ? <dd className="rv-sub">{sub}</dd> : null}
    </div>
  )
}

export default function FinancePanel() {
  const ctx = usePanelCtx()
  const d = useDraft((s) => s.decision)
  const setLoanTake = useDraft((s) => s.setLoanTake)
  const setRepay = useDraft((s) => s.setRepay)
  const toggleRefinance = useDraft((s) => s.toggleRefinance)
  const setShares = useDraft((s) => s.setShares)
  const { preview, risk } = useDerived()

  // The risk view without the new loan, to show what the loan changes.
  const state = ctx?.state
  const meId = ctx?.meId
  const config = ctx?.config
  const base = useMemo(() => {
    if (!state || !meId || !config) return null
    const without: Decision = { ...d, loans: { ...d.loans, take: 0 } }
    return riskView(state, meId, without, config)
  }, [state, meId, config, d])

  if (!ctx || !base) return null
  const { me, disabled } = ctx
  const cfg = ctx.config
  const round = ctx.state.round

  // ---- Loan ----
  const loanMax = Math.max(LOAN_BIG_STEP, Math.floor((3 * me.marketCap) / LOAN_STEP) * LOAN_STEP)
  const take = d.loans.take
  // Stability score explained in one line: revenue weights of last round × stability.
  const last = me.history.at(-1)
  const revTotal = last ? POOLS.reduce((s, p) => s + Math.max(0, last.revenueByPool[p]), 0) : 0
  const weights = POOLS.map((p) => ({ p, w: revTotal > 0 && last ? Math.max(0, last.revenueByPool[p]) / revTotal : 0 })).filter((x) => x.w > 0.005)
  const score = weights.reduce((s, x) => s + x.w * cfg.stability[x.p as PoolId], 0)
  const stressed = me.treasury < 0 || (last !== undefined && last.profit < 0)
  const mix = weights
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => `${POOL_META[x.p].short.toLowerCase()} ${fmtPct(x.w)}`)
    .join(', ')
  const rateLine =
    revTotal > 0
      ? `Stability ${score.toFixed(2)} from last round's revenue (${mix}): ${fmtPct(cfg.loan.baseRate)} − ${fmtPct(cfg.loan.stabilitySpread)} × ${score.toFixed(2)}${stressed ? ` + ${fmtPct(cfg.loan.stressAdd)} stress` : ''}.`
      : `No revenue yet, so the base rate of ${fmtPct(cfg.loan.baseRate)}${stressed ? ` + ${fmtPct(cfg.loan.stressAdd)} stress` : ''}. Stable clients (citizens, cloud) make debt cheaper.`

  const lvl = costLevel(risk.debtCostShare)
  const thisLoanInterest = (take * risk.annualRate) / 4
  const thisLoanDue = round + cfg.loan.termRounds - 1

  // ---- Current loans ----
  const forcedCash = d.forcedSales.reduce((s, id) => {
    const b = me.buildings.find((x) => x.id === id)
    return s + (b ? sellValue(b, cfg) : 0)
  }, 0)
  const cashForRepay = me.treasury + forcedCash
  const repaid = Object.values(d.loans.repay).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
  const loans = [...me.loans].sort((a, b) => a.dueRound - b.dueRound)

  // ---- Shares ----
  const maxShares = Math.floor(cfg.shares.maxChangePerRound * me.shares)
  const price = me.sharePrice
  const treasuryBeforeShares = cashForRepay - repaid + take
  const buybackCash = Math.max(0, Math.round((treasuryBeforeShares - preview.debt) * 100) / 100)
  const maxBuy = price > 0 ? Math.max(0, Math.min(maxShares, Math.floor(buybackCash / price + 1e-9), me.shares - 1)) : 0
  const mode = d.shares.mode
  const countMax = mode === 'buyback' ? maxBuy : maxShares
  const shareCash = Math.round(d.shares.count * price * 100) / 100
  const priceAfter = mode === 'none' || d.shares.count === 0 ? price : preview.sharePrice
  const onMode = (m: Decision['shares']['mode']) => {
    const cap = m === 'buyback' ? maxBuy : maxShares
    setShares(m, m === 'none' ? 0 : Math.min(cap, Math.max(1, d.shares.count || 1)))
  }

  return (
    <div className="panel-stack finance-panel">
      <TreasuryStrip
        extra={
          <span className="num">
            debt {fmtMoney(preview.debt)}
          </span>
        }
      />

      <Panel title="New loan" icon="coin" tone="money" data-tut="finance-loan">
        <div className="loan-stepper">
          <PanelStepper
            label="Borrow"
            value={take}
            onChange={(v) => setLoanTake(Math.round(v / LOAN_STEP) * LOAN_STEP)}
            min={0}
            max={loanMax}
            step={LOAN_STEP}
            bigStep={LOAN_BIG_STEP}
            disabled={disabled}
            hint={`Steps of ${LOAN_STEP} (Shift ${LOAN_BIG_STEP}), up to ${fmtMoney(loanMax, { decimals: 0 })}. Cash now; interest each round, principal after ${cfg.loan.termRounds} rounds.`}
          />
        </div>

        <div className="risk-view" aria-label="Risk view" role="group">
          <div className="rv-rate">
            <span className="rv-rate-value pixel num">
              <NumberTween value={risk.annualRate} format={(v) => fmtPct(v, { decimals: 1 })} />
              <span className="rv-unit"> a year</span>
            </span>
            <p className="rv-rate-why">{rateLine}</p>
          </div>

          <dl className="rv-facts">
            <Fact label="Est. revenue next round">
              <Money value={risk.estRevenue} tween />
            </Fact>
            <Fact label="Interest next round" sub={take > 0 ? <span className="num">incl. {fmtMoney(thisLoanInterest)} on this loan</span> : 'on current loans'}>
              <Money value={risk.interestNextRound} tween />
            </Fact>
          </dl>

          <div className="rv-cost">
            <div className="row-between">
              <span className="rv-cost-label">Debt cost / revenue</span>
              <span className={`rv-level rv-level-${lvl.level}`}>
                <Icon name={lvl.level === 'ok' ? 'ok' : lvl.level === 'warn' ? 'warn' : 'critical'} size={16} />
                <NumberTween value={risk.debtCostShare} format={(v) => fmtPct(v)} className="num" /> {lvl.word}
              </span>
            </div>
            <div
              className="rv-bar"
              role="meter"
              aria-label="Debt cost as a share of estimated revenue"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(risk.debtCostShare * 100)}
              aria-valuetext={`${fmtPct(risk.debtCostShare)}, ${lvl.word.toLowerCase()}`}
            >
              <span className="rv-bar-zone rv-zone-ok" style={{ width: '20%' }} />
              <span className="rv-bar-zone rv-zone-warn" style={{ width: '30%' }} />
              <span className="rv-bar-zone rv-zone-critical" style={{ width: '50%' }} />
              <span className={`rv-bar-fill rv-fill-${lvl.level}`} style={{ width: `${Math.min(100, risk.debtCostShare * 100)}%` }} />
              {base.debtCostShare !== risk.debtCostShare ? <span className="rv-bar-was" style={{ left: `${Math.min(100, base.debtCostShare * 100)}%` }} title="Without the new loan" /> : null}
            </div>
            <p className="rv-drag">
              Market cap drag{' '}
              <strong className="num">
                <NumberTween value={-risk.marketCapDrag} format={(v) => fmtMoney(v)} />
              </strong>
              {take > 0 && base.marketCapDrag !== risk.marketCapDrag ? <span className="muted num"> (was {fmtMoney(-base.marketCapDrag)})</span> : null}
              <span className="muted"> · interest + principal due next round, over revenue</span>
            </p>
          </div>

          <dl className="rv-facts">
            <Fact label="Next due" sub={risk.nextDue ? <span className="num">principal {fmtMoney(risk.nextDue.principal)}</span> : 'no loans'}>
              <span className="num">{risk.nextDue ? `Round ${risk.nextDue.round}` : '—'}</span>
            </Fact>
            <Fact label="This loan" sub={take > 0 ? <span className="num">{fmtMoney(take)} due round {thisLoanDue}</span> : 'set an amount above'}>
              <span className="num">{take > 0 ? `${fmtMoney(thisLoanInterest)}/round` : '—'}</span>
            </Fact>
          </dl>
        </div>
      </Panel>

      <Panel title="Your loans" icon="lock" aside={<span className="num muted">{loans.length === 0 ? 'none' : `${fmtMoney(loans.reduce((s, l) => s + l.principal, 0))} owed`}</span>}>
        {loans.length === 0 ? (
          <p className="muted">No loans yet. A loan you take shows up here from next round.</p>
        ) : (
          <ul className="plain-list loan-list">
            {loans.map((l: Loan) => {
              const due = l.dueRound === round
              const soon = !due && l.dueRound <= round + 2
              const others = repaid - (d.loans.repay[l.id] ?? 0)
              const max = Math.max(0, Math.min(l.principal, Math.floor((cashForRepay - others) * 100) / 100))
              const refi = d.loans.refinance.includes(l.id)
              return (
                <li key={l.id} className={`loan-item${due ? ' is-due' : ''}`}>
                  <div className="loan-top">
                    <strong className="pixel num loan-principal">{fmtMoney(l.principal)}</strong>
                    <span className="loan-meta num">
                      {fmtPct(l.annualRate, { decimals: 1 })} · {fmtMoney((l.principal * l.annualRate) / 4)}/round
                    </span>
                    {due ? (
                      <span className="tag tag-warn">
                        <Icon name="warn" size={16} className="inline-icon" /> due now
                      </span>
                    ) : (
                      <span className={`tag${soon ? ' tag-warn' : ' tag-plain'}`}>due R{l.dueRound}</span>
                    )}
                  </div>
                  <PanelStepper
                    label="Repay early"
                    value={d.loans.repay[l.id] ?? 0}
                    onChange={(v) => setRepay(l.id, Math.min(v, max))}
                    min={0}
                    max={Math.max(max, d.loans.repay[l.id] ?? 0)}
                    step={1}
                    disabled={disabled || max <= 0}
                    hint={max <= 0 ? 'No treasury to repay with.' : `Up to ${fmtMoney(max)}, no fee.`}
                  />
                  {due ? (
                    <Toggle
                      label="Refinance"
                      checked={refi}
                      onChange={() => toggleRefinance(l.id)}
                      disabled={disabled || me.treasury < 0}
                      description={
                        me.treasury < 0
                          ? 'Refused while the treasury is below 0.'
                          : `Roll ${fmtMoney(l.principal - (d.loans.repay[l.id] ?? 0))} into a new ${cfg.loan.termRounds}-round loan at ${fmtPct(risk.annualRate, { decimals: 1 })} instead of paying it this round.`
                      }
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Shares" icon="chart" aside={<span className="num muted">{me.shares} shares · {fmtMoney(price)}</span>}>
        <Segmented
          label="Issue or buy back (one per round)"
          value={mode}
          onChange={onMode}
          options={[
            { value: 'none', label: 'None' },
            { value: 'issue', label: 'Issue', icon: 'arrowDown', disabled: disabled || maxShares === 0 },
            { value: 'buyback', label: 'Buy back', icon: 'arrowUp', disabled: disabled || maxBuy === 0 },
          ]}
        />
        {mode === 'none' ? (
          <p className="field-desc">
            Issuing raises cash but lowers the price; buying back does the opposite. Up to {maxShares} shares a round.
            {maxBuy === 0 && maxShares > 0 ? ` Buy back needs treasury above debt (now ${fmtMoney(treasuryBeforeShares - preview.debt)}).` : ''}
          </p>
        ) : (
          <>
            <PanelStepper
              label={mode === 'issue' ? 'Shares to issue' : 'Shares to buy back'}
              value={d.shares.count}
              onChange={(v) => setShares(mode, Math.min(countMax, v))}
              min={0}
              max={Math.max(countMax, d.shares.count)}
              step={1}
              disabled={disabled}
              hint={mode === 'issue' ? `0 to ${maxShares} (20% of ${me.shares}).` : `0 to ${maxBuy}: at most 20% of shares, and cash at most treasury − debt = ${fmtMoney(buybackCash)}.`}
            />
            <div className="share-impact">
              <div className="share-price">
                <span className="muted">Price</span>
                <span className="num strong">{fmtMoney(price)}</span>
                <span className="share-arrow" aria-label="becomes">→</span>
                <NumberTween value={priceAfter} format={(v) => fmtMoney(v)} className={`num strong ${priceAfter > price ? 'delta-up' : priceAfter < price ? 'delta-down' : ''}`} />
                <span className="muted num">
                  ({fmtPct(price > 0 ? priceAfter / price - 1 : 0, { sign: true, decimals: 1 })})
                </span>
              </div>
              <div className="share-cash">
                <span className="muted">Cash</span>
                <NumberTween value={mode === 'issue' ? shareCash : -shareCash} format={(v) => fmtMoney(v, { sign: true })} className={`num strong ${mode === 'issue' ? 'delta-up' : 'delta-down'}`} />
                <span className="muted num">
                  {d.shares.count} × {fmtMoney(price)}
                </span>
              </div>
            </div>
            {mode === 'buyback' && maxBuy === 0 ? <Note level="warn">Buy back needs treasury above debt.</Note> : null}
          </>
        )}
      </Panel>
    </div>
  )
}
