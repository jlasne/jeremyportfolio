import { useEffect, useState } from 'react'
import { createAgent, getAgent, runFirstCrawl, type CrawlProgress } from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { AgentEditor } from './Agent'

// Onboarding is one thing: create the first agent. Then the first batch runs.

/** No id yet: make an agent and move to its editor. */
export function OnboardingStart() {
  useEffect(() => {
    const a = createAgent()
    navigate(`onboarding/${a.id}`)
  }, [])
  return null
}

export function OnboardingAgent({ agentId }: { agentId: string }) {
  useStore()
  const agent = getAgent(agentId)
  useEffect(() => {
    if (!agent) navigate('onboarding')
  }, [agent])
  if (!agent) return null
  return (
    <div className="onboard-shell">
      <header className="onboard-top">
        <span className="brand-word">brandmatch</span>
        <span className="faint">Step 1 of 2</span>
      </header>
      <AgentEditor agentId={agentId} firstRun />
    </div>
  )
}

export function FirstRun({ agentId }: { agentId: string }) {
  useStore()
  const agent = getAgent(agentId)
  const [p, setP] = useState<CrawlProgress>({ found: 0, scored: 0, done: false })
  useEffect(() => runFirstCrawl(setP), [])
  useEffect(() => {
    if (p.done) {
      const t = window.setTimeout(() => navigate(`contacts/${agentId}`), 500)
      return () => window.clearTimeout(t)
    }
  }, [p.done, agentId])
  const pct = Math.round(((p.found + p.scored) / (412 * 2)) * 100)
  return (
    <div className="onboard">
      <div className="onboard-box" aria-live="polite">
        <p className="steps">Step 2 of 2</p>
        <h1>{agent?.name || 'Your search'} is running now</h1>
        <div className="brief-line">
          <p>{agent?.brief.summary ?? ''}</p>
          <a href={`#/onboarding/${agentId}`}>Edit</a>
        </div>
        <div className="progress">
          <div className="stat">
            <b>{p.found}</b>
            <span>creators found</span>
          </div>
          <div className="stat">
            <b>{p.scored}</b>
            <span>creators ranked</span>
          </div>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="helper">{p.done ? 'Done. Opening your leads.' : 'Usually under 10 minutes. This preview takes 8 seconds.'}</p>
      </div>
    </div>
  )
}
