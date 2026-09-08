import { useState } from 'react'
import { countTagged, exportCsv, getContacts, getNote, getTagVocabulary, getTags, toggleTag } from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { CreatorDetail } from '../components/CreatorDetail'
import { Stars } from '../components/Stars'

export function Contacts() {
  useStore()
  const all = getContacts()
  const vocabulary = getTagVocabulary()
  const [tag, setTag] = useState<string | null>(null)
  const [minStars, setMinStars] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [tagging, setTagging] = useState<string | null>(null)

  const contacts = all.filter((l) => l.score.stars >= minStars).filter((l) => !tag || getTags(l.creator.id).includes(tag))

  const copy = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(email)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      window.prompt('Copy the email', email)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Contacts</h1>
        <span className="count num">{contacts.length} reachable by email</span>
        <span className="spacer" />
        <div className="chips">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} type="button" className={`chip small${minStars === n ? ' on' : ''}`} aria-pressed={minStars === n} onClick={() => setMinStars(n)}>
              {n === 0 ? 'All' : `${n}+ stars`}
            </button>
          ))}
        </div>
        <button type="button" className="btn" disabled={contacts.length === 0} onClick={() => downloadCsv('brandmatch-contacts.csv', exportCsv(contacts.map((l) => l.creator.id)))}>
          Export
        </button>
      </div>

      <div className="tag-strip">
        <span className="field-label" style={{ margin: 0 }}>Tags</span>
        <div className="chips">
          {vocabulary.map((t) => {
            const n = countTagged(t)
            return (
              <button key={t} type="button" className={`chip small${tag === t ? ' on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t} <span className="num faint">{n}</span>
              </button>
            )
          })}
        </div>
        {tag && <button type="button" className="btn quiet small" onClick={() => setTag(null)}>Clear</button>}
      </div>

      <div className="feed">
        <div className="contact-cols" aria-hidden="true">
          <span />
          <span>Contact</span>
          <span>Email</span>
          <span>Score</span>
          <span>Agent</span>
          <span>Tags</span>
          <span />
        </div>
        {contacts.map((lead) => {
          const c = lead.creator
          const tags = getTags(c.id)
          const note = getNote(c.id)
          return (
            <div className="contact-row" key={c.id}>
              <img className="avatar" src={c.avatar} alt="" width={36} height={36} />
              <div className="who">
                <div className="name">
                  <button type="button" className="link-btn" onClick={() => setOpenId(c.id)}>{c.name}</button>
                  <span className="handle">@{c.handle}</span>
                </div>
                {note && <p className="note">{note}</p>}
              </div>
              <div className="mail">{c.email}</div>
              <Stars score={lead.score} />
              <div className="muted">{lead.agent?.name ?? 'No agent'}</div>
              <div className="tag-cell">
                {tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
                <button type="button" className="btn quiet small" onClick={() => setTagging(tagging === c.id ? null : c.id)} aria-expanded={tagging === c.id}>
                  {tags.length ? 'Edit tags' : 'Add a tag'}
                </button>
                {tagging === c.id && (
                  <div className="chips" style={{ marginTop: 6, flexBasis: '100%' }}>
                    {vocabulary.map((t) => {
                      const on = tags.includes(t)
                      return (
                        <button key={t} type="button" className={`chip small${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleTag(c.id, t)}>
                          {t}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="side">
                <button type="button" className="btn small" onClick={() => copy(c.email!)}>{copied === c.email ? 'Copied' : 'Copy email'}</button>
              </div>
            </div>
          )
        })}
        {contacts.length === 0 && (
          <div className="empty">
            <h2>No contact matches</h2>
            <p>{tag ? `No contact carries the tag ${tag} at ${minStars}+ stars.` : `No contact reaches ${minStars} stars.`} Lower the bar or clear the tag.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => { setTag(null); setMinStars(0) }}>Show every contact</button>
            </div>
          </div>
        )}
      </div>

      {openId && <CreatorDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
