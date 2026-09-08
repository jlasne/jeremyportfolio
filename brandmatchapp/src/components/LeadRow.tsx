import type { FeedItem } from '../data'
import { compact, percent } from '../lib/format'
import { Signal } from './Signal'
import { Stars } from './Stars'

export function LeadRow({ item, open, onOpen }: { item: FeedItem; open: boolean; onOpen: (id: string) => void }) {
  const c = item.creator
  return (
    <button type="button" className={`lead${open ? ' open' : ''}`} onClick={() => onOpen(c.id)} aria-expanded={open}>
      <img className="avatar" src={c.avatar} alt="" width={36} height={36} />
      <div className="who">
        <div className="name">
          <span>{c.name}</span>
          <span className="handle">@{c.handle}</span>
          {item.isNew && <span className="badge-new">NEW</span>}
          {item.isSaved && <span className="badge-saved">Saved</span>}
        </div>
        <p className="bio">{c.bio}</p>
      </div>
      <Stars intent={c.intent.stars} match={c.match.stars} />
      <Signal signal={item.latestSignal} />
      <div className="metrics-inline">
        <div className="metric">
          <b>{compact(c.followers)}</b>
          <small>followers</small>
        </div>
        <div className="metric">
          <b>{percent(c.engagementRate)}</b>
          <small>engaged</small>
        </div>
        <div className="metric">
          <b>{compact(c.medianReelViews)}</b>
          <small>reel views</small>
        </div>
      </div>
      <div className="geo">
        <span>{c.country}</span> <span className="faint">{c.language.toUpperCase()}</span>
      </div>
      <div className={`mail${c.email ? '' : ' none'}`}>{c.email ?? 'No email'}</div>
    </button>
  )
}
