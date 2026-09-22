import { useMemo, useState } from 'react'
import type { HardRules } from '../types'
import { getCampaign, getGateSet } from '../data'
import { saveGateSet, setExtracted } from '../data/store'
import { cadence, DIALS, eitherLine, fromPosition, settle, toPosition, type Dial, type DialKey } from '../data/tuning'
import { compact, LANGUAGE_NAMES } from '../lib/format'
import { Info } from './Info'

// The first hard filter, and the one that costs nothing to run.
//
// It lives on the brief because it is a description of who the client is
// after, not a setting they tune against a score: how big, how active, what
// they post in. Everything here is measured off the last twelve posts, never
// off anything an account declares.
//
// Pass this, work in a niche that is on, and clear the deal breakers, and you
// are a qualified lead. Brand fit then scores that lead. It never removes one.
//
// Nothing is written until Save, and a save writes the next version rather
// than over the old one, so a lead delivered last week still has its rules.

const TONGUES = Object.keys(LANGUAGE_NAMES)

function Picker({
  label, help, picked, all, name, none, onChange,
}: {
  label: string
  help: string
  picked: string[]
  all: string[]
  name: (code: string) => string
  none: string
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="read-field">
      <span className="drawer-label">{label}<Info text={help} /></span>
      <div className="pill-row">
        {picked.map((code) => (
          <button
            key={code}
            type="button"
            className="chip on"
            title={`Stop looking for ${name(code)}`}
            onClick={() => onChange(picked.filter((c) => c !== code))}
          >
            {name(code)} <span aria-hidden="true">✕</span>
          </button>
        ))}
        {picked.length === 0 && <span className="faint">{none}</span>}
        <button type="button" className="chip" onClick={() => setOpen(!open)}>
          {open ? 'Done' : 'Add one'}
        </button>
      </div>
      {open && (
        <div className="pill-row pick-row">
          {all.filter((c) => !picked.includes(c)).map((code) => (
            <button key={code} type="button" className="chip" onClick={() => onChange([...picked, code])}>
              {name(code)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Slider({
  dial, hard, value, onChange,
}: {
  dial: Dial
  hard: HardRules
  value: number
  onChange: (next: number) => void
}) {
  const { min, max } = dial.range(hard)
  const atFloor = value <= min
  const atCeiling = value >= max
  return (
    <div className="dial">
      <div className="dial-head">
        <span>{dial.label}</span>
        <b className="num">{dial.format(value)}</b>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={toPosition(dial, hard, value)}
        aria-label={dial.label}
        onChange={(e) => onChange(fromPosition(dial, hard, Number(e.target.value)))}
      />
      <div className="dial-foot">
        <span className={atFloor ? 'edge' : undefined}>{dial.format(min)}</span>
        <span className="dial-limit">{atFloor || atCeiling ? dial.limit : ''}</span>
        <span className={atCeiling ? 'edge' : undefined}>{dial.format(max)}</span>
      </div>
    </div>
  )
}

/**
 * A dial with three settings and nothing between them.
 *
 * Comments are the cheapest number on a profile to buy, so an exact figure
 * would be false precision. Off, a light floor, or a real one says everything
 * the filter can honestly carry.
 */
function Steps({
  dial, value, onChange,
}: {
  dial: Dial
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="dial">
      <div className="dial-head">
        <span>{dial.label}</span>
        <b className="num">{dial.format(value)}</b>
      </div>
      <div className="pill-row" role="group" aria-label={dial.label}>
        {(dial.steps ?? []).map((step) => (
          <button
            key={step}
            type="button"
            className={`chip${step === value ? ' on' : ''}`}
            aria-pressed={step === value}
            onClick={() => onChange(step)}
          >
            {dial.format(step)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The first check in one sentence, rewritten on every drag. */
export function gateOneLine(hard: HardRules): string {
  const reach = [
    hard.medianViewsMin ? `${compact(hard.medianViewsMin)} views` : null,
    hard.medianCommentsMin ? `${hard.medianCommentsMin} comments` : null,
  ].filter(Boolean)
  const bits = [
    `${compact(hard.followersMin ?? 0)} to ${hard.followersMax && hard.followersMax >= 5_000_000 ? 'any number of' : compact(hard.followersMax ?? 0)} followers`,
    hard.postsPerMonthMin ? cadence(hard.postsPerMonthMin) : null,
    reach.length ? `around ${reach.join(' and ')} on a typical post` : null,
    hard.lastPostWithinDays ? `active in the last ${hard.lastPostWithinDays} days` : null,
  ].filter(Boolean)
  return `We keep people with ${bits.join(', ')}.`.replace('with .', 'with the numbers below.')
}

export function SizeAndActivity({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  const [draft, setDraft] = useState<HardRules | null>(null)
  const [saved, setSaved] = useState(false)

  const stored = useMemo(() => (gates ? { ...gates.hard } : null), [gates])
  if (!gates || !campaign || !stored) return null

  const hard = draft ?? stored
  const dirty = JSON.stringify(hard) !== JSON.stringify(stored)
  // A number a group decides has no dial. Two controls on one rule would let a
  // client tighten the demand and wonder why the choice below it changed
  // nothing, which is the kind of screen people stop trusting.
  const choices = gates.either ?? []
  const decided = new Set<string>(choices.flatMap((g) => g.options.flatMap((o) => Object.keys(o))))

  const set = (next: HardRules) => { setSaved(false); setDraft(settle(next)) }

  const save = () => {
    saveGateSet(
      campaignId,
      {
        hard,
        either: gates.either,
        knockouts: gates.knockouts,
        criteria: gates.criteria,
        passScore: gates.passScore,
        preset: gates.preset,
      },
      'mem_1',
    )
    setExtracted(campaignId, { countries: hard.countries ?? [], languages: hard.languages ?? [] })
    setDraft(null)
    setSaved(true)
  }

  return (
    <div className="card gate-card">
      <h2>
        1. Size and activity
        <Info
          title="Size and activity"
          text={[
            'The numbers a profile has to meet. Every one of them is counted from their last twelve posts, never from anything an account declares about itself.',
            'This is a hard filter and it runs first. Somebody who misses it is never looked at again, and nothing is paid for them, which is what makes the rest affordable.',
            'A line marked with or is a choice: meeting one way through it is enough. Reach and rhythm are written that way, because a creator who posts twice a month to three million views a month is not dormant and a posting count on its own says they are.',
          ]}
        />
      </h2>
      <p className="gate-lede">{gateOneLine(hard)}</p>

      <Picker
        label="Language"
        help="The language of their captions, read from their last 12 posts. A creator who posts in a language you do not sell in is dropped before anything else is asked."
        picked={hard.languages ?? []}
        all={TONGUES}
        name={(c) => LANGUAGE_NAMES[c] ?? c}
        none="Any language"
        onChange={(languages) => set({ ...hard, languages })}
      />

      {choices.length > 0 && (
        <div className="choices">
          {choices.map((group) => (
            <div className="choice" key={group.label ?? group.options.map((o) => Object.keys(o).join()).join('|')}>
              <span className="choice-label">{group.label}</span>
              <span className="choice-ways">{eitherLine(group)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="dials">
        {DIALS.filter((dial) => !decided.has(dial.key)).map((dial) => {
          const value = (hard[dial.key as DialKey] as number) ?? dial.range(hard).min
          const onChange = (v: number) => set({ ...hard, [dial.key]: v })
          return dial.steps
            ? <Steps key={dial.key} dial={dial} value={value} onChange={onChange} />
            : <Slider key={dial.key} dial={dial} hard={hard} value={value} onChange={onChange} />
        })}
      </div>

      <div className="card-foot">
        {saved && <span className="hint">Saved as version {gates.version}.</span>}
        {dirty && <span className="hint">Saving keeps a copy of the current rules.</span>}
        <span className="spacer" />
        {dirty && (
          <button type="button" className="btn small" onClick={() => { setDraft(null); setSaved(false) }}>
            Discard
          </button>
        )}
        <button type="button" className="btn small primary" disabled={!dirty} onClick={save}>
          Save
        </button>
      </div>
    </div>
  )
}
