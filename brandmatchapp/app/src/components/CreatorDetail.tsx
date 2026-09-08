import { useEffect, useRef, useState } from 'react'
import {
  addTag,
  createList,
  getLead,
  getLists,
  getNote,
  getPosts,
  getTags,
  getTagVocabulary,
  toggleTag,
  listsFor,
  reject,
  removeFromList,
  removeTag,
  saveToList,
  setNote,
  exportCsv,
} from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { COUNTRY_NAMES, LANGUAGE_NAMES, absolute, compact, percent, relative } from '../lib/format'
import { Signal } from './Signal'
import { Stars } from './Stars'

export function CreatorDetail({ id, onClose }: { id: string; onClose: () => void }) {
  useStore()
  const item = getLead(id)
  const panel = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'none' | 'save' | 'note' | 'tag'>('none')
  const [noteDraft, setNoteDraft] = useState(() => getNote(id))
  const [tagDraft, setTagDraft] = useState('')
  const [newList, setNewList] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  useEffect(() => {
    setMode('none')
    setNoteDraft(getNote(id))
    setTagDraft('')
    setCopied(false)
    setConfirmReject(false)
    panel.current?.focus()
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) return null
  const c = item.creator
  const posts = getPosts(c.id)
  const lists = getLists()
  const inLists = listsFor(c.id)
  const tags = getTags(c.id)
  const note = getNote(c.id)

  const copyEmail = async () => {
    if (!c.email) return
    try {
      await navigator.clipboard.writeText(c.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy the email', c.email)
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="panel" role="dialog" aria-modal="true" aria-label={`${c.name}, creator detail`} ref={panel} tabIndex={-1}>
        <div className="panel-head">
          <img className="avatar lg" src={c.avatar} alt="" width={52} height={52} />
          <div className="who" style={{ flex: 1 }}>
            <div className="name">
              <span>{c.name}</span>
              {item.isNew && <span className="badge-new">NEW</span>}
            </div>
            <div className="muted">
              @{c.handle} · {COUNTRY_NAMES[c.country]} · {LANGUAGE_NAMES[c.language]}
            </div>
          </div>
          <button type="button" className="btn quiet" onClick={onClose} aria-label="Close">Close</button>
        </div>

        <div className="panel-body">
          {item.isRejected && <div className="state-line rejected">Rejected. This creator stays out of the feed.</div>}
          {inLists.length > 0 && !item.isRejected && (
            <div className="state-line">Saved in {inLists.map((l) => l.name).join(', ')}.</div>
          )}

          <section>
            <h3>Why this score</h3>
            <div className="why">
              <Stars score={item.score} size="large" />
              <p>{item.score.why}</p>
            </div>
            <ul className="facts">
              <li className={item.score.niche ? 'yes' : 'no'}>{item.score.niche ? 'Fits the brief' : 'Outside the brief'}</li>
              <li className={item.score.active ? 'yes' : 'no'}>{c.sells ? `Sells ${c.sells}` : 'Sells nothing yet'}</li>
              <li className={item.score.intent ? 'yes' : 'no'}>{item.score.intent ? 'Brand signal in the last 30 days' : 'Last brand signal over 30 days ago'}</li>
            </ul>
            {!item.score.niche && <p className="hint">{c.nicheWhy}</p>}
            {item.agent && <p className="hint">Found by {item.agent.name}.</p>}
          </section>

          <section>
            <h3>Signals found</h3>
            {c.signals.length === 0 ? (
              <p className="faint">No signal in the last 90 days. Last post {relative(c.lastPostAt)}.</p>
            ) : (
              <div className="signals-list">
                {c.signals.map((s) => (
                  <Signal key={s.type + s.date} signal={s} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3>Numbers</h3>
            <div className="metrics">
              <div className="metric"><b>{compact(c.followers)}</b><small>followers</small></div>
              <div className="metric"><b>{percent(c.engagementRate)}</b><small>engagement</small></div>
              <div className="metric"><b>{compact(c.medianReelViews)}</b><small>median reel views</small></div>
              <div className="metric"><b>{c.postsPerMonth}</b><small>posts a month</small></div>
            </div>
            <p className="hint">Engagement and views come from the last 12 posts we crawled. Last post {relative(c.lastPostAt)}. First seen {relative(c.firstSeenAt)}. Crawled {relative(c.lastCrawlAt)}.</p>
          </section>

          <section>
            <h3>Bio</h3>
            <p>{c.bio}</p>
            <p className={`mail${c.email ? '' : ' none'}`} style={{ marginTop: 4 }}>{c.email ?? 'No email in the bio'}</p>
          </section>

          <section>
            <h3>Actions</h3>
            <div className="actions-bar">
              <button type="button" className={`btn${mode === 'save' ? ' on' : ''}`} onClick={() => setMode(mode === 'save' ? 'none' : 'save')}>Save</button>
              <button type="button" className={`btn${mode === 'note' ? ' on' : ''}`} onClick={() => setMode(mode === 'note' ? 'none' : 'note')}>{note ? 'Edit note' : 'Add note'}</button>
              <button type="button" className={`btn${mode === 'tag' ? ' on' : ''}`} onClick={() => setMode(mode === 'tag' ? 'none' : 'tag')}>Tag</button>
              <button type="button" className="btn" onClick={copyEmail} disabled={!c.email}>{copied ? 'Copied' : 'Copy email'}</button>
              <a className="btn" href={`https://instagram.com/${c.handle}`} target="_blank" rel="noreferrer">Open Instagram</a>
              <button type="button" className="btn" onClick={() => downloadCsv(`${c.handle}.csv`, exportCsv([c.id]))}>Export</button>
              {!item.isRejected && !confirmReject && (
                <button type="button" className="btn danger" onClick={() => setConfirmReject(true)}>Reject</button>
              )}
              {confirmReject && (
                <>
                  <button type="button" className="btn danger" onClick={() => { reject(c.id); setConfirmReject(false) }}>Confirm reject</button>
                  <button type="button" className="btn quiet" onClick={() => setConfirmReject(false)}>Keep</button>
                </>
              )}
            </div>

            {mode === 'save' && (
              <div className="card" style={{ marginTop: 10 }}>
                <div className="list-picker">
                  {lists.map((l) => {
                    const on = l.creatorIds.includes(c.id)
                    return (
                      <div className="row" key={l.id}>
                        <span className="name">{l.name} <span className="faint num">{l.creatorIds.length}</span></span>
                        <button type="button" className={`btn small${on ? ' on' : ''}`} onClick={() => (on ? removeFromList(c.id, l.id) : saveToList(c.id, l.id))}>
                          {on ? 'Saved' : 'Save here'}
                        </button>
                      </div>
                    )
                  })}
                  <form
                    className="new-list"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!newList.trim()) return
                      const l = createList(newList)
                      saveToList(c.id, l.id)
                      setNewList('')
                    }}
                  >
                    <input className="input" placeholder="New list name" value={newList} onChange={(e) => setNewList(e.target.value)} aria-label="New list name" />
                    <button type="submit" className="btn">Create and save</button>
                  </form>
                </div>
              </div>
            )}

            {mode === 'note' && (
              <div className="card" style={{ marginTop: 10 }}>
                <textarea className="textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Private. Survives every refresh of the feed." aria-label="Note" />
                <div className="actions-bar" style={{ marginTop: 8 }}>
                  <button type="button" className="btn primary" onClick={() => { setNote(c.id, noteDraft); setMode('none') }}>Save note</button>
                  <button type="button" className="btn quiet" onClick={() => { setNoteDraft(getNote(c.id)); setMode('none') }}>Cancel</button>
                </div>
              </div>
            )}

            {mode === 'tag' && (
              <div className="card" style={{ marginTop: 10 }}>
                <div className="chips" style={{ marginBottom: 10 }}>
                  {getTagVocabulary().map((t) => {
                    const on = tags.includes(t)
                    return (
                      <button key={t} type="button" className={`chip small${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleTag(c.id, t)}>
                        {t}
                      </button>
                    )
                  })}
                </div>
                <form
                  className="tags-edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addTag(c.id, tagDraft)
                    setTagDraft('')
                  }}
                >
                  <input className="input" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="New tag" aria-label="New tag" />
                  <button type="submit" className="btn small">Add</button>
                </form>
                <p className="hint">Tags filter contacts and saved lists.</p>
              </div>
            )}

            {(note || tags.length > 0) && mode !== 'note' && (
              <div className="stack" style={{ marginTop: 12, gap: 8 }}>
                {note && <p className="muted">{note}</p>}
                {tags.length > 0 && (
                  <div className="chips">
                    {tags.map((t) => (
                      <span key={t} className="chip small">
                        {t}
                        <button type="button" className="x" aria-label={`Remove tag ${t}`} onClick={() => removeTag(c.id, t)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h3>Last 12 posts</h3>
            <div className="posts">
              {posts.map((p) => (
                <figure key={p.id} className="post" style={{ margin: 0 }} title={`${p.kind === 'reel' ? 'Reel' : 'Post'}, ${absolute(p.date)}`}>
                  <img src={p.thumbnail} alt="" loading="lazy" />
                  <figcaption className="stats">
                    <span>{compact(p.views)} views</span>
                    <span>{compact(p.comments)} comments</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
