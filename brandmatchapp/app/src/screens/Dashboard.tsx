import { useState } from 'react'
import { deliveredToday, getCampaigns, getGateSet, getQuota, getSubscription, listLeads } from '../data'
import { useStore } from '../data/hooks'
import {
  advice, byWeek, compare, economics, funnelOf, GROUP_MIN, inPeriod, insight, nicheBands, nudges,
  lostBreakdown, NICHE_MIN, previousPeriod, RATE_MIN, reachBands, readTable, repliedRows,
  scoreBands, SETTLED_DAYS, sizeBands, widenedReading, type Band, type Period,
} from '../data/insights'
import { LOST_LABEL, STATUS_LABEL } from '../data/status'
import { download, toCsv } from '../lib/csv'
import { money } from '../lib/format'

// Zone 1. What the client shows their boss.
//
// Everything here is built from statuses and amounts they typed themselves, so
// the honest thing and the useful thing are the same thing: when a figure rests
// on too little, it says so instead of rounding a guess into a percentage. The
// rules live in data/insights.ts and each one is simple enough that a client
// can check it.
//
// The cost side is their subscription, split across their campaigns. What a
// lead costs us to produce is not on this screen and cannot be reached from it.

const PERIODS: { id: Period; label: string }[] = [
  { id: 7, label: 'Last 7 days' },
  { id: 30, label: 'Last 30 days' },
  { id: 0, label: 'All time' },
]

const DISMISSED = 'brandmatch.nudges'

/** A share, or an honest blank. Never a percentage on a handful of rows. */
function Rate({ value, base, unit = 'leads' }: { value: number | null; base: number; unit?: string }) {
  if (value === null) {
    return (
      <span className="rate thin" title={`Only ${base} ${unit} so far. We wait for ${RATE_MIN}.`}>
        too few yet
      </span>
    )
  }
  return (
    <span className="rate">
      {Math.round(value * 100)}%
      <small>of {base}</small>
    </span>
  )
}

/** What one of the four numbers says, written as a person would say it. */
function Typical({ title, table, side, muted }: {
  title: string
  table: ReturnType<typeof compare>
  side: 'all' | 'replied'
  muted?: boolean
}) {
  return (
    <div className={`typical${muted ? ' muted-card' : ''}`}>
      <h3>{title}</h3>
      <ul>
        {table.map((row) => (
          <li key={row.label}>
            <b className="num">{row.format(side === 'all' ? row.all : row.replied)}</b>
            <span>{row.label.toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Suggestions({ list }: { list: ReturnType<typeof advice> }) {
  if (!list.length) return null
  return (
    <ul className="suggestions">
      {list.map((a) => (
        <li key={a.id}>
          <span>{a.text}</span>
          {a.action && a.href && <a className="btn small" href={a.href}>{a.action}</a>}
        </li>
      ))}
    </ul>
  )
}

function Bands({ rows, title }: { rows: Band[]; title: string }) {
  const top = Math.max(0.01, ...rows.map((b) => b.rate ?? 0))
  return (
    <div className="band-group">
      <h3>{title}</h3>
      <ul className="bands">
        {rows.map((b) => (
          <li key={b.label}>
            <span className="band-label">{b.label}</span>
            <span className="band-track">
              <i style={{ width: `${Math.round(((b.rate ?? 0) / top) * 100)}%` }} />
            </span>
            <Rate value={b.rate} base={b.delivered} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What this screen says before it has anything to say.
 *
 * A dashboard on day one is twenty rows of zeros and "too few yet", which is
 * honest and useless at the same time. It is the first screen a paying client
 * sees, so it answers the question they actually have: what happens next.
 *
 * Three cases, and they are different questions. No campaign at all. A
 * campaign whose first morning has not come. And enough leads to count but
 * not enough to compare.
 */
function Starting({ leads, total, campaigns, days }: {
  /** Leads inside the window being looked at. */
  leads: number
  /** Leads on the account, whatever the window. */
  total: number
  campaigns: { id: string; name: string }[]
  days: Period
}) {
  if (!campaigns.length) {
    return (
      <div className="card">
        <h2>Nothing is running yet</h2>
        <p className="gate-lede">
          Tell us who you want to reach and what you sell them. We turn that into rules you can change, test them
          against real accounts, and the first leads land the next morning.
        </p>
        <div className="verdict-actions">
          <a className="btn primary" href="#/campaign/new">Start a campaign</a>
        </div>
      </div>
    )
  }
  if (total === 0) {
    return (
      <div className="card">
        <h2>Your first leads land tomorrow morning</h2>
        <p className="gate-lede">
          We are searching tonight. Two things are worth doing while you wait: read your rules once to check they say
          what you mean, and test them so you know how many to expect each day.
        </p>
        <div className="verdict-actions">
          <a className="btn" href={`#/campaign/${campaigns[0].id}/gates`}>Read my rules</a>
          <a className="btn primary" href={`#/campaign/${campaigns[0].id}/feasibility`}>Test them</a>
        </div>
      </div>
    )
  }
  return (
    <div className="card">
      <h2>Too early to read anything into it</h2>
      <p className="gate-lede">
        {leads} {leads === 1 ? 'lead' : 'leads'} {days ? `in the last ${days} days` : 'so far'}. A share starts meaning
        something at about {RATE_MIN}, because below that one reply moves it by more than five points.
      </p>
      <p className="muted">
        The counts below are real. Everything else appears on its own, the day there is enough behind it.
      </p>
      <div className="verdict-actions">
        <a className="btn primary" href="#/leads">Work the list</a>
      </div>
    </div>
  )
}

export function Dashboard() {
  useStore()
  const campaigns = getCampaigns()
  const plan = getSubscription()
  const quota = getQuota()
  const [period, setPeriod] = useState<Period>(30)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(DISMISSED) ?? '[]') } catch { return [] }
  })

  const all = listLeads({ campaignId })
  const rows = inPeriod(all, period)
  const before = previousPeriod(all, period)
  const replied = repliedRows(rows)
  const funnel = funnelOf(rows, before)
  const weeks = byWeek(rows)
  const money_ = economics(rows, plan, campaigns, campaignId)
  const campaign = campaigns.find((c) => c.id === campaignId)
  const niches = campaign?.extracted.niches ?? campaigns.flatMap((c) => c.extracted.niches)
  const headline = insight(rows, niches)
  // Niches with a handful of leads can only print "too few yet", so they are
  // counted in a line rather than drawn as five empty rows.
  const niched = nicheBands(rows, niches)
  const shownNiches = niched.filter((b) => b.delivered >= NICHE_MIN)
  const quietNiches = niched.length - shownNiches.length
  // The receipt on any door already opened. Only drawn when there is one.
  const widened = reachBands(rows)
  const wideCampaign = campaignId ?? campaigns.find((c) => c.widened)?.id ?? null
  const table = compare(rows)
  // What the rules currently ask for, so a suggestion can say "and your rules
  // still let them in" rather than guessing.
  const followersFrom = campaignId ? getGateSet(campaignId)?.hard.followersMin ?? null : null
  const tips = advice(rows, niches, funnel, campaignId, followersFrom)
  const lost = lostBreakdown(rows)
  const reminders = nudges(all).filter((n) => !hidden.includes(n.id))
  // Nothing at all, something but not enough, or enough to compare. The blocks
  // below are drawn against this rather than each one printing its own blank.
  const phase = all.length === 0 ? 'none' : rows.length < RATE_MIN ? 'early' : 'ready'

  const dismiss = (id: string) => {
    const next = [...hidden, id]
    setHidden(next)
    try { window.localStorage.setItem(DISMISSED, JSON.stringify(next)) } catch { /* storage off */ }
  }

  const exportReport = () => {
    const lines = [
      { metric: 'Leads delivered', value: rows.length, based_on: `${PERIODS.find((p) => p.id === period)?.label}` },
      ...funnel.map((s) => ({
        metric: STATUS_LABEL[s.status],
        value: s.count,
        based_on: s.rate === null ? 'too few to show a share' : `${Math.round(s.rate * 100)}% of ${s.base}`,
      })),
      { metric: 'Replies', value: money_.replies, based_on: '' },
      { metric: 'Deals signed', value: money_.deals, based_on: '' },
      { metric: 'Value won', value: money(money_.wonCents), based_on: `${money_.deals} deals` },
      { metric: 'Your cost', value: money(money_.costCents), based_on: money_.basis },
      { metric: 'Cost per reply', value: money_.costPerReplyCents ? money(money_.costPerReplyCents) : 'no replies yet', based_on: `${money_.replies} replies` },
      { metric: 'Cost per deal', value: money_.costPerDealCents ? money(money_.costPerDealCents) : 'no deals yet', based_on: `${money_.deals} deals` },
      { metric: 'Return', value: money_.multiple ? `${money_.multiple >= 20 ? Math.round(money_.multiple) : money_.multiple.toFixed(1)}x` : 'no deals yet', based_on: money_.early ? 'early, under three deals' : '' },
    ]
    download(`brandmatch-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(lines, ['metric', 'value', 'based_on']))
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Today</h1>
        <span className="count num">{deliveredToday(campaignId)} leads in</span>
        <span className="spacer" />
        <select
          className="select head-select"
          value={campaignId ?? ''}
          aria-label="Campaign"
          onChange={(e) => setCampaignId(e.target.value || null)}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="select head-select"
          value={period}
          aria-label="Period"
          onChange={(e) => setPeriod(Number(e.target.value) as Period)}
        >
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      {reminders.map((n) => (
        <div key={n.id} className="nudge">
          <span>{n.text}</span>
          <a className="btn small" href={n.href}>{n.action}</a>
          <button type="button" className="btn small quiet" onClick={() => dismiss(n.id)}>Not now</button>
        </div>
      ))}

      {/* Four zeros tell a new client nothing, and the sidebar already carries
          the allowance. The tiles wait until there is something in them. */}
      {phase !== 'none' && (
      <div className="tiles">
        <div className="tile">
          <b className="num">{rows.length}</b>
          <span>leads in this period</span>
        </div>
        <div className="tile">
          <b className="num">{quota.remaining}</b>
          <span>left in your allowance</span>
        </div>
        <div className="tile">
          <b className="num">{replied.length}</b>
          <span>have replied</span>
        </div>
        <div className="tile">
          <b className="num">{money(money_.wonCents)}</b>
          <span>won, from {money_.deals} {money_.deals === 1 ? 'deal' : 'deals'}</span>
        </div>
      </div>
      )}

      {phase !== 'ready' && (
        <Starting leads={rows.length} total={all.length} campaigns={campaigns} days={period} />
      )}

      {/* Block one ------------------------------------------------------- */}
      {phase === 'ready' && (
      <div className="card">
        <h2>Who replies</h2>
        {headline ? (
          <p className="verdict-line">{headline}</p>
        ) : (
          <p className="muted">
            Not enough replies yet to say what they have in common. We need about {GROUP_MIN} before a pattern means
            anything.
          </p>
        )}

        <div className="typicals">
          <Typical title="A typical lead we send you" table={table} side="all" muted />
          {replied.length >= GROUP_MIN ? (
            <Typical title="A typical person who replies" table={table} side="replied" />
          ) : (
            <div className="typical">
              <h3>A typical person who replies</h3>
              <p className="muted">
                {replied.length} {replied.length === 1 ? 'person has' : 'people have'} replied so far. We need about{' '}
                {GROUP_MIN} before this means anything.
              </p>
            </div>
          )}
        </div>
        <p className="reading">{readTable(table, replied.length, Boolean(headline))}</p>
        <p className="hint">
          These are middle values, not averages, so one unusual account cannot pull them. Taken from {rows.length}{' '}
          leads.
        </p>

        <div className="band-grid">
          <Bands rows={sizeBands(rows)} title="How often each size replies" />
          <Bands rows={scoreBands(rows)} title="How often each score replies" />
          {shownNiches.length > 0 && <Bands rows={shownNiches} title="How often each niche replies" />}
        </div>
        <p className="hint">
          A share only appears once {RATE_MIN} leads sit behind it. Below that one reply would swing it, so we say too
          few yet instead.
          {quietNiches > 0 &&
            ` ${quietNiches} other ${quietNiches === 1 ? 'niche has' : 'niches have'} fewer than ${NICHE_MIN} leads so far, so they are left off the chart.`}
        </p>

        {widened.length > 1 && (
          <div className="widened-block">
            <Bands rows={widened} title="What widening your rules cost" />
            <p className="reading">{widenedReading(widened)}</p>
            <p className="hint">
              Leads sent in the last {SETTLED_DAYS} days are left out here. Everyone past your first rules arrived
              after you opened them, so counting the newest would call them silent when nobody has written yet.
            </p>
            {wideCampaign && (
              <div className="verdict-actions">
                <a className="btn small" href="#/leads?reach=wider">See those leads</a>
                <a className="btn small quiet" href={`#/campaign/${wideCampaign}/room`}>Manage what is open</a>
              </div>
            )}
          </div>
        )}
        <Suggestions list={tips.filter((t) => t.id !== 'after-reply')} />
      </div>
      )}

      {/* Block two ------------------------------------------------------- */}
      {phase !== 'none' && (
      <div className="card">
        <h2>How far your leads get</h2>
        <ol className="funnel-shape steps">
          {funnel.map((step, i) => (
            <li key={step.status}>
              <span className="funnel-label">{STATUS_LABEL[step.status]}</span>
              <span className="funnel-track">
                <i style={{ width: step.count ? `${Math.max(8, Math.round((step.count / Math.max(1, funnel[0].count)) * 100))}%` : 0 }} />
              </span>
              <span className="funnel-count">
                <b className="num">{step.count}</b>
              </span>
              <span className="funnel-drop">
                {i > 0 && <Rate value={step.rate} base={step.base} />}
                {i > 0 && step.rate !== null && step.was !== null && (
                  <small className={`trend${step.rate >= step.was ? ' up' : ''}`}>
                    {step.rate >= step.was ? 'up from' : 'down from'} {Math.round(step.was * 100)}%
                  </small>
                )}
              </span>
            </li>
          ))}
        </ol>

        <h3>Reply rate, week by week</h3>
        <ul className="weeks">
          {weeks.map((w) => (
            <li key={w.start}>
              <span className="week-bar">
                {/* A week with nothing in it draws nothing, not a hairline. */}
                {w.delivered > 0 && <i style={{ height: `${Math.round(((w.rate ?? 0) / 0.6) * 100)}%` }} />}
              </span>
              <b className="num">{w.rate === null ? '' : `${Math.round(w.rate * 100)}%`}</b>
              <small>{w.delivered} in</small>
            </li>
          ))}
        </ul>

        {lost.length > 0 && (
          <p className="hint">
            Of the {lost.reduce((sum, l) => sum + l.count, 0)} you dropped:{' '}
            {lost.map((l) => `${l.count} ${LOST_LABEL[l.reason].toLowerCase()}`).join(', ')}. Counting silence as a
            reply is how a reply rate stops meaning anything.
          </p>
        )}

        <Suggestions list={tips.filter((t) => t.id === 'after-reply')} />

        {campaigns.length > 1 && !campaignId && (
          <>
            <h3>One campaign against the other</h3>
            <div className="compare-scroll">
            <table className="compare">
              <thead>
                <tr>
                  <th />
                  {['Delivered', ...funnel.slice(1).map((s) => STATUS_LABEL[s.status])].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const mine = inPeriod(listLeads({ campaignId: c.id }), period)
                  const steps = funnelOf(mine)
                  return (
                    <tr key={c.id}>
                      <th>{c.name}</th>
                      <td className="num">{mine.length}</td>
                      {steps.slice(1).map((s) => (
                        <td key={s.status} className="num">
                          {s.count}
                          {s.rate !== null && <small> {Math.round(s.rate * 100)}%</small>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
      )}

      {/* Block three ----------------------------------------------------- */}
      {phase === 'ready' && (
      <div className="card">
        <h2>What you got back</h2>
        <div className="tiles">
          <div className="tile">
            <b className="num">{money_.costPerReplyCents ? money(money_.costPerReplyCents) : '—'}</b>
            <span>per reply</span>
            <small className="faint">{money_.replies} {money_.replies === 1 ? 'reply' : 'replies'}</small>
          </div>
          <div className="tile">
            <b className="num">{money_.costPerDealCents ? money(money_.costPerDealCents) : '—'}</b>
            <span>per signed deal</span>
            <small className="faint">
              {money_.deals} {money_.deals === 1 ? 'deal' : 'deals'}{money_.early ? ', early' : ''}
            </small>
          </div>
          <div className="tile">
            <b className="num">
              {/* A decimal on a big multiple is false precision. */}
              {money_.multiple ? `${money_.multiple >= 20 ? Math.round(money_.multiple) : money_.multiple.toFixed(1)}x` : '—'}
            </b>
            <span>back for every euro spent</span>
            <small className="faint">{money(money_.wonCents)} won</small>
          </div>
        </div>
        <p className="hint">
          {money_.basis} That comes to {money(money_.costCents)}. One deal is worth many months of your plan, so the
          ratio grows quickly. The two figures to its left are the ones to plan with.
        </p>
        {money_.early && money_.deals > 0 && (
          <p className="notice">
            These rest on {money_.deals} {money_.deals === 1 ? 'deal' : 'deals'}. Worth watching, too early to plan
            around.
          </p>
        )}
        <div className="verdict-actions">
          <button type="button" className="btn" onClick={exportReport}>Export this for your report</button>
        </div>
      </div>
      )}

      <div className="card">
        <h2>Campaigns</h2>
        {campaigns.length === 0 && (
          <p className="muted">None yet. A campaign is one brief, one set of rules, one daily limit.</p>
        )}
        <ul className="zone-list">
          {campaigns.map((c) => (
            <li key={c.id}>
              <a href={`#/campaign/${c.id}/brief`}>
                <b>{c.name}</b>
                <span className="muted">
                  {deliveredToday(c.id)} today, up to {c.dailyCap ?? 'any number'} a day
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
