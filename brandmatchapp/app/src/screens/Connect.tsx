import { useState } from 'react'
import { getCampaigns, getDashboard } from '../data'
import { useStore } from '../data/hooks'
import { API, getKey, setKey } from '../lib/api'

// One API: read the leads, classify them, and run the campaigns that fill
// them. The app is the CRM, so what the API writes is what the list shows.

const API_URL = API

/** Reading the list. */
const READ_ACTIONS = [
  { call: 'GET /contacts', note: "This morning's list, ranked, with the email where we found one. Filter it the way the app does." },
  { call: 'GET /contacts?campaign=:id', note: 'One campaign at a time, or one agent inside it.' },
  { call: 'GET /creators/:id', note: 'The full profile: last 12 posts, every signal with its date, and why it ranks where it does.' },
  { call: 'GET /stats?days=30', note: 'How many leads each campaign and each agent brought against its daily quota, day by day.' },
]

/** Classifying what came in. The app is the CRM, so these writes show in the list. */
const CRM_ACTIONS = [
  { call: "POST /actions { action: 'tag' }", note: 'Put a lead in a bucket: a launch, a market, a wave. The same tags the app filters on.' },
  { call: "POST /actions { action: 'note' }", note: 'Write what you know. It sits on the contact panel, next to the score.' },
  { call: "POST /actions { action: 'done' }", note: 'Tick off the ones you wrote to, so tomorrow only shows what is left.' },
  { call: "POST /actions { action: 'reject' }", note: 'Drop one for good. It never comes back in this campaign.' },
]

/** Running the campaigns. */
const WRITE_ACTIONS = [
  { call: 'POST /campaigns', note: 'A name, its website, the brief and the daily quota. It reads the shared pool before it crawls anything.' },
  { call: 'PATCH /campaigns/:id', note: 'Point a campaign at a new audience, or set active to false to stop it.' },
  { call: 'POST /campaigns/:id/agents', note: 'Add a searcher with its own hashtags and its own share of the day.' },
  { call: 'POST /campaigns/:id/run', note: 'Start a crawl now instead of waiting for tonight.' },
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
  const searches = getCampaigns()

  return (
    <div className="page editor">
      <div>
      <div className="page-head">
        <h1>API</h1>
      </div>
      <p className="subhead">
        One base URL, one key. It reads your leads, classifies them in the same list you work in, and runs the campaigns
        that fill it. Your own code, or the AI tool you already point at your APIs.
      </p>

      <section className="ask">
        <h2>Your key</h2>
        <div className="keys">
          <Field label="Base" value={API_URL} />
          <KeyBox />
        </div>
        <pre className="code" aria-label="Request example">{`curl ${API_URL}/contacts \\
  -H "Authorization: Bearer $BRANDMATCH_KEY"

curl -X POST ${API_URL}/campaigns \\
  -H "Authorization: Bearer $BRANDMATCH_KEY" \\
  -d '{ "name": "Spring launch",
        "website": "strongher.co",
        "brief": { "who": "Women lifting coaches who sell their own program" },
        "leadsPerDay": 250 }'`}</pre>
        <p className="hint">
          Same key both ways. The key stays in this browser, never in the page. Every field you see in the app is
          reachable here.
        </p>
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
        <h2>Classify them, in the same list</h2>
        <p className="muted">brandmatch is the CRM. Tag, note, tick off and reject from your code, and the app shows it.</p>
        <ul className="criteria plain wide">
          {CRM_ACTIONS.map((a) => (
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
          <dt>At 2 stars and up</dt>
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
