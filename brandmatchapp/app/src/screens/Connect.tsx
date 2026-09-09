import { useState } from 'react'
import { getCampaigns, getDashboard } from '../data'
import { useStore } from '../data/hooks'

// Connect AI: hand brandmatch to whatever AI the brand already uses.
// One address, one key, and a list of what it can ask for.

const MCP_URL = 'https://mcp.brandmatch.app/sse'
const API_URL = 'https://api.brandmatch.app/v1'
const KEY = 'bm_live_7f2a9c41d8e6b350'

/** MCP is for reading the list. */
const MCP_ACTIONS = [
  { call: "Today's leads", note: 'Everything that came in this morning, ranked, with the email where we found one.' },
  { call: 'Qualified only', note: 'The ones at 0.5 stars or more, ready for a message today.' },
  { call: 'One creator', note: 'The full profile: last 12 posts, every signal with its date, and why it ranks where it does.' },
  { call: 'Ask in plain words', note: '"Lifting coaches in the UK over 50k followers with a signal this week."' },
  { call: 'Tag, note, tick off', note: 'Your AI writes back, so your list stays tidy while it works.' },
]

/** The API is for running the campaigns themselves. */
const API_ACTIONS = [
  { call: 'Create a campaign', note: 'A name, its website, the agents inside it and how many leads a day each should bring.' },
  { call: 'Change the sentence', note: 'Point a campaign at a new niche without touching the app.' },
  { call: 'Move the volume', note: 'Raise a run from 100 to 800 leads a day, or drop it back.' },
  { call: 'Pause and resume', note: 'Stop every campaign while you are closed, start them again on Monday.' },
  { call: 'Read the numbers', note: 'How many leads each campaign and each agent brought, and how many came back qualified.' },
]

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn small"
      disabled
      title="Available when Connect AI ships"
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
  const [peek, setPeek] = useState(false)
  const d = getDashboard()
  const searches = getCampaigns()

  return (
    <div className="page editor soon-page">
      {!peek && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="soon-title">
          <div className="modal">
            <span className="soon">Coming soon</span>
            <h2 id="soon-title">Connect AI is on its way</h2>
            <p>
              MCP will hand your leads to Claude, ChatGPT or your own tool. The API will create campaigns, move their volume and
              pause them from your own code. One key for both.
            </p>
            <div className="actions-bar">
              <a className="btn primary" href="#/contacts">Back to contacts</a>
              <button type="button" className="btn" onClick={() => setPeek(true)}>Show me the preview</button>
            </div>
          </div>
        </div>
      )}
      <div className={peek ? '' : 'blurred'} aria-hidden={!peek}>
      <div className="page-head">
        <h1>Connect AI</h1>
        <span className="soon">Coming soon</span>
      </div>
      <p className="subhead">
        One key, two doors. MCP hands your leads to the AI you already use. The API runs your campaigns from your own code.
        Both open soon, and the shape below is what they will look like.
      </p>



      <section className="ask">
        <h2>MCP · get your leads</h2>
        <p className="muted">For Claude and any tool that speaks MCP. Paste the address and the key, then ask in plain words.</p>
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
        <h2>API · manage your campaigns</h2>
        <p className="muted">Create a campaign, change its sentence, move its volume or pause it, from your own code.</p>
        <div className="keys">
          <Field label="Base" value={API_URL} />
        </div>
        <pre className="code" aria-label="Request example">{`curl -X POST ${API_URL}/campaigns \\
  -H "Authorization: Bearer ${KEY}" \\
  -d '{ "name": "Spring launch",
        "brief": "Women lifting coaches who sell their own program",
        "leads_per_day": 250 }'`}</pre>
        <p className="hint">Same key. Every field you see in the app, reachable here.</p>
      </section>

      <section className="ask">
        <h2>What your AI can ask for</h2>
        <ul className="criteria plain wide">
          {MCP_ACTIONS.map((a) => (
            <li key={a.call}>
              <span className="crit-name">{a.call}</span>
              <span className="crit-means">{a.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ask">
        <h2>What your code can run</h2>
        <ul className="criteria plain wide">
          {API_ACTIONS.map((a) => (
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
          <dt>Campaigns running</dt>
          <dd className="num">{searches.filter((s) => s.active).length}</dd>
        </dl>
        <p className="hint">The key reads every campaign on your account. Pause a campaign and its leads stop arriving.</p>
      </section>
      </div>
    </div>
  )
}
