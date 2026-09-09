import { useState } from 'react'
import type { Filters } from '../types'
import {
  CRITERIA, QUALIFIED_RATIO, agentTally, createAgent, deleteAgent, getAgent, getAgents, getDashboard, getSettings, getTimezones,
  leadsNeeded, setAgentBrief, setSettings, updateAgent, updateAgentFilters,
} from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { DailyChart } from '../components/DailyChart'
import { FilterForm } from '../components/FilterForm'

/** A count of qualified always carries its total and its share. */
function rate(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '0%'
}

/** The list: what each agent brings in, who is running, who is paused. */
export function Agents() {
  useStore()
  const agents = getAgents()
  const [pick, setPick] = useState<string | null>(null)
  const d = getDashboard(pick)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Agents</h1>
        <span className="count">One search each, run every morning</span>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={() => navigate(`agents/${createAgent().id}`)}>New agent</button>
      </div>

      <div className="card">
        <h2>
          Leads a day
          <select className="select inline-select" value={pick ?? ''} onChange={(e) => setPick(e.target.value || null)} aria-label="Agent">
            <option value="">Every agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </h2>
        <DailyChart data={d.daily} />
        <div className="star-split">
          <div><b className="num">{d.leadsToday}</b><span>leads today</span></div>
          <div>
            <b className="num">{d.qualifiedToday}</b>
            <span>qualified of {d.leadsToday}, {rate(d.qualifiedToday, d.leadsToday)}</span>
          </div>
          <div>
            <b className="num">{d.high}</b>
            <span>qualified of {d.total} in the list, {rate(d.high, d.total)}</span>
          </div>
          <div><b className="num">{pick ? 1 : agents.filter((a) => a.active).length}</b><span>{pick ? 'agent shown' : 'agents running'}</span></div>
        </div>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {agents.map((a) => {
          const t = agentTally(a.id)
          return (
            <a className="agent-row" key={a.id} href={`#/agents/${a.id}`}>
              <span className={`dot${a.active ? ' on' : ''}`} aria-hidden="true" />
              <span className="who">
                <span className="name">{a.name}</span>
                <span className="handle">{a.brief.summary}</span>
              </span>
              <span className="state">{a.active ? `Running, ${a.qualifiedPerDay} qualified a day at ${a.runAt}` : 'Paused'}</span>
              <span className="metric">
                <b className="num">{t.high}</b>
                <small>qualified of {t.found}, {rate(t.high, t.found)}</small>
              </span>
            </a>
          )
        })}
        {agents.length === 0 && (
          <div className="empty">
            <h2>No agent yet</h2>
            <p>An agent holds one sentence about who you want, plus its filters. It runs every morning and fills the contact list.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => navigate(`agents/${createAgent().id}`)}>Create the first agent</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The editor: one sentence, the filters, and when the batch lands. */
export function AgentEditor({ agentId }: { agentId: string }) {
  useStore()
  const agent = getAgent(agentId)
  const settings = getSettings()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!agent) {
    return (
      <div className="page">
        <div className="page-head"><h1>Agent not found</h1></div>
        <a className="btn" href="#/agents">Back to agents</a>
      </div>
    )
  }

  const tally = agentTally(agent.id)
  const onFilters = (patch: Partial<Filters>) => updateAgentFilters(agent.id, patch)

  return (
    <div className="page editor">
      <div className="page-head">
        <a className="back" href="#/agents">Agents</a>
        <span className="spacer" />
        <button type="button" className="btn" onClick={() => updateAgent(agent.id, { active: !agent.active })}>
          {agent.active ? 'Pause' : 'Run every day'}
        </button>
        <a className="btn primary" href={`#/contacts/${agent.id}`}>See {tally.found} leads</a>
      </div>

      <input
        className="input title-input"
        value={agent.name}
        aria-label="Agent name"
        placeholder="Agent name"
        onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
      />

      <section className="ask">
        <h2><label htmlFor="who">Who are you looking for?</label></h2>
        <input
          id="who"
          className="input big"
          placeholder="Women lifting coaches who sell their own program"
          value={agent.brief.who}
          onChange={(e) => setAgentBrief(agent.id, e.target.value)}
        />
        <p className="helper">One sentence. It drives the crawl keywords and the niche star.</p>
      </section>

      <section className="ask">
        <h2>Filters</h2>
        <FilterForm value={agent.filters} onChange={onFilters} />
      </section>

      <section className="ask">
        <h2>Delivery</h2>
        <div className="field-row">
          <label className="field">
            <span>Qualified leads a day</span>
            <input
              className="input num"
              inputMode="numeric"
              value={agent.qualifiedPerDay}
              onChange={(e) => updateAgent(agent.id, { qualifiedPerDay: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })}
            />
          </label>
          <label className="field">
            <span>Ready at</span>
            <input className="input" type="time" value={agent.runAt} onChange={(e) => updateAgent(agent.id, { runAt: e.target.value })} />
          </label>
          <label className="field">
            <span>Timezone</span>
            <select className="select" value={settings.timezone} onChange={(e) => setSettings({ timezone: e.target.value })}>
              {getTimezones().map((tz) => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="estimate">
          <b className="num">{leadsNeeded(agent.qualifiedPerDay)}</b> leads a day to find them. About 1 lead in {QUALIFIED_RATIO} comes back
          qualified, and every one of them shows in the list.
        </p>
        <p className="hint">
          Found {tally.found} leads so far, {tally.high} qualified, {rate(tally.high, tally.found)}. Cost follows the leads crawled, so a
          lower target costs less.
        </p>
      </section>

      <section className="ask">
        <h2>How this agent scores</h2>
        <ul className="criteria plain">
          {CRITERIA.map((c) => (
            <li key={c.key}>
              <span className="crit-name">{c.label}</span>
              <span className="crit-means">
                <b>Full.</b> {c.full}
                <br />
                <b>Half.</b> {c.half}
              </span>
            </li>
          ))}
        </ul>
        <p className="hint">Three criteria, one star each, added up. Half a star when it half fits, so the score runs 0 to 3 in half steps.</p>
      </section>

      <div className="editor-foot">
        {confirmDelete ? (
          <>
            <button type="button" className="btn danger" onClick={() => { deleteAgent(agent.id); navigate('agents') }}>Confirm delete</button>
            <button type="button" className="btn quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
          </>
        ) : (
          <button type="button" className="btn quiet danger" onClick={() => setConfirmDelete(true)}>Delete this agent</button>
        )}
        <span className="spacer" />
        <a className="btn primary" href={`#/contacts/${agent.id}`}>See {tally.found} leads</a>
      </div>
    </div>
  )
}
