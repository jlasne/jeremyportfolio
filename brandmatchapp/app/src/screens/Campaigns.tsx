import { deliveredToday, getActivity, getCampaigns, getDelivery, getFitHistory, getSubscription } from '../data'
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
 * One slider a campaign and the number beside it. No summary bar above them:
 * with a handful of campaigns the sliders are the summary, and a second way
 * of drawing the same split was a second thing to read.
 *
 * A slider stops at what the others have left, so the numbers can never add
 * up to more than the plan. A control that lets you set something impossible
 * and then explains why is a control that wasted your time.
 */
function Split({ campaigns, tier }: { campaigns: Campaign[]; tier: number }) {
  if (campaigns.length < 2) return null
  const taken = (except: string) =>
    campaigns.filter((c) => c.id !== except).reduce((n, c) => n + (c.dailyCap ?? 0), 0)
  const spoken = campaigns.reduce((n, c) => n + (c.dailyCap ?? 0), 0)
  const free = Math.max(0, tier - spoken)

  return (
    <div className="card split-card tight">
      <div className="chart-head">
        <h2>
          How many leads a day
          <Info text="Your plan is bought by the account and spent by the campaigns. Each slider stops at what the others have left, so the numbers always fit inside the plan." />
        </h2>
        <span className="faint num">{spoken} of {tier} a day{free ? `, ${free} free` : ''}</span>
      </div>

      <ul className="split-rows">
        {campaigns.map((c, i) => {
          const ceiling = Math.max(0, tier - taken(c.id))
          const value = Math.min(c.dailyCap ?? ceiling, ceiling)
          return (
            <li key={c.id}>
              <span className={`split-dot s${i % 4}`} aria-hidden="true" />
              <span className="split-name">{c.name}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, ceiling)}
                value={value}
                aria-label={`${c.name}, leads a day`}
                onChange={(e) => setDailyCap(c.id, Number(e.target.value))}
              />
              <b className="num">{value} a day</b>
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
  const activity = getActivity()

  // The bars are what each campaign handed over. One line says how well the
  // search did that day, the other says what the client was asking for, so a
  // drop can be read as the world changing or as the client changing the bar.
  const dates = activity.map((d) => d.date)
  const bars = campaigns.map((c) => {
    const rows = new Map(getDelivery(c.id).map((r) => [r.date, r.delivered]))
    return { id: c.id, name: c.name, values: dates.map((d) => rows.get(d) ?? 0) }
  })
  const first = campaigns[0]
  const lines = [
    { id: 'qualified', name: 'Share that qualified', values: activity.map((d) => (d.scored ? d.qualified / d.scored : 0)) },
    ...(first ? [{ id: 'fit', name: 'Brand fit you asked for', values: getFitHistory(first.id, dates) }] : []),
  ]

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
        barsLabel="Leads delivered"
        lines={lines}
      />
    </div>
  )
}
