import { useState } from 'react'
import { getAccount } from '../data'
import { useStore } from '../data/hooks'
import { API, getKey } from '../lib/api'

// Your own AI, on your own leads.
//
// Two ways in, one behind the other. The HTTP API is the surface; the MCP
// server is the same surface described so a model can call it without anyone
// writing code. Everything a screen in this app can do is here, because the
// screens call this and nothing else.
//
// The key is the account. It is shown once, masked, and copied rather than
// retyped: a key read off a screen and typed back in is a key typed wrong.

interface Call {
  verb: 'GET' | 'POST' | 'PATCH'
  path: string
  what: string
}

const CAMPAIGN_CALLS: Call[] = [
  { verb: 'GET', path: '/campaigns', what: 'Every campaign, with its rules version and what it takes a day.' },
  { verb: 'POST', path: '/campaigns', what: 'Start one from the two answers: who you want, what you sell.' },
  { verb: 'GET', path: '/campaigns/{id}', what: 'One campaign and the rules in force on it.' },
  { verb: 'PATCH', path: '/campaigns/{id}', what: 'Rename it, pause it, or set how many leads a day it may take.' },
  { verb: 'POST', path: '/campaigns/{id}/gates', what: 'Write the next version of the rules. The old one is kept.' },
  { verb: 'POST', path: '/campaigns/{id}/feasibility', what: 'Run the rules over the sample and get the funnel back.' },
]

const LEAD_CALLS: Call[] = [
  { verb: 'GET', path: '/leads', what: 'The list. Filter by campaign, status, tag, size, brand fit or search.' },
  { verb: 'GET', path: '/leads/{id}', what: 'One lead: the person, the numbers, and every sentence they were scored on.' },
  { verb: 'POST', path: '/leads/{id}/status', what: 'Move them along the pipeline, or drop them with a reason.' },
  { verb: 'POST', path: '/leads/{id}/tags', what: 'Add or remove your own tags. The same tags the list shows.' },
  { verb: 'POST', path: '/leads/{id}/mark', what: 'Save them, or write the note you want to remember.' },
  { verb: 'POST', path: '/leads/{id}/deal', what: 'Record what they signed for.' },
  { verb: 'GET', path: '/tags', what: 'Your tags and how many leads carry each one.' },
]

const ASKS = [
  'Tag every lead over 100k followers who has an email as "priority" and give me their handles.',
  'Which niche has the best reply rate this month, and how many leads did each one get?',
  'Draft a first message for the five newest leads, in my voice, using what their last posts are about.',
  'Move everyone I contacted more than ten days ago and never heard from to lost, reason no answer.',
  'Raise the brand fit needed on the fitness campaign to 70% and tell me how many a day that leaves.',
]

function Calls({ title, list }: { title: string; list: Call[] }) {
  return (
    <>
      <h2>{title}</h2>
      <ul className="api-calls">
        {list.map((c) => (
          <li key={`${c.verb} ${c.path}`}>
            <code className={`verb ${c.verb.toLowerCase()}`}>{c.verb}</code>
            <code className="api-path">{c.path}</code>
            <small className="muted">{c.what}</small>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Shown masked, copied whole. A key read off a screen is a key typed wrong. */
function Key() {
  const key = getKey()
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!key) {
    return (
      <p className="muted">
        Your key appears here once you are signed in to your own account. The sample has no key, and nothing on this
        page will answer for it.
      </p>
    )
  }
  const masked = `${key.slice(0, 6)}${'•'.repeat(24)}${key.slice(-4)}`
  return (
    <div className="api-key">
      <code>{shown ? key : masked}</code>
      <button type="button" className="btn small quiet" onClick={() => setShown(!shown)}>
        {shown ? 'Hide' : 'Show'}
      </button>
      <button
        type="button"
        className="btn small"
        onClick={() => {
          void navigator.clipboard?.writeText(key)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2_000)
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function Ai() {
  useStore()
  const account = getAccount()
  const key = getKey() ?? 'YOUR_KEY'
  const mcp = JSON.stringify(
    { mcpServers: { brandmatch: { url: `${API}/mcp`, headers: { Authorization: `Bearer ${key}` } } } },
    null,
    2,
  )

  return (
    <div className="page">
      <div className="page-head"><h1>API and MCP</h1></div>
      <p className="subhead">Point your own AI at your leads. Everything these screens do, it can do.</p>

      <div className="card">
        <h2>Your key</h2>
        <p className="gate-lede">
          One key for {account.name}. It carries your account and nothing else, so anything it reads or writes is
          yours. Send it as a bearer token on every call.
        </p>
        <Key />
        <p className="hint">Treat it like a password. If it leaks, tell us and we swap it in a minute.</p>
      </div>

      <div className="card">
        <h2>Connect an AI in one paste</h2>
        <p className="gate-lede">
          The MCP server describes every call below, so a model can use them without anyone writing code. Paste this
          into Claude, Cursor, or any client that speaks MCP.
        </p>
        <pre className="code-block"><code>{mcp}</code></pre>
        <p className="hint">Then ask in plain words. A few that work today:</p>
        <ul className="facts">
          {ASKS.map((a) => <li key={a} className="yes">{a}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2>Or call it yourself</h2>
        <p className="gate-lede">Plain HTTP, JSON in and out. The base is <code>{API}</code>.</p>
        <pre className="code-block"><code>{`curl ${API}/leads?status=new \\
  -H "Authorization: Bearer ${key.slice(0, 6)}…"`}</code></pre>
        <Calls title="Your leads, and your CRM" list={LEAD_CALLS} />
        <Calls title="Your campaigns and their rules" list={CAMPAIGN_CALLS} />
        <p className="hint">
          A tag written here shows on the list the moment you refresh it, and a tag written on the list is readable
          here. There is one set of tags and one set of statuses, not two.
        </p>
      </div>
    </div>
  )
}
