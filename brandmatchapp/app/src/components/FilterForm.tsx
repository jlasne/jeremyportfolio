import { useState } from 'react'
import type { Country, Filters, Language } from '../types'
import { COUNTRY_NAMES, LANGUAGE_NAMES, compact } from '../lib/format'

const COUNTRIES: Country[] = ['US', 'UK', 'CA', 'AU', 'IE', 'NZ', 'FR', 'DE', 'ES', 'IT', 'NL', 'SE', 'PL', 'BR', 'MX', 'IN', 'JP', 'ZA']
const LANGUAGES: Language[] = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'pl', 'ja']

/** The open end of the follower scale. Reaching it means no ceiling. */
const ANY_FOLLOWERS = 100_000_000

/** Stops on the follower bar, so a drag lands on a round number. */
const FOLLOWER_STOPS = [0, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, ANY_FOLLOWERS]
const ENGAGEMENT_STOPS = [0, 0.005, 0.01, 0.02, 0.03, 0.05, 0.08]
const RECENCY_STOPS: Filters['lastPostWithin'][] = [7, 30, 90]
const RECENCY_LABELS = ['This week', 'This month', 'Last 3 months']

/** The stop at or just under a value, so any saved number lands on the bar. */
function stopIndex(stops: number[], value: number): number {
  let at = 0
  stops.forEach((s, i) => { if (value >= s) at = i })
  return at
}

const followerLabel = (v: number) => (v >= ANY_FOLLOWERS ? 'any' : v === 0 ? '0' : compact(v))
const engagementLabel = (v: number) => (v === 0 ? 'Any' : `${(v * 100).toFixed(v < 0.01 ? 1 : 0)}% and up`)

/** One click bundles. Each one says what it keeps. */
const PRESETS: { label: string; note: string; patch: Partial<Filters> }[] = [
  {
    label: 'Micro and engaged',
    note: '10k to 100k followers, 3% engagement and up',
    patch: { followersMin: 10_000, followersMax: 100_000, engagementMin: 0.03, reelViewsMin: null },
  },
  {
    label: 'Mid tier reach',
    note: '100k to 500k followers, 1% engagement and up',
    patch: { followersMin: 100_000, followersMax: 500_000, engagementMin: 0.01, reelViewsMin: 10_000 },
  },
  {
    label: 'Big reach',
    note: '500k and up, 50k median reel views',
    patch: { followersMin: 500_000, followersMax: ANY_FOLLOWERS, engagementMin: 0, reelViewsMin: 50_000 },
  },
  {
    label: 'Ready to contact',
    note: 'Email in the bio, posted this month, 3 posts a month and up',
    patch: { emailInBio: 'yes', lastPostWithin: 30, postsPerMonthMin: 3 },
  },
  {
    label: 'Posting daily',
    note: '15 posts a month and up, posted this week',
    patch: { postsPerMonthMin: 15, lastPostWithin: 7 },
  },
  {
    label: 'English speaking',
    note: 'United States, United Kingdom, Canada, Australia, Ireland, New Zealand',
    patch: { countries: ['US', 'UK', 'CA', 'AU', 'IE', 'NZ'], languages: ['en'] },
  },
]

const CADENCE = [
  { label: 'Any', value: 0 },
  { label: '3 a month and up', value: 3 },
  { label: '8 a month and up', value: 8 },
  { label: '15 a month and up', value: 15 },
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

/** How far along its track a bar sits, so the filled part can be drawn. */
function fill(value: number, min: number, max: number): React.CSSProperties {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  return { ['--fill' as string]: `${pct}%` }
}

/** One slide bar: a name, its reading, the track, and its two ends. */
function Bar({
  label, reading, min, max, value, onChange, ends, ariaLabel,
}: {
  label: string
  reading: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  ends: [string, string]
  ariaLabel: string
}) {
  return (
    <div className="filter-bar-line">
      <div className="bar-head">
        <span className="filter-label">{label}</span>
        <b className="bar-reading">{reading}</b>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        style={fill(value, min, max)}
        aria-label={ariaLabel}
        aria-valuetext={reading}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="bar-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>
    </div>
  )
}

/** Three slide bars carry the volume. Everything else stays a plain choice. */
export function FilterForm({ value, onChange }: { value: Filters; onChange: (patch: Partial<Filters>) => void }) {
  const [more, setMore] = useState(false)
  const toggle = <K extends 'countries' | 'languages'>(key: K, item: Filters[K][number]) => {
    const list = value[key] as string[]
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    onChange({ [key]: next } as Partial<Filters>)
  }
  const advanced =
    value.reelViewsMin !== null || value.postsPerMonthMin !== 3 || value.countries.length > 0 || value.languages.length > 0

  const matches = (patch: Partial<Filters>) =>
    (Object.keys(patch) as (keyof Filters)[]).every((k) => JSON.stringify(value[k]) === JSON.stringify(patch[k]))

  const lowAt = stopIndex(FOLLOWER_STOPS, value.followersMin)
  const highAt = stopIndex(FOLLOWER_STOPS, Math.min(value.followersMax, ANY_FOLLOWERS))
  const sizeReading =
    value.followersMin === 0 && value.followersMax >= ANY_FOLLOWERS
      ? 'Any size'
      : `${followerLabel(value.followersMin)} to ${followerLabel(value.followersMax)}`

  return (
    <div className="filters-form">
      <div className="presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`preset${matches(preset.patch) ? ' on' : ''}`}
            aria-pressed={matches(preset.patch)}
            onClick={() => onChange(preset.patch)}
          >
            <b>{preset.label}</b>
            <span>{preset.note}</span>
          </button>
        ))}
      </div>

      <div className="filter-bar-line">
        <div className="bar-head">
          <span className="filter-label">Audience size</span>
          <b className="bar-reading">{sizeReading}</b>
        </div>
        <div className="range-pair">
          <label className="range-leg">
            <span>From</span>
            <input
              className="slider"
              type="range"
              min={0}
              max={FOLLOWER_STOPS.length - 2}
              step={1}
              value={Math.max(0, Math.min(lowAt, highAt - 1))}
              style={fill(Math.max(0, Math.min(lowAt, highAt - 1)), 0, FOLLOWER_STOPS.length - 2)}
              aria-label="Smallest audience"
              aria-valuetext={followerLabel(value.followersMin)}
              onChange={(e) => {
                const i = Math.min(Number(e.target.value), highAt - 1)
                onChange({ followersMin: FOLLOWER_STOPS[Math.max(0, i)] })
              }}
            />
            <b className="num">{followerLabel(value.followersMin)}</b>
          </label>
          <label className="range-leg">
            <span>To</span>
            <input
              className="slider"
              type="range"
              min={1}
              max={FOLLOWER_STOPS.length - 1}
              step={1}
              value={Math.max(highAt, lowAt + 1)}
              style={fill(Math.max(highAt, lowAt + 1) - 1, 0, FOLLOWER_STOPS.length - 2)}
              aria-label="Largest audience"
              aria-valuetext={followerLabel(value.followersMax)}
              onChange={(e) => {
                const i = Math.max(Number(e.target.value), lowAt + 1)
                onChange({ followersMax: FOLLOWER_STOPS[Math.min(FOLLOWER_STOPS.length - 1, i)] })
              }}
            />
            <b className="num">{followerLabel(value.followersMax)}</b>
          </label>
        </div>
      </div>

      <Bar
        label="Engagement"
        reading={engagementLabel(value.engagementMin)}
        ariaLabel="Least engagement"
        min={0}
        max={ENGAGEMENT_STOPS.length - 1}
        value={stopIndex(ENGAGEMENT_STOPS, value.engagementMin)}
        onChange={(i) => onChange({ engagementMin: ENGAGEMENT_STOPS[i] })}
        ends={['Any', '8%']}
      />

      <Bar
        label="Posted"
        reading={RECENCY_LABELS[Math.max(0, RECENCY_STOPS.indexOf(value.lastPostWithin))]}
        ariaLabel="Posted within"
        min={0}
        max={RECENCY_STOPS.length - 1}
        value={Math.max(0, RECENCY_STOPS.indexOf(value.lastPostWithin))}
        onChange={(i) => onChange({ lastPostWithin: RECENCY_STOPS[i] })}
        ends={['This week', '3 months']}
      />

      <Line label="Email">
        <button type="button" className={`chip${value.emailInBio === 'any' ? ' on' : ''}`} aria-pressed={value.emailInBio === 'any'} onClick={() => onChange({ emailInBio: 'any' })}>
          Any
        </button>
        <button type="button" className={`chip${value.emailInBio === 'yes' ? ' on' : ''}`} aria-pressed={value.emailInBio === 'yes'} onClick={() => onChange({ emailInBio: 'yes' })}>
          In the bio
        </button>
      </Line>

      {(more || advanced) && (
      <>
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
      </>
      )}

      {!more && !advanced && (
        <button type="button" className="btn quiet small more-filters" onClick={() => setMore(true)}>
          Reel views, posting, country and language
        </button>
      )}
    </div>
  )
}
