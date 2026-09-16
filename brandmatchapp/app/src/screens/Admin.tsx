import { useEffect, useRef, useState } from 'react'
import { api, isLive, type AdminOverview, type AdminSettings } from '../lib/api'

// The owner's screen. One slider decides how much of every account's day is
// crawled fresh, and the page says what that does to the pool and the bill
// before the night runs.
//
//   floor    below it the pool cannot keep up. A claim lasts claimDays, so
//            the pool sustains at most free / claimDays leads a day.
//   ceiling  above it Apify eats more than 30% of revenue.

const pct = (n: number) => `${Math.round(n * 100)}%`
const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`

export function Admin() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<AdminSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const timer = useRef<number | null>(null)

  const load = async () => {
    try {
      const d = await api.admin()
      setData(d)
      setDraft(d.settings)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the admin view')
    }
  }

  useEffect(() => { void load() }, [])

  /** A knob moves, the setting lands 400ms after the hand stops. */
  const change = (patch: Partial<AdminSettings>) => {
    if (!draft) return
    const next = { ...draft, ...patch }
    setDraft(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      setSaving(true)
      try {
        await api.setSettings(patch)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
      } finally {
        setSaving(false)
      }
    }, 400)
  }

  if (!isLive()) {
    return (
      <div className="page editor">
        <div className="page-head"><h1>Admin</h1></div>
        <p className="subhead">Paste your key on the API screen first. This page reads the live deployment.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page editor">
        <div className="page-head"><h1>Admin</h1></div>
        <p className="subhead">{error}</p>
      </div>
    )
  }

  if (!data || !draft) {
    return <div className="page editor"><div className="page-head"><h1>Admin</h1></div><p className="subhead">Reading…</p></div>
  }

  const { pool, demand, recommendation: r, cost, accounts, waitlist } = data
  const fresh = draft.freshFloor
  const verdict =
    fresh < r.floor ? `Under the floor. The pool sustains ${pool.sustainablePerDay} a day against ${demand.leadsPerDay} asked. It runs dry.`
    : fresh > r.ceiling ? `Over the ceiling. Apify passes 30% of revenue at this share.`
    : `In range. Recommended ${pct(r.floor)} to ${pct(r.ceiling)}.`

  return (
    <div className="page editor admin">
      <div className="page-head">
        <h1>Admin</h1>
        <span className="faint">{saving ? 'Saving' : 'Live'}</span>
      </div>
      <p className="subhead">
        One number decides the bill: the share of every account's day that is crawled new rather than
        served from the pool. Move it and the cost below moves with it. The night's crawl reads it as is.
      </p>

      <section className="card knob">
        <div className="knob-head">
          <div>
            <span className="eyebrow">Fresh share</span>
            <b className="num knob-value">{pct(fresh)}</b>
          </div>
          <span className={`verdict ${fresh < r.floor || fresh > r.ceiling ? 'bad' : 'good'}`}>{verdict}</span>
        </div>
        <div className="knob-track">
          <input
            className="slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(fresh * 100)}
            style={{ ['--fill' as string]: `${fresh * 100}%` }}
            onChange={(e) => change({ freshFloor: Number(e.target.value) / 100 })}
            aria-label="Share of each day crawled fresh"
          />
          <div className="knob-marks">
            <span style={{ left: pct(r.floor) }} title="Below this the pool runs dry"><i />floor {pct(r.floor)}</span>
            <span style={{ left: pct(r.ceiling) }} title="Above this Apify passes 30% of revenue"><i />ceiling {pct(r.ceiling)}</span>
          </div>
        </div>
        <div className="knob-grid">
          <label>Leads a day, $99 plan<input type="number" value={draft.includedPerDay} onChange={(e) => change({ includedPerDay: Number(e.target.value) })} /></label>
          <label>Claim window, days<input type="number" value={draft.claimDays} onChange={(e) => change({ claimDays: Number(e.target.value) })} /></label>
          <label>Trial, days<input type="number" value={draft.trialDays} onChange={(e) => change({ trialDays: Number(e.target.value) })} /></label>
          <label>Trial, credits<input type="number" value={draft.trialCredits} onChange={(e) => change({ trialCredits: Number(e.target.value) })} /></label>
        </div>
      </section>

      <div className="tiles">
        <div className="card tile">
          <span className="eyebrow">Cost at {pct(fresh)}</span>
          <b className="num">{usd(cost.perMonth)}<small>/mo</small></b>
          <span className="faint">Apify {usd(cost.apifyPerDay)} a day, scoring {usd(cost.scoringPerDay)}. Revenue {usd(cost.revenuePerMonth)}.
            {cost.marginPct !== null ? ` Margin ${cost.marginPct}%.` : ''}</span>
        </div>
        <div className="card tile">
          <span className="eyebrow">Demand</span>
          <b className="num">{demand.leadsPerDay}<small>/day</small></b>
          <span className="faint">{demand.paidAccounts} paid account{demand.paidAccounts === 1 ? '' : 's'}, active agents added up.</span>
        </div>
        <div className="card tile">
          <span className="eyebrow">Pool</span>
          <b className="num">{pool.free.toLocaleString('en-US')}<small> free</small></b>
          <span className="faint">of {pool.size.toLocaleString('en-US')}. Sustains {pool.sustainablePerDay} a day over a {draft.claimDays} day claim.</span>
        </div>
      </div>

      <section className="list admin-table">
        <div className="row head">
          <span>Account</span><span>Plan</span><span>Quota</span><span>Today</span><span>Credits</span><span>Cost / day</span>
        </div>
        {accounts.map((a) => (
          <div className="row" key={a.id}>
            <span className="name">{a.email}{a.role === 'owner' ? <em> owner</em> : null}</span>
            <span>{a.plan}{a.plan === 'trial' ? <small> {a.trialDaysLeft}d left</small> : null}</span>
            <span className="num">{a.quota}</span>
            <span className="num">{a.today}<small> {a.freshToday} fresh, {a.poolToday} pool</small></span>
            <span className="num">{a.credits.toLocaleString('en-US')}</span>
            <span className="num">{usd(a.costPerDay)}</span>
          </div>
        ))}
      </section>

      <section className="card waitlist-box">
        <h2>
          Waitlist
          <span className="spacer" />
          <b className="num">{waitlist.total.toLocaleString('en-US')}</b>
        </h2>
        {waitlist.total === 0 ? (
          <p className="faint">Nobody yet. The form on the landing writes straight here.</p>
        ) : (
          <ul className="waitlist-list">
            {waitlist.recent.map((w) => (
              <li key={w.email}>
                <a href={`mailto:${w.email}`}>{w.email}</a>
                {w.website && <span className="faint">{w.website}</span>}
                <span className="spacer" />
                <span className="faint">{when(w.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** A date said the way a person would say it. */
function when(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
