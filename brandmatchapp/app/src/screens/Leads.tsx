import { useState } from 'react'
import { getGateSet, getLeadEvents, getLeadRow, listLeads, type LeadRow } from '../data'
import { useStore } from '../data/hooks'
import { foundLabel } from '../data/gates'
import { moveLead } from '../data/store'
import { nextLabel, nextStatus, STATUSES, STATUS_LABEL } from '../data/status'
import { compact, money, relative } from '../lib/format'
import { navigate } from '../lib/router'
import type { LeadStatus } from '../types'

// Zone 2, the daily screen. It answers one question: who do I contact now.
//
// The rule that shapes it: a status change is one click from the list and never
// more than one. The button carries the next step, so nobody opens a menu to
// say they sent a message.

function Row({ row, open }: { row: LeadRow; open: boolean }) {
  const { lead, creator, evaluation } = row
  const step = nextLabel(lead.status)
  const next = nextStatus(lead.status)
  return (
    <div className={`contact${open ? ' open' : ''}`}>
      <a className="who" href={`#/leads/${lead.id}`}>
        <span className="name">
          {creator.name}
          {lead.status === 'new' && <span className="badge-new">New</span>}
        </span>
        <span className="handle">@{creator.handle}</span>
      </a>
      <span className="signal-cell muted">{evaluation.reason}</span>
      <span className="metric">
        <b className="num">{compact(creator.followers)}</b>
        <small>followers</small>
      </span>
      <span className="metric">
        <b className="num">{lead.score}/14</b>
        <small>fit score</small>
      </span>
      <span className="row-act">
        {step && next ? (
          <button type="button" className="btn small primary" onClick={() => moveLead(lead.id, next)}>
            {step}
          </button>
        ) : (
          <span className="tag">{STATUS_LABEL[lead.status]}</span>
        )}
      </span>
    </div>
  )
}

function Panel({ row }: { row: LeadRow }) {
  const { lead, creator, evaluation, campaign, deal } = row
  const gates = getGateSet(campaign.id)
  const events = getLeadEvents(lead.id)
  return (
    <aside className="card lead-panel">
      <h2>
        {creator.name} <span className="muted">@{creator.handle}</span>
      </h2>
      <p className="muted">{creator.bio}</p>
      <ul className="facts">
        <li className="yes"><b>{compact(creator.followers)}</b> followers</li>
        <li className="yes"><b>{compact(creator.medianViews ?? 0)}</b> views on a typical post, from their last 12</li>
        <li className="yes"><b>{creator.medianComments ?? 0}</b> comments on a typical post</li>
        <li className="yes"><b>{creator.postsPerMonth ?? 0}</b> posts a month</li>
        <li className={creator.lastPostAt ? 'yes' : 'no'}>
          Last post {creator.lastPostAt ? relative(creator.lastPostAt) : 'unknown'}
        </li>
        <li className={creator.email ? 'yes' : 'no'}>{creator.email ?? 'No email on the profile'}</li>
      </ul>

      <h2>Why they reached you</h2>
      <p>{evaluation.reason}</p>
      <ul className="facts">
        {evaluation.criteriaScores.map((c) => {
          const criterion = gates?.criteria.find((k) => k.id === c.id)
          return (
            <li key={c.id} className={c.score === 2 ? 'yes' : c.score === 1 ? 'half' : 'no'}>
              <b>{criterion?.label ?? c.id}</b> {c.note}
            </li>
          )
        })}
      </ul>
      <p className="hint">
        Checked against your rules, version {evaluation.gateSetVersion}, the ones in use the day this lead arrived.
      </p>

      <h2>The numbers we found</h2>
      <ul className="facts">
        {evaluation.hardChecks.map((c) => (
          <li key={c.key} className={c.pass ? 'yes' : 'no'}>
            <b>{foundLabel(c.key)}</b> {c.value}
          </li>
        ))}
      </ul>

      <h2>History</h2>
      <ul className="facts">
        {events.map((e) => (
          <li key={e.id} className="yes">
            <b>{STATUS_LABEL[e.to]}</b> {relative(e.at)}
          </li>
        ))}
      </ul>
      {deal && (
        <p className="notice">
          Signed for <b>{money(deal.amountCents, deal.currency)}</b>. {deal.note}
        </p>
      )}
    </aside>
  )
}

export function Leads({ leadId }: { leadId: string | null }) {
  useStore()
  const [status, setStatus] = useState<LeadStatus | null>(null)
  const [search, setSearch] = useState('')
  const rows = listLeads({ status, search })
  const open = leadId ? getLeadRow(leadId) : null

  return (
    <div className="page">
      <div className="page-head">
        <h1>Leads</h1>
        <span className="count num">{rows.length}</span>
        <span className="spacer" />
        <input
          className="input"
          placeholder="Search a handle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-row">
        <button type="button" className={`chip${status === null ? ' on' : ''}`} onClick={() => setStatus(null)}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`chip${status === s ? ' on' : ''}`} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={open ? 'with-panel' : undefined}>
        <div className="list">
          {rows.map((row) => (
            <Row key={row.lead.id} row={row} open={open?.lead.id === row.lead.id} />
          ))}
          {rows.length === 0 && (
            <div className="empty">
              <h2>Nothing here yet</h2>
              <p>Your next leads land tomorrow morning.</p>
            </div>
          )}
        </div>
        {open && (
          <div className="panel-side">
            <button type="button" className="btn small quiet" onClick={() => navigate('leads')}>
              Close
            </button>
            <Panel row={open} />
          </div>
        )}
      </div>
    </div>
  )
}
