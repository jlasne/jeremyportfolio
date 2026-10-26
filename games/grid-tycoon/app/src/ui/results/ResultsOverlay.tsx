// The round results: a card over the dimmed map (a full sheet on phones) that plays the round in
// 4 beats: demand, revenue, stock move, ranking. Each beat runs a few seconds and the next starts
// on its own; Space / Enter jumps to the next beat, Esc skips to the end, the step tabs revisit any
// beat. Reduced motion shows every beat at once with no animation.
//
// Contract: default export, no props; mounted by the game screen while phase === 'results' and
// useGame.last is set. Stores: useGame (last.before / last.after, meId, finishResults).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { audio } from '../../audio'
import { seasonOf } from '../../engine'
import { mapApi } from '../../map/CompanyMap'
import { useGame } from '../../store/game'
import { SEASON_NAMES } from '../../store/selectors'
import { Button, Icon, fmtMoney, trend, usePhone, useReducedMotion } from '../kit'
import type { IconName } from '../kit'
import { DemandBeat, RankingBeat, RevenueBeat, StockBeat } from './Beats'
import { rankRows, stockDriver, stockRows, whatHappened } from './data'

type BeatId = 'demand' | 'revenue' | 'stock' | 'ranking'
const BEAT_INFO: Record<BeatId, { label: string; title: string; icon: IconName }> = {
  demand: { label: 'Demand', title: 'Demand this round', icon: 'chart' },
  revenue: { label: 'Revenue', title: 'Revenue and costs', icon: 'coin' },
  stock: { label: 'Stock', title: 'Why your price moved', icon: 'arrowUp' },
  ranking: { label: 'Ranking', title: 'Share price ranking', icon: 'flag' },
}
/** How long each beat plays before the next one starts (the step tab fills meanwhile). */
const BEAT_MS = 3800

export default function ResultsOverlay() {
  const last = useGame((s) => s.last)
  const meId = useGame((s) => s.meId)
  const finish = useGame((s) => s.finishResults)
  const reduced = useReducedMotion()
  const phone = usePhone()

  const rootRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [beat, setBeat] = useState(0)
  const [auto, setAuto] = useState(true)
  const [paused, setPaused] = useState(false)
  const [seen, setSeen] = useState(0)
  const cued = useRef(false)
  const coins = useRef(false)

  const data = useMemo(() => {
    if (!last || !meId) return null
    const { before, after } = last
    const me = after.companies.find((c) => c.id === meId)
    const summary = after.history[after.history.length - 1]
    if (!me || !summary) return null
    const resRaw = me.history[me.history.length - 1]
    const res = resRaw && resRaw.round === summary.round ? resRaw : null
    const prevRes = res ? me.history[me.history.length - 2] : undefined
    const ranks = rankRows(before, after, meId)
    const mine = ranks.find((r) => r.isMe)
    const happened = whatHappened(before, after, meId)
    const beats: BeatId[] = res ? ['demand', 'revenue', 'stock', 'ranking'] : ['ranking']
    const move = res ? res.stock.priceAfter - res.stock.priceBefore : 0
    const sentence = res
      ? `Round ${res.round}: profit ${fmtMoney(res.profit, { sign: true })}, share price ${fmtMoney(res.stock.priceBefore)} to ${fmtMoney(res.stock.priceAfter)}, rank ${mine?.rank ?? '?'} of ${ranks.length}. ${stockDriver(stockRows(res), move)}`
      : `Round ${summary.round} resolved. Your company is out of the game; the ranking follows.`
    return { before, after, me, summary, res, prevRes, mine, ranks, happened, beats, move, sentence }
  }, [last, meId])

  const beats = data?.beats ?? ['ranking']
  const lastBeat = beats.length - 1
  const allAtOnce = reduced
  const current: BeatId = beats[Math.min(beat, lastBeat)]

  // Focus the dialog (not the Next button, so Enter steps through the beats first).
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    setSeen((s) => Math.max(s, beat))
  }, [beat])

  // Beat effects: coins over the map with the revenue beat (desktop, where the map stays visible),
  // the stock cue with the stock beat.
  useEffect(() => {
    if (!data) return
    const showing = (id: BeatId) => allAtOnce || beats.indexOf(id) <= seen
    if (!coins.current && !phone && data.res && showing('revenue')) {
      coins.current = true
      mapApi.playResolution(data.before, data.after)
    }
    if (!cued.current && data.res && showing('stock')) {
      cued.current = true
      const t = trend(data.move)
      if (t !== 0) audio.cue(t > 0 ? 'stockUp' : 'stockDown')
    }
  }, [seen, allAtOnce, phone, data, beats])

  if (!data) return null
  const { after, before, summary, res, prevRes, mine, ranks, happened, sentence } = data

  const go = (i: number, stopAuto = false) => {
    setBeat(Math.max(0, Math.min(lastBeat, i)))
    if (stopAuto) setAuto(false)
  }
  const skip = () => {
    setAuto(false)
    setBeat(lastBeat)
    setSeen(lastBeat)
    nextRef.current?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    const onControl = !!t.closest('button, a, input, select, textarea')
    if (e.key === 'Escape') {
      e.preventDefault()
      skip()
    } else if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
      e.preventDefault()
      if (allAtOnce || beat >= lastBeat) finish()
      else go(beat + 1)
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !allAtOnce && !t.closest('input')) {
      e.preventDefault()
      go(beat + (e.key === 'ArrowRight' ? 1 : -1), true)
      if (t.getAttribute('role') === 'tab') requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus())
    }
  }

  const priceDir = trend(data.move)
  const renderBeat = (id: BeatId, active: boolean) => {
    if (id === 'ranking') return <RankingBeat before={before} after={after} summary={summary} meId={meId!} />
    if (!res) return null
    if (id === 'demand') return <DemandBeat summary={summary} res={res} prevRes={prevRes} />
    if (id === 'revenue') return <RevenueBeat res={res} active={active} />
    return <StockBeat res={res} />
  }

  const season = SEASON_NAMES[seasonOf(summary.round)]
  const finalLabel = after.finished ? 'See final ranking' : 'Next round'
  const nextBeat = !allAtOnce && beat < lastBeat ? BEAT_INFO[beats[beat + 1]] : null

  return (
    <div
      ref={rootRef}
      className={`rs-overlay${allAtOnce ? ' is-all' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rs-title"
      aria-describedby="rs-summary"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="rs-card" onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)} onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}>
        <header className="rs-head">
          <div className="rs-head-row">
            <h2 id="rs-title" className="rs-title">
              Round <span className="num">{summary.round}</span> results
            </h2>
            <span className="rs-season caps muted">{season}</span>
          </div>
          <p id="rs-summary" className="visually-hidden">
            {sentence}
          </p>
          {res ? (
            <dl className="rs-hero">
              <div className={`rs-hero-item ${trend(res.profit) >= 0 ? 'is-up' : 'is-down'}`}>
                <dt>Profit</dt>
                <dd className="pixel num">{fmtMoney(res.profit, { sign: true })}</dd>
              </div>
              <div className="rs-hero-item">
                <dt>Share price</dt>
                <dd>
                  <span className="pixel num">{fmtMoney(res.stock.priceAfter)}</span>
                  <span className={`delta delta-${priceDir > 0 ? 'up' : priceDir < 0 ? 'down' : 'flat'}`}>
                    {priceDir !== 0 ? <Icon name={priceDir > 0 ? 'arrowUp' : 'arrowDown'} size={16} /> : null}
                    <span className="num">{fmtMoney(data.move, { sign: true })}</span>
                  </span>
                </dd>
              </div>
              <div className="rs-hero-item">
                <dt>Rank</dt>
                <dd>
                  <span className="pixel num">#{mine?.rank ?? '–'}</span>
                  <span className="rs-hero-of num"> of {ranks.length}</span>
                </dd>
              </div>
            </dl>
          ) : null}
          {happened.length ? (
            <ul className="rs-happened" aria-label="What happened">
              {happened.map((h, i) => (
                <li key={i} className={`rs-happen rs-happen-${h.tone}`}>
                  <Icon name={h.icon} size={16} />
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        {!allAtOnce && beats.length > 1 ? (
          <div className="rs-steps" role="tablist" aria-label="Results steps">
            {beats.map((id, i) => {
              const sel = i === beat
              const playing = sel && auto && i < lastBeat
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`rs-tab-${id}`}
                  aria-selected={sel}
                  aria-controls="rs-panel"
                  tabIndex={sel ? 0 : -1}
                  className={`rs-step-tab${sel ? ' is-selected' : ''}${i <= seen ? ' is-seen' : ''}`}
                  onClick={() => go(i, true)}
                >
                  <span className="rs-step-num num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="rs-step-label">{BEAT_INFO[id].label}</span>
                  <span className="rs-step-bar" aria-hidden="true">
                    <span
                      key={`${beat}-${auto}`}
                      className={`rs-step-fill${playing ? ' is-playing' : ''}`}
                      style={{ animationDuration: `${BEAT_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                      onAnimationEnd={() => playing && go(i + 1)}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="rs-body">
          {allAtOnce ? (
            beats.map((id) => (
              <section key={id} className="rs-beat" aria-labelledby={`rs-h-${id}`}>
                <h3 id={`rs-h-${id}`} className="rs-beat-title">
                  <Icon name={BEAT_INFO[id].icon} size={16} /> {BEAT_INFO[id].title}
                </h3>
                {renderBeat(id, true)}
              </section>
            ))
          ) : (
            <section key={current} id="rs-panel" role="tabpanel" aria-labelledby={`rs-tab-${current}`} className="rs-beat rs-beat-anim">
              <h3 className="rs-beat-title">
                <Icon name={BEAT_INFO[current].icon} size={16} /> {BEAT_INFO[current].title}
              </h3>
              {renderBeat(current, true)}
            </section>
          )}
        </div>

        <footer className="rs-foot">
          <p className="rs-keys muted" aria-hidden="true">
            {allAtOnce ? (
              <>
                <kbd>Enter</kbd> next round
              </>
            ) : (
              <>
                <kbd>Space</kbd> next <kbd>Esc</kbd> skip
              </>
            )}
          </p>
          {nextBeat ? (
            <Button className="rs-next-beat" iconEnd="play" onClick={() => go(beat + 1)}>
              {nextBeat.label}
            </Button>
          ) : null}
          <Button ref={nextRef} variant="primary" size="lg" iconEnd="play" className="rs-finish" data-tut="results-next" onClick={finish}>
            {finalLabel}
          </Button>
        </footer>
        <div className="visually-hidden" aria-live="polite">
          {allAtOnce || beat === 0 ? '' : `${BEAT_INFO[current].title}.`}
        </div>
      </div>
    </div>
  )
}
