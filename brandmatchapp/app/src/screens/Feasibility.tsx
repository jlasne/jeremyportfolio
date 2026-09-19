import { useEffect, useRef, useState } from 'react'
import { getCampaign, getFeasibility, getGateSet, getSubscription, getSurvey } from '../data'
import { useStore } from '../data/hooks'
import type { Door } from '../data/pool'
import { about, simulate, verdictOf, type Funnel as Counts, type SimResult, type Verdict } from '../data/simulate'
import { acceptVolume, addSeeds, openDoor, runFeasibility } from '../data/store'
import { cleanHandles } from '../data/seeds'
import { Info } from '../components/Info'

// Zone 5. One question, asked twice: how much do these rules filter, and what
// would change if you opened one of them.
//
// It is a simulation and it says so. We run the campaign's rules over a sample
// of real accounts and count what survives each check. The number worth
// reading is not how many died at a step, it is how much of the world these
// rules keep: one in four hundred is a different business from one in ten, and
// a client who has never seen that number tunes their rules blind.
//
// Nothing here says gate, knockout, median or threshold. And nothing here says
// what a lead costs to produce: this screen negotiates volume and rules, never
// the price.

// ---------------------------------------------------------------------------
// The wait
// ---------------------------------------------------------------------------

const STAGES = [
  { at: 0, label: 'Searching your niches' },
  { at: 1200, label: 'Counting views on their real posts' },
  { at: 2200, label: 'Confirming what they work in' },
  { at: 3200, label: 'Asking your deal breakers' },
  { at: 4100, label: 'Scoring the fit' },
]
const SCAN_MS = 5000

function Scanning({ result, passScore, max, onDone }: { result: SimResult; passScore: number; max: number; onDone: () => void }) {
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
        <span>people looked at</span>
      </div>
      <ol>
        {STAGES.map((s, i) => (
          <li key={s.label} className={i < stage ? 'done' : i === stage ? 'now' : undefined}>
            <i aria-hidden="true" />
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="card gate-card">
        <h2>How much your rules filter</h2>
        <Funnel counts={result.funnel} passScore={passScore} max={max} upTo={stage} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// What the rules keep
// ---------------------------------------------------------------------------

interface Band { label: string; count: number; width: number; kept: number }

/**
 * Five steps, in the order a client thinks of them: we search their niches,
 * keep the big active ones, confirm what each person works in, ask the deal
 * breakers, score the fit. The size check runs before the niche is confirmed
 * because it is free and the confirmation is not.
 *
 * Every row says what share of the people we started with is still standing.
 * The old version said how many were lost at each step, which reads as a list
 * of failures rather than as the shape of a filter.
 */
function Funnel({
  counts, passScore, max, upTo,
}: {
  counts: Counts
  passScore: number
  max: number
  /** How many bands to show. Everything once the scan is done. */
  upTo?: number
}) {
  const f = counts
  const top = Math.max(1, f.scanned)
  const widest = Math.max(1, f.pastHard)
  const rows: Band[] = [
    { label: 'We look at', count: f.scanned, width: 1, kept: 1 },
    { label: 'Big and active enough', count: f.pastHard, width: f.pastHard / widest, kept: f.pastHard / top },
    { label: 'Working in a niche you want', count: f.inNiche, width: f.inNiche / widest, kept: f.inNiche / top },
    { label: 'Past your deal breakers', count: f.pastKnockouts, width: f.pastKnockouts / widest, kept: f.pastKnockouts / top },
    { label: `Brand fit ${Math.round((passScore / max) * 100)}% or more`, count: f.qualified, width: f.qualified / widest, kept: f.qualified / top },
  ]

  const shown = upTo === undefined ? rows.length : Math.max(1, upTo + 1)
  return (
    <ol className="funnel-shape">
      {rows.slice(0, shown).map((row, i) => (
        <li key={row.label}>
          <span className="funnel-label">{row.label}</span>
          <span className="funnel-track">
            <i style={{ width: `${Math.max(8, Math.round(row.width * 100))}%` }} />
          </span>
          <span className="funnel-count">
            <b className="num">about {about(row.count)}</b>
            {i > 0 && <small className="num">{share(row.kept)} still standing</small>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Under one percent still has to read as a number, not as zero. */
function share(fraction: number): string {
  const pct = fraction * 100
  if (Math.round(pct) >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

/** "One in 340". The share written the way people say it out loud. */
function oneIn(kept: number, total: number): string {
  if (kept <= 0) return 'nobody yet'
  const n = Math.round(total / kept)
  return `1 in ${n.toLocaleString('en-GB')}`
}

const VERDICT: Record<Verdict, (per: number, want: number) => string> = {
  feasible: (per, want) => `That is around ${per} a day. You asked for ${want}, so there is room to spare.`,
  short: (per, want) => `That is around ${per} a day, and you asked for ${want}. Open something up below, or take ${per}.`,
  too_narrow: () => 'That is not enough to fill a day. Open something up below, or move to a smaller plan.',
}

function span(days: number): string {
  if (days <= 0) return 'nothing left'
  if (days === 1) return 'about a day'
  if (days < 14) return `about ${days} days`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `about ${weeks} weeks`
  return `about ${Math.round(days / 30)} months`
}

// ---------------------------------------------------------------------------
// What we would change
// ---------------------------------------------------------------------------

/**
 * Each one is measured, not guessed: the whole sample is run again with that
 * single change and the difference is what is printed. What it brings is said
 * in leads a day and in weeks; what it costs is said in the numbers of the
 * people it lets in, never as "slightly lower quality".
 */
function Doors({ list, dry, campaignId, seeds, onOpen }: {
  list: Door[]
  dry: boolean
  campaignId: string
  seeds: number
  onOpen: (d: Door) => void
}) {
  const [asking, setAsking] = useState<string | null>(null)
  const [handles, setHandles] = useState('')
  const [added, setAdded] = useState(0)
  return (
    <div className={`card exits-card${dry ? ' urgent' : ''}`}>
      <h2>
        {dry ? 'What we would change to keep it going' : 'What we would change to get you more'}
        <Info text="Each line is measured by running your whole sample again with that one change, so the gain and the cost are counted, not guessed." />
      </h2>
      <p className="gate-lede">
        Written from your own numbers: these are the rules costing you the most people, in the order they cost them.
      </p>
      <ul className="exits">
        {list.map((door) => (
          <li key={door.id}>
            <div className="exit-text">
              <b>{door.title}</b>
              <span className="exit-move">{door.move}</span>
              <small className="muted">{door.cost}</small>
            </div>
            <div className="exit-gain">
              <b className="num">{door.perDay > 0 ? `+${door.perDay} a day` : `+${about(door.people)} people`}</b>
              <small>{span(door.days)} longer</small>
            </div>
            <div className="exit-act">
              {asking === door.id ? (
                <>
                  <button type="button" className="btn small primary" onClick={() => { onOpen(door); setAsking(null) }}>
                    Open it
                  </button>
                  <button type="button" className="btn small quiet" onClick={() => setAsking(null)}>Keep my rules</button>
                </>
              ) : (
                <button type="button" className="btn small" onClick={() => setAsking(door.id)}>Open this</button>
              )}
            </div>
          </li>
        ))}
        <li className="exit-seeds">
          <div className="exit-text">
            <b>Give us more handles</b>
            <span className="exit-move">
              Accounts you already know that fit. {seeds > 0 ? `You have given us ${seeds}.` : 'You have given us none yet.'}
            </span>
            <small className="muted">
              The people around a good account look like that account. Each handle that fits opens the people next to it.
            </small>
          </div>
          <div className="exit-seed-form">
            <input
              className="input"
              placeholder="@handle, @handle"
              aria-label="Handles to add"
              value={handles}
              onChange={(e) => setHandles(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                const list = cleanHandles(handles)
                if (list.length) { addSeeds(campaignId, list); setAdded(list.length); setHandles('') }
              }}
            />
            <button
              type="button"
              className="btn small"
              disabled={!cleanHandles(handles).length}
              onClick={() => {
                const list = cleanHandles(handles)
                addSeeds(campaignId, list)
                setAdded(list.length)
                setHandles('')
              }}
            >
              Add
            </button>
            {added > 0 && <small className="hint">Added {added}. We check each one against your rules tonight.</small>}
          </div>
        </li>
      </ul>
    </div>
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

  if (!campaign || !gates) return null
  const niches = campaign.extracted.niches
  const max = gates.criteria.length * 2
  // What this campaign may take in a day: its own cap, or the whole tier.
  const want = campaign.dailyCap ?? plan.tier

  const start = () => setScan(simulate(gates, niches, plan.tier))
  const finish = () => {
    if (scan) runFeasibility(campaignId, scan)
    setScan(null)
  }

  if (scan) return <Scanning result={scan} passScore={gates.passScore} max={max} onDone={finish} />

  if (!run) {
    return (
      <div className="empty">
        <h2>Not tested yet</h2>
        <p>We run your rules over a sample of real accounts and tell you how much of the world they keep, and how many leads a day that is.</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={start}>Test my rules</button>
        </div>
      </div>
    )
  }

  const verdict = verdictOf(run.estimatedPerDay, want)
  const counts: Counts = {
    scanned: run.sampleSize, pastHard: run.passedHard, inNiche: run.inNiche,
    pastKnockouts: run.passedKnockouts, qualified: run.qualified,
  }
  const survey = getSurvey(campaignId)

  return (
    <>
      <div className="card gate-card">
        <div className="chart-head">
          <h2>
            How much your rules filter
            <Info text="A simulation over a sample of real accounts, run against the rules you have saved. It is a measurement of your rules, not a promise about next week." />
          </h2>
          <button type="button" className="btn small" onClick={start}>Test again</button>
        </div>
        <p className="filter-headline">
          Your rules keep <b className="num">{oneIn(run.qualified, run.sampleSize)}</b> of the people we look at.
        </p>
        <Funnel counts={counts} passScore={gates.passScore} max={max} />
        <p className={`verdict-line ${verdict}`}>{VERDICT[verdict](run.estimatedPerDay, want)}</p>
        {verdict !== 'feasible' && (
          <div className="verdict-actions">
            <button type="button" className="btn" onClick={() => acceptVolume(campaignId, run.estimatedPerDay)}>
              Keep my rules, take {run.estimatedPerDay} a day
            </button>
            <a className="btn quiet" href="#/account">See my plan</a>
          </div>
        )}
      </div>

      {survey && (
        <Doors
          list={survey.doors}
          dry={survey.room.state === 'dry'}
          campaignId={campaignId}
          seeds={campaign.brief.seeds?.length ?? 0}
          onOpen={(d) => openDoor(campaignId, d)}
        />
      )}
    </>
  )
}
