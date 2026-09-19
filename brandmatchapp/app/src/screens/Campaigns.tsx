import { deliveredToday, getCampaigns, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { setDailyCap } from '../data/store'
import { Delivery } from '../components/Delivery'
import { Info } from '../components/Info'
import type { Campaign } from '../types'

// The way into the campaign zones. Not one of them itself: it is the index in
// front of them, plus the one decision that belongs above a single campaign.
//
// That decision is how the day is split. The plan is bought by the account and
// spent by the campaigns, so the only place it can be set is here, and the
// only thing a client needs to see is the three numbers underneath: what is
// spoken for, what is still free, and what has been asked for twice.

/**
 * How many leads a day each campaign may take.
 *
 * One bar, one slider a campaign, and three plain numbers under it. The sum
 * may pass the plan on purpose: a client who wants both campaigns fed on a
 * good day sets both high and lets the best fit win. The bar says when that
 * is happening rather than refusing the setting.
 */
function Split({ campaigns, tier }: { campaigns: Campaign[]; tier: number }) {
  if (campaigns.length < 2) return null
  const set = campaigns.filter((c) => c.dailyCap !== null)
  const spoken = set.reduce((n, c) => n + (c.dailyCap ?? 0), 0)
  const sharing = campaigns.length - set.length
  const free = Math.max(0, tier - spoken)
  const over = Math.max(0, spoken - tier)
  const widest = Math.max(tier, spoken)

  return (
    <div className="card split-card">
      <h2>
        How your {tier} a day are shared
        <Info text="Each campaign takes at most its number. A campaign left on 'the rest' takes whatever the others leave. Asking for more than your plan is allowed: on a full day the best fit wins, whichever campaign it comes from." />
      </h2>

      <div className={`split-bar${over ? ' over' : ''}`}>
        {campaigns.map((c, i) => {
          const share = c.dailyCap === null ? free / Math.max(1, sharing) : c.dailyCap
          return (
            <i
              key={c.id}
              className={`s${i % 4}`}
              style={{ width: `${Math.min(100, Math.round((share / widest) * 100))}%` }}
              title={`${c.name}: ${c.dailyCap ?? 'whatever is left'}`}
            />
          )
        })}
        {free > 0 && sharing === 0 && (
          <i className="free" style={{ width: `${Math.round((free / widest) * 100)}%` }} title="Not asked for" />
        )}
      </div>

      <ul className="split-sums">
        <li>
          <b className="num">{spoken}</b>
          <span>a day spoken for</span>
        </li>
        <li className={free > 0 ? 'good' : undefined}>
          <b className="num">{sharing > 0 ? free : free}</b>
          <span>{sharing > 0 ? `a day left, shared by ${sharing}` : 'a day nobody has asked for'}</span>
        </li>
        <li className={over > 0 ? 'warn' : undefined}>
          <b className="num">{over}</b>
          <span>a day more than your plan</span>
        </li>
      </ul>

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
            <b className="num">{c.dailyCap === null ? 'whatever is left' : `${c.dailyCap} a day`}</b>
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
        {over > 0
          ? `You have asked for ${spoken} a day and your plan is ${tier}. On a full day the best fit wins, whichever campaign it came from.`
          : free > 0 && sharing === 0
            ? `${free} a day are not asked for, so they will not be looked for. Raise a campaign to use them.`
            : `Every lead in your plan has somewhere to go.`}
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
      <Delivery campaigns={campaigns} />

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
        {campaigns.map((c) => (
          <a key={c.id} className="campaign-row" href={`#/campaign/${c.id}/brief`}>
            <span className={`dot${c.status === 'live' ? ' on' : ''}`} />
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
    </div>
  )
}
