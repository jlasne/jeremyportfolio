import { useEffect, useRef, useState } from 'react'
import type { Level } from '../types'
import {
  CRITERIA, addTag, countDone, countTagged, diagnoseEmpty, exportCsv, getAgents, getContacts, getFilters, getTagVocabulary,
  reject, resetFilter, resetFilters, setFilters, toggleDone,
} from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { compact, percent } from '../lib/format'
import { navigate } from '../lib/router'
import { CreatorDetail } from '../components/CreatorDetail'
import { FilterForm } from '../components/FilterForm'
import { Stars } from '../components/Stars'

type CriterionKey = 'niche' | 'active' | 'intent'

/** The one list. A handle, how ready they are, and the email. */
export function Contacts({ agentId }: { agentId: string | null }) {
  useStore()
  const agents = getAgents()
  const [tag, setTag] = useState<string | null>(null)
  const [minStars, setMinStars] = useState(0)
  const [minLevels, setMinLevels] = useState<Partial<Record<CriterionKey, Level>>>({})
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [bulkTag, setBulkTag] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const starBox = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setShowFilters(false)
      if (starBox.current && !starBox.current.contains(e.target as Node)) setShowStars(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setShowFilters(false)
      setShowStars(false)
    }
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
    minStars,
    minLevels,
    done: showDone ? 'any' : 'hide',
  })
  const vocabulary = getTagVocabulary().filter((t) => countTagged(t) > 0)
  const allTags = getTagVocabulary()
  const done = countDone()
  const shown = contacts.map((c) => c.creator.id)
  const selected = picked.filter((id) => shown.includes(id))
  const allPicked = shown.length > 0 && selected.length === shown.length

  const levelCount = Object.values(minLevels).filter((v) => (v ?? 0) > 0).length
  const setLevel = (key: CriterionKey, level: Level) =>
    setMinLevels((m) => {
      const next = { ...m }
      if (level === 0) delete next[key]
      else next[key] = level
      return next
    })

  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const clearPick = () => setPicked([])
  const bulk = (run: (id: string) => void) => {
    selected.forEach(run)
    clearPick()
  }

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
        <div className="popover-wrap" ref={starBox}>
          <button type="button" className={`btn${minStars || levelCount ? ' on' : ''}`} aria-expanded={showStars} onClick={() => setShowStars((v) => !v)}>
            Stars: {minStars === 0 && levelCount === 0 ? 'Any' : `${minStars > 0 ? `${minStars}+` : 'Any'}${levelCount ? ` · ${levelCount} set` : ''}`}
          </button>
          {showStars && (
            <div className="popover narrow left" role="dialog" aria-label="Stars">
              <h2>Stars</h2>
              <div className="slider-row">
                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={3}
                  step={0.5}
                  value={minStars}
                  aria-label="Minimum stars"
                  onChange={(e) => setMinStars(Number(e.target.value))}
                />
                <span className="slider-value num">{minStars === 0 ? 'Any' : `${minStars}+`}</span>
              </div>
              <div className="slider-ticks"><span>0</span><span>1</span><span>2</span><span>3</span></div>
              <p className="hint" style={{ marginTop: 10 }}>Above 1.5 stars is what counts as qualified.</p>

              <h2 style={{ marginTop: 18 }}>At least</h2>
              <div className="levels">
                {CRITERIA.map((c) => {
                  const key = c.key as CriterionKey
                  const at = minLevels[key] ?? 0
                  return (
                    <div className="level-row" key={key}>
                      <span className="level-name">{c.label}</span>
                      <div className="chips">
                        {([0, 0.5, 1] as Level[]).map((lv) => (
                          <button
                            key={lv}
                            type="button"
                            className={`chip small${at === lv ? ' on' : ''}`}
                            aria-pressed={at === lv}
                            onClick={() => setLevel(key, lv)}
                          >
                            {lv === 0 ? 'Any' : lv === 0.5 ? 'Half' : 'Full'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="hint">Niche is the fit, selling is their own product, signal is a fresh brand deal.</p>
              {(minStars > 0 || levelCount > 0) && (
                <button type="button" className="btn quiet small" style={{ marginTop: 12 }} onClick={() => { setMinStars(0); setMinLevels({}) }}>
                  Clear stars
                </button>
              )}
            </div>
          )}
        </div>

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

      {selected.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selected contacts">
          <b className="num">{selected.length}</b>
          <span>selected</span>
          <span className="spacer" />
          <select
            className="select"
            value={bulkTag}
            aria-label="Tag the selected contacts"
            onChange={(e) => {
              const label = e.target.value
              if (!label) return
              bulk((id) => addTag(id, label))
              setBulkTag('')
            }}
          >
            <option value="">Add a tag</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => bulk(toggleDone)}>Mark done</button>
          <button type="button" className="btn danger" onClick={() => bulk(reject)}>Reject</button>
          <button type="button" className="btn quiet" onClick={clearPick}>Clear</button>
        </div>
      )}

      <div className="list">
        {contacts.length > 0 && (
          <div className="select-all">
            <label className="tick">
              <input
                type="checkbox"
                checked={allPicked}
                aria-label="Select every contact shown"
                onChange={() => setPicked(allPicked ? [] : shown)}
              />
            </label>
            <span className="faint">Select all {contacts.length}</span>
          </div>
        )}
        {contacts.map((c) => (
          <div className={`contact${openId === c.creator.id ? ' open' : ''}${c.isDone ? ' done' : ''}`} key={c.creator.id}>
            <label className="tick">
              <input
                type="checkbox"
                checked={picked.includes(c.creator.id)}
                onChange={() => pick(c.creator.id)}
                aria-label={`Select @${c.creator.handle}`}
              />
            </label>
            <button type="button" className="handle-btn" onClick={() => setOpenId(c.creator.id)}>
              @{c.creator.handle}
              {c.isNew && <span className="badge-new">NEW</span>}
              {c.isDone && <span className="badge-done">Done</span>}
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
        {contacts.length === 0 && <Empty tag={tag} done={done} onClear={() => { setTag(null); setMinStars(0); setMinLevels({}); navigate('contacts') }} />}
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
