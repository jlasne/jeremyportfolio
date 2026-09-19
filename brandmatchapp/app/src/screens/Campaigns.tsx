import { deliveredToday, getCampaigns, getFeasibility, getGateSet, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { setDailyCap } from '../data/store'
import { Info } from '../components/Info'
import type { Campaign } from '../types'

// The way into the campaign zones. Not one of them itself: it is the index in
// front of them.
//
// The number on the right is the campaign's daily limit, the same figure the
// dashboard and the lead list show. It used to be the test estimate, which is
// what the rules could bring rather than what the campaign may take, and the
// two screens disagreed about the same campaign on the same morning.

/**
 * The day, split between campaigns.
 *
 * One bar shows who takes what of the plan. One slider per campaign sets it.
 * The sum may pass the plan: the bar says so, and on such a day the best
 * score wins across campaigns, which is the rule the delivery already
 * follows. A campaign with no number takes whatever the others leave.
 */
function Split({ campaigns, tier }: { campaigns: Campaign[]; tier: number }) {
  if (campaigns.length < 2) return null
  const set = campaigns.filter((c) => c.dailyCap !== null)
  const sum = set.reduce((n, c) => n + (c.dailyCap ?? 0), 0)
  const free = campaigns.length - set.length
  const over = sum > tier
  return (
    <div className="card split-card">
      <h2>
        Your {tier} a day, split
        <Info text="Each campaign takes at most its number. A campaign with no number takes whatever the others leave. When the numbers add up to more than your plan, the best fit wins that morning, whichever campaign it comes from." />
      </h2>
      <div className={`split-bar${over ? ' over' : ''}`}>
        {campaigns.map((c, i) => {
          const share = c.dailyCap === null ? Math.max(0, tier - sum) / Math.max(1, free) : c.dailyCap
          return (
            <i
              key={c.id}
              className={`s${i % 4}`}
              style={{ width: `${Math.min(100, Math.round((share / Math.max(tier, sum)) * 100))}%` }}
              title={`${c.name}: ${c.dailyCap ?? 'the rest'}`}
            />
          )
        })}
      </div>
      <ul className="split-rows">
        {campaigns.map((c, i) => (
          <li key={c.id}>
            <span className={`split-dot s${i % 4}`} aria-hidden="true" />
            <span className="split-name">{c.name}</span>
            <input
              type="range"
              min={0}
              max={tier}
              value={c.dailyCap ?? 0}
              aria-label={`${c.name}, leads a day`}
              onChange={(e) => setDailyCap(c.id, Number(e.target.value))}
            />
            <b className="num">{c.dailyCap === null ? 'the rest' : `${c.dailyCap} a day`}</b>
            <button
              type="button"
              className="btn small quiet"
              onClick={() => setDailyCap(c.id, c.dailyCap === null ? Math.floor(tier / campaigns.length) : null)}
            >
              {c.dailyCap === null ? 'Set a number' : 'Take the rest'}
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">
        {over
          ? `That adds up to ${sum}, and your plan is ${tier}. On a full day the best fit wins.`
          : `${sum} of ${tier} spoken for${free ? `, the rest shared by ${free}` : ''}.`}
      </p>
    </div>
  )
}

export function Campaigns() {
  useStore()
  const campaigns = getCampaigns()
  const plan = getSubscription()
  return (
    <div className="page">
      <div className="page-head">
        <h1>Campaigns</h1>
        <span className="spacer" />
        <a className="btn primary" href="#/campaign/new">New campaign</a>
      </div>
      <p className="subhead">Each campaign has its own brief and its own rules. They share your plan.</p>
      <Split campaigns={campaigns} tier={plan.tier} />
      <div className="list">
        {campaigns.length === 0 && (
          <div className="empty">
            <h2>No campaign yet</h2>
            <p>Two questions, and we write the rules. You can change every one of them afterwards.</p>
            <div className="actions">
              <a className="btn primary" href="#/campaign/new">Start a campaign</a>
            </div>
          </div>
        )}
        {campaigns.map((c) => {
          const gates = getGateSet(c.id)
          const run = getFeasibility(c.id)
          return (
            <a key={c.id} className="campaign-row" href={`#/campaign/${c.id}/brief`}>
              <span className={`dot${c.status === 'live' ? ' on' : ''}`} />
              <span className="who">
                <span className="name">{c.name}</span>
                <span className="handle">{c.brief.audience}</span>
              </span>
              <span className="state">
                Rules version {gates?.version ?? 1}, qualified from{' '}
                {gates ? Math.round((gates.passScore / (gates.criteria.length * 2)) * 100) : 0}% fit
                {run ? '' : ', not tested yet'}
              </span>
              <span className="metric">
                <b className="num">{deliveredToday(c.id)}</b>
                <small>today, up to {c.dailyCap ?? plan.tier} a day</small>
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
