import { useEffect, useMemo, useRef, useState } from 'react'
import { getCampaign, getFeasibility, getGateSet, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { about, levers, simulate, verdictOf, type Funnel, type Lever, type SimResult, type Verdict } from '../data/simulate'
import { acceptVolume, applyLever, runFeasibility } from '../data/store'
import { absolute } from '../lib/format'

// Zone 5, and the screen nobody else has.
//
// It answers one question: do these criteria hold your daily flow. Two blocks
// answer it. The funnel shows where the target narrows. The verdict says what
// to do about it, and when the answer is no it comes with the two moves worth
// making rather than a list to study.
//
// What is on this screen: volume, criteria, and moves between them. What is
// never on it: a price, a cost, or what a lead costs to produce. The simulator
// negotiates the volume and the criteria. It never negotiates the price.
//
// The one partial exception to the rest of the product is the scan figure at
// the top of the funnel. It is there to teach that we look at many to find few,
// so it is rounded to two figures and always preceded by "about".

// ---------------------------------------------------------------------------
// The wait
// ---------------------------------------------------------------------------

const STAGES = [
  { at: 0, label: 'Reading profiles' },
  { at: 1400, label: 'Measuring reach on their real posts' },
  { at: 2600, label: 'Asking the knockouts' },
  { at: 3700, label: 'Scoring' },
]
const SCAN_MS = 4600

function Scanning({ result, passScore, onDone }: { result: SimResult; passScore: number; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const started = useRef(performance.now())

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const ms = performance.now() - started.current
      setElapsed(ms)
      if (ms >= SCAN_MS) {
        onDone()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onDone])

  const stage = STAGES.filter((s) => elapsed >= s.at).length - 1
  const scanned = Math.round((Math.min(1, elapsed / SCAN_MS) * result.funnel.scanned) / 10) * 10

  return (
    <div className="scanning" role="status" aria-live="polite">
      <div className="scanning-head">
        <b className="num">{scanned.toLocaleString('en-GB')}</b>
        <span>profiles scanned</span>
      </div>
      <ol>
        {STAGES.map((s, i) => (
          <li key={s.label} className={i < stage ? 'done' : i === stage ? 'now' : undefined}>
            <i aria-hidden="true" />
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      {/* The funnel fills as the scan reaches each gate, so the wait shows the
          shape of the answer rather than a spinner. */}
      <div className="card gate-card">
        <h2>Where your target narrows</h2>
        <Funnel result={result} passScore={passScore} upTo={stage} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block one, the funnel
// ---------------------------------------------------------------------------

interface Band { label: string; count: number; width: number; share: number; drop: number | null }

function Funnel({
  result, passScore, upTo,
}: {
  result: { funnel: Funnel }
  passScore: number
  /** How many bands to show. Everything while the scan is done. */
  upTo?: number
}) {
  const f = result.funnel
  const top = Math.max(1, f.scanned)
  // The population is drawn at full width in grey, as the reference. The three
  // gates are drawn against each other, because against the population they all
  // collapse to the same sliver and the narrowing stops being visible. Every
  // band still carries its true share of the total and its drop, so the numbers
  // say what the picture cannot.
  const widest = Math.max(1, f.pastHard)
  const rows: Band[] = [
    { label: 'Profiles looked at', count: f.scanned, width: 1, share: 1, drop: null },
    { label: 'Past the hard filters', count: f.pastHard, width: f.pastHard / widest, share: f.pastHard / top, drop: null },
    { label: 'Past the knockouts', count: f.pastKnockouts, width: f.pastKnockouts / widest, share: f.pastKnockouts / top, drop: null },
    { label: `Scored ${passScore} or above`, count: f.qualified, width: f.qualified / widest, share: f.qualified / top, drop: null },
  ]
  for (let i = 1; i < rows.length; i++) {
    const before = rows[i - 1].count
    if (before <= 0) {
      rows[i].drop = 0
      continue
    }
    const pct = (1 - rows[i].count / before) * 100
    // A band that still holds profiles never reads as a total wipe out, however
    // close the rounding gets.
    rows[i].drop = rows[i].count > 0 ? Math.min(99, Math.round(pct)) : 100
  }

  const shown = upTo === undefined ? rows.length : Math.max(1, upTo + 1)
  return (
    <ol className="funnel-shape">
      {rows.slice(0, shown).map((row, i) => (
        <li key={row.label}>
          <span className="funnel-label">{row.label}</span>
          <span className="funnel-track">
            {/* A minimum width, or a thin band stops being readable. */}
            <i style={{ width: `${Math.max(8, Math.round(row.width * 100))}%` }} />
          </span>
          <span className="funnel-count">
            <b className="num">about {about(row.count)}</b>
            {i > 0 && <small className="num">{share(row.share)} of all</small>}
          </span>
          {row.drop !== null && row.drop > 0 && <span className="funnel-drop num">-{row.drop}%</span>}
        </li>
      ))}
    </ol>
  )
}

/** Under one percent still has to read as a number, not as zero. */
function share(fraction: number): string {
  const pct = fraction * 100
  // Decide on the rounded figure, or 9.99 prints as "10.0%".
  if (Math.round(pct) >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

function Spread({ histogram, passScore }: { histogram: { score: number; count: number }[]; passScore: number }) {
  const tallest = Math.max(1, ...histogram.map((h) => h.count))
  return (
    <ul className="spread">
      {histogram.map((h) => (
        <li key={h.score} className={h.score >= passScore ? 'in' : undefined}>
          <b className="num">{h.score}</b>
          <i style={{ width: `${Math.max(2, Math.round((h.count / tallest) * 300))}px` }} />
          <span className="num">{h.count}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Block two, the verdict
// ---------------------------------------------------------------------------

const HEADLINE: Record<Verdict, (per: number, want: number) => string> = {
  feasible: (_per, want) => `These criteria can deliver your ${want} qualified leads a day.`,
  short: (per) => `These criteria max out around ${per} leads a day.`,
  too_narrow: () => 'These criteria are too narrow for a daily feed. Broaden them or switch to a lower plan.',
}

function Levers({ list, onApply }: { list: Lever[]; onApply: (l: Lever) => void }) {
  if (!list.length) {
    return <p className="hint">No single change moves this much. Loosen a few thresholds together.</p>
  }
  return (
    <ul className="levers">
      {list.map((lever) => (
        <li key={lever.id}>
          <div>
            <b>{lever.label}</b>
            <small>{lever.action}</small>
          </div>
          <button type="button" className="btn small" onClick={() => onApply(lever)}>Apply</button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------

export function Feasibility({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  const run = getFeasibility(campaignId)
  const plan = getSubscription()
  const [scan, setScan] = useState<SimResult | null>(null)

  // What this campaign may take in a day: its own cap, or the whole tier when
  // it has none. Never the monthly balance, which is not a daily number.
  const want = campaign?.dailyCap ?? plan.tier

  const list = useMemo(() => (gates ? levers(gates) : []), [gates])
  if (!campaign || !gates) return null

  // The scan runs at once and the screen spends the wait showing it happen.
  const start = () => setScan(simulate(gates, plan.tier))
  const finish = () => {
    if (scan) runFeasibility(campaignId, scan)
    setScan(null)
  }

  if (scan) return <Scanning result={scan} passScore={gates.passScore} onDone={finish} />

  if (!run) {
    return (
      <div className="empty">
        <h2>Not tested yet</h2>
        <p>Run a sample scan to see what these criteria would deliver in a day.</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={start}>Run the test</button>
        </div>
      </div>
    )
  }

  const verdict = verdictOf(run.estimatedPerDay, want)

  return (
    <>
      <div className="card gate-card">
        <h2>Where your target narrows</h2>
        <Funnel
          result={{
            funnel: {
              scanned: run.sampleSize,
              pastHard: run.passedHard,
              pastKnockouts: run.passedKnockouts,
              qualified: run.qualified,
            },
          }}
          passScore={gates.passScore}
        />
        <p className="gate-lede">
          That is around <b className="num">{run.estimatedPerDay}</b> qualified a day at your current search rate.
        </p>
        <p className="hint">
          A sample, not a promise. Every figure here is an estimate from gate version {run.gateSetVersion}, run on{' '}
          {absolute(run.ranAt)}.
        </p>
      </div>

      <div className={`card verdict-card ${verdict}`}>
        <h2>{verdict === 'feasible' ? 'It holds' : verdict === 'short' ? 'It falls short' : 'Too narrow'}</h2>
        <p className="verdict-line">{HEADLINE[verdict](run.estimatedPerDay, want)}</p>

        {verdict === 'feasible' && (
          <>
            <p className="muted">
              Around {run.estimatedPerDay} a day at this rate, against {want} asked for. There is room.
            </p>
            <div className="verdict-actions">
              <a className="btn primary" href="#/leads">Work the list</a>
            </div>
          </>
        )}

        {verdict !== 'feasible' && (
          <>
            <p className="muted">Two moves would change that.</p>
            <Levers list={list} onApply={(l) => applyLever(campaignId, l)} />
            <div className="verdict-actions">
              {list.length > 0 && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    // Both at once: the first write settles the dials, the
                    // second reads them back and adds its own.
                    applyLever(campaignId, list[0])
                    if (list[1]) applyLever(campaignId, list[1])
                  }}
                >
                  Apply both
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => acceptVolume(campaignId, run.estimatedPerDay)}
              >
                Keep my criteria, take {run.estimatedPerDay} a day
              </button>
              <a className="btn quiet" href="#/account">Look at my plan</a>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Score spread</h2>
        <Spread histogram={run.scoreHistogram} passScore={gates.passScore} />
        <p className="hint">Moving the bar changes what you get, not what you pay.</p>
      </div>

      <div className="page-head">
        <span className="spacer" />
        <a className="btn" href={`#/campaign/${campaignId}/gates`}>Edit the gates</a>
        <button type="button" className="btn" onClick={start}>Run it again</button>
      </div>
    </>
  )
}
