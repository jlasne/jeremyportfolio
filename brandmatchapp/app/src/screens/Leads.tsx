import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fitOf, getAccountShape, getCampaigns, getGateSet, getLeadEvents, getLeadRow, getTags, listLeads, todayCount,
  type LeadRow,
} from '../data'
import { useStore } from '../data/hooks'
import {
  createTag, deleteTag, moveLead, recordDeal, renameTag, setNote, tagLead, toggleSaved, undoMove, untagLead,
} from '../data/store'
import { LOST_LABEL, LOST_REASONS, STATUSES, STATUS_LABEL } from '../data/status'
import { Avatar } from '../components/Avatar'
import { Range } from '../components/Range'
import { download, toCsv } from '../lib/csv'
import { absolute, compact, COUNTRY_NAMES, LANGUAGE_NAMES, money, relative } from '../lib/format'
import { hasKey } from '../lib/api'
import { navigate, type Query } from '../lib/router'
import type { Creator, LeadStatus } from '../types'

// The daily screen, and the one the client lives in.
//
// It is a table, and it is read across before it is read down: who they are,
// how big, how well they fit, how to reach them, and how you have filed them.
// Every one of those is a fact. Nothing in a row asks to be clicked, because
// a row full of buttons is a row nobody reads.
//
// Filing happens in one place, the last cell, and it holds both halves of a
// CRM: where someone is in the conversation, which is our pipeline, and
// whatever the client calls them, which is their own. The same tags are
// readable and writable through the API, so a model can file a hundred leads
// while the client files three.
//
// Above the table, five controls and no more: brand fit, because it is the
// one number that decides who is here at all; the filters, which are the
// facts we measured; the tags; a search; and the export.
//
// One order, and it is not offered as a choice: people nobody has touched
// first, best fit first inside that. It is the order of the morning.

/** The whole span a size range can cover. Nobody under 5k, no ceiling above 5M. */
const SIZE_SPAN: [number, number] = [5_000, 5_000_000]
const FIT_SPAN: [number, number] = [0, 100]
const VIEW_SPAN: [number, number] = [0, 1_000_000]

const ADDED: { days: number | null; label: string }[] = [
  { days: null, label: 'Any time' },
  { days: 1, label: 'Today' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
]

interface Filters {
  size: [number, number]
  views: [number, number]
  postsMin: number
  withEmail: boolean
  addedWithinDays: number | null
}

const NO_FILTERS: Filters = {
  size: SIZE_SPAN,
  views: VIEW_SPAN,
  postsMin: 0,
  withEmail: false,
  addedWithinDays: null,
}

/** How many of the five are doing something. Shown on the button, so a hidden
 *  filter can never quietly empty the list. */
function countFilters(f: Filters): number {
  let n = 0
  if (f.size[0] > SIZE_SPAN[0] || f.size[1] < SIZE_SPAN[1]) n++
  if (f.views[0] > VIEW_SPAN[0] || f.views[1] < VIEW_SPAN[1]) n++
  if (f.postsMin > 0) n++
  if (f.withEmail) n++
  if (f.addedWithinDays !== null) n++
  return n
}

// ---------------------------------------------------------------------------
// Filing a lead: where they are, and what you call them.
// ---------------------------------------------------------------------------

function FileMenu({ row, onClose, onMoved }: { row: LeadRow; onClose: () => void; onMoved: () => void }) {
  const { lead } = row
  const all = getTags()
  const mine = lead.tags ?? []
  const [why, setWhy] = useState(false)
  const [fresh, setFresh] = useState('')
  const [amount, setAmount] = useState<string | null>(null)

  // Signed asks for the amount once, and never again on a lead that has one.
  if (amount !== null) {
    const save = () => {
      const cents = Math.round(Number(amount.replace(/[^\d.]/g, '')) * 100)
      if (Number.isFinite(cents) && cents > 0) recordDeal(lead.id, cents)
      onClose()
    }
    return (
      <div className="file-menu">
        <h3>What did they sign for?</h3>
        <div className="file-deal">
          <input
            className="input"
            autoFocus
            inputMode="decimal"
            placeholder="Deal size"
            aria-label="Deal amount in euros"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <button type="button" className="btn small primary" onClick={save}>Save</button>
          <button type="button" className="btn small quiet" onClick={onClose}>Skip</button>
        </div>
      </div>
    )
  }

  if (why) {
    return (
      <div className="file-menu">
        <h3>What happened?</h3>
        <div className="file-chips">
          {LOST_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip"
              onClick={() => { moveLead(lead.id, 'lost', 'mem_1', r.id); onMoved(); onClose() }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="file-menu">
      <h3>Where they are</h3>
      <div className="file-chips">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${lead.status === s ? ' on' : ''}`}
            onClick={() => {
              if (s === lead.status) return
              if (s === 'lost') { setWhy(true); return }
              moveLead(lead.id, s, 'mem_1')
              onMoved()
              if (s === 'signed' && !row.deal) { setAmount(''); return }
              onClose()
            }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <h3>Your tags</h3>
      <div className="file-chips">
        {all.map((t) => (
          <button
            key={t.name}
            type="button"
            className={`chip${mine.includes(t.name) ? ' on' : ''}`}
            onClick={() => (mine.includes(t.name) ? untagLead(lead.id, t.name) : tagLead(lead.id, t.name))}
          >
            {t.name}
          </button>
        ))}
        {all.length === 0 && <span className="faint">None yet. Write one below.</span>}
      </div>
      <div className="file-new">
        <input
          className="input"
          placeholder="New tag"
          aria-label="New tag"
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && fresh.trim()) { tagLead(lead.id, fresh); setFresh('') } }}
        />
        <button
          type="button"
          className="btn small"
          disabled={!fresh.trim()}
          onClick={() => { tagLead(lead.id, fresh); setFresh('') }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The row. Five facts, no buttons.
// ---------------------------------------------------------------------------

function Row({ row, open, manyCampaigns, onMoved }: {
  row: LeadRow
  open: boolean
  manyCampaigns: boolean
  onMoved: () => void
}) {
  const { lead, creator, campaign } = row
  const [filing, setFiling] = useState(false)
  const cell = useRef<HTMLSpanElement>(null)

  // Clicking anywhere else puts the menu away, so it never covers the next row.
  useEffect(() => {
    if (!filing) return
    const away = (e: MouseEvent) => {
      if (!cell.current?.contains(e.target as Node)) setFiling(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiling(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [filing])

  const tags = lead.tags ?? []
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
      <span className="cell-email">
        {creator.email ? (
          <a href={`mailto:${creator.email}`} title={creator.email}>{creator.email}</a>
        ) : (
          <small className="faint">handle only</small>
        )}
      </span>
      <span className="cell-file" ref={cell}>
        <button
          type="button"
          className="file-open"
          aria-expanded={filing}
          onClick={() => setFiling(!filing)}
        >
          {lead.status !== 'new' && (
            <span className={`tag-chip status ${lead.status}`}>
              {lead.status === 'lost' && lead.lostReason ? LOST_LABEL[lead.lostReason] : STATUS_LABEL[lead.status]}
            </span>
          )}
          {tags.slice(0, 2).map((t) => <span key={t} className="tag-chip">{t}</span>)}
          {tags.length > 2 && <span className="tag-chip more">+{tags.length - 2}</span>}
          {lead.status === 'new' && tags.length === 0 && <span className="tag-add">File</span>}
        </button>
        {filing && <FileMenu row={row} onClose={() => setFiling(false)} onMoved={onMoved} />}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
/** The way this person was found, in the client's words. Four ways, one line. */
function foundLine(row: LeadRow): string {
  const via = row.creator.foundVia
  const niche = row.campaign.extracted.niches?.find((n) => n.id === row.evaluation.niche)
  const topic = niche ? niche.label.toLowerCase() : 'your niches'
  if (!via || via.channel === 'accounts') return `Found by searching Instagram for ${topic}`
  if (via.channel === 'search') return `Found posting under the hashtags of ${topic}`
  if (via.channel === 'neighbour') {
    const n = via.parents?.length ?? 1
    return n > 1 ? `Mentioned by ${n} people who fit your rules` : 'Mentioned by someone who fits your rules'
  }
  if (via.channel === 'seed') return 'One step out from a handle you gave us'
  return 'From the list you brought with you'
}

/** Where they live and what they post in, as the judge read them off the profile. */
function whereLine(creator: Creator): string {
  const where = creator.country ? (COUNTRY_NAMES[creator.country] ?? creator.country) : null
  const lang = creator.language ? (LANGUAGE_NAMES[creator.language] ?? creator.language) : null
  if (!where && !lang) return 'Country and language not shown on their profile'
  return [where ? `Based in ${where}` : null, lang ? `posts in ${lang}` : null].filter(Boolean).join(', ')
}

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

      <h2>How we found them</h2>
      <ul className="facts">
        <li className="yes">{foundLine(row)}</li>
        <li className={creator.country || creator.language ? 'yes' : 'no'}>{whereLine(creator)}</li>
      </ul>

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
// The two drawers above the table.
// ---------------------------------------------------------------------------

function FilterDrawer({ value, onChange }: { value: Filters; onChange: (next: Filters) => void }) {
  return (
    <div className="card drawer">
      <div className="drawer-grid">
        <Range
          label="Followers"
          min={SIZE_SPAN[0]}
          max={SIZE_SPAN[1]}
          value={value.size}
          scale="log"
          format={compact}
          onChange={(size) => onChange({ ...value, size })}
        />
        <Range
          label="Views on a typical post"
          min={VIEW_SPAN[0]}
          max={VIEW_SPAN[1]}
          value={value.views}
          scale="log"
          format={compact}
          onChange={(views) => onChange({ ...value, views })}
        />
        <div className="drawer-field">
          <span className="drawer-label">Posts a month, at least</span>
          <div className="drawer-chips">
            {[0, 4, 8, 12, 20].map((n) => (
              <button
                key={n}
                type="button"
                className={`chip${value.postsMin === n ? ' on' : ''}`}
                onClick={() => onChange({ ...value, postsMin: n })}
              >
                {n === 0 ? 'Any' : `${n}+`}
              </button>
            ))}
          </div>
        </div>
        <div className="drawer-field">
          <span className="drawer-label">Added</span>
          <div className="drawer-chips">
            {ADDED.map((a) => (
              <button
                key={a.label}
                type="button"
                className={`chip${value.addedWithinDays === a.days ? ' on' : ''}`}
                onClick={() => onChange({ ...value, addedWithinDays: a.days })}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="drawer-field">
          <span className="drawer-label">Email</span>
          <div className="drawer-chips">
            <button
              type="button"
              className={`chip${!value.withEmail ? ' on' : ''}`}
              onClick={() => onChange({ ...value, withEmail: false })}
            >
              Everyone
            </button>
            <button
              type="button"
              className={`chip${value.withEmail ? ' on' : ''}`}
              onClick={() => onChange({ ...value, withEmail: true })}
            >
              With an email
            </button>
          </div>
        </div>
      </div>
      <div className="drawer-foot">
        <button type="button" className="btn small quiet" onClick={() => onChange(NO_FILTERS)}>Clear them all</button>
      </div>
    </div>
  )
}

function TagDrawer({ picked, onPick }: { picked: string[]; onPick: (next: string[]) => void }) {
  const tags = getTags()
  const [fresh, setFresh] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')

  return (
    <div className="card drawer">
      <p className="drawer-label">
        Your own labels, beside our pipeline. Filter on them here, write them on a lead in its last column, or let
        your AI file a hundred at once through <a href="#/ai">the API</a>.
      </p>
      <ul className="tag-rows">
        {tags.map((t) => (
          <li key={t.name}>
            {editing === t.name ? (
              <>
                <input
                  className="input"
                  autoFocus
                  value={name}
                  aria-label={`Rename ${t.name}`}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameTag(t.name, name); setEditing(null) }
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
                <button type="button" className="btn small" onClick={() => { renameTag(t.name, name); setEditing(null) }}>
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`chip${picked.includes(t.name) ? ' on' : ''}`}
                  onClick={() => onPick(picked.includes(t.name) ? picked.filter((x) => x !== t.name) : [...picked, t.name])}
                >
                  {t.name}
                </button>
                <span className="faint num">{t.count}</span>
                <button
                  type="button"
                  className="btn small quiet"
                  onClick={() => { setEditing(t.name); setName(t.name) }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn small quiet drop"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => { deleteTag(t.name); onPick(picked.filter((x) => x !== t.name)) }}
                >
                  ✕
                </button>
              </>
            )}
          </li>
        ))}
        {tags.length === 0 && <li><span className="faint">No tags yet. Your first one goes below.</span></li>}
      </ul>
      <div className="file-new">
        <input
          className="input"
          placeholder="Make a tag"
          aria-label="Make a tag"
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && fresh.trim()) { createTag(fresh); setFresh('') } }}
        />
        <button type="button" className="btn small" disabled={!fresh.trim()} onClick={() => { createTag(fresh); setFresh('') }}>
          Make it
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Leads({ leadId, query: params }: { leadId: string | null; query: Query }) {
  useStore()
  const campaigns = getCampaigns()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [status, setStatus] = useState<LeadStatus | null>(null)
  const [fit, setFit] = useState<[number, number]>(FIT_SPAN)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [tags, setTags] = useState<string[]>([])
  const [drawer, setDrawer] = useState<'filters' | 'tags' | null>(null)
  const [search, setSearch] = useState('')
  const [moved, setMoved] = useState<string | null>(null)
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
    tags,
    fitMin: fit[0] > 0 ? fit[0] : null,
    fitMax: fit[1] < 100 ? fit[1] : null,
    followersMin: filters.size[0] > SIZE_SPAN[0] ? filters.size[0] : null,
    followersMax: filters.size[1] < SIZE_SPAN[1] ? filters.size[1] : null,
    viewsMin: filters.views[0] > VIEW_SPAN[0] ? filters.views[0] : null,
    viewsMax: filters.views[1] < VIEW_SPAN[1] ? filters.views[1] : null,
    postsMin: filters.postsMin || null,
    withEmail: filters.withEmail,
    addedWithinDays: filters.addedWithinDays,
  }
  const signature = JSON.stringify(query)

  /**
   * Which rows are on screen is decided once per set of filters, and not again
   * until the filters change. Marking a lead contacted while the Contacted
   * filter is off would otherwise pull the row out from under the cursor.
   *
   * It is recomputed when the account underneath changes too: the real account
   * lands a second after the sample painted, and a list remembered from the
   * sample finds none of its rows in it.
   */
  const { live, leadCount } = getAccountShape()
  const ids = useMemo(() => listLeads(query).map((r) => r.lead.id), [signature, live, leadCount])
  const rows = ids.map((id) => getLeadRow(id)).filter((r): r is LeadRow => r !== null)
  const open = leadId ? getLeadRow(leadId) : null
  const today = todayCount(campaignId)
  // Controls over a list that has never held anything are a wall in front of
  // an empty room. They appear with the first lead.
  const anyLeads = listLeads({}).length > 0
  const active = countFilters(filters)

  const armUndo = (id: string) => {
    setMoved(id)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMoved(null), 6_000)
  }
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const exportCsv = () => {
    const columns = [
      'name', 'handle', 'email', 'followers', 'views_per_post', 'posts_per_month',
      'brand_fit', 'status', 'tags', 'campaign', 'delivered', 'note',
    ]
    const body = rows.map((r) => ({
      name: r.creator.name,
      handle: `@${r.creator.handle}`,
      email: r.creator.email ?? '',
      followers: r.creator.followers,
      views_per_post: r.creator.medianViews ?? '',
      posts_per_month: r.creator.postsPerMonth ?? '',
      brand_fit: `${fitOf(r)}%`,
      status: STATUS_LABEL[r.lead.status],
      tags: (r.lead.tags ?? []).join(', '),
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
        <span className="count num">{today.delivered} of {today.target} today</span>
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

      <div className="table-tools">
        <Range label="Brand fit" min={0} max={100} value={fit} format={(n) => `${n}%`} onChange={setFit} />
        <button
          type="button"
          className={`btn${drawer === 'filters' ? ' on' : ''}`}
          aria-expanded={drawer === 'filters'}
          onClick={() => setDrawer(drawer === 'filters' ? null : 'filters')}
        >
          Filters{active ? ` · ${active}` : ''}
        </button>
        <button
          type="button"
          className={`btn${drawer === 'tags' ? ' on' : ''}`}
          aria-expanded={drawer === 'tags'}
          onClick={() => setDrawer(drawer === 'tags' ? null : 'tags')}
        >
          Tags{tags.length ? ` · ${tags.length}` : ''}
        </button>
        {(active > 0 || tags.length > 0 || fit[0] > 0 || fit[1] < 100) && (
          <button
            type="button"
            className="btn quiet"
            onClick={() => { setFilters(NO_FILTERS); setTags([]); setFit(FIT_SPAN) }}
          >
            Clear
          </button>
        )}
      </div>

      {drawer === 'filters' && <FilterDrawer value={filters} onChange={setFilters} />}
      {drawer === 'tags' && <TagDrawer picked={tags} onPick={setTags} />}
      </>
      )}

      {moved && (
        <p className="moved-line">
          Filed. <button type="button" className="undo" onClick={() => { undoMove(moved); setMoved(null) }}>Undo</button>
        </p>
      )}

      <div className={open ? 'with-panel' : undefined}>
        <div className="list">
          {rows.map((row) => (
            <Row
              key={row.lead.id}
              row={row}
              open={open?.lead.id === row.lead.id}
              manyCampaigns={!campaignId && campaigns.length > 1}
              onMoved={() => armUndo(row.lead.id)}
            />
          ))}
          {rows.length === 0 && (
            <Empty
              waiting={!status && !search && !active && !tags.length && fit[0] === 0 && fit[1] === 100}
              campaignId={campaignId}
            />
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
        {hasKey() && (
          <a className="btn quiet" href="#/demo" target="_blank" rel="noreferrer">See it filled with sample data</a>
        )}
      </div>
    </div>
  )
}
