import { deliveredToday, getActivity, getCampaigns, getDelivery, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { setDailyCap } from '../data/store'
import { Activity } from '../components/Activity'
import { Info } from '../components/Info'
import type { Campaign } from '../types'

// The way into the campaign zones, plus the one decision that sits above a
// single campaign: how the day is shared.
//
// The plan is bought by the account and spent by the campaigns, so a campaign
// can never ask for more than what the others have left. The slider stops
// there rather than warning afterwards: a control that lets you set something
// impossible and then explains why is a control that wasted your time.

/**
 * How many leads a day each campaign may take.
 *
 * One line a campaign, one bar above them, and no prose. Everything a client
 * needs is the number they set and the number still free.
 */
function Split({ campaigns, tier }: { campaigns: Campaign[]; tier: number }) {
  if (campaigns.length < 2) return null
  const set = campaigns.filter((c) => c.dailyCap !== null)
  // Older accounts may hold numbers adding up to more than the plan, from
  // before the sliders stopped at it. The bar reads against whichever is
  // larger, so it never draws past its own end.
  const spoken = set.reduce((n, c) => n + (c.dailyCap ?? 0), 0)
  const sharing = campaigns.length - set.length
  const free = Math.max(0, tier - spoken)
  const widest = Math.max(tier, spoken)

  return (
    <div className="card split-card tight">
      <div className="chart-head">
        <h2>
          Your {tier} a day
          <Info text="Each campaign takes at most its number, and the numbers cannot add up to more than your plan. A campaign left on the rest takes whatever the others leave that morning." />
        </h2>
        <span className="faint num">
          {spoken} set{free > 0 ? `, ${free} free` : ''}{sharing > 0 ? `, shared by ${sharing}` : ''}
        </span>
      </div>

      <div className="split-bar">
        {campaigns.map((c, i) => {
          const share = c.dailyCap === null ? free / Math.max(1, sharing) : c.dailyCap
          return (
            <i
              key={c.id}
              className={`s${i % 4}`}
              style={{ width: `${Math.round((share / widest) * 100)}%` }}
              title={`${c.name}: ${c.dailyCap ?? 'whatever is left'}`}
            />
          )
        })}
        {free > 0 && sharing === 0 && (
          <i className="free" style={{ width: `${Math.round((free / widest) * 100)}%` }} title="Not asked for" />
        )}
      </div>

      <ul className="split-rows">
        {campaigns.map((c, i) => {
          // What the others have already taken decides this one's ceiling, so
          // the sum can never pass the plan.
          const others = campaigns
            .filter((x) => x.id !== c.id)
            .reduce((n, x) => n + (x.dailyCap ?? 0), 0)
          const ceiling = Math.max(0, tier - others)
          return (
            <li key={c.id}>
              <span className={`split-dot s${i % 4}`} aria-hidden="true" />
              <span className="split-name">{c.name}</span>
              <input
                type="range"
                min={0}
                max={ceiling}
                value={Math.min(c.dailyCap ?? 0, ceiling)}
                aria-label={`${c.name}, leads a day`}
                onChange={(e) => setDailyCap(c.id, Number(e.target.value))}
              />
              <b className="num">{c.dailyCap === null ? 'the rest' : `${c.dailyCap} a day`}</b>
              <button
                type="button"
                className="btn small quiet"
                onClick={() => setDailyCap(c.id, c.dailyCap === null ? Math.min(ceiling, Math.floor(tier / campaigns.length)) : null)}
              >
                {c.dailyCap === null ? 'Set a number' : 'Take the rest'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Campaigns() {
  useStore()
  const campaigns = getCampaigns()
  const plan = getSubscription()
  const activity = getActivity(30)

  // The bars are what each campaign handed over; the line is how well the
  // search itself did that day. Same dates, two questions.
  const dates = activity.map((d) => d.date)
  const bars = campaigns.map((c) => {
    const rows = new Map(getDelivery(c.id).map((r) => [r.date, r.delivered]))
    return { id: c.id, name: c.name, values: dates.map((d) => rows.get(d) ?? 0) }
  })
  const line = activity.map((d) => (d.scored ? d.qualified / d.scored : 0))

  return (
    <div className="page">
      <div className="page-head">
        <h1>Campaigns</h1>
        <span className="spacer" />
        <a className="btn primary" href="#/campaign/new">New campaign</a>
      </div>
      <p className="subhead">Each campaign has its own brief and its own rules. They share your plan.</p>

      <div className="list campaign-list">
        {campaigns.length === 0 && (
          <div className="empty">
            <h2>No campaign yet</h2>
            <p>Two questions, and we write the rules. You can change every one of them afterwards.</p>
            <div className="actions">
              <a className="btn primary" href="#/campaign/new">Start a campaign</a>
            </div>
          </div>
        )}
        {campaigns.map((c, i) => (
          <a key={c.id} className="campaign-row" href={`#/campaign/${c.id}/brief`}>
            <span className={`split-dot s${i % 4}`} aria-hidden="true" />
            <span className="who">
              <span className="name">{c.name}</span>
              <span className="handle">{c.brief.audience}</span>
            </span>
            <span className="metric">
              <b className="num">{deliveredToday(c.id)}</b>
              <small>today, up to {c.dailyCap ?? plan.tier} a day</small>
            </span>
          </a>
        ))}
      </div>

      <Split campaigns={campaigns} tier={plan.tier} />

      <Activity
        title="What each campaign delivered this month"
        dates={dates}
        bars={bars}
        barsLabel="Leads delivered a day"
        line={line}
        lineLabel="Share that qualified"
      />
    </div>
  )
}
