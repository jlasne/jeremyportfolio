import { useState } from 'react'
import { getAgents, getDashboard } from '../data'
import { useStore } from '../data/hooks'

// Connect AI: hand brandmatch to whatever AI the brand already uses.
// One address, one key, and a list of what it can ask for.

const MCP_URL = 'https://mcp.brandmatch.app/sse'
const API_URL = 'https://api.brandmatch.app/v1'
const KEY = 'bm_live_7f2a9c41d8e6b350'

const ACTIONS = [
  { call: 'Today\'s leads', note: 'Everything that came in this morning, ranked, with the email where we found one.' },
  { call: 'Qualified only', note: 'The ones at 2 stars or more, ready for a message today.' },
  { call: 'One creator', note: 'The full profile: last 12 posts, every signal with its date, why it scored what it scored.' },
  { call: 'Search by sentence', note: 'Ask in plain words. "Lifting coaches in the UK over 50k followers with a fresh signal."' },
  { call: 'Tag and note', note: 'Your AI writes back. Tag a creator, leave a note, reject one.' },
  { call: 'Export', note: 'Hand the whole list to a spreadsheet or your CRM.' },
]

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          window.setTimeout(() => setDone(false), 1500)
        } catch {
          window.prompt(`Copy the ${label}`, text)
        }
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Field({ label, value, mask = false }: { label: string; value: string; mask?: boolean }) {
  const [shown, setShown] = useState(!mask)
  return (
    <div className="key-row">
      <span className="key-label">{label}</span>
      <code className="key-value">{shown ? value : value.slice(0, 8) + '••••••••••••'}</code>
      {mask && (
        <button type="button" className="btn small quiet" onClick={() => setShown((v) => !v)}>
          {shown ? 'Hide' : 'Show'}
        </button>
      )}
      <Copy text={value} label={label.toLowerCase()} />
    </div>
  )
}

export function Connect() {
  useStore()
  const d = getDashboard()
  const searches = getAgents()

  return (
    <div className="page editor">
      <div className="page-head">
        <h1>Connect AI</h1>
        <span className="count">Your leads, inside the AI you already use</span>
      </div>
      <p className="subhead">
        Point Claude, ChatGPT or your own tool at brandmatch. It reads your list, answers questions about a creator, and writes
        tags back. Nothing to install.
      </p>

      <section className="ask">
        <h2>MCP</h2>
        <p className="muted">For Claude and any tool that speaks MCP. Paste the address and the key.</p>
        <div className="keys">
          <Field label="Server" value={MCP_URL} />
          <Field label="Key" value={KEY} mask />
        </div>
        <pre className="code" aria-label="Configuration example">{`{
  "mcpServers": {
    "brandmatch": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer ${KEY}" }
    }
  }
}`}</pre>
        <p className="hint">Then ask it in plain words: "Who came in today above 2 stars with an email?"</p>
      </section>

      <section className="ask">
        <h2>API</h2>
        <p className="muted">For your own code, or a workflow tool like Make or n8n.</p>
        <div className="keys">
          <Field label="Base" value={API_URL} />
        </div>
        <pre className="code" aria-label="Request example">{`curl ${API_URL}/leads?min_stars=2 \\
  -H "Authorization: Bearer ${KEY}"`}</pre>
        <p className="hint">Same key. JSON back, one object per creator, the same fields you see on a row.</p>
      </section>

      <section className="ask">
        <h2>What it can do</h2>
        <ul className="criteria plain wide">
          {ACTIONS.map((a) => (
            <li key={a.call}>
              <span className="crit-name">{a.call}</span>
              <span className="crit-means">{a.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ask">
        <h2>What it reads today</h2>
        <dl className="pairs">
          <dt>Leads in your list</dt>
          <dd className="num">{d.total}</dd>
          <dt>Qualified</dt>
          <dd className="num">{d.high}</dd>
          <dt>New this morning</dt>
          <dd className="num">{d.today}</dd>
          <dt>Agents running</dt>
          <dd className="num">{searches.filter((s) => s.active).length}</dd>
        </dl>
        <p className="hint">The key reads every agent on your account. Pause an agent and its leads stop arriving.</p>
      </section>
    </div>
  )
}
