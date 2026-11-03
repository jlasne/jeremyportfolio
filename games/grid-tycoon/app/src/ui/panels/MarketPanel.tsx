// Market terminal (owner: "clear about every company"; "the goal is always to have it full").
// 1. My last round in one strip (revenue, profit, treasury, share price, rank, idle).
// 2. Companies: one row per company with its share price, plant and datacenter MW, last round's
//    offered → used MW per pool, and unallocated plant MW (from each company's last RoundResult).
// 3. Pools: per pool one chart with the demand line over every past round and, under it, what each
//    company offered stacked in company colours, so a glance says if the offer was above or under
//    demand. Facts: demand, offered, used, fill, my share, my tenure and my priority weight on open
//    MW this round. Read-only.

import { useMemo } from 'react'
import { POOLS, capacity, priorityWeights, rankCompanies } from '../../engine'
import type { Company, GameState, PoolId, RoundResult } from '../../engine'
import { companyColor, priceChange, rankOf } from '../../store/selectors'
import { Icon, Money, NumberTween, POOL_META, Panel, fmtMoney, fmtMw, fmtPct, trend } from '../kit'
import { usePanelCtx } from './common'
import { OfferChart, Sparkline } from './charts'
import type { OfferLayer } from './charts'

function Delta({ value, pct }: { value: number; pct?: boolean }) {
  const t = pct ? (Math.round(value * 1000) === 0 ? 0 : Math.sign(value)) : trend(value)
  return (
    <span className={`delta delta-${t > 0 ? 'up' : t < 0 ? 'down' : 'flat'}`}>
      {t !== 0 ? <Icon name={t > 0 ? 'arrowUp' : 'arrowDown'} size={16} /> : null}
      <span className="num">{pct ? fmtPct(value, { sign: true, decimals: 1 }) : fmtMoney(value, { sign: true })}</span>
      <span className="visually-hidden">{t > 0 ? ' up' : t < 0 ? ' down' : ' unchanged'}</span>
    </span>
  )
}

/** Start price of a company: its first round's price before (its current price before round 1). */
function startPrice(c: Company): number {
  return c.history[0]?.stock.priceBefore ?? c.sharePrice
}

const sumValues = (r: Record<string, number> | undefined): number => (r ? Object.values(r).reduce((s, v) => s + (v > 0 ? v : 0), 0) : 0)

interface PoolSeries {
  rounds: number[]
  demand: number[]
  layers: OfferLayer[]
}

function buildSeries(state: GameState, order: Company[], meId: string): Record<PoolId, PoolSeries> {
  const out = {} as Record<PoolId, PoolSeries>
  for (const p of POOLS) {
    const rounds = state.history.map((s) => s.round)
    const demand = state.history.map((s) => s.pools[p].demand)
    const layers = order.map((c) => ({
      id: c.id,
      name: c.name,
      color: companyColor(c),
      isMe: c.id === meId,
      values: state.history.map((s) => s.pools[p].offered?.[c.id] ?? c.history.find((h) => h.round === s.round)?.offered[p] ?? 0),
    }))
    out[p] = { rounds, demand, layers }
  }
  return out
}

export default function MarketPanel() {
  const ctx = usePanelCtx()
  const state = ctx?.state
  const meId = ctx?.meId

  // Me at the bottom of every stack, then the rivals in company order.
  const stackOrder = useMemo(() => (state && meId ? [...state.companies].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0)) : []), [state, meId])
  const series = useMemo(() => (state && meId ? buildSeries(state, stackOrder, meId) : null), [state, meId, stackOrder])

  if (!ctx || !series || !state || !meId) return null
  const { me } = ctx
  const summary = state.history.at(-1)
  const lastMine = me.history.at(-1)
  const rank = rankOf(state, meId)
  const byId = new Map(state.companies.map((c) => [c.id, c]))
  const ranking = rankCompanies(state)
  const active = state.companies.filter((c) => !c.bankrupt).map((c) => c.id)

  return (
    <div className="mterm">
      <section className="panel panel-money mterm-review" aria-labelledby="mterm-review">
        <h3 id="mterm-review" className="panel-title">
          <Icon name="flag" size={16} /> {lastMine ? `Round ${lastMine.round}: you` : 'Starting position'}
        </h3>
        <dl className="review mterm-review-list">
          <div>
            <dt>Revenue</dt>
            <dd>{lastMine ? <Money value={lastMine.revenue} tween /> : <span className="muted">—</span>}</dd>
          </div>
          <div>
            <dt>Profit</dt>
            <dd>{lastMine ? <NumberTween value={lastMine.profit} format={(v) => fmtMoney(v, { sign: true })} className={`num ${lastMine.profit >= 0 ? 'delta-up' : 'delta-down'}`} /> : <span className="muted">—</span>}</dd>
          </div>
          <div>
            <dt>Treasury</dt>
            <dd>
              <Money value={me.treasury} tween className={me.treasury < 0 ? 'is-negative' : undefined} />
            </dd>
          </div>
          <div>
            <dt>Share price</dt>
            <dd className="review-price">
              <NumberTween value={me.sharePrice} format={(v) => fmtMoney(v)} className="num" />
              {lastMine ? <Delta value={priceChange(me)} /> : null}
            </dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd className="num">
              #{rank.rank} <span className="muted review-of">of {rank.of}</span>
            </dd>
          </div>
          <div>
            <dt>Idle</dt>
            <dd className="num">{lastMine ? fmtPct(lastMine.idle) : <span className="muted">—</span>}</dd>
          </div>
        </dl>
      </section>

      <Panel
        title="Companies"
        icon="rivals"
        className="mterm-companies"
        aside={<span className="muted">{summary ? `round ${summary.round}: offered → used MW` : 'allocations appear after round 1'}</span>}
      >
        <CompanyTable state={state} meId={meId} ranking={ranking} byId={byId} />
      </Panel>

      <Panel title="Pools" icon="chart" className="mterm-pools" aside={<span className="muted">highest share price wins at round {state.rounds}</span>}>
        <div className="mterm-legend" aria-hidden="true">
          <span>
            <span className="key key-line" /> Demand
          </span>
          {stackOrder.map((c) => (
            <span key={c.id}>
              <span className="key ochart-key" style={{ background: companyColor(c) }} /> {c.id === meId ? 'You' : c.name}
            </span>
          ))}
        </div>
        {!summary ? <p className="field-desc">Start demand per pool. Offers, fill and priority appear after round 1.</p> : null}
        <ul className="plain-list mpools">
          {POOLS.map((p) => {
            const meta = POOL_META[p]
            const s = summary?.pools[p]
            const demand = s ? s.demand : state.pools[p].demand
            const offered = s ? sumValues(s.offered) : 0
            const used = s ? s.used : 0
            const mineUsed = state.pools[p].lastUsed[meId] ?? 0
            const fillPct = demand > 0 ? used / demand : 0
            const share = used > 0 ? mineUsed / used : 0
            const tenure = state.pools[p].tenure?.[meId] ?? 0
            const weights = priorityWeights(state, p, active)
            const mine = weights[meId] ?? 1
            const best = Math.max(...Object.values(weights), 1)
            const gap = offered - demand
            const status = !s ? null : gap >= -0.005 ? (fillPct >= 0.995 ? 'full' : 'over') : 'short'
            return (
              <li key={p} className={`mpool pool-${p}`}>
                <div className="pool-head">
                  <span className="pool-icon" style={{ background: meta.hue }} aria-hidden="true">
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <h4 className="pool-name">{meta.label}</h4>
                  <span className="pool-buys muted">{meta.buys}</span>
                  {status ? (
                    <span className={`mpool-status is-${status === 'short' ? 'short' : 'ok'}`}>
                      <Icon name={status === 'short' ? 'warn' : 'ok'} size={16} />
                      {status === 'short' ? (
                        <>
                          <span className="num">{fmtMw(-gap)}</span> short
                        </>
                      ) : (
                        <>
                          offer <span className="num">{fmtMw(gap, { sign: true })}</span>
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="pool-demand num strong">{fmtMw(demand)}</span>
                  )}
                </div>
                {s ? <OfferChart name={meta.label} pool={p} rounds={series[p].rounds} demand={series[p].demand} layers={series[p].layers} /> : null}
                <dl className="mpool-facts">
                  <div>
                    <dt>Demand</dt>
                    <dd className="num strong">{fmtMw(demand)}</dd>
                  </div>
                  <div>
                    <dt>Offered</dt>
                    <dd className="num">{s ? fmtMw(offered) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Used</dt>
                    <dd className="num">{s ? fmtMw(used) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Filled</dt>
                    <dd className="num">
                      {s ? (
                        <>
                          <span className="mpool-meter" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, fillPct * 100)}%` }} />
                          </span>
                          {fmtPct(fillPct)}
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Your share</dt>
                    <dd className="num">
                      <strong>{fmtPct(share)}</strong> <span className="muted">{fmtMw(mineUsed)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Your tenure</dt>
                    <dd className="num">
                      {tenure} {tenure === 1 ? 'round' : 'rounds'}
                    </dd>
                  </div>
                  <div title="Your weight on this round's open MW, from your share of last round and your tenure">
                    <dt>Your priority</dt>
                    <dd className="num">
                      <strong>×{mine.toFixed(2)}</strong>
                      {active.length > 1 ? <span className="muted"> {mine >= best - 1e-9 ? 'top' : `top ×${best.toFixed(2)}`}</span> : null}
                    </dd>
                  </div>
                  {s ? (
                    <div>
                      <dt>Growth</dt>
                      <dd>
                        <Delta value={s.growth} pct />
                        <span className="muted num"> exp. {fmtPct(s.expectedGrowth, { sign: true, decimals: 1 })}</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

function Cell({ r, p }: { r: RoundResult | undefined; p: PoolId }) {
  if (!r) return <td className="mt-pool muted">—</td>
  const o = r.offered[p] ?? 0
  const u = r.used[p] ?? 0
  if (o <= 0.005 && u <= 0.005) return <td className="mt-pool muted">—</td>
  const idle = o - u > 0.005
  return (
    <td className="mt-pool num">
      <span className="mt-off">{fmtMw(o, { unit: false })}</span>
      <span className="mt-arrow" aria-label="offered, used">
        {' → '}
      </span>
      <strong className={idle ? 'mt-used is-idle' : 'mt-used'}>{fmtMw(u, { unit: false })}</strong>
    </td>
  )
}

function CompanyTable({ state, meId, ranking, byId }: { state: GameState; meId: string; ranking: string[]; byId: Map<string, Company> }) {
  const summary = state.history.at(-1)
  return (
    <div className="mt-wrap" role="region" aria-label="Companies, last round" tabIndex={0}>
      <table className="mt">
        <caption className="visually-hidden">Every company: share price, capacity, and last round's offered and used MW per pool</caption>
        <thead>
          <tr>
            <th scope="col" className="mt-co">
              Company
            </th>
            <th scope="col" className="mt-price">
              Share price
            </th>
            <th scope="col">
              <span className="mt-th">
                <Icon name="plant" size={16} /> Plants
              </span>
            </th>
            <th scope="col">
              <span className="mt-th">
                <Icon name="dc" size={16} /> DCs
              </span>
            </th>
            {POOLS.map((p) => (
              <th key={p} scope="col" className="mt-pool">
                <span className="mt-th">
                  <span className="mt-th-icon" style={{ background: POOL_META[p].hue }} aria-hidden="true">
                    <Icon name={POOL_META[p].icon} size={16} />
                  </span>
                  {POOL_META[p].short}
                </span>
              </th>
            ))}
            <th scope="col">
              <span className="mt-th">Unallocated</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((id, i) => {
            const c = byId.get(id)
            if (!c) return null
            const isMe = id === meId
            const r = c.history.at(-1)
            const cap = r ? null : capacity(c)
            const values = [startPrice(c), ...state.history.map((h) => h.prices[id] ?? c.sharePrice)]
            return (
              <tr key={id} className={isMe ? 'is-me' : undefined}>
                <th scope="row" className="mt-co">
                  <span className="mt-co-in">
                    <span className="mt-pos num">#{i + 1}</span>
                    <span className="leader-dot" style={{ background: companyColor(c) }} aria-hidden="true" />
                    <span className="mt-name">
                      {c.name}
                      {isMe ? <span className="muted"> (you)</span> : null}
                    </span>
                    {c.bankrupt ? <span className="tag tag-critical">bankrupt</span> : null}
                  </span>
                </th>
                <td className="mt-price">
                  <span className="mt-price-in">
                    <Sparkline values={values} color={companyColor(c)} label={`${c.name} share price`} width={64} height={22} />
                    <span className="mt-price-v">
                      <NumberTween value={c.sharePrice} format={(v) => fmtMoney(v)} className="num strong" />
                      {c.history.length ? <Delta value={priceChange(c)} /> : null}
                    </span>
                  </span>
                </td>
                <td className="num">{fmtMw(r ? r.plantMw : (cap?.plantMw ?? 0), { unit: false })}</td>
                <td className="num">{fmtMw(r ? r.dcMw : (cap?.dcMw ?? 0), { unit: false })}</td>
                {POOLS.map((p) => (
                  <Cell key={p} r={r} p={p} />
                ))}
                <td className="num">
                  {!r ? (
                    <span className="muted">—</span>
                  ) : r.unallocatedMw > 0.005 ? (
                    <span className="mt-unalloc">
                      <Icon name="critical" size={16} />
                      {fmtMw(r.unallocatedMw, { unit: false })}
                    </span>
                  ) : (
                    <span className="muted">0</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        {summary ? (
          <tfoot>
            <tr>
              <th scope="row" className="mt-co">
                Pool demand
              </th>
              <td className="mt-price muted">round {summary.round}</td>
              <td />
              <td />
              {POOLS.map((p) => {
                const s = summary.pools[p]
                const off = sumValues(s.offered)
                return (
                  <td key={p} className="mt-pool num">
                    <strong>{fmtMw(s.demand, { unit: false })}</strong>
                    <span className={`mt-gap ${off >= s.demand - 0.005 ? 'is-ok' : 'is-short'}`}>
                      {off >= s.demand - 0.005 ? `+${fmtMw(off - s.demand, { unit: false })}` : `−${fmtMw(s.demand - off, { unit: false })}`}
                    </span>
                  </td>
                )
              })}
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
      <p className="mt-key muted">
        MW offered → used last round. <strong className="mt-used is-idle">Amber</strong> means part of the offer sat idle. The demand row shows each pool's demand and how far the total offer was above (+) or under (−) it.
      </p>
    </div>
  )
}
