import { useEffect, useRef, useState } from 'react'
import {
  countTagged, diagnoseEmpty, exportCsv, getAgents, getContacts, getFilters, getTagVocabulary, resetFilter, resetFilters, setFilters,
} from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { compact, percent, relative } from '../lib/format'
import { navigate } from '../lib/router'
import { CreatorDetail } from '../components/CreatorDetail'
import { FilterForm } from '../components/FilterForm'
import { Stars } from '../components/Stars'

/** The one list. Everything else about a contact lives behind the row. */
export function Contacts({ agentId }: { agentId: string | null }) {
  useStore()
  const agents = getAgents()
  const [tag, setTag] = useState<string | null>(null)
  const [minStars, setMinStars] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const agent = agents.find((a) => a.id === agentId) ?? null
  const contacts = getContacts({ agentId, tag, minStars })
  const vocabulary = getTagVocabulary().filter((t) => countTagged(t) > 0)

  useEffect(() => {
    if (!showFilters) return
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
  }, [showFilters])

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
          <span>Stars</span>
          <select className="select" value={minStars} onChange={(e) => setMinStars(Number(e.target.value))}>
            <option value={0}>Any</option>
            <option value={1}>1 and up</option>
            <option value={2}>2 and up, qualified</option>
            <option value={3}>3 only</option>
          </select>
        </label>

        <label className="filter-select">
          <span>Agent</span>
          <select className="select" value={agentId ?? ''} onChange={(e) => navigate(e.target.value ? `contacts/${e.target.value}` : 'contacts')}>
            <option value="">Every agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <div className="popover-wrap" ref={box}>
          <button type="button" className={`btn${showFilters ? ' on' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
            More Instagram filters
          </button>
          {showFilters && (
            <div className="popover" role="dialog" aria-label="Instagram filters">
              <h2>
                Instagram filters
                <button type="button" className="btn quiet small" onClick={() => resetFilters()}>Reset</button>
              </h2>
              <FilterForm value={getFilters()} onChange={setFilters} />
              {vocabulary.length > 0 && (
                <div className="filter-line" style={{ marginTop: 14 }}>
                  <span className="filter-label">Your tags</span>
                  <div className="chips">
                    {vocabulary.map((t) => (
                      <button key={t} type="button" className={`chip${tag === t ? ' on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {(tag || minStars > 0) && (
          <button type="button" className="btn quiet" onClick={() => { setTag(null); setMinStars(0) }}>Clear</button>
        )}
      </div>

      {agent && <p className="subhead">{agent.brief.summary}</p>}

      <div className="list">
        {contacts.map((c) => (
          <button type="button" className={`contact${openId === c.creator.id ? ' open' : ''}`} key={c.creator.id} onClick={() => setOpenId(c.creator.id)}>
            <img className="avatar" src={c.creator.avatar} alt="" width={38} height={38} />
            <span className="who">
              <span className="name">
                {c.creator.name}
                {c.isNew && <span className="badge-new">NEW</span>}
              </span>
              <span className="handle">@{c.creator.handle}</span>
            </span>
            <Stars score={c.score} />
            <span className="signal-cell">
              {c.latestSignal ? (
                <>
                  {c.latestSignal.label} <span className="faint">{relative(c.latestSignal.date)}</span>
                </>
              ) : (
                <span className="faint">No signal</span>
              )}
            </span>
            <span className="metric">
              <b className="num">{compact(c.creator.followers)}</b>
              <small>followers</small>
            </span>
            <span className="metric">
              <b className="num">{percent(c.creator.engagementRate)}</b>
              <small>engaged</small>
            </span>
          </button>
        ))}
        {contacts.length === 0 && <Empty tag={tag} minStars={minStars} onClear={() => { setTag(null); setMinStars(0) }} />}
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Empty({ tag, minStars, onClear }: { tag: string | null; minStars: number; onClear: () => void }) {
  if (tag || minStars) {
    return (
      <div className="empty">
        <h2>Nothing matches</h2>
        <p>{tag ? `No contact carries the tag ${tag}` : `No contact reaches ${minStars} stars`} under the filters you set.</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onClear}>Clear the chips</button>
        </div>
      </div>
    )
  }
  const d = diagnoseEmpty()
  return (
    <div className="empty">
      <h2>No contact passes the filters</h2>
      <p>
        {d ? `${d.label} is cutting everything. Loosen it and ${d.restored} contacts come back.` : 'Every filter together cuts all contacts.'}
      </p>
      <div className="actions">
        {d && <button type="button" className="btn primary" onClick={() => resetFilter(d.key)}>Loosen {d.label.toLowerCase()}</button>}
        <button type="button" className="btn" onClick={() => resetFilters()}>Reset all filters</button>
      </div>
    </div>
  )
}
