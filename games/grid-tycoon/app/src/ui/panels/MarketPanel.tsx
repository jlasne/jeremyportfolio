// PLACEHOLDER (UI shell track). The panels track replaces this file wholesale with per-pool line
// charts. Contract: default export, no props; rendered inside the dock's Sheet body.
// Stores: useGame (state.history summaries, state.pools, companies, meId). Rivals' exact MW stay
// hidden: only the pool ranking (who leads) and share prices are public.

import { POOLS, rankCompanies } from '../../engine'
import { useGame } from '../../store/game'
import { priceChange } from '../../store/selectors'
import { Icon, POOL_META, Panel, fmtMoney, fmtMw, fmtPct, trend } from '../kit'

export default function MarketPanel() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  if (!state || !meId) return null
  const me = state.companies.find((c) => c.id === meId)
  const last = state.history[state.history.length - 1]
  const mine = me?.history[me.history.length - 1]
  const names = Object.fromEntries(state.companies.map((c) => [c.id, c.name]))

  return (
    <div className="panel-stack">
      <Panel title="Demand last round" icon="chart">
        {!last ? <p className="muted">Demand appears after round 1 resolves. Each pool starts at its start demand per company.</p> : null}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Pool</th>
                <th scope="col" className="r">
                  Demand
                </th>
                <th scope="col" className="r">
                  Growth
                </th>
                <th scope="col" className="r">
                  You
                </th>
              </tr>
            </thead>
            <tbody>
              {POOLS.map((p) => {
                const s = last?.pools[p]
                const demand = s ? s.demand : state.pools[p].demand
                const used = mine?.used[p] ?? 0
                return (
                  <tr key={p}>
                    <th scope="row">
                      <Icon name={POOL_META[p].icon} size={16} className="inline-icon" /> {POOL_META[p].short}
                    </th>
                    <td className="r num">{fmtMw(demand, { unit: false })}</td>
                    <td className="r num" title={s ? `Expected ${fmtPct(s.expectedGrowth, { decimals: 1 })}` : undefined}>
                      {s ? fmtPct(s.growth, { sign: true, decimals: 1 }) : '—'}
                      {s ? <span className={`cell-sub ${s.growth >= s.expectedGrowth ? 'delta-up' : 'delta-down'}`}>exp. {fmtPct(s.expectedGrowth, { decimals: 1 })}</span> : null}
                    </td>
                    <td className="r num">
                      {fmtMw(used, { unit: false })}
                      {demand > 0 ? <span className="cell-sub muted">{fmtPct(used / demand)}</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="field-desc">MW. Growth is this round's actual; "exp." is what the market expected.</p>
        {last ? (
          <ul className="plain-list leaders">
            {POOLS.map((p) => {
              const lead = last.pools[p].ranking[0]
              return (
                <li key={p} className="row-between">
                  <span className="muted">{POOL_META[p].short} leader</span>
                  <span className="strong">{lead ? (lead === meId ? 'You' : names[lead]) : 'nobody'}</span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </Panel>

      <Panel title="Share prices" icon="rivals">
        <ol className="rank-list">
          {rankCompanies(state).map((id, i) => {
            const c = state.companies.find((x) => x.id === id)!
            const ch = priceChange(c)
            const t = trend(ch)
            return (
              <li key={id} className={id === meId ? 'is-me' : undefined}>
                <span className="rank-pos pixel num">#{i + 1}</span>
                <span className="rank-swatch" style={{ background: `var(--company-${c.color % 6})` }} aria-hidden="true" />
                <span className="rank-name">
                  {c.name}
                  {c.bankrupt ? <span className="tag tag-critical">bankrupt</span> : null}
                </span>
                <span className="rank-price num">{fmtMoney(c.sharePrice)}</span>
                <span className={`delta delta-${t > 0 ? 'up' : t < 0 ? 'down' : 'flat'} num`}>
                  {t !== 0 ? <Icon name={t > 0 ? 'arrowUp' : 'arrowDown'} size={16} /> : null}
                  {c.history.length ? fmtMoney(ch, { sign: true }) : '—'}
                </span>
              </li>
            )
          })}
        </ol>
      </Panel>
    </div>
  )
}
