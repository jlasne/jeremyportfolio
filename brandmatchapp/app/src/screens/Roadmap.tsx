import { useState } from 'react'
import { getAccount } from '../data'
import { useStore } from '../data/hooks'
import {
  addIdea, hasVoted, listIdeas, NOTES, STATE_LABEL, TAGS, toggleVote, type Idea,
} from '../data/ideas'
import { absolute } from '../lib/format'

// What people want, and what we are doing about it.
//
// Two lists behind one page. Ideas are everyone's: anyone writes one, anyone
// votes, and the state on each card says whether it was picked up. Notes are
// ours, and short.
//
// The order is by votes, because a roadmap sorted by date is a roadmap where
// the loudest recent thing wins.

type Sort = 'trending' | 'newest'

function Card({ idea, onVote }: { idea: Idea; onVote: () => void }) {
  const voted = hasVoted(idea.id)
  return (
    <li className="idea">
      <button
        type="button"
        className={`idea-vote${voted ? ' on' : ''}`}
        aria-pressed={voted}
        aria-label={voted ? `Take back your vote for ${idea.title}` : `Vote for ${idea.title}`}
        onClick={onVote}
      >
        <b className="num">{idea.votes}</b>
        <small>{voted ? 'voted' : 'vote'}</small>
      </button>
      <div className="idea-body">
        <h3>{idea.title}</h3>
        <p>{idea.body}</p>
        <div className="idea-foot">
          <span className={`state ${idea.state}`}>{STATE_LABEL[idea.state]}</span>
          <span className="tag-chip">{idea.tag}</span>
          <small className="muted">{idea.by} · {absolute(idea.at)}</small>
        </div>
      </div>
    </li>
  )
}

function NewIdea({ onDone }: { onDone: () => void }) {
  const account = getAccount()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState(TAGS[0])
  return (
    <div className="card">
      <h2>Your idea</h2>
      <input
        className="input"
        placeholder="What should we build?"
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="textarea"
        rows={3}
        placeholder="What are you doing today instead, and what does it cost you?"
        aria-label="Description"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="pill-row">
        {TAGS.map((t) => (
          <button key={t} type="button" className={`chip${tag === t ? ' on' : ''}`} onClick={() => setTag(t)}>{t}</button>
        ))}
      </div>
      <div className="verdict-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!title.trim()}
          onClick={() => { addIdea(title, body, tag, account.name); onDone() }}
        >
          Post it
        </button>
        <button type="button" className="btn quiet" onClick={onDone}>Cancel</button>
      </div>
      <p className="hint">Everyone on brandmatch sees it and can vote for it.</p>
    </div>
  )
}

export function Roadmap() {
  useStore()
  const [tab, setTab] = useState<'ideas' | 'notes'>('ideas')
  const [sort, setSort] = useState<Sort>('trending')
  const [writing, setWriting] = useState(false)
  const [, bump] = useState(0)

  const ideas = [...listIdeas()].sort((a, b) =>
    sort === 'trending' ? b.votes - a.votes : b.at.localeCompare(a.at),
  )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Roadmap</h1>
        <span className="spacer" />
        {tab === 'ideas' && !writing && (
          <button type="button" className="btn primary" onClick={() => setWriting(true)}>Add an idea</button>
        )}
      </div>
      <p className="subhead">Ask for what you need. The most wanted gets built first.</p>

      <div className="filter-row">
        <button type="button" className={`chip${tab === 'ideas' ? ' on' : ''}`} onClick={() => setTab('ideas')}>
          Ideas
        </button>
        <button type="button" className={`chip${tab === 'notes' ? ' on' : ''}`} onClick={() => setTab('notes')}>
          What shipped
        </button>
        {tab === 'ideas' && (
          <>
            <span className="rule" />
            <button type="button" className={`chip${sort === 'trending' ? ' on' : ''}`} onClick={() => setSort('trending')}>
              Most wanted
            </button>
            <button type="button" className={`chip${sort === 'newest' ? ' on' : ''}`} onClick={() => setSort('newest')}>
              Newest
            </button>
          </>
        )}
      </div>

      {tab === 'ideas' ? (
        <>
          {writing && <NewIdea onDone={() => { setWriting(false); bump((n) => n + 1) }} />}
          <ul className="ideas">
            {ideas.map((idea) => (
              <Card key={idea.id} idea={idea} onVote={() => { toggleVote(idea.id); bump((n) => n + 1) }} />
            ))}
          </ul>
        </>
      ) : (
        <ul className="notes">
          {NOTES.map((n) => (
            <li key={n.at} className="card">
              <small className="muted">{absolute(n.at)}</small>
              <h2>{n.title}</h2>
              <p className="gate-lede">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
