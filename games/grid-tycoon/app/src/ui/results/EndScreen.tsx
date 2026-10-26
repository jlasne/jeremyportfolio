// The end screen after the last round (solo and multiplayer): a podium with the final share
// prices, every company's price over the game, my key stats, the seed (copy, replay) and a share
// card PNG drawn in the game's pixel style (download, or Web Share with the file when supported).
//
// Contract: default export, no props; rendered full screen when useGame.screen === 'end'.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { rankCompanies } from '../../engine'
import { useGame } from '../../store/game'
import { Button, Icon, fmtMoney } from '../kit'
import { Logo } from '../title/Logo'
import { endStats, priceSeries } from './data'
import { ChartLegend, ChartTable, PriceChart, companyVar, markerOf, markerPath } from './PriceChart'
import { CARD_H, CARD_W, canvasToBlob, drawShareCard } from './shareCard'

type CopyState = 'idle' | 'done' | 'failed'

export default function EndScreen() {
  const state = useGame((s) => s.state)
  const meId = useGame((s) => s.meId)
  const mode = useGame((s) => s.mode)
  const startSolo = useGame((s) => s.startSolo)
  const quit = useGame((s) => s.quitToTitle)
  const headRef = useRef<HTMLHeadingElement>(null)
  const [copy, setCopy] = useState<CopyState>('idle')
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null)
  const [cardError, setCardError] = useState(false)
  const [shareNote, setShareNote] = useState('')

  const view = useMemo(() => {
    if (!state) return null
    const order = rankCompanies(state)
    const companies = order.map((id) => state.companies.find((c) => c.id === id)!)
    const me = meId ? (state.companies.find((c) => c.id === meId) ?? null) : null
    const myRank = me ? order.indexOf(me.id) + 1 : 0
    const series = priceSeries(state)
    const stats = me ? endStats(me) : null
    const runnerUp = companies.find((c) => c.id !== meId)
    return { order, companies, me, myRank, series, stats, runnerUp }
  }, [state, meId])

  useEffect(() => {
    headRef.current?.focus({ preventScroll: true })
  }, [])

  // Draw the share card once.
  useEffect(() => {
    if (!state || !view?.me) return
    let alive = true
    let url = ''
    const me = view.me
    drawShareCard({
      name: me.name,
      rank: view.myRank,
      of: view.order.length,
      price: me.sharePrice,
      startPrice: view.series.find((s) => s.id === me.id)?.prices[0] ?? 10,
      seed: state.seed,
      rounds: state.rounds,
      series: view.series,
      meId,
    })
      .then(canvasToBlob)
      .then((blob) => {
        if (!alive) return
        if (!blob) return setCardError(true)
        url = URL.createObjectURL(blob)
        setCard({ url, blob })
      })
      .catch(() => alive && setCardError(true))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [state, view, meId])

  if (!state || !view) return null
  const { companies, me, myRank, series, stats } = view
  const fileName = `grid-tycoon-seed-${state.seed}.png`
  const file = card && typeof File !== 'undefined' ? new File([card.blob], fileName, { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })
  const shareText = me ? `I finished #${myRank} of ${companies.length} in Grid Tycoon with a share price of ${fmtMoney(me.sharePrice)}. Seed ${state.seed}.` : `Grid Tycoon, seed ${state.seed}.`

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(state.seed))
      setCopy('done')
    } catch {
      setCopy('failed')
    }
    window.setTimeout(() => setCopy('idle'), 2200)
  }
  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'Grid Tycoon', text: shareText })
      setShareNote('Shared.')
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setShareNote('Sharing did not work here: download the image instead.')
    }
  }
  const replay = () => {
    const name = me?.name
    if (mode === 'multi') quit()
    startSolo({ seed: state.seed, name: mode === 'multi' ? undefined : name })
  }
  const fresh = () => {
    const name = mode === 'multi' ? undefined : me?.name
    if (mode === 'multi') quit()
    startSolo({ name })
  }

  const headline = !me ? 'Final ranking' : me.bankrupt ? 'Your company went bankrupt' : myRank === 1 ? 'You win!' : `You finished #${myRank} of ${companies.length}`
  const leader = companies[0]
  const sub = !me
    ? `${leader?.name} leads with ${fmtMoney(leader?.sharePrice ?? 0)}.`
    : myRank === 1 && view.runnerUp
      ? `${me.name} closes at ${fmtMoney(me.sharePrice)}, ${fmtMoney(me.sharePrice - view.runnerUp.sharePrice)} ahead of ${view.runnerUp.name}.`
      : `${me.name} closes at ${fmtMoney(me.sharePrice)}. ${leader?.name} won at ${fmtMoney(leader?.sharePrice ?? 0)}.`

  const podium = companies.slice(0, 3)
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium.length === 2 ? [podium[1], podium[0]] : podium
  const rest = companies.slice(3)

  return (
    <div className="es">
      <header className="es-head">
        <Logo size="small" />
        <p className="caps muted">
          Final ranking · round <span className="num">{Math.min(state.round - 1, state.rounds)}</span> of <span className="num">{state.rounds}</span>
        </p>
        <h2 ref={headRef} tabIndex={-1} className={`es-title${myRank === 1 ? ' is-win' : ''}`}>
          {myRank === 1 ? <Icon name="flag" size={32} /> : null}
          {headline}
        </h2>
        <p className="es-sub">{sub}</p>
      </header>

      <div className="es-grid">
        <div className="es-col">
          <section className="es-card es-podium-card" aria-labelledby="es-rank-h">
            <h3 id="es-rank-h" className="es-card-title">
              <Icon name="flag" size={16} /> Final share prices
            </h3>
            <ol className="es-podium" aria-label="Top three">
              {podiumOrder.map((c) => {
                const rank = companies.indexOf(c) + 1
                const isMe = c.id === meId
                return (
                  <li key={c.id} className={`es-step es-step-${rank}${isMe ? ' is-me' : ''}`} style={{ '--co': companyVar(c.color) } as CSSProperties} value={rank}>
                    <span className="es-step-name">
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ color: companyVar(c.color) }}>
                        <path d={markerPath(markerOf(c.color), 7, 7, 11)} fill="currentColor" />
                      </svg>
                      <span>{c.name}</span>
                    </span>
                    {isMe ? <span className="rs-you">You</span> : null}
                    <span className="es-step-price pixel num">{fmtMoney(c.sharePrice)}</span>
                    <span className="es-block" aria-hidden="true">
                      <span className="pixel num">{rank}</span>
                    </span>
                    <span className="visually-hidden">rank {rank}</span>
                  </li>
                )
              })}
            </ol>
            {rest.length ? (
              <ol className="rs-rank es-rest" start={4}>
                {rest.map((c, i) => (
                  <li key={c.id} className={c.id === meId ? 'is-me' : undefined}>
                    <span className="rs-rank-pos pixel num">#{i + 4}</span>
                    <span className="rank-swatch" style={{ background: companyVar(c.color) }} aria-hidden="true" />
                    <span className="rs-rank-name">
                      {c.name}
                      {c.id === meId ? <span className="rs-you">You</span> : null}
                      {c.bankrupt ? <span className="tag tag-critical">Bankrupt</span> : null}
                    </span>
                    <span className="num strong">{fmtMoney(c.sharePrice)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          {stats ? (
            <section className="es-card es-stats-card" aria-labelledby="es-stats-h">
              <h3 id="es-stats-h" className="es-card-title">
                <Icon name="coin" size={16} /> Your game
              </h3>
              <dl className="es-stats">
                <div>
                  <dt>Total revenue</dt>
                  <dd className="pixel num money">{fmtMoney(stats.totalRevenue)}</dd>
                </div>
                <div>
                  <dt>Best round profit</dt>
                  <dd>
                    <span className="pixel num">{fmtMoney(stats.bestProfit, { sign: true })}</span>
                    {stats.bestProfitRound ? <span className="es-stat-sub num">round {stats.bestProfitRound}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt>Buildings built</dt>
                  <dd className="pixel num">{stats.built}</dd>
                </div>
                <div>
                  <dt>Peak share price</dt>
                  <dd>
                    <span className="pixel num">{fmtMoney(stats.peakPrice)}</span>
                    {stats.peakRound ? <span className="es-stat-sub num">round {stats.peakRound}</span> : null}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
        <div className="es-col">
          <section className="es-card es-chart-card" aria-labelledby="es-chart-h">
            <h3 id="es-chart-h" className="es-card-title">
              <Icon name="chart" size={16} /> Share price over {state.rounds} rounds
            </h3>
            <PriceChart series={series} meId={meId} title={`Share price of every company from the start to round ${state.history.length}`} />
            <ChartLegend series={series} meId={meId} />
            <ChartTable series={series} meId={meId} />
          </section>

          <section className="es-card es-share-card" aria-labelledby="es-share-h">
            <h3 id="es-share-h" className="es-card-title">
              <Icon name="play" size={16} /> Share and replay
            </h3>
            <div className="es-card-img" style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}>
              {card ? (
                <img src={card.url} width={CARD_W} height={CARD_H} alt={`Share card: ${shareText}`} />
              ) : (
                <span className="muted">{cardError ? 'The share card could not be drawn.' : 'Drawing your share card…'}</span>
              )}
            </div>
            <div className="es-share-actions">
              <a
                className={`btn btn-secondary btn-md${card ? '' : ' is-disabled'}`}
                href={card?.url}
                download={fileName}
                aria-disabled={!card || undefined}
                onClick={(e) => !card && e.preventDefault()}
              >
                <Icon name="arrowDown" size={16} />
                <span className="btn-label">Download PNG</span>
              </a>
              {canShareFile ? (
                <Button icon="arrowUp" onClick={share}>
                  Share
                </Button>
              ) : null}
            </div>
            {shareNote ? (
              <p className="field-desc" role="status">
                {shareNote}
              </p>
            ) : null}

            <div className="es-seed">
              <span className="caps muted">Seed</span>
              <span className="pixel num es-seed-value">{state.seed}</span>
              <Button size="sm" icon={copy === 'done' ? 'ok' : 'copy'} onClick={copySeed} aria-label={`Copy seed ${state.seed}`}>
                {copy === 'done' ? 'Copied' : copy === 'failed' ? 'Copy failed' : 'Copy'}
              </Button>
              <span className="visually-hidden" role="status">
                {copy === 'done' ? 'Seed copied.' : copy === 'failed' ? 'Could not copy the seed.' : ''}
              </span>
            </div>
            <p className="field-desc">Same seed, same demand: replay it to beat your price{mode === 'multi' ? ' in a solo game' : ''}.</p>
          </section>
        </div>
      </div>

      <footer className="es-actions">
        <Button variant="primary" size="lg" icon="play" onClick={replay}>
          {mode === 'multi' ? 'Play this seed solo' : 'Replay this seed'}
        </Button>
        <Button size="lg" icon="bolt" onClick={fresh}>
          New game
        </Button>
        <Button variant="ghost" size="lg" icon="close" onClick={quit}>
          Title
        </Button>
      </footer>
    </div>
  )
}
