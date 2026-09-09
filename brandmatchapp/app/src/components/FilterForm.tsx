import type { Country, Filters, Language } from '../types'
import { COUNTRY_NAMES, LANGUAGE_NAMES, compact } from '../lib/format'

const COUNTRIES: Country[] = ['US', 'UK', 'CA', 'AU', 'FR', 'DE']
const LANGUAGES: Language[] = ['en', 'fr', 'de']

const SIZES: { label: string; min: number; max: number }[] = [
  { label: '10k to 100k', min: 10_000, max: 100_000 },
  { label: '100k to 500k', min: 100_000, max: 500_000 },
  { label: '500k and up', min: 500_000, max: 100_000_000 },
  { label: '10k to 1M', min: 10_000, max: 1_000_000 },
  { label: 'Any size', min: 0, max: 100_000_000 },
]
const ENGAGEMENT = [
  { label: 'Any', value: 0 },
  { label: '1% and up', value: 0.01 },
  { label: '3% and up', value: 0.03 },
  { label: '5% and up', value: 0.05 },
]
const CADENCE = [
  { label: 'Any', value: 0 },
  { label: '3 a month and up', value: 3 },
  { label: '8 a month and up', value: 8 },
  { label: '15 a month and up', value: 15 },
]
const RECENCY: { label: string; value: Filters['lastPostWithin'] }[] = [
  { label: 'This week', value: 7 },
  { label: 'This month', value: 30 },
  { label: 'Last 3 months', value: 90 },
]
const VIEWS = [
  { label: 'Any', value: null },
  { label: '10k and up', value: 10_000 },
  { label: '50k and up', value: 50_000 },
  { label: '100k and up', value: 100_000 },
]

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="filter-line">
      <span className="filter-label">{label}</span>
      <div className="chips">{children}</div>
    </div>
  )
}

/** Plain choices instead of number boxes. Every option says what it keeps. */
export function FilterForm({ value, onChange }: { value: Filters; onChange: (patch: Partial<Filters>) => void }) {
  const toggle = <K extends 'countries' | 'languages'>(key: K, item: Filters[K][number]) => {
    const list = value[key] as string[]
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    onChange({ [key]: next } as Partial<Filters>)
  }
  const sizeOn = (s: (typeof SIZES)[number]) => value.followersMin === s.min && value.followersMax === s.max

  return (
    <div className="filters-form">
      <Line label="Audience size">
        {SIZES.map((s) => (
          <button key={s.label} type="button" className={`chip${sizeOn(s) ? ' on' : ''}`} aria-pressed={sizeOn(s)} onClick={() => onChange({ followersMin: s.min, followersMax: s.max })}>
            {s.label}
          </button>
        ))}
        {!SIZES.some(sizeOn) && (
          <span className="chip on">{compact(value.followersMin)} to {compact(value.followersMax)}</span>
        )}
      </Line>

      <Line label="Engagement">
        {ENGAGEMENT.map((e) => (
          <button key={e.label} type="button" className={`chip${value.engagementMin === e.value ? ' on' : ''}`} aria-pressed={value.engagementMin === e.value} onClick={() => onChange({ engagementMin: e.value })}>
            {e.label}
          </button>
        ))}
      </Line>

      <Line label="Reel views">
        {VIEWS.map((v) => (
          <button key={v.label} type="button" className={`chip${value.reelViewsMin === v.value ? ' on' : ''}`} aria-pressed={value.reelViewsMin === v.value} onClick={() => onChange({ reelViewsMin: v.value })}>
            {v.label}
          </button>
        ))}
      </Line>

      <Line label="Posts a month">
        {CADENCE.map((c) => (
          <button key={c.label} type="button" className={`chip${value.postsPerMonthMin === c.value ? ' on' : ''}`} aria-pressed={value.postsPerMonthMin === c.value} onClick={() => onChange({ postsPerMonthMin: c.value })}>
            {c.label}
          </button>
        ))}
      </Line>

      <Line label="Posted">
        {RECENCY.map((r) => (
          <button key={r.label} type="button" className={`chip${value.lastPostWithin === r.value ? ' on' : ''}`} aria-pressed={value.lastPostWithin === r.value} onClick={() => onChange({ lastPostWithin: r.value })}>
            {r.label}
          </button>
        ))}
      </Line>

      <Line label="Email">
        <button type="button" className={`chip${value.emailInBio === 'any' ? ' on' : ''}`} aria-pressed={value.emailInBio === 'any'} onClick={() => onChange({ emailInBio: 'any' })}>
          Any
        </button>
        <button type="button" className={`chip${value.emailInBio === 'yes' ? ' on' : ''}`} aria-pressed={value.emailInBio === 'yes'} onClick={() => onChange({ emailInBio: 'yes' })}>
          In the bio
        </button>
      </Line>

      <Line label="Country">
        {COUNTRIES.map((c) => (
          <button key={c} type="button" className={`chip${value.countries.includes(c) ? ' on' : ''}`} aria-pressed={value.countries.includes(c)} onClick={() => toggle('countries', c)}>
            {COUNTRY_NAMES[c]}
          </button>
        ))}
        {value.countries.length === 0 && <span className="filter-note">Every country</span>}
      </Line>

      <Line label="Language">
        {LANGUAGES.map((l) => (
          <button key={l} type="button" className={`chip${value.languages.includes(l) ? ' on' : ''}`} aria-pressed={value.languages.includes(l)} onClick={() => toggle('languages', l)}>
            {LANGUAGE_NAMES[l]}
          </button>
        ))}
        {value.languages.length === 0 && <span className="filter-note">Every language</span>}
      </Line>
    </div>
  )
}
