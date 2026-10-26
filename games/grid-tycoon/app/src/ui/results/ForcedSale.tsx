// PLACEHOLDER (UI shell track). The results track replaces this file wholesale.
// Contract: default export, no props; the dock renders it inside a locked Sheet instead of the
// panels while my treasury opens the phase below 0 (selectLosingRound) and the sale is not
// confirmed. Stores: useDraft (decision.forcedSales, toggleForcedSale; defaultDecision pre-picks
// the cheapest sales), useGame (state, meId, config), useUi (confirmForcedSale(true) brings the
// regular panels back; the sales stay in the draft and resolve at lock in).

import { companyById, sellValue } from '../../engine'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Button, KIND_META, fmtMoney } from '../kit'

export default function ForcedSale() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const sales = useDraft((s) => s.decision.forcedSales)
  const toggle = useDraft((s) => s.toggleForcedSale)
  const confirm = useUi((s) => s.confirmForcedSale)
  if (!state || !meId) return null
  const me = companyById(state, meId)
  const cash = me.buildings.filter((b) => sales.includes(b.id)).reduce((s, b) => s + sellValue(b, config), 0)
  const after = me.treasury + cash
  const allSold = me.buildings.every((b) => sales.includes(b.id))
  const ok = after >= 0 || allSold

  return (
    <div className="panel-stack">
      <p className="panel-lead">
        Treasury is <strong className="num is-negative">{fmtMoney(me.treasury)}</strong>. Sell buildings for {Math.round(config.sellBackRate * 100)}% of their price paid until it is back to 0 or above.
      </p>
      <ul className="plain-list">
        {me.buildings.map((b) => (
          <li key={b.id}>
            <label className="check row-between">
              <span>
                <input type="checkbox" checked={sales.includes(b.id)} onChange={() => toggle(b.id)} /> {b.size === 'big' ? 'Big' : 'Small'} {KIND_META[b.kind].label.toLowerCase()}{' '}
                <span className="muted">({b.status})</span>
              </span>
              <span className="num">+{fmtMoney(sellValue(b, config))}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="row-between strong">
        <span>Treasury after sales</span>
        <span className={`num${after < 0 ? ' is-negative' : ' money'}`}>{fmtMoney(after)}</span>
      </p>
      {allSold && after < 0 ? <p className="field-desc">With every building sold, new shares cover the rest at the current price.</p> : null}
      <Button variant="primary" block disabled={!ok} onClick={() => confirm(true)}>
        Confirm sale
      </Button>
    </div>
  )
}
