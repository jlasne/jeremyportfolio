import { useState } from 'react'
import { exportCsv, getGroups } from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { CreatorDetail } from '../components/CreatorDetail'
import { LeadRow } from '../components/LeadRow'

export function Groups({ agentId }: { agentId: string | null }) {
  useStore()
  const groups = getGroups()
  const current = groups.find((g) => g.agent.id === agentId) ?? groups[0] ?? null
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="page">
      <div className="page-head">
        <h1>{current ? current.agent.name : 'Groups'}</h1>
        {current && (
          <span className="count">
            <span className="num">{current.high}</span> high · <span className="num">{current.today}</span> new today ·{' '}
            {current.agent.active ? `up to ${current.agent.leadsPerDay} a day at ${current.agent.runAt}` : 'paused'}
          </span>
        )}
        <span className="spacer" />
        {current && <a className="btn" href={`#/agents/${current.agent.id}`}>Agent settings</a>}
        {current && (
          <button
            type="button"
            className="btn"
            disabled={current.leads.length === 0}
            onClick={() => downloadCsv(`${current.agent.name.replace(/\s+/g, '-').toLowerCase()}.csv`, exportCsv(current.leads.map((l) => l.creator.id)))}
          >
            Export
          </button>
        )}
      </div>
      {current && <p className="subhead">{current.agent.brief.summary}</p>}

      <div className="feed">
        {current && current.leads.length === 0 && (
          <div className="empty">
            <h2>{current.agent.name} found nothing yet</h2>
            <p>The agent runs at {current.agent.runAt} and delivers up to {current.agent.leadsPerDay} leads a day. Widen its brief or its filters to raise that.</p>
            <div className="actions">
              <a className="btn primary" href={`#/agents/${current.agent.id}`}>Open agent settings</a>
            </div>
          </div>
        )}
        {current?.leads.map((lead) => (
          <LeadRow key={lead.creator.id} item={lead} open={openId === lead.creator.id} onOpen={setOpenId} />
        ))}
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
