import { useState } from 'react'
import { createAgent, deleteAgent, getAgents, getGroups, updateAgent, updateAgentFilters } from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { FilterForm } from '../components/FilterForm'

export function Agents({ agentId }: { agentId: string | null }) {
  useStore()
  const agents = getAgents()
  const groups = getGroups()
  const current = agents.find((a) => a.id === agentId) ?? agents[0] ?? null
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const group = groups.find((g) => g.agent.id === current?.id)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Agents</h1>
        <span className="count">Each agent runs once a day and fills its own group</span>
        <span className="spacer" />
        <form
          className="new-inline"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            const a = createAgent(name)
            setName('')
            navigate(`agents/${a.id}`)
          }}
        >
          <input className="input" placeholder="New agent" value={name} onChange={(e) => setName(e.target.value)} aria-label="New agent name" />
          <button type="submit" className="btn">Create</button>
        </form>
      </div>

      <div className="two-col">
        <nav className="list-nav" aria-label="Agents">
          {agents.map((a) => (
            <a key={a.id} href={`#/agents/${a.id}`} className={current?.id === a.id ? 'on' : undefined}>
              <span>{a.name}</span>
              <span className="count num">{a.active ? a.leadsPerDay : 'off'}</span>
            </a>
          ))}
        </nav>

        <div>
          {!current && (
            <div className="card">
              <h2>No agent yet</h2>
              <p className="muted">Create one on the left. An agent holds a brief, its filters, and how many leads a day it should deliver.</p>
            </div>
          )}

          {current && (
            <>
              <div className="card">
                <h2>Settings</h2>
                <div className="field-row">
                  <label className="field">
                    <span>Name</span>
                    <input className="input" value={current.name} onChange={(e) => updateAgent(current.id, { name: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select className="select" value={current.active ? 'on' : 'off'} onChange={(e) => updateAgent(current.id, { active: e.target.value === 'on' })}>
                      <option value="on">Running every day</option>
                      <option value="off">Paused</option>
                    </select>
                  </label>
                </div>
                <div className="field-row" style={{ marginTop: 12 }}>
                  <label className="field">
                    <span>Leads a day</span>
                    <input
                      className="input num"
                      inputMode="numeric"
                      value={current.leadsPerDay}
                      onChange={(e) => updateAgent(current.id, { leadsPerDay: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                    />
                  </label>
                  <label className="field">
                    <span>Batch ready at</span>
                    <input className="input" type="time" value={current.runAt} onChange={(e) => updateAgent(current.id, { runAt: e.target.value })} />
                  </label>
                </div>
                <p className="hint">
                  {current.active
                    ? `Delivers up to ${current.leadsPerDay} leads by ${current.runAt}. Cost follows the profiles crawled, so a lower number costs less.`
                    : 'Paused. The daily job skips this agent.'}
                </p>
              </div>

              <div className="card">
                <h2>Brief</h2>
                <div className="brief-line">
                  <p>{current.brief.summary}</p>
                </div>
                <label className="field" style={{ marginTop: 12 }}>
                  <span>Who this agent looks for</span>
                  <input
                    className="input"
                    value={current.brief.who}
                    placeholder="Women lifting coaches who sell their own program"
                    onChange={(e) => updateAgent(current.id, { brief: { ...current.brief, who: e.target.value } })}
                  />
                </label>
                <p className="hint">The brief drives the crawl keywords and the niche call in the score.</p>
              </div>

              <div className="card">
                <h2>Filters</h2>
                <FilterForm value={current.filters} onChange={(patch) => updateAgentFilters(current.id, patch)} />
                <p className="hint" style={{ marginTop: 12 }}>Filters cut the volume this agent delivers. Stars set the order.</p>
              </div>

              <div className="card">
                <h2>Output</h2>
                <dl className="pairs">
                  <dt>Leads found</dt>
                  <dd className="num">{group?.leads.length ?? 0}</dd>
                  <dt>High leads, 2 or 3 stars</dt>
                  <dd className="num">{group?.high ?? 0}</dd>
                  <dt>New today</dt>
                  <dd className="num">{group?.today ?? 0}</dd>
                </dl>
                <a className="btn small" href={`#/groups/${current.id}`}>Open the group</a>
              </div>

              <div className="card">
                <h2>Delete</h2>
                <p className="muted">Removes the agent. Its leads stay in the feed and keep their notes and tags.</p>
                <div className="actions-bar" style={{ marginTop: 10 }}>
                  {confirmDelete ? (
                    <>
                      <button type="button" className="btn danger" onClick={() => { deleteAgent(current.id); setConfirmDelete(false); navigate('agents') }}>Confirm delete</button>
                      <button type="button" className="btn quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
                    </>
                  ) : (
                    <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>Delete this agent</button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
