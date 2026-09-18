import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getCampaigns, getGateSet, getLeadEvents, getLeadRow, listLeads, todayCount,
  type LeadRow, type LeadSort,
} from '../data'
import { useStore } from '../data/hooks'
import { moveLead, recordDeal, setNote, toggleSaved, undoMove } from '../data/store'
import { LOST_LABEL, LOST_REASONS, nextLabel, nextStatus, STATUSES, STATUS_LABEL } from '../data/status'
import { Avatar } from '../components/Avatar'
import { download, toCsv } from '../lib/csv'
import { absolute, compact, money, relative } from '../lib/format'
import { navigate } from '../lib/router'
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

const FOLLOWER_STEPS = [
  { label: 'Any size', value: null },
  { label: '25k+', value: 25_000 },
  { label: '100k+', value: 100_000 },
  { label: '250k+', value: 250_000 },
]

const SORTS: { id: LeadSort; label: string }[] = [
  { id: 'fit', label: 'Best fit' },
  { id: 'newest', label: 'Newest' },
  { id: 'status', label: 'Furthest along' },
]

/** New today, new this week, or freshly re-measured. */
function badgeFor(row: LeadRow): string | null {
  const day = 86_400_000
  const now = Date.now()
  if (row.lead.refreshedAt && now - new Date(row.lead.refreshedAt).getTime() < 3 * day) return 'Updated'
  const age = now - new Date(row.lead.deliveredAt).getTime()
  if (age < day) return 'New today'
  if (age < 7 * day) return 'New this week'
  return null
}

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
  const { lead, creator, evaluation, campaign } = row
  const badge = badgeFor(row)
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
            {badge && <span className="badge-new">{badge}</span>}
            {lead.saved && <span className="saved-dot" title="Saved">★</span>}
          </span>
          <span className="handle">@{creator.handle}{manyCampaigns ? ` · ${campaign.name}` : ''}</span>
        </span>
      </a>
      <span className="signal-cell muted">{evaluation.reason}</span>
      <span className="metric size">
        <b className="num">{compact(creator.followers)}</b>
        <small>{compact(creator.medianViews ?? 0)} views a post</small>
      </span>
      <span className="metric fit">
        <b className="num">{lead.score}</b>
        <small>of 14</small>
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
      <p>{evaluation.reason}</p>
      <ul className="facts">
        {evaluation.criteriaScores.map((c) => {
          const criterion = gates?.criteria.find((k) => k.id === c.id)
          return (
            <li key={c.id} className={c.score === 2 ? 'yes' : c.score === 1 ? 'half' : 'no'}>
              <b>{criterion?.label ?? c.id}</b> <span className="num">{c.score} of 2</span>. {c.note}
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

export function Leads({ leadId }: { leadId: string | null }) {
  useStore()
  const campaigns = getCampaigns()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [status, setStatus] = useState<LeadStatus | null>(null)
  const [followersMin, setFollowersMin] = useState<number | null>(null)
  const [scoreMin, setScoreMin] = useState<number | null>(null)
  const [savedOnly, setSavedOnly] = useState(false)
  const [sort, setSort] = useState<LeadSort>('fit')
  const [search, setSearch] = useState('')
  const [undoable, setUndoable] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const query = { campaignId, status, search, followersMin, scoreMin, savedOnly, sort }
  const signature = JSON.stringify(query)

  /**
   * Which rows are on screen is decided once per set of filters, and not again
   * until the filters change. Marking a lead contacted while the Contacted
   * filter is off would otherwise pull the row out from under the cursor.
   */
  const ids = useMemo(() => listLeads(query).map((r) => r.lead.id), [signature])
  const rows = ids.map((id) => getLeadRow(id)).filter((r): r is LeadRow => r !== null)
  const open = leadId ? getLeadRow(leadId) : null
  const today = todayCount(campaignId)

  const armUndo = (id: string) => {
    setUndoable(id)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setUndoable(null), 6_000)
  }
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const exportCsv = () => {
    const columns = ['name', 'handle', 'email', 'followers', 'views_per_post', 'fit_score', 'status', 'campaign', 'delivered', 'note']
    const body = rows.map((r) => ({
      name: r.creator.name,
      handle: `@${r.creator.handle}`,
      email: r.creator.email ?? '',
      followers: r.creator.followers,
      views_per_post: r.creator.medianViews ?? '',
      fit_score: `${r.lead.score} of 14`,
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
      </div>

      <div className="filter-row">
        <select
          className="select"
          value={followersMin ?? ''}
          aria-label="Smallest size"
          onChange={(e) => setFollowersMin(e.target.value ? Number(e.target.value) : null)}
        >
          {FOLLOWER_STEPS.map((f) => <option key={f.label} value={f.value ?? ''}>{f.label}</option>)}
        </select>
        <select
          className="select"
          value={scoreMin ?? ''}
          aria-label="Lowest fit score"
          onChange={(e) => setScoreMin(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Any score</option>
          {[10, 11, 12, 13, 14].map((n) => <option key={n} value={n}>{n} of 14 or more</option>)}
        </select>
        <button type="button" className={`chip${savedOnly ? ' on' : ''}`} onClick={() => setSavedOnly(!savedOnly)}>
          Saved only
        </button>
        <span className="rule" />
        {SORTS.map((s) => (
          <button key={s.id} type="button" className={`chip${sort === s.id ? ' on' : ''}`} onClick={() => setSort(s.id)}>
            {s.label}
          </button>
        ))}
        <span className="spacer" />
        <span className="faint num">{rows.length} shown</span>
      </div>

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
            <Empty waiting={!status && !savedOnly && !search} campaignId={campaignId} />
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
