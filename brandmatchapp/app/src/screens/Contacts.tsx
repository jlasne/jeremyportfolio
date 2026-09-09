import { useEffect, useRef, useState } from 'react'
import { CRITERIA, countTagged, diagnoseEmpty, exportCsv, getAgents, getContacts, getFilters, getTagVocabulary, resetFilter, resetFilters, setFilters } from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { compact, percent } from '../lib/format'
import { navigate } from '../lib/router'
import { CreatorDetail } from '../components/CreatorDetail'
import { FilterForm } from '../components/FilterForm'
import { Stars } from '../components/Stars'

type CriterionKey = 'niche' | 'active' | 'intent'

/** The one list. Everything else about a contact lives behind the row. */
export function Contacts({ agentId }: { agentId: string | null }) {
  useStore()
  const agents = getAgents()
  const [picked, setPicked] = useState<string[]>(agentId ? [agentId] : [])
  const [tag, setTag] = useState<string | null>(null)
  const [minStars, setMinStars] = useState(0)
  const [mustHave, setMustHave] = useState<CriterionKey[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const starBox = useRef<HTMLDivElement>(null)

  // A link from an agent preselects it.
  useEffect(() => {
    if (agentId) setPicked([agentId])
  }, [agentId])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setShowFilters(false)
      if (starBox.current && !starBox.current.contains(e.target as Node)) setShowStars(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFilters(false)
        setShowStars(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const contacts = getContacts({ agentIds: picked, tag, minStars, mustHave })
  const vocabulary = getTagVocabulary().filter((t) => countTagged(t) > 0)

  const toggleAgent = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    if (agentId) navigate('contacts')
  }
  const toggleMust = (key: CriterionKey) => setMustHave((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key]))
  const starLabel = minStars === 0 && mustHave.length === 0 ? 'Any' : `${minStars}+${mustHave.length ? ` · ${mustHave.length} must have` : ''}`

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
          <button type="button" className={`btn${minStars || mustHave.length ? ' on' : ''}`} aria-expanded={showStars} onClick={() => setShowStars((v) => !v)}>
            Stars: {starLabel}
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
              <div className="slider-ticks">
                <span>0</span><span>1</span><span>2</span><span>3</span>
              </div>
              <p className="hint" style={{ marginTop: 10 }}>2 stars and up is what counts as qualified.</p>
              <h2 style={{ marginTop: 16 }}>Must have</h2>
              <div className="chips">
                {CRITERIA.map((c) => {
                  const key = c.key as CriterionKey
                  const on = mustHave.includes(key)
                  return (
                    <button key={key} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleMust(key)}>
                      {c.label}
                    </button>
                  )
                })}
              </div>
              <p className="hint">Each one picked must score above zero.</p>
            </div>
          )}
        </div>

        <div className="chips agent-chips">
          <button type="button" className={`chip${picked.length === 0 ? ' on' : ''}`} aria-pressed={picked.length === 0} onClick={() => { setPicked([]); if (agentId) navigate('contacts') }}>
            Every agent
          </button>
          {agents.map((a) => (
            <button key={a.id} type="button" className={`chip${picked.includes(a.id) ? ' on' : ''}`} aria-pressed={picked.includes(a.id)} onClick={() => toggleAgent(a.id)}>
              {a.name}
            </button>
          ))}
        </div>

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

        {(tag || minStars > 0 || mustHave.length > 0) && (
          <button type="button" className="btn quiet" onClick={() => { setTag(null); setMinStars(0); setMustHave([]) }}>Clear</button>
        )}
      </div>

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
            <span className={`mail${c.creator.email ? '' : ' none'}`}>{c.creator.email ?? 'No email found'}</span>
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
        {contacts.length === 0 && (
          <Empty tag={tag} minStars={minStars} mustHave={mustHave.length} onClear={() => { setTag(null); setMinStars(0); setMustHave([]) }} />
        )}
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Empty({ tag, minStars, mustHave, onClear }: { tag: string | null; minStars: number; mustHave: number; onClear: () => void }) {
  if (tag || minStars || mustHave) {
    return (
      <div className="empty">
        <h2>Nothing matches</h2>
        <p>{tag ? `No contact carries the tag ${tag}` : mustHave ? 'No contact scores on every criterion you asked for' : `No contact reaches ${minStars} stars`} under the filters you set.</p>
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
      <p>{d ? `${d.label} is cutting everything. Loosen it and ${d.restored} contacts come back.` : 'Every filter together cuts all contacts.'}</p>
      <div className="actions">
        {d && <button type="button" className="btn primary" onClick={() => resetFilter(d.key)}>Loosen {d.label.toLowerCase()}</button>}
        <button type="button" className="btn" onClick={() => resetFilters()}>Reset all filters</button>
      </div>
    </div>
  )
}
