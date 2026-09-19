import { useEffect, useRef, useState } from 'react'
import { getCampaign, getFeasibility, getGateSet, getSubscription, getSurvey, getVersionRows, type VersionRow } from '../data'
import { useStore } from '../data/hooks'
import type { Channel, Door, Room } from '../data/pool'
import { about, simulate, verdictOf, type Funnel as Counts, type SimResult, type Verdict } from '../data/simulate'
import { acceptVolume, addSeeds, openDoor, restoreVersion, runFeasibility } from '../data/store'
import { cleanHandles } from '../data/seeds'
import { Info } from '../components/Info'
import { absolute } from '../lib/format'
import { DIALS, perNicheKeys, type DialKey } from '../data/tuning'

// Zone 5. It answers three questions, in order: how many a day, for how long,
// and what if.
//
// One screen and not two, because they are the same object looked at twice.
// The funnel says how many of the people we find make it through; the room
// says how many are left to find; the doors say what each rule costs in both.
// A client who has to hold two screens in their head to answer "should I
// loosen this" never answers it.
//
// Nothing here says gate, knockout, median or threshold. And nothing here says
// what a lead costs to produce: this screen negotiates volume and rules, never
// the price. The one figure it borrows from our side of the table is the count
// of people we looked at, rounded to two figures and always "about", because
// the point of it is to teach that we look at many to find few.

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
        <h2>Where people drop out</h2>
        <Funnel counts={result.funnel} passScore={passScore} max={max} upTo={stage} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block one, the funnel
// ---------------------------------------------------------------------------

interface Band { label: string; count: number; width: number; share: number; drop: number | null; was: number | null }

/**
 * Five steps, in the order a client thinks of them: we search their niches,
 * keep the big active ones, confirm what each person works in, ask the deal
 * breakers, score the fit. The size check runs before the niche is confirmed
 * because it is free and the confirmation is not, which is why the counts
 * come in this order and not the other.
 */
function Funnel({
  counts, passScore, max, upTo, before,
}: {
  counts: Counts
  passScore: number
  max: number
  /** How many bands to show. Everything once the scan is done. */
  upTo?: number
  /** The same counts under the version before, for a before and after. */
  before?: Counts | null
}) {
  const f = counts
  const top = Math.max(1, f.scanned)
  const widest = Math.max(1, f.pastHard)
  const rows: Band[] = [
    { label: 'Found, searching your niches', count: f.scanned, width: 1, share: 1, drop: null, was: before?.scanned ?? null },
    { label: 'Big and active enough', count: f.pastHard, width: f.pastHard / widest, share: f.pastHard / top, drop: null, was: before?.pastHard ?? null },
    { label: 'Working in a niche you want', count: f.inNiche, width: f.inNiche / widest, share: f.inNiche / top, drop: null, was: before?.inNiche ?? null },
    { label: 'Passed your deal breakers', count: f.pastKnockouts, width: f.pastKnockouts / widest, share: f.pastKnockouts / top, drop: null, was: before?.pastKnockouts ?? null },
    { label: `Brand fit ${Math.round((passScore / max) * 100)}% or more`, count: f.qualified, width: f.qualified / widest, share: f.qualified / top, drop: null, was: before?.qualified ?? null },
  ]
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].count
    if (prev <= 0) {
      rows[i].drop = 0
      continue
    }
    const pct = (1 - rows[i].count / prev) * 100
    rows[i].drop = rows[i].count > 0 ? Math.min(99, Math.round(pct)) : 100
  }

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
            {i > 0 && <small className="num">{share(row.share)} of all</small>}
            {i > 0 && row.was !== null && about(row.was) !== about(row.count) && (
              <small className={`num was${row.count > row.was ? ' up' : ''}`}>was about {about(row.was)}</small>
            )}
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
  if (Math.round(pct) >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

const VERDICT: Record<Verdict, (per: number, want: number) => string> = {
  feasible: (per, want) => `Around ${per} a day. You asked for ${want}, so there is room to spare.`,
  short: (per, want) => `Around ${per} a day, and you asked for ${want}. Open something up below, or take ${per}.`,
  too_narrow: () => 'Too narrow to fill a day. Open something up below, or move to a smaller plan.',
}

// ---------------------------------------------------------------------------
// Block two, how long it lasts
// ---------------------------------------------------------------------------

function span(days: number): string {
  if (days <= 0) return 'nothing left'
  if (days === 1) return 'about a day'
  if (days < 14) return `about ${days} days`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `about ${weeks} weeks`
  return `about ${Math.round(days / 30)} months`
}

function health(c: Channel): { label: string; tone: string } {
  if (c.spent) return { label: 'run its course', tone: 'out' }
  const left = c.capacity > 0 ? c.frontier / c.capacity : 0
  if (left < 0.3) return { label: 'slowing down', tone: 'low' }
  return { label: 'still finding new people', tone: 'ok' }
}

function Lasting({ room }: { room: Room }) {
  const total = Math.max(1, room.found + room.left)
  const spent = room.channels.filter((c) => c.spent).length
  return (
    <div className={`card room-card ${room.state}`}>
      <h2>
        How long this lasts
        <Info text="Instagram publishes no list of everyone. This is everyone we can reach with three ways of searching, which is a large number and not every number. It is an estimate, and it moves every night." />
      </h2>
      <p className="room-big">
        About <b className="num">{about(room.left)}</b> more people fit these rules.{' '}
        {span(room.days).charAt(0).toUpperCase() + span(room.days).slice(1)} at {room.perDay} a day.
      </p>
      <div className="room-gauge">
        <i className="done" style={{ width: `${Math.round((room.found / total) * 100)}%` }} />
        <i className="ahead" style={{ width: `${Math.round((room.left / total) * 100)}%` }} />
      </div>
      <ul className="room-key">
        <li className="done"><b className="num">{room.found}</b> sent to you</li>
        <li className="ahead"><b className="num">about {about(room.left)}</b> still to find</li>
      </ul>
      <ul className="ways-short">
        {room.channels.map((c) => {
          const h = health(c)
          return (
            <li key={c.id} className={h.tone}>
              <i aria-hidden="true" />
              <span>{c.label}</span>
              <small>{h.label}</small>
            </li>
          )
        })}
      </ul>
      {spent > 0 && spent < room.channels.length && (
        <p className="hint">
          {spent === 1 ? 'One way of searching' : `${spent} ways of searching`} ran its course. The rest still finds
          people you have never seen.
        </p>
      )}
      {room.allSpent && (
        <p className="hint">Every way of searching has run its course under these rules. Opening one rule below starts them all again.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block three, what if
// ---------------------------------------------------------------------------

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
        {dry ? 'Ways to keep it going' : 'What if you opened something up'}
        <Info text="Each one is measured by running the whole sample again with that one change. What it brings is said in leads a day and in weeks. What it costs is said in the numbers of the people it lets in." />
      </h2>
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
// Block four, the versions side by side
// ---------------------------------------------------------------------------

function Versions({ rows, campaignId, max, perNiche }: { rows: VersionRow[]; campaignId: string; max: number; perNiche: DialKey[] }) {
  if (rows.length < 2) return null
  const shown = DIALS.filter((d) => rows.some((r) => typeof r.gates.hard[d.key] === 'number'))
  return (
    <div className="card">
      <h2>
        Your rules, version by version
        <Info text="Every save is a new version and every version was tested on the same people, so the columns compare. Going back writes a new version too, so a lead from last week still points at the rules that chose it." />
      </h2>
      <div className="compare-scroll">
        <table className="compare versions">
          <thead>
            <tr>
              <th />
              {rows.map((r) => (
                <th key={r.gates.id}>
                  v{r.gates.version}{r.current ? ', in use' : ''}
                  <small>{absolute(r.gates.createdAt)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.key}>
                <th>{d.label}</th>
                {rows.map((r) => {
                  const v = r.gates.hard[d.key]
                  return (
                    <td key={r.gates.id} className="num">
                      {typeof v === 'number' ? d.format(v) : r.current && perNiche.includes(d.key) ? 'per niche' : 'not set'}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th>Qualified from</th>
              {rows.map((r) => <td key={r.gates.id} className="num">{Math.round((r.gates.passScore / max) * 100)}%</td>)}
            </tr>
            <tr>
              <th>Deal breakers asked</th>
              {rows.map((r) => <td key={r.gates.id} className="num">{r.gates.knockouts.filter((k) => k.enabled !== false).length}</td>)}
            </tr>
            <tr className="versions-out">
              <th>Make it through</th>
              {rows.map((r) => <td key={r.gates.id} className="num">about {about(r.funnel.qualified)}</td>)}
            </tr>
            <tr className="versions-out">
              <th>A day</th>
              {rows.map((r) => <td key={r.gates.id} className="num"><b>{r.estimatedPerDay}</b></td>)}
            </tr>
            <tr>
              <th />
              {rows.map((r) => (
                <td key={r.gates.id}>
                  {!r.current && (
                    <button type="button" className="btn small" onClick={() => restoreVersion(campaignId, r.gates.id)}>
                      Go back to these
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
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
        <p>We run your rules over a sample of real accounts and tell you how many leads a day they would bring, and for how long.</p>
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
  const versions = getVersionRows(campaignId)
  const previous = versions.find((v) => !v.current) ?? null
  const survey = getSurvey(campaignId)

  return (
    <>
      <div className="page-head test-head">
        <span className="hint">
          Tested on {absolute(run.ranAt)}, rules version {run.gateSetVersion}. A sample, not a promise.
        </span>
        <span className="spacer" />
        <a className="btn" href={`#/campaign/${campaignId}/gates`}>Change my rules</a>
        <button type="button" className="btn primary" onClick={start}>Test again</button>
      </div>

      <div className="card gate-card">
        <h2>Where people drop out</h2>
        <Funnel counts={counts} passScore={gates.passScore} max={max} before={previous?.funnel} />
        <p className={`verdict-line ${verdict}`}>{VERDICT[verdict](run.estimatedPerDay, want)}</p>
        {verdict !== 'feasible' && (
          <div className="verdict-actions">
            <button type="button" className="btn" onClick={() => acceptVolume(campaignId, run.estimatedPerDay)}>
              Keep my rules, take {run.estimatedPerDay} a day
            </button>
            <a className="btn quiet" href="#/account">See my plan</a>
          </div>
        )}
        {previous && (
          <p className="hint">
            "Was" is version {previous.gates.version}, the one before this. The full side by side is at the bottom.
          </p>
        )}
      </div>

      {survey && <Lasting room={survey.room} />}

      {survey && (
        <Doors
          list={survey.doors}
          dry={survey.room.state === 'dry'}
          campaignId={campaignId}
          seeds={campaign.brief.seeds?.length ?? 0}
          onOpen={(d) => openDoor(campaignId, d)}
        />
      )}

      <Versions rows={versions} campaignId={campaignId} max={max} perNiche={perNicheKeys(gates.hard, niches)} />
    </>
  )
}

