import { useState } from 'react'
import type { BriefAnswer, Filters } from '../types'
import { agentTally, createAgent, deleteAgent, getAgent, getAgents, getFollowUpQuestions, setAgentBrief, updateAgent, updateAgentFilters } from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { FilterForm } from '../components/FilterForm'

/** The list: who is running, who is paused. */
export function Agents() {
  useStore()
  const agents = getAgents()
  return (
    <div className="page">
      <div className="page-head">
        <h1>Agents</h1>
        <span className="count">One search each, run every morning</span>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={() => navigate(`agents/${createAgent().id}`)}>New agent</button>
      </div>

      <div className="list">
        {agents.map((a) => {
          const t = agentTally(a.id)
          return (
            <a className="agent-row" key={a.id} href={`#/agents/${a.id}`}>
              <span className={`dot${a.active ? ' on' : ''}`} aria-hidden="true" />
              <span className="who">
                <span className="name">{a.name}</span>
                <span className="handle">{a.brief.summary}</span>
              </span>
              <span className="state">{a.active ? `Running, ${a.leadsPerDay} a day at ${a.runAt}` : 'Paused'}</span>
              <span className="metric num">{t.found}</span>
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

/** The editor: the same two questions as onboarding, then the filters. */
export function AgentEditor({ agentId }: { agentId: string }) {
  useStore()
  const agent = getAgent(agentId)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!agent) {
    return (
      <div className="page">
        <div className="page-head"><h1>Agent not found</h1></div>
        <a className="btn" href="#/agents">Back to agents</a>
      </div>
    )
  }

  const questions = getFollowUpQuestions(agent.brief.who)
  const answers: BriefAnswer[] = questions.map((q) => ({
    questionId: q.id,
    value: agent.brief.answers.find((a) => a.questionId === q.id)?.value ?? null,
  }))
  const setAnswer = (id: string, value: string | null) =>
    setAgentBrief(agent.id, agent.brief.who, answers.map((a) => (a.questionId === id ? { ...a, value } : a)))
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
        <a className="btn primary" href={`#/contacts/${agent.id}`}>See {tally.found} contacts</a>
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
          onChange={(e) => setAgentBrief(agent.id, e.target.value, answers)}
        />
        <p className="helper">One sentence. It drives the crawl keywords and the niche star.</p>
      </section>

      {questions.map((q) => {
        const value = answers.find((a) => a.questionId === q.id)?.value ?? ''
        return (
          <section className="ask" key={q.id}>
            <h2>{q.text}</h2>
            <div className="chips" role="group" aria-label={q.text}>
              {q.chips.map((chip) => {
                const on = value === chip
                return (
                  <button key={chip} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setAnswer(q.id, on ? null : chip)}>
                    {chip}
                  </button>
                )
              })}
            </div>
            <input
              className="input"
              placeholder="Or type your own"
              value={q.chips.includes(value) ? '' : value}
              aria-label={`${q.text} Free text`}
              onChange={(e) => setAnswer(q.id, e.target.value || null)}
            />
          </section>
        )
      })}

      <div className="brief-line">
        <p>{agent.brief.summary}</p>
      </div>

      <section className="ask">
        <h2>Filters</h2>
        <FilterForm value={agent.filters} onChange={onFilters} />
      </section>

      <section className="ask">
        <h2>Delivery</h2>
        <div className="field-row">
          <label className="field">
            <span>Contacts a day</span>
            <input
              className="input num"
              inputMode="numeric"
              value={agent.leadsPerDay}
              onChange={(e) => updateAgent(agent.id, { leadsPerDay: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })}
            />
          </label>
          <label className="field">
            <span>Batch ready at</span>
            <input className="input" type="time" value={agent.runAt} onChange={(e) => updateAgent(agent.id, { runAt: e.target.value })} />
          </label>
        </div>
        <p className="hint">
          Found {tally.found} contacts so far, {tally.high} at 2 stars or more. Cost follows the profiles crawled, so a lower number costs less.
        </p>
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
        <a className="btn primary" href={`#/contacts/${agent.id}`}>See {tally.found} contacts</a>
      </div>
    </div>
  )
}
