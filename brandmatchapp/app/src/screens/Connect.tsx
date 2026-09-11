import { useState } from 'react'
import { getCampaigns, getDashboard } from '../data'
import { useStore } from '../data/hooks'

// One API: read the leads, run the campaigns that fill them.
// One base URL, one key, and a list of what it covers.

const API_URL = 'https://api.brandmatch.app/v1'
const KEY = 'bm_live_7f2a9c41d8e6b350'

/** Reading the list. */
const READ_ACTIONS = [
  { call: "GET /leads", note: "This morning's list, ranked, with the email where we found one. Filter it the way the app does." },
  { call: 'GET /leads?qualified=1', note: 'The ones at half a star or more, ready for a message today.' },
  { call: 'GET /leads/:id', note: 'The full profile: last 12 posts, every signal with its date, and why it ranks where it does.' },
  { call: 'POST /leads/:id/tags', note: 'Tag, note and tick off from your own code, so the list stays tidy while it works.' },
  { call: 'GET /stats', note: 'How many leads each campaign and each agent brought, and how many came back qualified.' },
]

/** Running the campaigns. */
const WRITE_ACTIONS = [
  { call: 'POST /campaigns', note: 'A name, its website, the agents inside it and how many leads a day each should bring.' },
  { call: 'PATCH /campaigns/:id', note: 'Point a campaign at a new audience without touching the app.' },
  { call: 'PATCH /campaigns/:id/agents/:id', note: 'Raise an agent from 100 to 800 leads a day, or drop it back.' },
  { call: 'POST /campaigns/:id/pause', note: 'Stop every campaign while you are closed, start them again on Monday.' },
]

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn small"
      disabled
      title="Available when the API ships"
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
            <h2 id="soon-title">The API is on its way</h2>
            <p>
              One key reads this morning's leads and runs the campaigns that fill them: create one, add agents, move a daily
              volume, pause it. Your own code, or the AI tool you already point at your APIs.
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
        <h1>API</h1>
        <span className="soon">Coming soon</span>
      </div>
      <p className="subhead">
        One base URL, one key. It reads your leads and it runs the campaigns that fill them. It opens soon, and the
        shape below is what it will look like.
      </p>

      <section className="ask">
        <h2>Your key</h2>
        <div className="keys">
          <Field label="Base" value={API_URL} />
          <Field label="Key" value={KEY} mask />
        </div>
        <pre className="code" aria-label="Request example">{`curl ${API_URL}/leads?qualified=1 \\
  -H "Authorization: Bearer ${KEY}"

curl -X POST ${API_URL}/campaigns \\
  -H "Authorization: Bearer ${KEY}" \\
  -d '{ "name": "Spring launch",
        "audience": "Women lifting coaches who sell their own program",
        "leads_per_day": 250 }'`}</pre>
        <p className="hint">Same key both ways. Every field you see in the app, reachable here.</p>
      </section>

      <section className="ask">
        <h2>Read your leads</h2>
        <ul className="criteria plain wide">
          {READ_ACTIONS.map((a) => (
            <li key={a.call}>
              <span className="crit-name">{a.call}</span>
              <span className="crit-means">{a.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ask">
        <h2>Run your campaigns</h2>
        <ul className="criteria plain wide">
          {WRITE_ACTIONS.map((a) => (
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
