import { useState } from 'react'
import { getCampaign, getSurvey, listLeads } from '../data'
import { useStore } from '../data/hooks'
import { reachBands, SETTLED_DAYS, widenedReading } from '../data/insights'
import type { Channel, Door, Room as RoomShape, RoomState } from '../data/pool'
import { about } from '../data/simulate'
import { closeDoors, openDoor } from '../data/store'
import { absolute, relative } from '../lib/format'

// Zone 6. It answers one question: how long do these rules keep delivering.
//
// The hardest screen to write honestly, because the honest answer is sometimes
// "not much longer". Four rules keep it from becoming either a scare or a lie.
//
//   Nothing is ever exhausted. It is exhausted under the rules in force today,
//   and those rules are the client's to move.
//
//   One way of searching running dry is not the end. It is said plainly and
//   the screen carries on, because two others are still working. The gauge
//   only reads empty when every one of them is spent.
//
//   Every way out is priced on both sides. What it buys, in people and days.
//   What it costs, in the numbers of the people it lets in.
//
//   And the last door opened comes with its receipt: whether the people it let
//   in actually answer. A promise made three weeks ago is checked here.
//
// The limit we state rather than hide: Instagram publishes no list of
// everyone. What we can reach is what searching, neighbours and your own
// handles turn up, which is a large number and not every number.

function span(days: number): string {
  if (days <= 0) return 'nothing left'
  if (days === 1) return 'about a day'
  if (days < 14) return `about ${days} days`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `about ${weeks} weeks`
  return `about ${Math.round(days / 30)} months`
}

const STATE_LINE: Record<RoomState, (room: RoomShape) => string> = {
  wide: () => 'Nothing to do. We keep looking every night.',
  thin: () => 'Worth deciding now what you would open up, rather than on the morning it stops.',
  dry: (room) =>
    room.allSpent
      ? 'Every way we search has run dry under your current rules.'
      : 'At this pace the flow stops before the month is out.',
}

/** How a way of searching is doing, without ever naming a volume. */
function health(channel: Channel): { label: string; fill: number; tone: string } {
  if (channel.spent) return { label: 'Has run its course', fill: 1, tone: 'out' }
  const left = channel.capacity > 0 ? channel.frontier / channel.capacity : 0
  if (left < 0.3) return { label: 'Slowing down', fill: 1 - left, tone: 'low' }
  return { label: 'Still turning up new people', fill: 1 - left, tone: 'ok' }
}

function Channels({ room }: { room: RoomShape }) {
  const spent = room.channels.filter((c) => c.spent)
  const working = room.channels.filter((c) => !c.spent)
  return (
    <div className="card">
      <h2>Where we are still looking</h2>
      <ul className="ways">
        {room.channels.map((c) => {
          const state = health(c)
          return (
            <li key={c.id} className={state.tone}>
              <span className="way-head">
                <b>{c.label}</b>
                <small>{state.label}</small>
              </span>
              <span className="way-track">
                <i style={{ width: `${Math.max(4, Math.round(state.fill * 100))}%` }} />
              </span>
              <span className="way-note muted">{c.note}</span>
            </li>
          )
        })}
      </ul>
      {spent.length > 0 && working.length > 0 && (
        <p className="gate-lede">
          {spent.length === 1
            ? `${spent[0].label} has run its course.`
            : `${spent.length} of these have run their course.`}{' '}
          {working.length === 1 ? 'The other one is' : `The other ${working.length} are`} still turning up people
          you have never seen.
        </p>
      )}
      {working.length === 0 && (
        <p className="gate-lede">
          All of them have run their course under your current rules. Moving one rule opens them all again.
        </p>
      )}
      <p className="hint">
        Instagram publishes no list of everyone. This is everyone we can reach, which is a large number and not
        every number.
      </p>
    </div>
  )
}

function Doors({ list, dry, onOpen }: { list: Door[]; dry: boolean; onOpen: (d: Door) => void }) {
  const [asking, setAsking] = useState<string | null>(null)
  if (!list.length) return null
  return (
    <div className={`card exits-card${dry ? ' urgent' : ''}`}>
      <h2>{dry ? 'Ways to keep it going' : 'Ways to open it up'}</h2>
      <p className="gate-lede">
        {dry
          ? 'Each one is measured on your own rules. What it brings, and what it costs you.'
          : 'You have room. These are here for the day you want more, with what each one costs.'}
      </p>
      <ul className="exits">
        {list.map((door) => (
          <li key={door.id}>
            <div className="exit-text">
              <b>{door.title}</b>
              <span className="exit-move">{door.move}</span>
              <small className="muted">{door.cost}</small>
            </div>
            <div className="exit-gain">
              <b className="num">about {about(door.people)}</b>
              <small>more people, {span(door.days)} longer</small>
            </div>
            {asking === door.id ? (
              <div className="exit-act">
                <button type="button" className="btn small primary" onClick={() => { onOpen(door); setAsking(null) }}>
                  Open it
                </button>
                <button type="button" className="btn small quiet" onClick={() => setAsking(null)}>Keep my rules</button>
              </div>
            ) : (
              <div className="exit-act">
                <button type="button" className="btn small" onClick={() => setAsking(door.id)}>Open this</button>
              </div>
            )}
            {asking === door.id && (
              <p className="exit-warn">
                Everyone who arrives through this stays marked on your list, so you always know which leads came
                from your first rules and which came from this.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Room({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const out = getSurvey(campaignId)
  if (!campaign || !out) return null
  const { room, doors } = out

  const rows = listLeads({ campaignId })
  const wider = rows.filter((r) => r.lead.reach === 'wider')
  const bands = reachBands(rows)
  const reading = campaign.widened ? widenedReading(bands) : null
  const share = rows.length ? Math.round((wider.length / rows.length) * 100) : 0
  const total = Math.max(1, room.found + room.left)

  return (
    <>
      <div className={`card room-card ${room.state}`}>
        <h2>How much room these rules have left</h2>
        <p className="room-big">
          About <b className="num">{about(room.left)}</b> people still fit your rules and have not been sent to you.
        </p>
        <div className="room-gauge">
          <i className="done" style={{ width: `${Math.round((room.found / total) * 100)}%` }} />
          <i className="ahead" style={{ width: `${Math.round((room.left / total) * 100)}%` }} />
        </div>
        <ul className="room-key">
          <li className="done"><b className="num">{room.found}</b> sent to you already</li>
          <li className="ahead"><b className="num">about {about(room.left)}</b> still to find</li>
        </ul>
        <p className="room-span">
          {span(room.days).charAt(0).toUpperCase() + span(room.days).slice(1)} at {room.perDay} a day.
        </p>
        <p className="gate-lede">{STATE_LINE[room.state](room)}</p>
        <p className="hint">
          An estimate from your rules, not a promise. It moves every night as we search.
        </p>
      </div>

      <Channels room={room} />

      {campaign.widened && (
        <div className="card">
          <h2>What you have already opened</h2>
          <ul className="facts">
            {campaign.widened.doors.map((d) => (
              <li key={d.id} className="half">
                <b>{d.label}</b>. Opened {relative(d.openedAt)}, on {absolute(d.openedAt)}.
              </li>
            ))}
          </ul>
          <p className="gate-lede">
            {wider.length} of your {rows.length} leads came through {campaign.widened.doors.length > 1 ? 'these' : 'it'},{' '}
            {share}% of what you were sent.
          </p>
          {bands.length > 1 && (
            <ul className="bands">
              {bands.map((b) => {
                const top = Math.max(0.01, ...bands.map((x) => x.rate ?? 0))
                return (
                  <li key={b.label}>
                    <span className="band-label">{b.label}</span>
                    <span className="band-track">
                      <i style={{ width: `${Math.round(((b.rate ?? 0) / top) * 100)}%` }} />
                    </span>
                    {b.rate === null ? (
                      <span className="rate thin">too few yet</span>
                    ) : (
                      <span className="rate">{Math.round(b.rate * 100)}%<small>of {b.delivered}</small></span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {reading && <p className="reading">{reading}</p>}
          <p className="hint">
            Leads sent in the last {SETTLED_DAYS} days are left out of these two figures. Nobody has had time to answer them.
          </p>
          <div className="verdict-actions">
            <a className="btn" href="#/leads?reach=wider">See the {wider.length} of them</a>
            <button type="button" className="btn quiet" onClick={() => closeDoors(campaignId)}>
              Put my first rules back
            </button>
          </div>
          <p className="hint">
            Putting them back stops new ones arriving. The leads you already have keep their mark, because they did
            arrive under the wider rules.
          </p>
        </div>
      )}

      <Doors list={doors} dry={room.state === 'dry'} onOpen={(d) => openDoor(campaignId, d)} />

      <div className="page-head">
        <span className="spacer" />
        <a className="btn" href={`#/campaign/${campaignId}/gates`}>Change my rules</a>
        <a className="btn" href={`#/campaign/${campaignId}/feasibility`}>Test them</a>
      </div>
    </>
  )
}
