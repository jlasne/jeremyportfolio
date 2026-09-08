import { getBrief, getFilters, getFollowUpQuestions, getSettings, getTimezones, resetFilters, restartOnboarding, setFilters, setSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import { navigate } from '../lib/router'
import { FilterForm } from '../components/FilterForm'

export function Settings() {
  useStore()
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
            <p className="hint" style={{ marginTop: 10 }}>The brief drives the crawl keywords and the match score. Editing it re-runs the three questions.</p>
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
