// PLACEHOLDER (UI shell track). The results track replaces this file wholesale with the animated
// 4-beat sequence. Contract: default export, no props; mounted by the game screen only while
// useGame.phase === 'results' and useGame.last is set; it covers the screen (the rest is inert).
// Stores: useGame (last.before / last.after, meId, finishResults). The live region already
// announces the round's headline numbers.

import { useEffect, useRef } from 'react'
import { POOLS, rankCompanies } from '../../engine'
import { useGame } from '../../store/game'
import { Button, Icon, POOL_META, fmtMoney, fmtMw, trend } from '../kit'

export default function ResultsOverlay() {
  const last = useGame((s) => s.last)
  const meId = useGame((s) => s.meId)
  const finish = useGame((s) => s.finishResults)
  const next = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    next.current?.focus({ preventScroll: true })
  }, [])

  if (!last || !meId) return null
  const me = last.after.companies.find((c) => c.id === meId)
  const res = me?.history[me.history.length - 1]
  const summary = last.after.history[last.after.history.length - 1]
  if (!me || !res || !summary) return null
  const move = res.stock.priceAfter - res.stock.priceBefore
  const parts: [string, number][] = [
    ['Revenue growth', res.stock.parts.revenueGrowth],
    ['Demand miss', POOLS.reduce((s, p) => s + res.stock.parts.demandMiss[p], 0)],
    ['Idle penalty', res.stock.parts.idle],
    ['Fundamentals', res.stock.parts.fundamentals],
    ['Debt drag', res.stock.parts.debtDrag],
    ['Share issue / buyback', res.stock.parts.shares],
  ]
  const maxPart = Math.max(0.01, ...parts.map(([, v]) => Math.abs(v)))
  const names = Object.fromEntries(last.after.companies.map((c) => [c.id, c.name]))

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="results-title" onKeyDown={(e) => e.key === 'Escape' && finish()}>
      <div className="overlay-card results">
        <header className="results-head">
          <p className="caps muted">Round {res.round} results</p>
          <h2 id="results-title" className={`results-profit ${trend(res.profit) >= 0 ? 'is-up' : 'is-down'}`}>
            Profit <span className="num">{fmtMoney(res.profit, { sign: true })}</span>
          </h2>
        </header>

        <div className="results-grid">
          <section>
            <h3>Revenue by pool</h3>
            <ul className="plain-list">
              {POOLS.map((p) => (
                <li key={p} className="row-between">
                  <span>
                    <Icon name={POOL_META[p].icon} size={16} className="inline-icon" /> {POOL_META[p].short}{' '}
                    <span className="muted num">
                      {fmtMw(res.used[p])} · demand {summary.pools[p].growth >= 0 ? '+' : '−'}
                      {Math.abs(summary.pools[p].growth * 100).toFixed(1)}%
                    </span>
                  </span>
                  <span className="num">{fmtMoney(res.revenueByPool[p])}</span>
                </li>
              ))}
              <li className="row-between">
                <span>Costs (power, rent, maintenance, interest)</span>
                <span className="num">{fmtMoney(-(res.costs.power + res.costs.rent + res.costs.maintenance + res.costs.interest))}</span>
              </li>
              <li className="row-between strong">
                <span>Treasury</span>
                <span className="num money">{fmtMoney(res.treasury)}</span>
              </li>
            </ul>
          </section>

          <section>
            <h3>
              Share price <span className="num">{fmtMoney(res.stock.priceBefore)}</span> → <span className="num">{fmtMoney(res.stock.priceAfter)}</span>{' '}
              <span className={`delta delta-${trend(move) > 0 ? 'up' : trend(move) < 0 ? 'down' : 'flat'} num`}>{fmtMoney(move, { sign: true })}</span>
            </h3>
            <ul className="bars">
              {parts.map(([label, v]) => (
                <li key={label}>
                  <span className="bar-label">{label}</span>
                  <span className="bar-track" aria-hidden="true">
                    <span className={`bar ${v >= 0 ? 'bar-up' : 'bar-down'}`} style={{ width: `${(Math.abs(v) / maxPart) * 50}%` }} />
                  </span>
                  <span className="bar-value num">{fmtMoney(v, { sign: true })}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Ranking</h3>
            <ol className="rank-list">
              {rankCompanies(last.after).map((id, i) => (
                <li key={id} className={id === meId ? 'is-me' : undefined}>
                  <span className="rank-pos pixel num">#{i + 1}</span>
                  <span className="rank-name">{names[id]}</span>
                  <span className="rank-price num">{fmtMoney(summary.prices[id] ?? 0)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="results-foot">
          <Button ref={next} variant="primary" size="lg" iconEnd="play" onClick={finish}>
            {last.after.finished ? 'See final ranking' : 'Next round'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
