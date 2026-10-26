// The forced sale of a losing round. The dock renders it inside a locked Sheet instead of the
// panels while my treasury opens the phase below 0 and the sale is not confirmed. Each building
// sells for 30% of its price paid; Confirm unlocks once the treasury is back to 0 or above, or every
// building is sold (then new shares cover the rest at the current price).
//
// Stores: useDraft (decision.forcedSales, toggleForcedSale; defaultDecision pre-picks the cheapest
// sales), useGame (state, meId, config), useUi (confirmForcedSale(true) brings the panels back; the
// sales stay in the draft and resolve at lock in).

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { companyById, sellValue } from '../../engine'
import type { Building } from '../../engine'
import { useDraft } from '../../store/draft'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Button, Icon, KIND_META, fmtMoney, fmtMw } from '../kit'
import { buildingName, losingReason } from './data'

function statusText(b: Building): string {
  if (b.status === 'building') return `building, ${b.roundsLeft} round${b.roundsLeft === 1 ? '' : 's'} left`
  if (b.status === 'upgrading') return `upgrading, ${b.roundsLeft} round${b.roundsLeft === 1 ? '' : 's'} left`
  return 'online'
}

export default function ForcedSale() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const config = useGame((s) => s.config)
  const sales = useDraft((s) => s.decision.forcedSales)
  const toggle = useDraft((s) => s.toggleForcedSale)
  const setDraft = useDraft((s) => s.set)
  const confirm = useUi((s) => s.confirmForcedSale)

  const me = state && meId ? companyById(state, meId) : null
  const list = useMemo(() => {
    if (!me) return []
    return me.buildings.map((b) => ({ b, value: sellValue(b, config) })).sort((x, y) => x.value - y.value || x.b.tile[1] - y.b.tile[1] || x.b.tile[0] - y.b.tile[0])
  }, [me, config])
  if (!state || !me) return null

  const cash = list.filter((x) => sales.includes(x.b.id)).reduce((s, x) => s + x.value, 0)
  const after = Math.round((me.treasury + cash) * 100) / 100
  const allSold = list.length > 0 && list.every((x) => sales.includes(x.b.id))
  const noBuildings = list.length === 0
  const ok = after >= 0 || allSold || noBuildings
  const short = Math.max(0, -after)
  const issue = (allSold || noBuildings) && after < 0 ? Math.ceil(-after / Math.max(0.01, me.sharePrice)) : 0
  const lostMw = list.filter((x) => sales.includes(x.b.id)).reduce((s, x) => s + x.b.mw, 0)
  const deficit = -me.treasury
  const progress = deficit > 0 ? Math.max(0, Math.min(1, cash / deficit)) : 1

  /** Cheapest first until the treasury is back to 0, the same pick the game starts with. */
  const pickCheapest = () =>
    setDraft((d) => {
      const picked: string[] = []
      let t = me.treasury
      for (const x of list) {
        if (t >= 0) break
        picked.push(x.b.id)
        t += x.value
      }
      d.forcedSales = picked
    })

  return (
    <div className="panel-stack fs">
      <div className="fs-lead">
        <p>
          <strong>Losing round.</strong> {losingReason(me)}
        </p>
        <p className="muted">Sell buildings for {Math.round(config.sellBackRate * 100)}% of what you paid until the treasury is back to 0. The rest of the round opens after.</p>
      </div>

      <div className={`fs-meter${ok ? ' is-ok' : ''}`} style={{ '--p': progress } as CSSProperties}>
        <div className="fs-meter-row">
          <span className="fs-meter-label">Treasury</span>
          <span className="num is-negative">{fmtMoney(me.treasury)}</span>
          <span className="fs-meter-arrow" aria-hidden="true">
            →
          </span>
          <span className={`pixel num fs-after${after < 0 ? ' is-negative' : ' money'}`}>{fmtMoney(after)}</span>
        </div>
        <div className="fs-bar" role="meter" aria-label="Deficit covered by sales" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span className="fs-bar-fill" />
        </div>
        <p className="fs-meter-sub">
          {ok ? (
            <>
              <Icon name="ok" size={16} /> {after >= 0 ? 'Back to 0 or above.' : 'Every building is sold.'}
            </>
          ) : (
            <>
              <Icon name="warn" size={16} /> <span className="num">{fmtMoney(short)}</span> short: pick more buildings.
            </>
          )}
        </p>
      </div>

      {noBuildings ? (
        <p className="field-desc">You own no buildings, so new shares cover the deficit.</p>
      ) : (
        <ul className="fs-list" aria-label="Buildings to sell">
          {list.map(({ b, value }) => {
            const on = sales.includes(b.id)
            return (
              <li key={b.id}>
                <label className={`fs-item${on ? ' is-on' : ''}`} style={{ '--hue': KIND_META[b.kind].hue } as CSSProperties}>
                  <input type="checkbox" className="fs-check" checked={on} onChange={() => toggle(b.id)} />
                  <span className="fs-art" aria-hidden="true">
                    <Icon name={b.status === 'building' ? 'crane' : KIND_META[b.kind].icon} size={24} />
                    {b.size === 'big' ? <span className="fs-big">Big</span> : null}
                  </span>
                  <span className="fs-info">
                    <span className="fs-name">{buildingName(b)}</span>
                    <span className="fs-sub muted">{b.status === 'building' ? statusText(b) : `${fmtMw(b.mw)} · ${statusText(b)}`}</span>
                    <span className="fs-sub muted num">paid {fmtMoney(b.pricePaid)}</span>
                  </span>
                  <span className="fs-value">
                    <span className="num strong money">+{fmtMoney(value)}</span>
                    <span className={`fs-toggle${on ? ' is-on' : ''}`} aria-hidden="true">
                      {on ? <Icon name="ok" size={16} /> : null}
                      {on ? 'Sell' : 'Keep'}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="fs-foot">
        {!noBuildings ? (
          <button type="button" className="link-btn" onClick={pickCheapest}>
            Pick the cheapest
          </button>
        ) : null}
        <p className="row-between">
          <span>
            Sales <span className="num money strong">+{fmtMoney(cash)}</span>
            {lostMw > 0 ? <span className="muted num"> · −{fmtMw(lostMw)}</span> : null}
          </span>
          <span>
            Treasury after <span className={`num strong${after < 0 ? ' is-negative' : ' money'}`}>{fmtMoney(after)}</span>
          </span>
        </p>
        {issue > 0 ? (
          <p className="fs-issue">
            <Icon name="info" size={16} /> The deficit left after selling everything, <span className="num">{fmtMoney(-after)}</span>, is covered by issuing <span className="num">{issue}</span> new
            shares at <span className="num">{fmtMoney(me.sharePrice)}</span>. Your share price will drop.
          </p>
        ) : null}
        <Button variant="primary" size="lg" block icon="ok" disabled={!ok} onClick={() => confirm(true)} aria-describedby={!ok ? 'fs-why' : undefined}>
          Confirm sale
        </Button>
        {!ok ? (
          <p id="fs-why" className="field-desc">
            Sell <span className="num">{fmtMoney(short)}</span> more to confirm.
          </p>
        ) : null}
      </div>
    </div>
  )
}
