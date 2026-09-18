import { useEffect, useState } from 'react'
import { api, isLive, ops, setKey, type OpsOverview, type OpsRun } from '../lib/api'
import { analysisBudgetPerDay, analysedToday, crawlRuns } from '../mock/ops'
import { money, relative } from '../lib/format'

// The internal screen, and the only one that reads the ops surface.
//
// Cost, profiles analysed and fair use live here and nowhere else. Rule one of
// the product is that a client never sees any of it, so this page imports from
// lib/api's `ops` object and from mock/ops, neither of which the client screens
// touch.

/**
 * The way in. One password, exchanged for the owner's key, which is then kept
 * in this browser like any other key. The server decides, not this screen.
 */
function AdminDoor({ reason }: { reason: string }) {
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'checking' | 'failed'>('idle')
  const [message, setMessage] = useState('')

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('checking')
    try {
      const { key } = await api.adminLogin(password)
      setKey(key)
      window.location.reload()
    } catch (err) {
      setState('failed')
      setMessage(err instanceof Error ? err.message : 'That did not work')
    }
  }

  return (
    <div className="page">
      <div className="page-head"><h1>Admin</h1></div>
      <p className="subhead">{reason ? `${reason}. Sign in with the admin password.` : 'Sign in with the admin password.'}</p>
      <form className="admin-door" onSubmit={open}>
        <input
          className="input"
          type="password"
          placeholder="Admin password"
          value={password}
          autoFocus
          aria-label="Admin password"
          onChange={(e) => { setPassword(e.target.value); setState('idle') }}
        />
        <button className="btn primary" type="submit" disabled={state === 'checking' || !password}>
          {state === 'checking' ? 'Checking' : 'Sign in'}
        </button>
        {state === 'failed' && <p className="warn">{message}</p>}
      </form>
    </div>
  )
}

/** The sample view, from mock/ops. Replaced by the ops API once a key is set. */
function sampleRuns(): OpsRun[] {
  return crawlRuns.map((r) => ({
    id: r.id,
    campaignId: r.campaignId,
    phase: r.phase,
    status: r.status,
    profilesFetched: r.profilesFetched,
    profilesEvaluated: r.profilesEvaluated,
    qualified: r.qualified,
    costCents: r.costCents,
    startedAt: new Date(r.startedAt).getTime(),
    finishedAt: r.finishedAt ? new Date(r.finishedAt).getTime() : null,
  }))
}

export function Admin() {
  const [data, setData] = useState<OpsOverview | null>(null)
  const [runs, setRuns] = useState<OpsRun[]>(sampleRuns())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLive()) return
    ops.overview().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Could not read the ops view'))
    ops.runs().then((r) => setRuns(r.runs)).catch(() => { /* stay on the sample */ })
  }, [])

  if (!isLive() || error) return <AdminDoor reason={error} />

  const spentCents = runs.reduce((sum, r) => sum + r.costCents, 0)
  const qualified = runs.reduce((sum, r) => sum + r.qualified, 0)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Admin</h1>
        <span className="spacer" />
        {/* The way back to the sample account. Without it the only exit is the
            browser's own storage panel, and showing the demo to somebody means
            signing out of your own account for a minute. */}
        <button
          type="button"
          className="btn small quiet"
          onClick={() => { setKey(''); window.location.hash = '#/dashboard'; window.location.reload() }}
        >
          Sign out, back to the sample
        </button>
      </div>
      <p className="subhead">Internal. Nothing on this page is readable by a client account.</p>

      <div className="tiles">
        <div className="tile">
          <b className="num">{data ? data.totals.profilesAnalysedToday : analysedToday}</b>
          <span>profiles analysed today</span>
        </div>
        <div className="tile">
          <b className="num">{analysisBudgetPerDay}</b>
          <span>fair use ceiling a day</span>
        </div>
        <div className="tile">
          <b className="num">{money(data ? data.totals.costCentsPerMonth : spentCents, 'USD')}</b>
          <span>crawl cost</span>
        </div>
        <div className="tile">
          <b className="num">{data?.totals.marginPct != null ? `${data.totals.marginPct}%` : `${qualified} qualified`}</b>
          <span>{data?.totals.marginPct != null ? 'margin' : 'from these runs'}</span>
        </div>
      </div>

      <div className="card">
        <h2>Crawl runs</h2>
        <ul className="rules">
          {runs.map((r) => (
            <li key={r.id}>
              <span>
                {r.phase}, {r.status}, {relative(new Date(r.startedAt).toISOString())}
              </span>
              <b className="num">
                {r.profilesFetched} fetched, {r.qualified} qualified, {money(r.costCents, 'USD')}
              </b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
