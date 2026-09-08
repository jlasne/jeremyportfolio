import type { Country, Filters, Language } from '../types'
import { COUNTRY_NAMES, LANGUAGE_NAMES } from '../lib/format'
import { Chips } from './Chips'

const COUNTRIES: Country[] = ['US', 'UK', 'CA', 'AU', 'FR', 'DE']
const LANGUAGES: Language[] = ['en', 'fr', 'de']

function num(v: string): number {
  const n = Number(v.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function FilterForm({ value, onChange }: { value: Filters; onChange: (patch: Partial<Filters>) => void }) {
  const toggle = <K extends 'countries' | 'languages'>(key: K, item: Filters[K][number]) => {
    const list = value[key] as string[]
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    onChange({ [key]: next } as Partial<Filters>)
  }
  return (
    <div className="filters-form">
      <div>
        <span className="field-label">Followers</span>
        <div className="inline-fields">
          <input className="input num" inputMode="numeric" aria-label="Followers minimum" value={value.followersMin} onChange={(e) => onChange({ followersMin: num(e.target.value) })} />
          <span className="faint">to</span>
          <input className="input num" inputMode="numeric" aria-label="Followers maximum" value={value.followersMax} onChange={(e) => onChange({ followersMax: num(e.target.value) })} />
        </div>
      </div>
      <div className="field-row three">
        <label className="field">
          <span>Engagement rate, minimum %</span>
          <input className="input num" inputMode="decimal" value={+(value.engagementMin * 100).toFixed(2)} onChange={(e) => onChange({ engagementMin: num(e.target.value) / 100 })} />
        </label>
        <label className="field">
          <span>Median reel views, minimum</span>
          <input className="input num" inputMode="numeric" placeholder="None" value={value.reelViewsMin ?? ''} onChange={(e) => onChange({ reelViewsMin: e.target.value.trim() === '' ? null : num(e.target.value) })} />
        </label>
        <label className="field">
          <span>Posts per month, minimum</span>
          <input className="input num" inputMode="numeric" value={value.postsPerMonthMin} onChange={(e) => onChange({ postsPerMonthMin: num(e.target.value) })} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Email in bio</span>
          <select className="select" value={value.emailInBio} onChange={(e) => onChange({ emailInBio: e.target.value as Filters['emailInBio'] })}>
            <option value="any">Any</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="field">
          <span>Last post within</span>
          <select className="select" value={value.lastPostWithin} onChange={(e) => onChange({ lastPostWithin: Number(e.target.value) as Filters['lastPostWithin'] })}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </div>
      <div>
        <span className="field-label">Country</span>
        <Chips options={COUNTRIES} value={value.countries} onToggle={(c) => toggle('countries', c)} labels={COUNTRY_NAMES} small />
        <p className="hint">Leave all off to allow every country.</p>
      </div>
      <div>
        <span className="field-label">Language</span>
        <Chips options={LANGUAGES} value={value.languages} onToggle={(l) => toggle('languages', l)} labels={LANGUAGE_NAMES} small />
      </div>
    </div>
  )
}
