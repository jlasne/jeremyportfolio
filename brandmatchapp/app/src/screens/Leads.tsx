import { useState } from 'react'
import type { Filters } from '../types'
import {
  CRITERIA, QUALIFIED_RATIO, agentTally, createAgent, deleteAgent, getAgent, getAgents, getDashboard, getSettings, getTimezones,
  qualifiedFrom, setAgentBrief, setSettings, updateAgent, updateAgentFilters,
} from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { DailyChart } from '../components/DailyChart'
import { FilterForm } from '../components/FilterForm'

/** A count of qualified always carries its total and its share. */
function rate(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '0%'
}

/** How many leads come in a day, and which searches bring them. */
export function Leads() {
  useStore()
  const searches = getAgents()
  const [pick, setPick] = useState<string | null>(null)
  const d = getDashboard(pick)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Leads</h1>
        <span className="count">One search each, run every morning</span>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={() => navigate(`leads/${createAgent().id}`)}>New search</button>
      </div>

      <div className="card">
        <h2>
          Leads a day
          <select className="select inline-select" value={pick ?? ''} onChange={(e) => setPick(e.target.value || null)} aria-label="Search">
            <option value="">Every search</option>
            {searches.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </h2>
        <DailyChart data={d.daily} />
        <div className="star-split">
          <div><b className="num">{d.leadsToday}</b><span>leads today</span></div>
          <div>
            <b className="num">{d.qualifiedToday}</b>
            <span>qualified of {d.leadsToday}, {rate(d.qualifiedToday, d.leadsToday)}</span>
          </div>
          <div>
            <b className="num">{d.daily.reduce((sum, x) => sum + x.leads, 0).toLocaleString('en-US')}</b>
            <span>leads over {d.daily.length} days</span>
          </div>
          <div><b className="num">{pick ? 1 : searches.filter((a) => a.active).length}</b><span>{pick ? 'search shown' : 'searches running'}</span></div>
        </div>
      </div>

      <div className="list" style={{ marginTop: 14 }}>
        {searches.map((a) => {
          const t = agentTally(a.id)
          return (
            <a className="agent-row" key={a.id} href={`#/leads/${a.id}`}>
              <span className={`dot${a.active ? ' on' : ''}`} aria-hidden="true" />
              <span className="who">
                <span className="name">{a.name}</span>
                <span className="handle">{a.brief.summary}</span>
              </span>
              <span className="state">{a.active ? `Running, ${a.leadsPerDay} leads a day at ${a.runAt}` : 'Paused'}</span>
              <span className="metric">
                <b className="num">{t.found}</b>
                <small>leads, {t.high} qualified</small>
              </span>
            </a>
          )
        })}
        {searches.length === 0 && (
          <div className="empty">
            <h2>No search yet</h2>
            <p>A search holds one sentence about the creators you want, plus your filters. It runs every morning and fills your contact list.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => navigate(`leads/${createAgent().id}`)}>Create the first search</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** One search: the sentence, the filters, and how many leads a day it brings. */
export function LeadEditor({ agentId, firstRun = false }: { agentId: string; firstRun?: boolean }) {
  useStore()
  const search = getAgent(agentId)
  const settings = getSettings()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!search) {
    return (
      <div className="page">
        <div className="page-head"><h1>Search not found</h1></div>
        <a className="btn" href="#/leads">Back to leads</a>
      </div>
    )
  }

  const tally = agentTally(search.id)
  const onFilters = (patch: Partial<Filters>) => updateAgentFilters(search.id, patch)
  const canRun = search.brief.who.trim().length > 0

  return (
    <div className="page editor">
      {firstRun ? (
        <div className="page-head">
          <h1>Set up your first search</h1>
        </div>
      ) : (
        <div className="page-head">
          <a className="back" href="#/leads">Leads</a>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => updateAgent(search.id, { active: !search.active })}>
            {search.active ? 'Pause' : 'Run every day'}
          </button>
          <a className="btn primary" href={`#/contacts/${search.id}`}>See {tally.found} leads</a>
        </div>
      )}
      {firstRun && (
        <p className="subhead">One sentence about the creators you want, plus your filters. It runs every morning and fills your list.</p>
      )}

      <input
        className="input title-input"
        value={search.name}
        aria-label="Search name"
        placeholder="Name this search"
        autoFocus={firstRun}
        onChange={(e) => updateAgent(search.id, { name: e.target.value })}
      />

      <section className="ask">
        <h2><label htmlFor="who">Who are you looking for?</label></h2>
        <input
          id="who"
          className="input big"
          placeholder="Women lifting coaches who sell their own program"
          value={search.brief.who}
          onChange={(e) => setAgentBrief(search.id, e.target.value)}
        />
        <p className="helper">One sentence. It decides who we look for and how well each creator fits.</p>
      </section>

      <section className="ask">
        <h2>Filters</h2>
        <FilterForm value={search.filters} onChange={onFilters} />
      </section>

      <section className="ask">
        <h2>Delivery</h2>
        <div className="field-row">
          <label className="field">
            <span>Leads a day</span>
            <input
              className="input num"
              inputMode="numeric"
              value={search.leadsPerDay}
              onChange={(e) => updateAgent(search.id, { leadsPerDay: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })}
            />
          </label>
          <label className="field">
            <span>Ready at</span>
            <input className="input" type="time" value={search.runAt} onChange={(e) => updateAgent(search.id, { runAt: e.target.value })} />
          </label>
          <label className="field">
            <span>Timezone</span>
            <select className="select" value={settings.timezone} onChange={(e) => setSettings({ timezone: e.target.value })}>
              {getTimezones().map((tz) => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="estimate">
          <b className="num">{search.leadsPerDay}</b> leads in your list every morning, about <b className="num">{qualifiedFrom(search.leadsPerDay)}</b> of
          them qualified. Roughly 1 lead in {QUALIFIED_RATIO} comes back qualified, and every lead shows either way.
        </p>
        {!firstRun && (
          <p className="hint">Found {tally.found} leads so far, {tally.high} qualified, {rate(tally.high, tally.found)}.</p>
        )}
      </section>

      {!firstRun && (
      <section className="ask">
        <h2>How this search ranks creators</h2>
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
        <p className="hint">Three things, one star each, added up. Half a star when it half fits, so the score runs 0 to 3 in half steps.</p>
      </section>
      )}

      {firstRun ? (
        <div className="editor-foot">
          <span className="faint">You can add more searches later.</span>
          <span className="spacer" />
          <button type="button" className="btn primary" disabled={!canRun} onClick={() => navigate(`onboarding/${search.id}/running`)}>
            Find my leads
          </button>
        </div>
      ) : (
      <div className="editor-foot">
        {confirmDelete ? (
          <>
            <button type="button" className="btn danger" onClick={() => { deleteAgent(search.id); navigate('leads') }}>Confirm delete</button>
            <button type="button" className="btn quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
          </>
        ) : (
          <button type="button" className="btn quiet danger" onClick={() => setConfirmDelete(true)}>Delete this search</button>
        )}
        <span className="spacer" />
        <a className="btn primary" href={`#/contacts/${search.id}`}>See {tally.found} leads</a>
      </div>
      )}
    </div>
  )
}
