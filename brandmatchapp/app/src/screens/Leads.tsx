import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fitOf, getAccountShape, getCampaigns, getGateSet, getLeadEvents, getLeadRow, listLeads, todayCount,
  type LeadRow,
} from '../data'
import { useStore } from '../data/hooks'
import { moveLead, recordDeal, setNote, toggleSaved, undoMove } from '../data/store'
import { LOST_LABEL, LOST_REASONS, nextLabel, nextStatus, STATUSES, STATUS_LABEL } from '../data/status'
import { Avatar } from '../components/Avatar'
import { Range } from '../components/Range'
import { download, toCsv } from '../lib/csv'
import { absolute, compact, money, relative } from '../lib/format'
import { navigate, type Query } from '../lib/router'
import type { LeadStatus, LostReason } from '../types'

// The daily screen, and the one the client lives in.
//
// One rule shapes everything: a status changes in one click from the list,
// without opening anything. Every other decision here follows from protecting
// that click.
//
//   the button carries the next step, never a menu
//   the row does not move when its status changes, or it vanishes under the
//     cursor, which is the classic bug on a filtered list
//   six seconds of undo, because people click the wrong row
//   signed asks for an amount inline, once, and never asks again
//
// The row carries four things: who, how big, how well they fit, and the click.
// Everything else about a person lives behind the click. A list is for moving
// through, and a line that has to be read is a line nobody moves past.
//
// One order, and it is not offered as a choice: people nobody has touched
// first, best fit first inside that. It is the order of the morning.

/** The whole span a size range can cover. Nobody under 5k, no ceiling above 5M. */
const SIZE_SPAN: [number, number] = [5_000, 5_000_000]
const FIT_SPAN: [number, number] = [0, 100]

// ---------------------------------------------------------------------------
// The action cell. This is the whole point of the screen.
// ---------------------------------------------------------------------------

function Action({
  row, undoable, onMove, onUndo, onDeal, onDrop,
}: {
  row: LeadRow
  /** True while this lead's last change can still be taken back. */
  undoable: boolean
  onMove: (to: LeadStatus, lostReason?: LostReason) => void
  onUndo: () => void
  onDeal: (amountCents: number | null) => void
  onDrop: () => void
}) {
  const { lead } = row
  const [asking, setAsking] = useState(false)
  const [amount, setAmount] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const next = nextStatus(lead.status)
  const step = nextLabel(lead.status)

  useEffect(() => {
    if (asking) field.current?.focus()
  }, [asking])

  // Signed was clicked. The lead is already signed; this is only the amount,
  // and it is asked once. A lead that already has a deal never sees it again.
  if (asking) {
    const save = () => {
      const cents = Math.round(Number(amount.replace(/[^\d.]/g, '')) * 100)
      onDeal(Number.isFinite(cents) && cents > 0 ? cents : null)
      setAsking(false)
      setAmount('')
    }
    return (
      <span className="row-act asking">
        <input
          ref={field}
          className="input deal-field"
          inputMode="decimal"
          placeholder="Deal size"
          aria-label="Deal amount in euros"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { onDeal(null); setAsking(false) }
          }}
        />
        <button type="button" className="btn small primary" onClick={save}>Save</button>
        <button type="button" className="btn small quiet" onClick={() => { onDeal(null); setAsking(false) }}>
          Skip
        </button>
      </span>
    )
  }

  return (
    <span className="row-act">
      <small className="row-state">
        {undoable ? (
          <button type="button" className="undo" onClick={onUndo}>Undo</button>
        ) : lead.status === 'lost' && lead.lostReason ? (
          LOST_LABEL[lead.lostReason]
        ) : (
          STATUS_LABEL[lead.status]
        )}
      </small>
      {step && next ? (
        <span className="row-buttons">
          <button
            type="button"
            className="btn small primary"
            onClick={() => {
              onMove(next)
              // Signed is the one step that asks a question, and only when we
              // have not already been told.
              if (next === 'signed' && !row.deal) setAsking(true)
            }}
          >
            {step}
          </button>
          {lead.status !== 'lost' && (
            <button
              type="button"
              className="btn small quiet drop"
              title="Not a fit"
              aria-label="Not a fit"
              onClick={onDrop}
            >
              ✕
            </button>
          )}
        </span>
      ) : (
        lead.status === 'lost' && (
          <button type="button" className="btn small quiet" onClick={() => onMove('new')}>Put back</button>
        )
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

function Row({
  row, open, manyCampaigns, undoable, onMove, onUndo, onDeal,
}: {
  row: LeadRow
  open: boolean
  manyCampaigns: boolean
  undoable: boolean
  onMove: (to: LeadStatus, lostReason?: LostReason) => void
  onUndo: () => void
  onDeal: (amountCents: number | null) => void
}) {
  const { lead, creator, campaign } = row
  const [dropping, setDropping] = useState(false)

  // Asking why takes the whole row. Four answers do not fit in an action cell,
  // and the question deserves to be read rather than squeezed.
  if (dropping) {
    return (
      <div className="contact why-row">
        <span className="why-ask">Dropping {creator.name}. What happened?</span>
        <span className="why-picks">
          {LOST_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="btn small"
              onClick={() => { onMove('lost', r.id); setDropping(false) }}
            >
              {r.label}
            </button>
          ))}
          <button type="button" className="btn small quiet" onClick={() => setDropping(false)}>Keep them</button>
        </span>
      </div>
    )
  }

  return (
    <div className={`contact${open ? ' open' : ''}${lead.status === 'lost' ? ' dropped' : ''}`}>
      <a className="who" href={`#/leads/${lead.id}`}>
        <Avatar name={creator.name} handle={creator.handle} />
        <span className="who-text">
          <span className="name">
            {creator.name}
            {lead.saved && <span className="saved-dot" title="Saved">★</span>}
          </span>
          <span className="handle">@{creator.handle}{manyCampaigns ? ` · ${campaign.name}` : ''}</span>
        </span>
      </a>
      <span className="metric size">
        <b className="num">{compact(creator.followers)}</b>
        <small>followers</small>
      </span>
      <span className="metric fit">
        <b className="num">{fitOf(row)}%</b>
        <small>brand fit</small>
      </span>
      <Action
        row={row}
        undoable={undoable}
        onMove={onMove}
        onUndo={onUndo}
        onDeal={onDeal}
        onDrop={() => setDropping(true)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The panel. For deciding whether to write, not for getting anything done.
// ---------------------------------------------------------------------------

function Panel({ row }: { row: LeadRow }) {
  const { lead, creator, evaluation, campaign, deal } = row
  const gates = getGateSet(campaign.id)
  const events = getLeadEvents(lead.id)
  const [note, setLocal] = useState(lead.note ?? '')

  useEffect(() => setLocal(lead.note ?? ''), [lead.id, lead.note])

  return (
    <aside className="card lead-panel">
      <div className="panel-top">
        <Avatar name={creator.name} handle={creator.handle} size={44} />
        <div>
          <h2>{creator.name}</h2>
          <p className="muted">@{creator.handle}</p>
        </div>
        <button
          type="button"
          className={`btn small${lead.saved ? ' on' : ''}`}
          onClick={() => toggleSaved(lead.id)}
        >
          {lead.saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <p className="muted">{creator.bio}</p>

      <div className="panel-links">
        <a className="btn small" href={`https://instagram.com/${creator.handle}`} target="_blank" rel="noreferrer">
          Open on Instagram
        </a>
        {creator.links[0] && (
          <a className="btn small" href={creator.links[0]} target="_blank" rel="noreferrer">Their link</a>
        )}
        {creator.email && <a className="btn small" href={`mailto:${creator.email}`}>Email them</a>}
      </div>

      <h2>The numbers we found</h2>
      <ul className="facts">
        <li className="yes"><b>{compact(creator.followers)}</b> followers</li>
        <li className="yes"><b>{compact(creator.medianViews ?? 0)}</b> views on a typical post, from their last 12</li>
        <li className="yes"><b>{creator.medianComments ?? 0}</b> comments on a typical post</li>
        <li className="yes"><b>{creator.postsPerMonth ?? 0}</b> posts a month</li>
        <li className={creator.lastPostAt ? 'yes' : 'no'}>
          Last posted {creator.lastPostAt ? relative(creator.lastPostAt) : 'we do not know'}
        </li>
        <li className={creator.email ? 'yes' : 'no'}>{creator.email ?? 'No email on their profile'}</li>
      </ul>
      <p className="hint">Measured {relative(creator.measuredAt)}.</p>

      <h2>Why they reached you</h2>
      <p>
        <b className="num">{fitOf(row)}% brand fit</b>, {lead.score} of {evaluation.criteriaScores.length * 2} on your
        criteria. {evaluation.reason}
      </p>
      <ul className="facts">
        {evaluation.criteriaScores.map((c) => {
          const criterion = gates?.criteria.find((k) => k.id === c.id)
          return (
            <li key={c.id} className={c.score === 2 ? 'yes' : c.score === 1 ? 'half' : 'no'}>
              <b>{c.score === 2 ? 'True' : c.score === 1 ? 'Partly' : 'False'}</b>: {(criterion?.text ?? c.id).replace(/[.]+$/, '')}.
              {c.note ? <span className="muted"> {c.note}</span> : null}
            </li>
          )
        })}
      </ul>
      <p className="hint">
        Checked against your rules, version {evaluation.gateSetVersion}, the ones in use the day this lead arrived.
      </p>

      <h2>Your notes</h2>
      <textarea
        className="textarea"
        rows={3}
        value={note}
        placeholder="What you want to remember about them"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => setNote(lead.id, note.trim())}
      />

      <h2>What happened</h2>
      <ul className="facts">
        {events.map((e) => (
          <li key={e.id} className="yes">
            <b>{STATUS_LABEL[e.to]}</b> {relative(e.at)}
          </li>
        ))}
      </ul>
      {deal && (
        <p className="notice">
          Deal worth <b>{money(deal.amountCents, deal.currency)}</b>, signed {absolute(deal.signedAt)}.
        </p>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------

export function Leads({ leadId, query: params }: { leadId: string | null; query: Query }) {
  useStore()
  const campaigns = getCampaigns()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [status, setStatus] = useState<LeadStatus | null>(null)
  const [size, setSize] = useState<[number, number]>(SIZE_SPAN)
  const [fit, setFit] = useState<[number, number]>(FIT_SPAN)
  const [search, setSearch] = useState('')
  const [undoable, setUndoable] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  // A link from anywhere else can arrive with the filter already set, which is
  // what makes "see the 39 of them" on another screen land on those 39.
  const incoming = `${params.status ?? ''}|${params.campaign ?? ''}`
  useEffect(() => {
    if (params.status && STATUSES.includes(params.status as LeadStatus)) setStatus(params.status as LeadStatus)
    if (params.campaign) setCampaignId(params.campaign)
  }, [incoming])

  const query = {
    campaignId,
    status,
    search,
    followersMin: size[0] > SIZE_SPAN[0] ? size[0] : null,
    followersMax: size[1] < SIZE_SPAN[1] ? size[1] : null,
    fitMin: fit[0] > 0 ? fit[0] : null,
    fitMax: fit[1] < 100 ? fit[1] : null,
  }
  const signature = JSON.stringify(query)

  /**
   * Which rows are on screen is decided once per set of filters, and not again
   * until the filters change. Marking a lead contacted while the Contacted
   * filter is off would otherwise pull the row out from under the cursor.
   */
  // Recomputed when the filters change, and when the account underneath
  // changes: the real account lands a second after the sample painted, and
  // a list remembered from the sample finds none of its rows in it. A status
  // change moves neither flag, so a row never vanishes under the cursor.
  const { live, leadCount } = getAccountShape()
  const ids = useMemo(() => listLeads(query).map((r) => r.lead.id), [signature, live, leadCount])
  const rows = ids.map((id) => getLeadRow(id)).filter((r): r is LeadRow => r !== null)
  const open = leadId ? getLeadRow(leadId) : null
  const today = todayCount(campaignId)
  // Filters over a list that has never held anything are a wall of controls in
  // front of an empty room. They appear with the first lead.
  const anyLeads = listLeads({}).length > 0

  const armUndo = (id: string) => {
    setUndoable(id)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setUndoable(null), 6_000)
  }
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const exportCsv = () => {
    const columns = ['name', 'handle', 'email', 'followers', 'views_per_post', 'brand_fit', 'status', 'campaign', 'delivered', 'note']
    const body = rows.map((r) => ({
      name: r.creator.name,
      handle: `@${r.creator.handle}`,
      email: r.creator.email ?? '',
      followers: r.creator.followers,
      views_per_post: r.creator.medianViews ?? '',
      brand_fit: `${fitOf(r)}%`,
      status: STATUS_LABEL[r.lead.status],
      campaign: r.campaign.name,
      delivered: r.lead.deliveredAt.slice(0, 10),
      note: r.lead.note ?? '',
    }))
    download(`brandmatch-leads-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(body, columns))
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Leads</h1>
        <span className="count num">
          {today.delivered} of {today.target} today
        </span>
        <span className="spacer" />
        <input
          className="input search-field"
          placeholder="Search a name or handle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn" onClick={exportCsv} disabled={!rows.length}>Export</button>
      </div>

      {anyLeads && (
      <>
      <div className="filter-row">
        {campaigns.length > 1 && (
          <select
            className="select"
            value={campaignId ?? ''}
            aria-label="Campaign"
            onChange={(e) => setCampaignId(e.target.value || null)}
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <span className="rule" />
        <button type="button" className={`chip${status === null ? ' on' : ''}`} onClick={() => setStatus(null)}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`chip${status === s ? ' on' : ''}`} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
        <span className="spacer" />
        <span className="faint num">{rows.length} shown</span>
      </div>

      <div className="ranges">
        <Range label="Followers" min={SIZE_SPAN[0]} max={SIZE_SPAN[1]} value={size} scale="log" format={compact} onChange={setSize} />
        <Range label="Brand fit" min={0} max={100} value={fit} format={(n) => `${n}%`} onChange={setFit} />
      </div>
      </>
      )}

      <div className={open ? 'with-panel' : undefined}>
        <div className="list">
          {rows.map((row) => (
            <Row
              key={row.lead.id}
              row={row}
              open={open?.lead.id === row.lead.id}
              manyCampaigns={!campaignId && campaigns.length > 1}
              undoable={undoable === row.lead.id}
              onMove={(to, why) => { moveLead(row.lead.id, to, 'mem_1', why); armUndo(row.lead.id) }}
              onUndo={() => { undoMove(row.lead.id); setUndoable(null) }}
              onDeal={(cents) => { if (cents) recordDeal(row.lead.id, cents) }}
            />
          ))}
          {rows.length === 0 && (
            <Empty waiting={!status && !search && size === SIZE_SPAN && fit === FIT_SPAN} campaignId={campaignId} />
          )}
        </div>
        {open && (
          <div className="panel-side">
            <button type="button" className="btn small quiet" onClick={() => navigate('leads')}>Close</button>
            <Panel row={open} />
          </div>
        )}
      </div>
    </div>
  )
}

/** A fresh campaign has nothing yet. Say when, and what to do until then. */
function Empty({ waiting, campaignId }: { waiting: boolean; campaignId: string | null }) {
  if (!waiting) {
    return (
      <div className="empty">
        <h2>Nothing matches</h2>
        <p>Try a wider filter, or clear the search.</p>
      </div>
    )
  }
  return (
    <div className="empty">
      <h2>Your first leads land tomorrow morning</h2>
      <p>
        We are searching now. While you wait, two things are worth doing: check your rules still say what you mean,
        and test them so you know how many to expect each day.
      </p>
      <div className="actions">
        <a className="btn" href={campaignId ? `#/campaign/${campaignId}/gates` : '#/campaigns'}>Check my rules</a>
        <a className="btn primary" href={campaignId ? `#/campaign/${campaignId}/feasibility` : '#/campaigns'}>
          Test them
        </a>
      </div>
    </div>
  )
}
