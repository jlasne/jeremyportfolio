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
        <h1>Groups</h1>
        <span className="count">One group per agent</span>
        <span className="spacer" />
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

      <div className="two-col">
        <aside>
          <nav className="list-nav" aria-label="Groups">
            {groups.map((g) => (
              <a key={g.agent.id} href={`#/groups/${g.agent.id}`} className={current?.agent.id === g.agent.id ? 'on' : undefined}>
                <span>{g.agent.name}</span>
                <span className="count num">{g.leads.length}</span>
              </a>
            ))}
          </nav>
          {current && (
            <div className="card" style={{ marginTop: 14 }}>
              <p className="muted">{current.agent.brief.summary}</p>
              <dl className="pairs">
                <dt>High leads</dt>
                <dd className="num">{current.high}</dd>
                <dt>New today</dt>
                <dd className="num">{current.today}</dd>
                <dt>Target a day</dt>
                <dd className="num">{current.agent.leadsPerDay}</dd>
                <dt>Runs at</dt>
                <dd>{current.agent.active ? current.agent.runAt : 'paused'}</dd>
              </dl>
              <a className="btn small" href={`#/agents/${current.agent.id}`}>Open agent settings</a>
            </div>
          )}
        </aside>

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
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
