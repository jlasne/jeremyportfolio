import { useState } from 'react'
import { getCampaigns, getDashboard } from '../data'
import { useStore } from '../data/hooks'
import { API, getKey, setKey } from '../lib/api'

// One API and one MCP server over the same key. It reads the leads, classifies
// them in the list you work in, and runs the campaigns that fill it.

const API_URL = API
const MCP_URL = API.replace(/\/api\/?$/, '/mcp')

interface Call {
  verb: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  note: string
}

const READ: Call[] = [
  { verb: 'GET', path: '/contacts', note: "This morning's list, ranked, with the email where we found one." },
  { verb: 'GET', path: '/contacts?campaign=:id&tag=replied', note: 'One campaign, one CRM stage, or both at once.' },
  { verb: 'GET', path: '/creators/:id', note: 'The full profile: last 12 posts, every signal with its date, and why it ranks where it does.' },
  { verb: 'GET', path: '/stats?days=30', note: 'What each campaign and each agent brought against its quota, day by day.' },
]

const CRM: Call[] = [
  { verb: 'POST', path: '/actions', note: "Move a lead along a stage: contacted, replied, in talks, deal, passed. One stage at a time, like the app." },
  { verb: 'POST', path: '/actions', note: 'Write a note. It sits on the contact panel, next to the score.' },
  { verb: 'POST', path: '/actions', note: 'Tick one off, so tomorrow only shows what is left.' },
  { verb: 'POST', path: '/actions', note: 'Reject one for good. It never comes back in this campaign.' },
]

const RUN: Call[] = [
  { verb: 'POST', path: '/campaigns', note: 'A name, a website, a brief and a daily quota. It reads the shared pool before it crawls.' },
  { verb: 'POST', path: '/campaigns/:id/propose', note: 'Read the site and get three agents proposed, with the hashtags each would search.' },
  { verb: 'POST', path: '/agents/:id/approve', note: 'Turn a proposal on. This is the one call that starts spending.' },
  { verb: 'POST', path: '/agents/:id/pause', note: 'Stop an agent. Its leads stop arriving tomorrow.' },
  { verb: 'POST', path: '/campaigns/:id/run', note: 'Crawl now instead of waiting for tonight.' },
]

/** What an AI does with the MCP server, in the words it would use. */
const TOOLS = [
  'list_leads', 'get_lead', 'classify_lead', 'list_campaigns',
  'create_campaign', 'create_agent', 'approve_agent', 'pause_agent', 'account',
]

const MCP_CONFIG = `{
  "mcpServers": {
    "brandmatch": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}`

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

function KeyBox() {
  const [value, setValue] = useState(getKey() ?? '')
  const [saved, setSaved] = useState(false)
  return (
    <div className="key-row">
      <span className="key-label">Key</span>
      <input
        className="key-value"
        type="password"
        placeholder="Paste your key to read your own leads"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false) }}
      />
      <button
        type="button"
        className="btn small"
        onClick={() => { setKey(value); setSaved(true); window.location.reload() }}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-row">
      <span className="key-label">{label}</span>
      <code className="key-value">{value}</code>
      <Copy text={value} label={label.toLowerCase()} />
    </div>
  )
}

/** One endpoint: the verb, the path, and what it does, each on its own line. */
function Endpoints({ calls }: { calls: Call[] }) {
  return (
    <ul className="endpoints">
      {calls.map((c) => (
        <li key={c.verb + c.path + c.note}>
          <span className="ep-call">
            <span className={`verb ${c.verb.toLowerCase()}`}>{c.verb}</span>
            <code>{c.path}</code>
          </span>
          <span className="ep-note">{c.note}</span>
        </li>
      ))}
    </ul>
  )
}

export function Connect() {
  useStore()
  const d = getDashboard()
  const searches = getCampaigns()

  return (
    <div className="page api">
      <div className="page-head">
        <h1>API</h1>
        <span className="count">One base URL, one key. Your own code, or the AI you already work in.</span>
      </div>

      <div className="api-grid">
        <div className="api-col">
          <section className="card">
            <h2>Your key</h2>
            <div className="keys">
              <Field label="Base" value={API_URL} />
              <KeyBox />
            </div>
            <pre className="code" aria-label="Request example">{`curl ${API_URL}/contacts \\
  -H "Authorization: Bearer $BRANDMATCH_KEY"`}</pre>
            <p className="hint">The key stays in this browser, never in the page. It reads every campaign on your account.</p>
          </section>

          <section className="card">
            <h2>Connect your AI</h2>
            <p className="muted">
              The same account over MCP. Paste this into Claude, Cursor or any client, and it works the leads for you.
            </p>
            <div className="keys">
              <Field label="MCP" value={MCP_URL} />
            </div>
            <pre className="code" aria-label="MCP configuration">{MCP_CONFIG}</pre>
            <div className="copy-row">
              <Copy text={MCP_CONFIG} label="MCP configuration" />
              <span className="faint">{TOOLS.length} tools, on your key alone</span>
            </div>
            <span className="tagrow">
              {TOOLS.map((t) => <span className="hashtag mono" key={t}>{t}</span>)}
            </span>
          </section>

          <section className="card">
            <h2>What it reads today</h2>
            <dl className="pairs">
              <dt>Leads in your list</dt>
              <dd className="num">{d.total.toLocaleString('en-US')}</dd>
              <dt>At 2 stars and up</dt>
              <dd className="num">{d.high.toLocaleString('en-US')}</dd>
              <dt>New this morning</dt>
              <dd className="num">{d.today.toLocaleString('en-US')}</dd>
              <dt>Campaigns running</dt>
              <dd className="num">{searches.filter((s) => s.active).length}</dd>
            </dl>
          </section>
        </div>

        <div className="api-col">
          <section className="card">
            <h2>Read your leads</h2>
            <Endpoints calls={READ} />
          </section>

          <section className="card">
            <h2>Classify them, in the same list</h2>
            <p className="muted">brandmatch is the CRM. What the API writes is what the app shows.</p>
            <Endpoints calls={CRM} />
            <pre className="code" aria-label="Stage example">{`curl -X POST ${API_URL}/actions \\
  -H "Authorization: Bearer $BRANDMATCH_KEY" \\
  -d '{ "creatorId": "...", "action": "tag", "value": "replied" }'`}</pre>
          </section>

          <section className="card">
            <h2>Run your campaigns</h2>
            <p className="muted">The model proposes agents. Approving one is the only call that spends a credit.</p>
            <Endpoints calls={RUN} />
          </section>
        </div>
      </div>
    </div>
  )
}
