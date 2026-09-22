import { fitOf, getActivity, getCampaignRank, getHotLeads, getQualifiedByCampaign, getTags, nextBatchIn } from '../data'
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
  const all = getActivity()
  const hot = getHotLeads(5)
  const rank = getCampaignRank(DAYS).slice(0, 5)
  const live = rank.filter((r) => r.campaign.status === 'live').length
  // The tiles read the last thirty days whatever the chart is showing: they
  // are the account's state, not a view of it.
  const scored = all.slice(-DAYS).reduce((n, d) => n + d.scored, 0)
  const tags = getTags()

  // One bar a day, stacked by the campaign that found each lead. A qualified
  // lead is someone who passed every hard filter, so the height of a day is
  // the work that survived and each band says which campaign did it.
  const delivered = getQualifiedByCampaign()
  // The tile is the chart, added up. Counting qualified evaluations instead
  // would put a bigger number above a smaller chart with the same name on it:
  // a profile that clears the filters on a full day is a lead tomorrow, not
  // one today.
  const from = Math.max(0, delivered.dates.length - DAYS)
  const qualified = delivered.series.reduce(
    (n, s) => n + s.values.slice(from).reduce((m, v) => m + v, 0),
    0,
  )

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
      </div>

      <div className="tiles four">
        <Tile big={untilNext()} label="until the next search" note="Every morning at 06:00 UTC" />
        <Tile big={qualified.toLocaleString('en-GB')} label="qualified leads" note={`Last ${DAYS} days`} />
        <Tile big={scored.toLocaleString('en-GB')} label="profiles scored" note={`Last ${DAYS} days`} />
        <Tile big={String(live)} label="active campaigns" note={tags.length ? `${tags.length} tags in use` : undefined} />
      </div>

      <Activity
        title="Activity overview"
        dates={delivered.dates}
        bars={delivered.series}
        barsLabel="Qualified leads"
      />

      <div className="two-up level">
        <div className="card">
          <h2>
            Latest hot leads
            <Info
              title="Latest hot leads"
              text={[
                'The best of the most recent delivery, ordered by brand fit.',
                'Not the best of all time. That would be the same five faces every morning, and you would stop reading it by the third day.',
              ]}
            />
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
            <Info
              title="Your campaigns"
              text={[
                'Every qualified lead a campaign has ever handed you.',
                'Beside it, what it is bringing a day right now. A campaign that was good in March and quiet this week shows both numbers rather than only the flattering one.',
              ]}
            />
          </h2>
          <ul className="mini-list">
            {rank.map(({ campaign, perDay, qualified: total }, i) => (
              <li key={campaign.id}>
                <a href={`#/campaign/${campaign.id}/brief`}>
                  <span className={`split-dot s${i % 4}`} aria-hidden="true" />
                  <span className="mini-who">
                    <span className="name">{campaign.name}</span>
                    <span className="handle">
                      {campaign.status === 'live' ? `${perDay} a day` : `Paused, ${perDay} a day`}
                    </span>
                  </span>
                  <b className="num">{total.toLocaleString('en-GB')}<small>qualified leads</small></b>
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
