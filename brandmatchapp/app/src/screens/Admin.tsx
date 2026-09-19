import { useEffect, useState } from 'react'
import { api, hasKey, isDemo, ops, setKey, setDemo, type OpsCampaign, type OpsDay, type OpsOverview, type OpsRun } from '../lib/api'
import { analysisBudgetPerDay, analysedToday, crawlRuns, opsCampaigns, opsDays } from '../mock/ops'
import { money, relative } from '../lib/format'
import { Info } from '../components/Info'

// The internal screen, and the only one that reads the ops surface.
//
// Cost, profiles analysed and fair use live here and nowhere else. Rule one of
// the product is that a client never sees any of it, so this page imports from
// lib/api's `ops` object and from mock/ops, neither of which the client screens
// touch.

/** What each way of searching is called on the cockpit. */
const CHANNEL_LABEL: Record<string, string> = {
  search: 'Hashtag search',
  accounts: 'Account search',
  neighbour: 'Neighbours of good accounts',
  seed: 'Client handles',
}

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
    if (!hasKey()) return
    ops.overview().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Could not read the ops view'))
    ops.runs().then((r) => setRuns(r.runs)).catch(() => { /* stay on the sample */ })
  }, [])

  // The demo is a client's view, and a client has no admin.
  if (!hasKey() || isDemo() || error) return <AdminDoor reason={error} />

  const spentCents = runs.reduce((sum, r) => sum + r.costCents, 0)
  const qualified = runs.reduce((sum, r) => sum + r.qualified, 0)
  const campaigns: OpsCampaign[] = data?.campaigns ?? opsCampaigns
  const days: OpsDay[] = data?.days ?? opsDays

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
          onClick={() => { setKey(''); setDemo(false); window.location.hash = '#/leads'; window.location.reload() }}
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
          <b className="num">{data ? data.accounts.reduce((sum, a) => sum + a.analysisBudgetPerDay, 0) : analysisBudgetPerDay}</b>
          <span>fair use ceiling a day</span>
        </div>
        <div className="tile">
          <b className="num">{money(data ? data.totals.costCentsPerMonth : spentCents, 'USD')}</b>
          <span>crawl cost this month</span>
        </div>
        <div className="tile">
          <b className="num">{data?.totals.marginPct != null ? `${data.totals.marginPct}%` : `${qualified} qualified`}</b>
          <span>{data?.totals.marginPct != null ? 'margin' : 'from these runs'}</span>
        </div>
      </div>

      <div className="card">
        <h2>
          Each campaign, last 30 days
          <Info text="Analysed is every profile the model or the free check looked at. The three passed columns are the funnel: size and activity, then niche, then deal breakers. Held is qualified people not yet handed over, and the days that buys at the campaign's pace. Cost is the crawl, attributed by campaign. The lines under a campaign split it by the way each profile was found: a hashtag search, Instagram's account search, the neighbours of good accounts, or the client's own handles." />
        </h2>
        <div className="compare-scroll">
          <table className="compare cockpit">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Analysed</th>
                <th>Passed size</th>
                <th>Passed niche</th>
                <th>Passed breakers</th>
                <th>Qualified</th>
                <th>Delivered</th>
                <th>Cost</th>
                <th>Per qualified</th>
                <th>Held</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const pct = (n: number) => (c.analysed ? ` ${Math.round((n / c.analysed) * 100)}%` : '')
                const dry = c.daysHeld !== null && c.daysHeld < 3
                return (
                  <tr key={c.id} className={c.status === 'live' ? undefined : 'off'}>
                    <th>
                      {c.name}
                      <small>{c.account}, {c.status}, {c.perDay} a day</small>
                    </th>
                    <td className="num">{c.analysed}</td>
                    <td className="num">{c.passedSize}<small>{pct(c.passedSize)}</small></td>
                    <td className="num">{c.passedNiche}<small>{pct(c.passedNiche)}</small></td>
                    <td className="num">{c.passedBreakers}<small>{pct(c.passedBreakers)}</small></td>
                    <td className="num"><b>{c.qualified}</b><small>{pct(c.qualified)}</small></td>
                    <td className="num">{c.delivered}</td>
                    <td className="num">{money(c.costCents, 'USD', true)}</td>
                    <td className="num">{c.costPerQualifiedCents !== null ? money(c.costPerQualifiedCents, 'USD', true) : 'none yet'}</td>
                    <td className={`num${dry ? ' warn' : ''}`}>
                      {c.held}
                      <small>{c.daysHeld !== null ? ` ${c.daysHeld} ${c.daysHeld === 1 ? 'day' : 'days'}` : ''}</small>
                    </td>
                  </tr>
                )
              }).flatMap((row, i) => {
                const c = campaigns[i]
                const lines = (c.channels ?? []).map((ch) => {
                  const pct = (n: number) => (ch.analysed ? ` ${Math.round((n / ch.analysed) * 100)}%` : '')
                  return (
                    <tr key={`${c.id}-${ch.channel}`} className="channel">
                      <th>{CHANNEL_LABEL[ch.channel] ?? ch.channel}</th>
                      <td className="num">{ch.analysed}</td>
                      <td className="num">{ch.passedSize}<small>{pct(ch.passedSize)}</small></td>
                      <td className="num">{ch.passedNiche}<small>{pct(ch.passedNiche)}</small></td>
                      <td />
                      <td className="num"><b>{ch.qualified}</b><small>{pct(ch.qualified)}</small></td>
                      <td />
                      <td className="num">{money(ch.costCents, 'USD', true)}</td>
                      <td className="num">{ch.costPerQualifiedCents !== null ? money(ch.costPerQualifiedCents, 'USD', true) : 'none yet'}</td>
                      <td />
                    </tr>
                  )
                })
                return [row, ...lines]
              })}
              {campaigns.length === 0 && (
                <tr><td colSpan={10} className="muted left">No campaign yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">Held under three days is a campaign about to run dry under its rules. That is the one to look at first.</p>
      </div>

      <div className="card">
        <h2>Day by day, last two weeks</h2>
        <ul className="ops-days">
          {days.map((d) => {
            const top = Math.max(1, ...days.map((x) => x.analysed))
            return (
              <li key={d.date} title={`${d.date}: ${d.analysed} analysed, ${d.qualified} qualified, ${money(d.costCents, 'USD')}`}>
                <span className="ops-bar">
                  {d.analysed > 0 && <i style={{ height: `${Math.round((d.analysed / top) * 100)}%` }} />}
                  {d.qualified > 0 && <em style={{ height: `${Math.round((d.qualified / top) * 100)}%` }} />}
                </span>
                <b className="num">{d.analysed}</b>
                <small className="num">{d.qualified} in</small>
                <small className="num faint">{money(d.costCents, 'USD')}</small>
              </li>
            )
          })}
        </ul>
        <p className="hint">Grey is analysed, orange is qualified, and the cost under each day is the crawl for that day.</p>
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
