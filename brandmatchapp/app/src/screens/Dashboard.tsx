import {
  fitOf, getActivity, getCampaignRank, getCrmUpdates, getHotLeads, getTags, nextBatchIn,
} from '../data'
import { useStore } from '../data/hooks'
import { Activity } from '../components/Activity'
import { Avatar } from '../components/Avatar'
import { Info } from '../components/Info'
import { compact, relative } from '../lib/format'
import { hasKey } from '../lib/api'

// The morning page. Five numbers, one chart, two lists, and nothing else.
//
// It answers, in this order: when does the next search land, what did the last
// one bring, and which campaign is carrying the account. A client who opens
// this and closes it again should know whether today needs them.
//
// Volume is on this page on purpose. Thirty leads out of eight thousand
// profiles read is the product, and a client who never sees the eight thousand
// thinks they are paying for a list. What those profiles cost to read is ours
// and stays on the ops surface: there is no money on this screen.

const DAYS = 30

/** A round number of hours, because nobody plans their day around minutes. */
function untilNext(): string {
  const { hours, minutes } = nextBatchIn()
  if (hours >= 1) return `${hours}h`
  return `${minutes}m`
}

function Tile({ big, label, note }: { big: string; label: string; note?: string }) {
  return (
    <div className="tile">
      <b className="num">{big}</b>
      <span>{label}</span>
      {note && <small className="muted">{note}</small>}
    </div>
  )
}

export function Dashboard() {
  useStore()
  const activity = getActivity(DAYS)
  const hot = getHotLeads(5)
  const rank = getCampaignRank(DAYS).slice(0, 5)
  const live = rank.filter((r) => r.campaign.status === 'live').length
  const scored = activity.reduce((n, d) => n + d.scored, 0)
  const qualified = activity.reduce((n, d) => n + d.qualified, 0)
  const updates = getCrmUpdates(DAYS)
  const tags = getTags()

  const dates = activity.map((d) => d.date)
  const bars = [{ id: 'scored', name: 'Profiles read', values: activity.map((d) => d.scored) }]
  const line = activity.map((d) => (d.scored ? d.qualified / d.scored : 0))

  if (!rank.length) {
    return (
      <div className="page">
        <div className="page-head"><h1>Welcome</h1></div>
        <div className="card">
          <h2>Nothing is running yet</h2>
          <p className="gate-lede">
            Tell us who you want to reach and what you sell them. We turn that into rules you can change, test them
            against real accounts, and the first leads land the next morning.
          </p>
          <div className="verdict-actions">
            <a className="btn primary" href="#/campaign/new">Start a campaign</a>
            {hasKey() && (
              <a className="btn quiet" href="#/demo" target="_blank" rel="noreferrer">See it filled with sample data</a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Welcome</h1>
        <span className="count num">{live} {live === 1 ? 'campaign' : 'campaigns'} running</span>
      </div>
      <p className="subhead">
        We read {scored.toLocaleString('en-GB')} profiles for you in the last {DAYS} days and kept{' '}
        {qualified.toLocaleString('en-GB')}.
      </p>

      <div className="tiles five">
        <Tile big={untilNext()} label="until the next search" note="Every morning at 06:00 UTC" />
        <Tile big={qualified.toLocaleString('en-GB')} label="qualified leads" note={`Last ${DAYS} days`} />
        <Tile big={scored.toLocaleString('en-GB')} label="profiles scored" note={`Last ${DAYS} days`} />
        <Tile big={updates.toLocaleString('en-GB')} label="CRM updates" note={`Last ${DAYS} days`} />
        <Tile big={String(live)} label="active campaigns" note={tags.length ? `${tags.length} tags in use` : undefined} />
      </div>

      <Activity
        title="Activity overview"
        dates={dates}
        bars={bars}
        barsLabel="Profiles read a day"
        line={line}
        lineLabel="Share that qualified"
      />

      <div className="two-up">
        <div className="card">
          <h2>
            Latest hot leads
            <Info text="The best of the most recent delivery, by brand fit. Not the best of all time: that would be the same five faces every morning." />
          </h2>
          {hot.length === 0 ? (
            <p className="muted">Nothing delivered yet. The first batch lands tomorrow morning.</p>
          ) : (
            <ul className="mini-list">
              {hot.map((row) => (
                <li key={row.lead.id}>
                  <a href={`#/leads/${row.lead.id}`}>
                    <Avatar name={row.creator.name} handle={row.creator.handle} size={32} />
                    <span className="mini-who">
                      <span className="name">{row.creator.name}</span>
                      <span className="handle">@{row.creator.handle} · {compact(row.creator.followers)} followers</span>
                    </span>
                    <b className="num">{fitOf(row)}%</b>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            {hot.length > 0 && `Delivered ${relative(hot[0].lead.deliveredAt)}.`}{' '}
            <a href="#/leads">See the whole list</a>
          </p>
        </div>

        <div className="card">
          <h2>
            Your campaigns
            <Info text="Ordered by what each one actually brings in a day over the last thirty, not by what it is allowed to take." />
          </h2>
          <ul className="mini-list">
            {rank.map(({ campaign, perDay, delivered }, i) => (
              <li key={campaign.id}>
                <a href={`#/campaign/${campaign.id}/brief`}>
                  <span className={`split-dot s${i % 4}`} aria-hidden="true" />
                  <span className="mini-who">
                    <span className="name">{campaign.name}</span>
                    <span className="handle">
                      {campaign.status === 'live' ? `${delivered} in ${DAYS} days` : `Paused, ${delivered} in ${DAYS} days`}
                    </span>
                  </span>
                  <b className="num">{perDay}<small>a day</small></b>
                </a>
              </li>
            ))}
          </ul>
          <p className="hint"><a href="#/campaigns">Change how the day is shared</a></p>
        </div>
      </div>
    </div>
  )
}
