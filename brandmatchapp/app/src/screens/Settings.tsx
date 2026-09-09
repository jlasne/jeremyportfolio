import {
  addToVocabulary, countTagged, getBrief, getFilters, getFollowUpQuestions, getSettings, getTagVocabulary, getTimezones,
  removeFromVocabulary, resetFilters, restartOnboarding, setFilters, setSettings,
} from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import { navigate } from '../lib/router'
import { useState } from 'react'
import { FilterForm } from '../components/FilterForm'
import { CRITERIA } from '../data'

export function Settings() {
  useStore()
  const [newTag, setNewTag] = useState('')
  const brief = getBrief()
  const filters = getFilters()
  const settings = getSettings()
  const questions = getFollowUpQuestions(brief?.who ?? '')
  return (
    <div className="page settings">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h2>The brief</h2>
        <p className="muted">This is the first agent's brief. Every agent has its own, on the <a href="#/agents">Agents</a> screen.</p>
        {brief ? (
          <>
            <div className="brief-line">
              <p>{brief.summary}</p>
              <a href="#/onboarding/who">Edit</a>
            </div>
            <dl style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px' }}>
              <dt className="faint">Who</dt>
              <dd style={{ margin: 0 }}>{brief.who}</dd>
              {questions.map((q) => (
                <FragmentRow key={q.id} label={q.text} value={brief.answers.find((a) => a.questionId === q.id)?.value ?? null} />
              ))}
            </dl>
            <p className="hint" style={{ marginTop: 10 }}>The brief drives the crawl keywords and the niche star. Editing it re-runs the three questions.</p>
          </>
        ) : (
          <p className="muted">No brief yet. <a href="#/onboarding/who">Write one</a>.</p>
        )}
      </div>

      <div className="card">
        <h2>Filters</h2>
        <FilterForm value={filters} onChange={setFilters} />
        <div className="actions-bar" style={{ marginTop: 12 }}>
          <button type="button" className="btn quiet" onClick={() => resetFilters()}>Reset to defaults</button>
        </div>
      </div>

      <div className="card">
        <h2>Tags</h2>
        <p className="muted">The labels offered when tagging a contact. Free text on a contact adds to this list.</p>
        <div className="chips" style={{ margin: '10px 0' }}>
          {getTagVocabulary().map((t) => (
            <span key={t} className="chip small">
              {t} <span className="num faint">{countTagged(t)}</span>
              <button type="button" className="x" aria-label={`Remove the tag ${t}`} onClick={() => removeFromVocabulary(t)}>×</button>
            </span>
          ))}
        </div>
        <form
          className="new-list"
          onSubmit={(e) => {
            e.preventDefault()
            addToVocabulary(newTag)
            setNewTag('')
          }}
        >
          <input className="input" placeholder="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} aria-label="New tag" />
          <button type="submit" className="btn">Add</button>
        </form>
      </div>

      <div className="card">
        <h2>How the score works</h2>
        <p className="muted">Three criteria, one star each, added up. A half star means the criterion half fits, so the score runs 0 to 3 in half steps. The three are independent, so a creator selling with a fresh signal scores 2 even outside the niche.</p>
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
        <p className="hint">Filters cut the volume. The score sets the order.</p>
      </div>

      <div className="card">
        <h2>Timezone</h2>
        <label className="field">
          <span>The daily batch is ready before 7:00 in this timezone</span>
          <select className="select" value={settings.timezone} onChange={(e) => setSettings({ timezone: e.target.value })}>
            {getTimezones().map((tz) => (
              <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
        <p className="hint">Next batch lands {nextBatchLabel(settings.timezone)}.</p>
      </div>

      <div className="card">
        <h2>Start over</h2>
        <p className="muted">Clears the brief, the filters, the saved lists, notes, tags and rejections, then runs onboarding again.</p>
        <div className="actions-bar" style={{ marginTop: 10 }}>
          <button type="button" className="btn danger" onClick={() => { restartOnboarding(); navigate('onboarding/who') }}>Restart onboarding</button>
        </div>
      </div>
    </div>
  )
}

function FragmentRow({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="faint">{label}</dt>
      <dd style={{ margin: 0 }}>{value ?? <span className="faint">Skipped</span>}</dd>
    </>
  )
}
