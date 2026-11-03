// The losing round screen. The dock renders it inside a locked Sheet instead of the panels while my
// treasury opens the phase below 0 and the choice is not confirmed. New shares at the current price
// cover the deficit by default, so every building keeps earning; the player can sell buildings (30%
// of price paid) instead, and shares then cover only what the sales leave short.
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
  const setDraft = useDraft((s) => s.set)
  const confirm = useUi((s) => s.confirmForcedSale)

  const me = state && meId ? companyById(state, meId) : null
  const list = useMemo(() => {
    if (!me) return []
    return me.buildings.map((b) => ({ b, value: sellValue(b, config) })).sort((x, y) => x.value - y.value || x.b.tile[1] - y.b.tile[1] || x.b.tile[0] - y.b.tile[0])
  }, [me, config])
  if (!state || !me) return null

  const price = me.sharePrice > 0 ? me.sharePrice : me.shares > 0 ? me.marketCap / me.shares : 0
  /** Shares that cover what the picked sales leave short. */
  const needFor = (picked: string[]): number => {
    const t = Math.round((me.treasury + list.filter((x) => picked.includes(x.b.id)).reduce((s, x) => s + x.value, 0)) * 100) / 100
    return t < 0 && price > 0 ? Math.ceil(-t / price - 1e-9) : 0
  }
  /** Picks sales and sets the share issue that covers the rest, in one undo step. */
  const choose = (picked: string[]) =>
    setDraft((d) => {
      d.forcedSales = picked
      const need = needFor(picked)
      d.shares = need > 0 ? { mode: 'issue', count: need } : d.shares.mode === 'issue' ? { mode: 'none', count: 0 } : d.shares
    })
  const toggle = (id: string) => choose(sales.includes(id) ? sales.filter((x) => x !== id) : [...sales, id])

  const cash = list.filter((x) => sales.includes(x.b.id)).reduce((s, x) => s + x.value, 0)
  const afterSales = Math.round((me.treasury + cash) * 100) / 100
  const allSold = list.length > 0 && list.every((x) => sales.includes(x.b.id))
  const noBuildings = list.length === 0
  const issue = needFor(sales)
  const issueCash = Math.round(issue * price * 100) / 100
  const after = Math.round((afterSales + issueCash) * 100) / 100
  const ok = after >= 0 || allSold || noBuildings
  const short = Math.max(0, -after)
  const priceAfter = issue > 0 ? Math.round((me.marketCap / (me.shares + issue)) * 100) / 100 : price
  const lostMw = list.filter((x) => sales.includes(x.b.id)).reduce((s, x) => s + x.b.mw, 0)
  const deficit = -me.treasury
  const progress = deficit > 0 ? Math.max(0, Math.min(1, (cash + issueCash) / deficit)) : 1

  /** Cheapest first until the treasury is back to 0. */
  const pickCheapest = () => {
    const picked: string[] = []
    let t = me.treasury
    for (const x of list) {
      if (t >= 0) break
      picked.push(x.b.id)
      t += x.value
    }
    choose(picked)
  }
  const onConfirm = () => {
    // Keep the share issue in step with the picked sales before the panels come back.
    choose(sales)
    confirm(true)
  }

  return (
    <div className="panel-stack fs">
      <div className="fs-lead">
        <p>
          <strong>Losing round.</strong> {losingReason(me)}
        </p>
        <p className="muted">
          Cover the <span className="num">{fmtMoney(deficit)}</span> deficit with new shares and keep every building, or sell buildings for {Math.round(config.sellBackRate * 100)}% of what you paid. Shares not covered by sales are issued at <span className="num">{fmtMoney(price)}</span>.
        </p>
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
        <div className="fs-bar" role="meter" aria-label="Deficit covered by sales and new shares" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span className="fs-bar-fill" />
        </div>
        <p className="fs-meter-sub">
          {ok ? (
            <>
              <Icon name="ok" size={16} /> {after >= 0 ? 'Back to 0 or above.' : 'Every building is sold.'}
            </>
          ) : (
            <>
              <Icon name="warn" size={16} /> <span className="num">{fmtMoney(short)}</span> short.
            </>
          )}
        </p>
      </div>

      <div className={`fs-shares${issue > 0 ? ' is-on' : ''}`}>
        <p className="fs-shares-title">
          <Icon name="coin" size={16} /> <strong>{issue > 0 ? `Issue ${issue} new share${issue === 1 ? '' : 's'}` : 'No new shares needed'}</strong>
        </p>
        <p className="muted">
          {issue > 0 ? (
            <>
              <span className="num">+{fmtMoney(issueCash)}</span> at <span className="num">{fmtMoney(price)}</span>. Shares go from <span className="num">{me.shares}</span> to <span className="num">{me.shares + issue}</span>, the price from <span className="num">{fmtMoney(price)}</span> to about <span className="num">{fmtMoney(priceAfter)}</span>. Your buildings keep earning.
            </>
          ) : (
            'Your building sales cover the deficit.'
          )}
        </p>
        {sales.length > 0 ? (
          <button type="button" className="link-btn" onClick={() => choose([])}>
            Keep every building, cover it all with shares
          </button>
        ) : null}
      </div>

      <p className="fs-or muted">Or sell buildings instead (optional):</p>

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
                    {b.size !== 'small' ? <span className={`fs-big${b.size === 'mega' ? ' is-l3' : ''}`}>{b.size === 'mega' ? 'L3' : 'L2'}</span> : null}
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
            Sell the cheapest instead
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
        <Button variant="primary" size="lg" block icon="ok" disabled={!ok} onClick={onConfirm} aria-describedby={!ok ? 'fs-why' : undefined}>
          {sales.length > 0 && issue > 0 ? 'Confirm sales and shares' : sales.length > 0 ? 'Confirm sale' : 'Confirm new shares'}
        </Button>
        {!ok ? (
          <p id="fs-why" className="field-desc">
            Sell <span className="num">{fmtMoney(short)}</span> more to confirm: the share price is 0, so no share can be issued.
          </p>
        ) : null}
      </div>
    </div>
  )
}
