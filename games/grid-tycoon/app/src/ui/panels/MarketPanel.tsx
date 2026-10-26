// Market panel (SPEC "Round flow: Review" and "Screens and interactions: Market panel"): last
// round's review, one small line chart per pool with its past demand and my used MW as a band
// under it, growth against what the market expected (after resolution only), my share of the pool
// and who leads it (names in order, never rivals' exact MW), then every company's share price with
// a sparkline. Read-only.

import { useMemo } from 'react'
import { POOLS, rankCompanies } from '../../engine'
import type { Company, PoolId } from '../../engine'
import { companyColor, priceChange, rankOf } from '../../store/selectors'
import { Icon, Money, NumberTween, POOL_META, Panel, fmtMoney, fmtMw, fmtPct, trend } from '../kit'
import { usePanelCtx } from './common'
import { PoolChart, Sparkline } from './charts'

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

export default function MarketPanel() {
  const ctx = usePanelCtx()
  const state = ctx?.state
  const meId = ctx?.meId

  const config = ctx?.config
  const series = useMemo(() => {
    if (!state || !meId || !config) return null
    const me = state.companies.find((c) => c.id === meId)
    const out = {} as Record<PoolId, { rounds: number[]; demand: number[]; mine: number[] }>
    for (const p of POOLS) {
      // Round 0 is the start demand (start per company × companies), before anyone has used MW.
      const rounds = [0]
      const demand = [config.pool.startPerCompany[p] * state.companies.length]
      const mine = [0]
      state.history.forEach((s, i) => {
        rounds.push(s.round)
        demand.push(s.pools[p].demand)
        mine.push(me?.history[i]?.used[p] ?? 0)
      })
      out[p] = { rounds, demand, mine }
    }
    return out
  }, [state, meId, config])

  if (!ctx || !series || !state || !meId) return null
  const { me } = ctx
  const lastSummary = state.history.at(-1)
  const lastMine = me.history.at(-1)
  const rank = rankOf(state, meId)
  const byId = new Map(state.companies.map((c) => [c.id, c]))
  const ranking = rankCompanies(state)

  return (
    <div className="panel-stack market-panel">
      <Panel title={lastMine ? `Round ${lastMine.round} review` : 'Starting position'} icon="flag" tone="money">
        <dl className="review">
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
        {!lastMine ? <p className="field-desc">Every company starts the same. Results, demand history and rankings fill in after round 1.</p> : null}
      </Panel>

      <Panel title="Demand by pool" icon="chart">
        {!lastSummary ? <p className="field-desc">Start demand per pool. Charts, growth against expectations, your share and the leaders appear after round 1.</p> : null}
        {lastSummary ? (
          <div className="pool-legend" aria-hidden="true">
            <span>
              <span className="key key-line" /> Demand
            </span>
            <span>
              <span className="key key-band" /> Your used MW
            </span>
          </div>
        ) : null}
        <ul className="plain-list pool-list">
          {POOLS.map((p) => {
            const meta = POOL_META[p]
            const s = series[p]
            const sum = lastSummary?.pools[p]
            const demandNow = s.demand[s.demand.length - 1]
            const mineNow = s.mine[s.mine.length - 1]
            const share = demandNow > 0 ? mineNow / demandNow : 0
            const diff = sum ? sum.growth - sum.expectedGrowth : 0
            return (
              <li key={p} className={`pool-card pool-${p}`}>
                <div className="pool-head">
                  <span className="pool-icon" style={{ background: meta.hue }} aria-hidden="true">
                    <Icon name={meta.icon} size={16} />
                  </span>
                  <h4 className="pool-name">{meta.short}</h4>
                  <span className="pool-buys muted">{meta.buys}</span>
                  <span className="pool-demand">
                    <Mwx value={demandNow} />
                  </span>
                </div>
                {sum ? (
                  <>
                    <PoolChart name={meta.label} pool={p} rounds={s.rounds} demand={s.demand} mine={s.mine} />
                    <dl className="pool-facts">
                      <div>
                        <dt>Growth</dt>
                        <dd>
                          {sum ? (
                            <>
                              <Delta value={sum.growth} pct />
                              <span className={`pool-vs ${diff >= 0 ? 'is-above' : 'is-below'}`}>
                                {diff >= 0 ? 'above' : 'below'} exp. <span className="num">{fmtPct(sum.expectedGrowth, { sign: true, decimals: 1 })}</span>
                              </span>
                            </>
                          ) : (
                            <span className="muted">after round 1</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Your share</dt>
                        <dd>
                          <span className="num strong">{fmtPct(share)}</span> <span className="muted num">{fmtMw(mineNow)}</span>
                        </dd>
                      </div>
                    </dl>
                    <div className="pool-leaders">
                      <span className="pool-leaders-label">Leaders</span>
                      {sum && sum.ranking.length > 0 ? (
                        <ol className="leader-list">
                          {sum.ranking.map((id, i) => {
                            const c = byId.get(id)
                            if (!c) return null
                            const isMe = id === meId
                            return (
                              <li key={id} className={isMe ? 'is-me' : undefined}>
                                <span className="leader-pos num">{i + 1}</span>
                                <span className="leader-dot" style={{ background: companyColor(c) }} aria-hidden="true" />
                                <span className="leader-name">{isMe ? 'You' : c.name}</span>
                              </li>
                            )
                          })}
                        </ol>
                      ) : (
                        <span className="muted">{sum ? 'nobody served it' : 'after round 1'}</span>
                      )}
                    </div>
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="Share prices" icon="rivals" aside={<span className="muted">highest wins at round {state.rounds}</span>}>
        <ol className="price-list">
          {ranking.map((id, i) => {
            const c = byId.get(id)!
            const isMe = id === meId
            const values = [startPrice(c), ...state.history.map((h) => h.prices[id] ?? c.sharePrice)]
            return (
              <li key={id} className={`price-row${isMe ? ' is-me' : ''}`}>
                <span className="price-pos pixel num">#{i + 1}</span>
                <span className="leader-dot" style={{ background: companyColor(c) }} aria-hidden="true" />
                <span className="price-name">
                  {c.name}
                  {isMe ? <span className="muted"> (you)</span> : null}
                  {c.bankrupt ? <span className="tag tag-critical">bankrupt</span> : null}
                </span>
                <span className="price-spark">
                  <Sparkline values={values} color={companyColor(c)} label={`${c.name} share price`} width={120} height={22} />
                </span>
                <span className="price-val">
                  <NumberTween value={c.sharePrice} format={(v) => fmtMoney(v)} className="num strong" />
                  {c.history.length ? <Delta value={priceChange(c)} /> : null}
                </span>
              </li>
            )
          })}
        </ol>
      </Panel>
    </div>
  )
}

function Mwx({ value }: { value: number }) {
  return <NumberTween value={value} format={(v) => fmtMw(v)} className="num strong" />
}
