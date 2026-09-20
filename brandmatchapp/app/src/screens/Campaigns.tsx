import { deliveredToday, getActivity, getCampaigns, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { setDailyCap } from '../data/store'
import { Info } from '../components/Info'
import type { Campaign } from '../types'

// The way into the campaign zones, plus the one decision that sits above a
// single campaign: how the searching is shared.
//
// What a campaign gets is a share of the day's effort, not a promise of leads.
// We can decide how much searching to point at a campaign; we cannot decide
// how many people it finds, because that is the rules and the world. A slider
// labelled in leads a day promises something nobody can keep.
//
// Each slider stops at what the others have left, so the shares always add up
// to at most the whole day. A control that lets you set something impossible
// and then explains why is a control that wasted your time.

const DAYS = 30

/** What one point of share is worth, measured from the last month of work. */
function searchesADay(): number {
  const recent = getActivity().slice(-DAYS)
  if (!recent.length) return 0
  return Math.round(recent.reduce((n, d) => n + d.scored, 0) / recent.length)
}

function Split({ campaigns, tier }: { campaigns: Campaign[]; tier: number }) {
  if (campaigns.length < 2) return null
  const pace = searchesADay()
  const pct = (c: Campaign) => Math.round(((c.dailyCap ?? 0) / Math.max(1, tier)) * 100)
  const taken = (except: string) =>
    campaigns.filter((c) => c.id !== except).reduce((n, c) => n + pct(c), 0)
  const spoken = campaigns.reduce((n, c) => n + pct(c), 0)
  const free = Math.max(0, 100 - spoken)

  return (
    <div className="card split-card tight">
      <div className="chart-head">
        <h2>
          How the searching is shared
          <Info text="Your plan buys a day of searching, and the campaigns split it. Each slider stops at what the others have left, so the shares always fit inside one day. How many leads a share brings is the rules and the world, not a setting." />
        </h2>
        <span className="faint num">{spoken}% of the day spoken for{free ? `, ${free}% free` : ''}</span>
      </div>

      <ul className="split-rows">
        {campaigns.map((c, i) => {
          const ceiling = Math.max(0, 100 - taken(c.id))
          const value = Math.min(pct(c), ceiling)
          return (
            <li key={c.id}>
              <span className={`split-dot s${i % 4}`} aria-hidden="true" />
              <span className="split-name">{c.name}</span>
              {/* The track runs the whole day, so a share reads as a share of
                  the day. Dragging stops at what the others have left rather
                  than the track ending there: a bar that looks full at 33%
                  because the rest is taken tells the client nothing. */}
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                aria-label={`${c.name}, share of the searching`}
                onChange={(e) =>
                  setDailyCap(c.id, Math.round((Math.min(Number(e.target.value), ceiling) / 100) * tier))
                }
              />
              <b className="num">
                {value}%
                {pace > 0 && <small>{Math.round((value / 100) * pace).toLocaleString('en-GB')} searches a day</small>}
              </b>
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
              <small>
                qualified today · {Math.round(((c.dailyCap ?? plan.tier) / Math.max(1, plan.tier)) * 100)}% of the
                searching
              </small>
            </span>
          </a>
        ))}
      </div>

      <Split campaigns={campaigns} tier={plan.tier} />
    </div>
  )
}
