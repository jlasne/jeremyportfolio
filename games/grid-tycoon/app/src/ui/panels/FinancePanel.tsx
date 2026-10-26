// PLACEHOLDER (UI shell track). The panels track replaces this file wholesale.
// Contract: default export, no props; rendered inside the dock's Sheet body.
// Stores: useDraft (decision.loans/shares, setLoanTake, setRepay, toggleRefinance, setShares),
// useDerived (preview.treasuryLeft/debt/sharePrice/shares, risk), useGame (state, meId, config).

import { companyById, totalDebt } from '../../engine'
import { useDerived } from '../../store/derived'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { Panel, Segmented, Stepper, fmtMoney, fmtPct } from '../kit'

export default function FinancePanel() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const disabled = useGame((s) => s.phase !== 'decide')
  const d = useDraft((s) => s.decision)
  const setLoanTake = useDraft((s) => s.setLoanTake)
  const setRepay = useDraft((s) => s.setRepay)
  const toggleRefinance = useDraft((s) => s.toggleRefinance)
  const setShares = useDraft((s) => s.setShares)
  const { preview, risk } = useDerived()
  if (!state || !meId) return null
  const me = companyById(state, meId)
  const maxShares = Math.floor(config.shares.maxChangePerRound * me.shares)
  const shareCash = d.shares.count * me.sharePrice

  return (
    <div className="panel-stack">
      <dl className="facts facts-3">
        <div>
          <dt>Treasury left</dt>
          <dd className="num money">{fmtMoney(preview.treasuryLeft)}</dd>
        </div>
        <div>
          <dt>Debt</dt>
          <dd className="num">{fmtMoney(preview.debt)}</dd>
        </div>
        <div>
          <dt>Loan rate</dt>
          <dd className="num">{fmtPct(risk.annualRate, { decimals: 1 })} / yr</dd>
        </div>
      </dl>

      <Panel title="New loan" icon="coin" tone="money">
        <Stepper label="Borrow" value={d.loans.take} onChange={setLoanTake} step={1} disabled={disabled} hint={`8 rounds. Interest each round, principal at the end.`} />
        <dl className="facts">
          <div>
            <dt>Est. revenue next round</dt>
            <dd className="num">{fmtMoney(risk.estRevenue)}</dd>
          </div>
          <div>
            <dt>Interest next round</dt>
            <dd className="num">{fmtMoney(risk.interestNextRound)}</dd>
          </div>
          <div>
            <dt>Debt cost / revenue</dt>
            <dd className="num">{fmtPct(risk.debtCostShare)}</dd>
          </div>
          <div>
            <dt>Market cap drag</dt>
            <dd className="num">{fmtMoney(risk.marketCapDrag)}</dd>
          </div>
          <div>
            <dt>Next due</dt>
            <dd className="num">{risk.nextDue ? `R${risk.nextDue.round}: ${fmtMoney(risk.nextDue.principal)}` : 'none'}</dd>
          </div>
        </dl>
      </Panel>

      {me.loans.length > 0 ? (
        <Panel title="Loans" icon="lock" aside={<span className="num muted">{fmtMoney(totalDebt(me))}</span>}>
          {me.loans.map((l) => {
            const due = l.dueRound === state.round
            return (
              <div key={l.id} className="loan-row">
                <p className="loan-head num">
                  <strong>{fmtMoney(l.principal)}</strong> at {fmtPct(l.annualRate, { decimals: 1 })}, due round {l.dueRound}
                  {due ? <span className="tag tag-warn">due now</span> : null}
                </p>
                <Stepper label="Repay early" value={d.loans.repay[l.id] ?? 0} onChange={(v) => setRepay(l.id, v)} max={l.principal} step={1} disabled={disabled} />
                {due ? (
                  <label className="check">
                    <input type="checkbox" checked={d.loans.refinance.includes(l.id)} onChange={() => toggleRefinance(l.id)} disabled={disabled} />
                    <span>Refinance into a new 8-round loan</span>
                  </label>
                ) : null}
              </div>
            )
          })}
        </Panel>
      ) : null}

      <Panel title="Shares" icon="chart" aside={<span className="num muted">{me.shares} shares at {fmtMoney(me.sharePrice)}</span>}>
        <Segmented
          label="Action"
          value={d.shares.mode}
          onChange={(m) => setShares(m, m === 'none' ? 0 : Math.max(1, Math.min(d.shares.count || 1, maxShares)))}
          options={[
            { value: 'none', label: 'None' },
            { value: 'issue', label: 'Issue', disabled: disabled || maxShares === 0 },
            { value: 'buyback', label: 'Buy back', disabled: disabled || maxShares === 0 },
          ]}
        />
        {d.shares.mode !== 'none' ? (
          <>
            <Stepper label="Shares" value={d.shares.count} onChange={(v) => setShares(d.shares.mode, v)} max={maxShares} step={1} disabled={disabled} hint={`At most ${maxShares} this round.`} />
            <p className="field-desc num">
              {d.shares.mode === 'issue' ? `+${fmtMoney(shareCash)} cash, price after ≈ ${fmtMoney(preview.sharePrice)}` : `−${fmtMoney(shareCash)} cash, price after ≈ ${fmtMoney(preview.sharePrice)}`}
            </p>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
