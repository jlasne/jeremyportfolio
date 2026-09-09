import { useEffect, useRef, useState } from 'react'
import {
  countDone, countTagged, diagnoseEmpty, exportCsv, getAgents, getContacts, getFilters, getTagVocabulary,
  resetFilter, resetFilters, setFilters, toggleDone,
} from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { compact, percent } from '../lib/format'
import { navigate } from '../lib/router'
import { CreatorDetail } from '../components/CreatorDetail'
import { FilterForm } from '../components/FilterForm'
import { Stars } from '../components/Stars'

/** The one list. A handle, how ready they are, and the email. */
export function Contacts({ agentId }: { agentId: string | null }) {
  useStore()
  const agents = getAgents()
  const [tag, setTag] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setShowFilters(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowFilters(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const contacts = getContacts({
    agentIds: agentId ? [agentId] : [],
    tag,
    done: showDone ? 'any' : 'hide',
  })
  const vocabulary = getTagVocabulary().filter((t) => countTagged(t) > 0)
  const done = countDone()

  return (
    <div className="page">
      <div className="page-head">
        <h1>Contacts</h1>
        <span className="count num">{contacts.length}</span>
        <span className="spacer" />
        <button type="button" className="btn" disabled={contacts.length === 0} onClick={() => downloadCsv('brandmatch-contacts.csv', exportCsv(contacts.map((c) => c.creator.id)))}>
          Export
        </button>
      </div>

      <div className="filter-bar">
        <label className="filter-select">
          <span>Agent</span>
          <select className="select" value={agentId ?? ''} onChange={(e) => navigate(e.target.value ? `contacts/${e.target.value}` : 'contacts')}>
            <option value="">Every agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <label className="filter-select">
          <span>Tag</span>
          <select className="select" value={tag ?? ''} onChange={(e) => setTag(e.target.value || null)}>
            <option value="">Any tag</option>
            {vocabulary.map((t) => (
              <option key={t} value={t}>{t} ({countTagged(t)})</option>
            ))}
          </select>
        </label>

        <div className="popover-wrap" ref={box}>
          <button type="button" className={`btn${showFilters ? ' on' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
            More filters
          </button>
          {showFilters && (
            <div className="popover" role="dialog" aria-label="Filters">
              <h2>
                Filters
                <button type="button" className="btn quiet small" onClick={() => resetFilters()}>Reset</button>
              </h2>
              <FilterForm value={getFilters()} onChange={setFilters} />
            </div>
          )}
        </div>

        <span className="spacer" />
        {done > 0 && (
          <button type="button" className={`btn${showDone ? ' on' : ''}`} onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide done' : `Show ${done} done`}
          </button>
        )}
      </div>

      <div className="list">
        {contacts.map((c) => (
          <div className={`contact${openId === c.creator.id ? ' open' : ''}${c.isDone ? ' done' : ''}`} key={c.creator.id}>
            <label className="tick">
              <input type="checkbox" checked={c.isDone} onChange={() => toggleDone(c.creator.id)} aria-label={`Mark @${c.creator.handle} done`} />
            </label>
            <button type="button" className="handle-btn" onClick={() => setOpenId(c.creator.id)}>
              @{c.creator.handle}
              {c.isNew && <span className="badge-new">NEW</span>}
            </button>
            <Stars score={c.score} />
            <span className={`mail${c.creator.email ? '' : ' none'}`}>{c.creator.email ?? 'No email found'}</span>
            <span className="metric">
              <b className="num">{compact(c.creator.followers)}</b>
              <small>followers</small>
            </span>
            <span className="metric">
              <b className="num">{percent(c.creator.engagementRate)}</b>
              <small>engaged</small>
            </span>
          </div>
        ))}
        {contacts.length === 0 && <Empty tag={tag} done={done} onClear={() => { setTag(null); navigate('contacts') }} />}
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Empty({ tag, done, onClear }: { tag: string | null; done: number; onClear: () => void }) {
  if (tag) {
    return (
      <div className="empty">
        <h2>Nothing tagged {tag}</h2>
        <p>Tag a contact from its panel and it shows up here.</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onClear}>Show every contact</button>
        </div>
      </div>
    )
  }
  if (done > 0) {
    return (
      <div className="empty">
        <h2>You are through today's list</h2>
        <p>All {done} contacts are marked done. The next batch lands tomorrow morning.</p>
      </div>
    )
  }
  const d = diagnoseEmpty()
  return (
    <div className="empty">
      <h2>No contact passes the filters</h2>
      <p>{d ? `${d.label} is cutting everything. Loosen it and ${d.restored} contacts come back.` : 'Every filter together cuts all contacts.'}</p>
      <div className="actions">
        {d && <button type="button" className="btn primary" onClick={() => resetFilter(d.key)}>Loosen {d.label.toLowerCase()}</button>}
        <button type="button" className="btn" onClick={() => resetFilters()}>Reset all filters</button>
      </div>
    </div>
  )
}
