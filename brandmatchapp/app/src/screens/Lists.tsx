import { useState } from 'react'
import { createList, exportCsv, getUsedTags, getLead, getList, getLists, getNote, getTags, removeFromList, type Lead } from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { navigate } from '../lib/router'
import { CreatorDetail } from '../components/CreatorDetail'
import { Signal } from '../components/Signal'
import { Stars } from '../components/Stars'

export function Lists({ listId }: { listId: string | null }) {
  useStore()
  const lists = getLists()
  const current = (listId && getList(listId)) || lists[0] || null
  const [name, setName] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const items = current
    ? current.creatorIds.map((id) => getLead(id)).filter((i): i is Lead => i !== null).filter((i) => !tag || getTags(i.creator.id).includes(tag))
    : []
  const tagsInList = current ? Array.from(new Set(current.creatorIds.flatMap((id) => getTags(id)))).sort() : []
  const allTags = getUsedTags()

  return (
    <div className="page">
      <div className="page-head">
        <h1>Saved lists</h1>
        <span className="spacer" />
        <form
          className="new-inline"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            const l = createList(name)
            setName('')
            navigate(`lists/${l.id}`)
          }}
        >
          <input className="input" placeholder="New list" value={name} onChange={(e) => setName(e.target.value)} aria-label="New list name" />
          <button type="submit" className="btn">Create</button>
        </form>
        {current && (
          <button type="button" className="btn" disabled={items.length === 0} onClick={() => downloadCsv(`${current.name.replace(/\s+/g, '-').toLowerCase()}.csv`, exportCsv(items.map((i) => i.creator.id)))}>
            Export
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="tag-strip">
          <span className="field-label" style={{ margin: 0 }}>Tags</span>
          <div className="chips">
            {allTags.map((t) => (
              <button key={t} type="button" className={`chip small${tag === t ? ' on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} disabled={!tagsInList.includes(t)}>
                {t}
              </button>
            ))}
          </div>
          {tag && <button type="button" className="btn quiet small" onClick={() => setTag(null)}>Clear</button>}
        </div>
      )}

      <div className="two-col">
        <nav className="list-nav" aria-label="Lists">
          {lists.map((l) => (
            <a key={l.id} href={`#/lists/${l.id}`} className={current?.id === l.id ? 'on' : undefined}>
              <span>{l.name}</span>
              <span className="count num">{l.creatorIds.length}</span>
            </a>
          ))}
        </nav>

        <div className="feed">
          {!current && (
            <div className="empty">
              <h2>No list yet</h2>
              <p>Create one on the left, then save creators from the feed. Saved creators keep their notes and tags through every refresh.</p>
            </div>
          )}
          {current && current.creatorIds.length === 0 && (
            <div className="empty">
              <h2>{current.name} is empty</h2>
              <p>Save a creator from the feed or its detail panel and it lands here. Notes and tags stay with the creator through every refresh.</p>
              <div className="actions">
                <a className="btn primary" href="#/feed">Open the feed</a>
              </div>
            </div>
          )}
          {current && current.creatorIds.length > 0 && items.length === 0 && (
            <div className="empty">
              <h2>No creator in {current.name} has the tag {tag}</h2>
              <div className="actions">
                <button type="button" className="btn" onClick={() => setTag(null)}>Clear the tag</button>
              </div>
            </div>
          )}
          {items.map((item) => {
            const c = item.creator
            const note = getNote(c.id)
            const tags = getTags(c.id)
            return (
              <div className="saved-row" key={c.id}>
                <img className="avatar" src={c.avatar} alt="" width={36} height={36} />
                <div className="who">
                  <div className="name">
                    <button type="button" className="btn quiet small" style={{ padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => setOpenId(c.id)}>
                      {c.name}
                    </button>
                    <span className="handle">@{c.handle}</span>
                    {item.isRejected && <span className="badge-saved">Rejected</span>}
                  </div>
                  {note ? <p className="note">{note}</p> : <p className="note faint">No note yet.</p>}
                  {tags.length > 0 && (
                    <div className="tags">
                      {tags.map((t) => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Stars score={item.score} />
                <Signal signal={item.latestSignal} />
                <div className="side">
                  <button type="button" className="btn small" onClick={() => setOpenId(c.id)}>Open</button>
                  <button type="button" className="btn small quiet" onClick={() => current && removeFromList(c.id, current.id)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
