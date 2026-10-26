// The four beats of the round results: demand, revenue, stock move, ranking. Each is a plain view
// of one round; `active` starts its count-ups and bar growth (the overlay passes true once the beat
// is on screen). Bars grow with CSS animations, which the reduced-motion rules switch off.

import type { CSSProperties } from 'react'
import { POOLS } from '../../engine'
import type { GameState, RoundResult, RoundSummary } from '../../engine'
import { Icon, POOL_META, fmtMoney, fmtMw, fmtPct, trend } from '../kit'
import { CountUp } from './CountUp'
import { demandRows, leaderRows, rankRows, stockDriver, stockRows } from './data'

const pct = (x: number, decimals = 1) => fmtPct(x, { sign: true, decimals })
const money = (v: number) => fmtMoney(v)
const signed = (v: number) => fmtMoney(v, { sign: true })

/** Position of x on a [lo, hi] axis, in % of the track. */
function at(x: number, lo: number, hi: number): number {
  return hi - lo <= 0 ? 50 : ((x - lo) / (hi - lo)) * 100
}

// ---------- 1. Demand ----------

export function DemandBeat({ summary, res, prevRes }: { summary: RoundSummary; res: RoundResult; prevRes: RoundResult | undefined }) {
  const rows = demandRows(summary, res, prevRes)
  const vals = rows.flatMap((r) => [r.growth, r.expected])
  const lo = Math.min(0, ...vals) - 0.005
  const hi = Math.max(0, ...vals) + 0.005
  const zero = at(0, lo, hi)
  return (
    <div className="rs-beat-body">
      <p className="rs-lead">How much each pool grew, against what the market expected. Now it is revealed.</p>
      <ul className="rs-demand" aria-label="Demand growth per pool">
        {rows.map((r, i) => {
          const s = Math.round(r.surprise * 1000)
          const tone = s > 0 ? 'up' : s < 0 ? 'down' : 'flat'
          const g = at(r.growth, lo, hi)
          const left = Math.min(g, zero)
          const style = { '--i': i, '--hue': POOL_META[r.pool].hue } as CSSProperties
          return (
            <li key={r.pool} style={style}>
              <span className="rs-pool">
                <span className="rs-pool-name">
                  <Icon name={POOL_META[r.pool].icon} size={16} /> {POOL_META[r.pool].short}
                </span>
                <span className="rs-pool-sub">
                  <span className="num">{fmtMw(r.demand)}</span>
                  {r.used > 0 ? <span className="num">you {fmtMw(r.used, { unit: false })}</span> : null}
                </span>
              </span>
              <span className="rs-track" aria-hidden="true">
                <span className="rs-zero" style={{ left: `${zero}%` }} />
                <span className={`rs-fill rs-grow ${r.growth >= 0 ? 'from-left' : 'from-right'}`} style={{ left: `${left}%`, width: `${Math.abs(g - zero)}%` }} />
                <span className="rs-expect" style={{ left: `${at(r.expected, lo, hi)}%` }} />
              </span>
              <span className="rs-demand-val">
                <span className="num strong">{pct(r.growth)}</span>
                <span className={`rs-vs rs-vs-${tone}`}>
                  {tone === 'up' ? <Icon name="arrowUp" size={16} /> : tone === 'down' ? <Icon name="arrowDown" size={16} /> : null}
                  <span className="visually-hidden">{tone === 'up' ? 'above' : tone === 'down' ? 'below' : 'in line with'} </span>
                  <span>exp. </span>
                  <span className="num">{pct(r.expected)}</span>
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="rs-legend" aria-hidden="true">
        <span className="rs-key rs-key-fill" /> actual growth <span className="rs-key rs-key-expect" /> expected
      </p>
    </div>
  )
}

// ---------- 2. Revenue ----------

const COSTS: { key: keyof RoundResult['costs']; label: string; hue: string }[] = [
  { key: 'power', label: 'Power', hue: 'var(--power-dark)' },
  { key: 'rent', label: 'Rent', hue: 'var(--grid-dark)' },
  { key: 'maintenance', label: 'Maintenance', hue: 'var(--stone-mid)' },
  { key: 'interest', label: 'Interest', hue: 'var(--plant-dark)' },
]

export function RevenueBeat({ res, active }: { res: RoundResult; active: boolean }) {
  const costs = res.costs.power + res.costs.rent + res.costs.maintenance + res.costs.interest
  const scale = Math.max(res.revenue, costs, 0.01)
  const pools = POOLS.filter((p) => res.revenueByPool[p] > 0.004 || res.used[p] > 0)
  let k = 0
  return (
    <div className="rs-beat-body">
      <div className="rs-stacks" aria-hidden="true">
        <div className="rs-stack-row">
          <span className="rs-stack-label">Revenue</span>
          <span className="rs-stack" style={{ width: `${(res.revenue / scale) * 100}%` }}>
            {POOLS.filter((p) => res.revenueByPool[p] > 0.004).map((p) => (
              <span
                key={p}
                className="rs-seg rs-grow from-left"
                style={{ flexGrow: res.revenueByPool[p], background: POOL_META[p].hue, '--i': k++ } as CSSProperties}
                title={`${POOL_META[p].label} ${money(res.revenueByPool[p])}`}
              />
            ))}
          </span>
        </div>
        <div className="rs-stack-row">
          <span className="rs-stack-label">Costs</span>
          <span className="rs-stack" style={{ width: `${(costs / scale) * 100}%` }}>
            {COSTS.filter((c) => res.costs[c.key] > 0.004).map((c) => (
              <span
                key={c.key}
                className="rs-seg rs-grow from-left"
                style={{ flexGrow: res.costs[c.key], background: c.hue, '--i': k++ } as CSSProperties}
                title={`${c.label} ${money(res.costs[c.key])}`}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="rs-money-cols">
        <section aria-label="Revenue by pool">
          <h3 className="rs-col-title">
            Revenue <CountUp className="num money" value={res.revenue} format={money} active={active} />
          </h3>
          <ul className="rs-lines">
            {pools.length === 0 ? <li className="muted">No sales this round.</li> : null}
            {pools.map((p, i) => (
              <li key={p}>
                <span className="rs-swatch" style={{ background: POOL_META[p].hue }} aria-hidden="true" />
                <Icon name={POOL_META[p].icon} size={16} className="rs-line-icon" />
                <span className="rs-line-name">
                  {POOL_META[p].short} <span className="muted num">{fmtMw(res.used[p])}</span>
                </span>
                <CountUp className="num" value={res.revenueByPool[p]} format={money} active={active} delay={i * 90} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Costs">
          <h3 className="rs-col-title">
            Costs <CountUp className="num" value={-costs} format={money} active={active} />
          </h3>
          <ul className="rs-lines">
            {COSTS.map((c, i) => (
              <li key={c.key} className={res.costs[c.key] > 0.004 ? undefined : 'is-zero'}>
                <span className="rs-swatch" style={{ background: c.hue }} aria-hidden="true" />
                <span className="rs-line-name">{c.label}</span>
                <CountUp className="num" value={-res.costs[c.key]} format={money} active={active} delay={i * 90} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={`rs-profit ${trend(res.profit) >= 0 ? 'is-up' : 'is-down'}`}>
        <span className="rs-profit-label">
          <Icon name={trend(res.profit) >= 0 ? 'arrowUp' : 'arrowDown'} size={16} /> Profit
        </span>
        <CountUp className="pixel num rs-profit-val" value={res.profit} format={signed} active={active} delay={250} />
        <span className="rs-profit-sub">
          Treasury <span className={`num ${res.treasury < 0 ? 'is-negative' : 'money'}`}>{money(res.treasury)}</span>
        </span>
      </div>
    </div>
  )
}

// ---------- 3. Stock ----------

export function StockBeat({ res }: { res: RoundResult }) {
  const rows = stockRows(res)
  const move = res.stock.priceAfter - res.stock.priceBefore
  let c = 0
  const spans = rows.map((r) => {
    const from = c
    c += r.value
    return { from, to: c }
  })
  const ends = [0, move, ...spans.flatMap((s) => [s.from, s.to])]
  const lo = Math.min(...ends)
  const hi = Math.max(...ends)
  const pad = (hi - lo) * 0.04 || 0.05
  const L = lo - pad
  const H = hi + pad
  const zero = at(0, L, H)
  const dir = trend(move)
  return (
    <div className="rs-beat-body">
      <div className="rs-price-move">
        <span className="pixel num rs-price-old">{money(res.stock.priceBefore)}</span>
        <span className="rs-price-arrow" aria-hidden="true">
          →
        </span>
        <span className="visually-hidden"> to </span>
        <span className="pixel num rs-price-new">{money(res.stock.priceAfter)}</span>
        <span className={`delta delta-${dir > 0 ? 'up' : dir < 0 ? 'down' : 'flat'}`}>
          {dir !== 0 ? <Icon name={dir > 0 ? 'arrowUp' : 'arrowDown'} size={16} /> : null}
          <span className="num">{signed(move)}</span>
        </span>
      </div>
      <ul className="rs-fall" aria-label="Share price move, part by part">
        {rows.map((r, i) => {
          const s = spans[i]
          const a = at(Math.min(s.from, s.to), L, H)
          const b = at(Math.max(s.from, s.to), L, H)
          const t = trend(r.value)
          return (
            <li key={r.key} style={{ '--i': i } as CSSProperties} className={t === 0 ? 'is-zero' : undefined} title={r.hint}>
              <span className="rs-fall-label">
                {r.icon ? <Icon name={r.icon} size={16} className="rs-line-icon" /> : null}
                {r.label}
              </span>
              <span className="rs-track" aria-hidden="true">
                <span className="rs-zero" style={{ left: `${zero}%` }} />
                <span className={`rs-step rs-grow ${r.value >= 0 ? 'from-left is-up' : 'from-right is-down'}`} style={{ left: `${a}%`, width: `${Math.max(t === 0 ? 0 : 0.6, b - a)}%` }} />
              </span>
              <span className={`rs-fall-val num ${t > 0 ? 'is-up' : t < 0 ? 'is-down' : ''}`}>{signed(r.value)}</span>
            </li>
          )
        })}
        <li className="rs-fall-total" style={{ '--i': rows.length } as CSSProperties}>
          <span className="rs-fall-label">Price change</span>
          <span className="rs-track" aria-hidden="true">
            <span className="rs-zero" style={{ left: `${zero}%` }} />
            <span
              className={`rs-step rs-total rs-grow ${move >= 0 ? 'from-left' : 'from-right'}`}
              style={{ left: `${at(Math.min(0, move), L, H)}%`, width: `${Math.max(dir === 0 ? 0 : 0.6, Math.abs(at(move, L, H) - zero))}%` }}
            />
          </span>
          <span className="rs-fall-val num strong">{signed(move)}</span>
        </li>
      </ul>
      <p className="rs-driver">{stockDriver(rows, move)}</p>
    </div>
  )
}

// ---------- 4. Ranking ----------

export function RankingBeat({ before, after, summary, meId }: { before: GameState; after: GameState; summary: RoundSummary; meId: string }) {
  const rows = rankRows(before, after, meId)
  const leaders = leaderRows(after, summary, meId)
  return (
    <div className="rs-beat-body rs-rank-cols">
      <section aria-label="Share price ranking">
        <ol className="rs-rank">
          {rows.map((r, i) => {
            const t = trend(r.change)
            return (
              <li key={r.id} className={r.isMe ? 'is-me' : undefined} style={{ '--i': i } as CSSProperties}>
                <span className="rs-rank-pos pixel num">#{r.rank}</span>
                <span className={`rs-moved ${r.moved > 0 ? 'is-up' : r.moved < 0 ? 'is-down' : 'is-flat'}`}>
                  {r.moved > 0 ? <Icon name="arrowUp" size={16} /> : r.moved < 0 ? <Icon name="arrowDown" size={16} /> : <span aria-hidden="true">–</span>}
                  {r.moved !== 0 ? (
                    <span className="num" aria-hidden="true">
                      {Math.abs(r.moved)}
                    </span>
                  ) : null}
                  <span className="visually-hidden">{r.moved > 0 ? `up ${r.moved}` : r.moved < 0 ? `down ${-r.moved}` : 'same place'}</span>
                </span>
                <span className="rank-swatch" style={{ background: `var(--company-${r.color % 6})` }} aria-hidden="true" />
                <span className="rs-rank-name">
                  {r.name}
                  {r.isMe ? <span className="rs-you">You</span> : null}
                  {r.bankrupt ? <span className="tag tag-critical">Bankrupt</span> : null}
                </span>
                <span className="rs-rank-price">
                  <span className="num strong">{money(r.price)}</span>
                  <span className={`delta delta-${t > 0 ? 'up' : t < 0 ? 'down' : 'flat'}`}>
                    <span className="num">{signed(r.change)}</span>
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>
      <section aria-labelledby="rs-lead-h">
        <h3 id="rs-lead-h" className="rs-col-title">
          Who leads each pool
        </h3>
        <ul className="rs-leaders">
          {leaders.map((l) => (
            <li key={l.pool}>
              <span className="rs-pool-name">
                <Icon name={POOL_META[l.pool].icon} size={16} /> {POOL_META[l.pool].short}
              </span>
              <span className={`rs-leader${l.leaderIsMe ? ' is-me' : ''}`}>
                {l.leader ? (
                  <>
                    <span className="rank-swatch" style={{ background: `var(--company-${l.leaderColor % 6})` }} aria-hidden="true" />
                    {l.leader}
                    {l.leaderIsMe ? <Icon name="flag" size={16} /> : null}
                  </>
                ) : (
                  <span className="muted">Nobody</span>
                )}
              </span>
              <span className="rs-leader-me muted">{l.myPlace > 0 ? `you #${l.myPlace} of ${l.players}` : 'you: none'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
