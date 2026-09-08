import { useCallback } from 'react'
import { diagnoseEmptyFeed, exportCsv, getFeed, getFilters, getSettings, resetFilter, resetFilters } from '../data'
import { useStore } from '../data/hooks'
import { downloadCsv } from '../lib/csv'
import { nextBatchLabel } from '../lib/format'
import { navigate } from '../lib/router'
import { CreatorDetail } from '../components/CreatorDetail'
import { FilterButton } from '../components/FilterButton'
import { LeadRow } from '../components/LeadRow'

export function Feed({ creatorId }: { creatorId: string | null }) {
  useStore()
  const items = getFeed()
  const newToday = items.filter((i) => i.isNew).length
  const settings = getSettings()
  const open = useCallback((id: string) => navigate(`feed/${encodeURIComponent(id)}`), [])
  const close = useCallback(() => navigate('feed'), [])

  const exportView = () => downloadCsv('brandmatch-feed.csv', exportCsv(items.map((i) => i.creator.id)))

  return (
    <div className="page">
      <div className="page-head">
        <h1>
          {newToday > 0 ? (
            <>
              <span className="num">{newToday}</span> new today
            </>
          ) : (
            'Nothing new today'
          )}
        </h1>
        <span className="count num">{items.length} in view</span>
        <span className="spacer" />
        <FilterButton />
        <a className="btn hide-m" href="#/lists">Saved lists</a>
        <button type="button" className="btn" onClick={exportView} disabled={items.length === 0}>Export</button>
      </div>

      {newToday === 0 && items.length > 0 && (
        <div className="notice" style={{ marginBottom: 10 }}>
          All caught up. This is yesterday's feed. The next batch lands {nextBatchLabel(settings.timezone)}.
        </div>
      )}

      <div className="feed">
        {items.length > 0 && (
          <div className="feed-cols" aria-hidden="true">
            <span />
            <span>Creator</span>
            <span>Stars</span>
            <span>Signal</span>
            <span className="r">Followers</span>
            <span className="r">Engaged</span>
            <span className="r">Reel views</span>
            <span>Country</span>
            <span>Email</span>
          </div>
        )}
        {items.map((item) => (
          <LeadRow key={item.creator.id} item={item} open={creatorId === item.creator.id} onOpen={open} />
        ))}
        {items.length === 0 && <EmptyFeed />}
      </div>

      {creatorId && <CreatorDetail id={creatorId} onClose={close} />}
    </div>
  )
}

function EmptyFeed() {
  const d = diagnoseEmptyFeed()
  const f = getFilters()
  const current = d ? describe(d.key, f) : ''
  return (
    <div className="empty">
      <h2>No creator passes these filters</h2>
      {d ? (
        <p>
          {d.label} is cutting everything. {current} Loosen it and <span className="num">{d.restored}</span> creators come back.
        </p>
      ) : (
        <p>Every filter together cuts all creators. Reset them to see the feed again.</p>
      )}
      <div className="actions">
        {d && <button type="button" className="btn primary" onClick={() => resetFilter(d.key)}>Loosen {d.label.toLowerCase()}</button>}
        <button type="button" className="btn" onClick={() => resetFilters()}>Reset all filters</button>
      </div>
    </div>
  )
}

function describe(key: keyof ReturnType<typeof getFilters>, f: ReturnType<typeof getFilters>): string {
  switch (key) {
    case 'followersMin': return `It is set to ${f.followersMin.toLocaleString('en-US')}.`
    case 'followersMax': return `It is set to ${f.followersMax.toLocaleString('en-US')}.`
    case 'engagementMin': return `It is set to ${(f.engagementMin * 100).toFixed(1)}%.`
    case 'reelViewsMin': return `It is set to ${(f.reelViewsMin ?? 0).toLocaleString('en-US')}.`
    case 'emailInBio': return 'It asks for an email.'
    case 'lastPostWithin': return `It is set to ${f.lastPostWithin} days.`
    case 'postsPerMonthMin': return `It is set to ${f.postsPerMonthMin}.`
    case 'countries': return `It allows ${f.countries.join(', ')}.`
    case 'languages': return `It allows ${f.languages.join(', ')}.`
  }
}
