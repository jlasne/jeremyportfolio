import { useState } from 'react'
import {
  CRITERIA, QUALIFIED_MIN, addToVocabulary, countDone, countTagged, getAgents, getDashboard, getSettings, getTagVocabulary,
  getTimezones, removeFromVocabulary, setSettings,
} from '../data'
import { useStore } from '../data/hooks'
import { resetState } from '../data/store'
import { nextBatchLabel } from '../lib/format'
import { navigate } from '../lib/router'

export function Settings() {
  useStore()
  const settings = getSettings()
  const agents = getAgents()
  const d = getDashboard()
  const [newTag, setNewTag] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="page editor">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <section className="ask">
        <h2>When your list lands</h2>
        <label className="field">
          <span>Your timezone</span>
          <select className="select" value={settings.timezone} onChange={(e) => setSettings({ timezone: e.target.value })}>
            {getTimezones().map((tz) => (
              <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
        <p className="hint">Next batch {nextBatchLabel(settings.timezone)}. Each agent sets its own hour.</p>
      </section>

      <section className="ask">
        <h2>Tags</h2>
        <p className="muted">The labels offered when you tag a contact. Typing a new one on a contact adds it here.</p>
        <div className="chips" style={{ margin: '12px 0' }}>
          {getTagVocabulary().map((t) => (
            <span key={t} className="chip small">
              {t} <span className="num faint">{countTagged(t)}</span>
              <button type="button" className="x" aria-label={`Remove the tag ${t}`} onClick={() => removeFromVocabulary(t)}>×</button>
            </span>
          ))}
        </div>
        <form
          className="new-inline"
          onSubmit={(e) => {
            e.preventDefault()
            addToVocabulary(newTag)
            setNewTag('')
          }}
        >
          <input className="input" placeholder="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} aria-label="New tag" />
          <button type="submit" className="btn">Add</button>
        </form>
      </section>

      <section className="ask">
        <h2>What counts as qualified</h2>
        <p className="muted">Above {QUALIFIED_MIN} stars. Each of the three below is worth one star, and half a star when it half fits.</p>
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
      </section>

      <section className="ask">
        <h2>Your account</h2>
        <dl className="pairs">
          <dt>Agents</dt>
          <dd className="num">{agents.length}, {agents.filter((a) => a.active).length} running</dd>
          <dt>Leads a day</dt>
          <dd className="num">{agents.filter((a) => a.active).reduce((sum, a) => sum + a.leadsPerDay, 0).toLocaleString('en-US')}</dd>
          <dt>Contacts in your list</dt>
          <dd className="num">{d.total}</dd>
          <dt>Marked done</dt>
          <dd className="num">{countDone()}</dd>
        </dl>
        <a className="btn small" href="#/connect">Connect your AI</a>
      </section>

      <section className="ask">
        <h2>Start over</h2>
        <p className="muted">Clears your agents, tags, notes and everything marked done, then runs setup again.</p>
        <div className="actions-bar" style={{ marginTop: 10 }}>
          {confirmReset ? (
            <>
              <button type="button" className="btn danger" onClick={() => { resetState(); navigate('onboarding') }}>Confirm reset</button>
              <button type="button" className="btn quiet" onClick={() => setConfirmReset(false)}>Keep my data</button>
            </>
          ) : (
            <button type="button" className="btn quiet danger" onClick={() => setConfirmReset(true)}>Reset everything</button>
          )}
        </div>
      </section>
    </div>
  )
}
