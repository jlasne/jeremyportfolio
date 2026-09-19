import { useMemo, useState } from 'react'
import type { Criterion, GateSet, HardRules, Knockout, Niche } from '../types'
import { getCampaign, getGateSet } from '../data'
import { useStore } from '../data/hooks'
import { Info } from '../components/Info'
import { Sentences } from '../components/Sentences'
import { saveGateSet, setNiches } from '../data/store'
import { slug } from '../data/niches'
import { SENTENCES_ENOUGH, suggest } from '../data/propose'
import { template } from '../data/templates'
import {
  DIALS, fromPosition, perNicheKeys, pointsFor, presetOf, settle, shareOf, toPosition,
  type Dial, type DialKey,
} from '../data/tuning'
import { compact } from '../lib/format'

// Zone 4. Four checks, in the order they run, and the client tunes them.
//
// Nothing on this screen says gate, knockout, threshold or median. The checks
// are named for what they ask: how big and how active, which niches, what
// would rule someone out, and how good a fit they are.
//
// Two rules shape it. Every dial has limits, some fixed and some tied to
// another dial, so nobody can ask for one view or for 500k views off a 15k
// follower minimum; the limits are written next to the dial rather than
// enforced silently. And every number is the campaign's, one number for
// everyone: a threshold that moved per niche could not be stated in a
// sentence, and this screen exists to state it in a sentence.
//
// Nothing is written until Save. An edit then writes the next version, never
// over the old one, so a lead delivered last week still has its rules.

interface Draft {
  hard: HardRules
  knockouts: Knockout[]
  criteria: Criterion[]
  passScore: number
  /** The niches ride in the draft too, so one Save covers the whole screen. */
  niches: Niche[]
}

/**
 * Numbers that a campaign saved under the niches come back to the campaign, at
 * the middle of what they were. Older versions could set them per niche; the
 * screen no longer can, and a rule it cannot show is a rule it must not keep.
 */
function flatten(hard: HardRules, niches: Niche[]): { hard: HardRules; niches: Niche[] } {
  const keys = perNicheKeys(hard, niches)
  let out = { ...hard }
  for (const key of keys) {
    const values = niches
      .map((n) => n.hard?.[key])
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b)
    if (values.length) out = settle({ ...out, [key]: values[Math.floor(values.length / 2)] })
  }
  return { hard: out, niches: niches.map(({ hard: _own, ...rest }) => rest) }
}

function draftOf(gates: GateSet, niches: Niche[]): Draft {
  const flat = flatten({ ...gates.hard }, niches.map((n) => ({ ...n, hard: n.hard ? { ...n.hard } : undefined })))
  return {
    hard: flat.hard,
    knockouts: gates.knockouts.map((k) => ({ ...k })),
    criteria: gates.criteria.map((c) => ({ ...c })),
    passScore: gates.passScore,
    niches: flat.niches,
  }
}

function same(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ---------------------------------------------------------------------------

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

/** The first check in one sentence, rewritten on every drag. */
function gateOneLine(hard: HardRules): string {
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

function cadence(perMonth: number): string {
  if (perMonth >= 26) return 'posting daily'
  if (perMonth >= 12) return 'posting several times a week'
  if (perMonth >= 4) return 'posting at least weekly'
  return `posting at least ${perMonth} times a month`
}

// ---------------------------------------------------------------------------
// The niches. Which slices of the target we look in. A niche on this list is
// searched; a niche off it does not exist. There is no third state, because a
// switched off niche is a row that costs a reader a decision for nothing.
// ---------------------------------------------------------------------------

function Niches({ niches, onChange }: { niches: Niche[]; onChange: (next: Niche[]) => void }) {
  const [adding, setAdding] = useState('')

  const add = () => {
    const label = adding.trim()
    if (!label) return
    const id = slug(label)
    if (niches.some((n) => n.id === id)) return
    onChange([...niches, { id, label, enabled: true }])
    setAdding('')
  }

  return (
    <div className="card gate-card">
      <h2>
        2. Niches
        <Info text="The slices of your target we search in, one search each. Every number above applies to all of them. Remove one and we stop looking there; add one and we start the next morning." />
      </h2>
      <p className="gate-lede">
        We search these {niches.length} {niches.length === 1 ? 'niche' : 'niches'}, one at a time, and someone who
        works in none of them is dropped. Anything you would say yes to belongs here.
      </p>
      <ul className="niche-list">
        {niches.map((n) => (
          <li key={n.id}>
            <input
              className="input niche-name"
              value={n.label}
              aria-label={`Name of ${n.label}`}
              onChange={(e) => onChange(niches.map((x) => (x.id === n.id ? { ...x, label: e.target.value } : x)))}
            />
            <button
              type="button"
              className="btn small quiet drop"
              aria-label={`Stop searching ${n.label}`}
              title="Stop searching this niche"
              onClick={() => onChange(niches.filter((x) => x.id !== n.id))}
            >
              ✕
            </button>
          </li>
        ))}
        {niches.length === 0 && <li><span className="faint">None yet. Add the first one below.</span></li>}
      </ul>
      <div className="file-new">
        <input
          className="input"
          placeholder="Add a niche we missed"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button type="button" className="btn small" onClick={add} disabled={!adding.trim()}>Add</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Gates({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saved, setSaved] = useState(false)
  const [offered, setOffered] = useState<Criterion[] | null>(null)

  const live = gates && campaign ? draft ?? draftOf(gates, campaign.extracted.niches) : null
  const lib = gates ? template(gates.templateId) : null

  const stored = useMemo(
    () => (gates && campaign ? draftOf(gates, campaign.extracted.niches) : null),
    [gates, campaign],
  )
  if (!gates || !live || !lib || !campaign || !stored) return null

  const dirty = !same(live, stored)
  const asking = live.knockouts.filter((k) => k.enabled !== false).length
  const written = live.criteria.filter((c) => c.text.trim()).length
  const share = shareOf(live.passScore, live.criteria.length)

  const set = (patch: Partial<Draft>) => {
    setSaved(false)
    setDraft({ ...live, ...patch })
  }
  const setDial = (key: Dial['key'], value: number) => {
    // Moving one dial moves what the others are allowed to be, so everything
    // is pulled back inside its range on every change and not only on save.
    set({ hard: settle({ ...live.hard, [key]: value }) })
  }
  const save = () => {
    const { niches, ...rules } = live
    // An empty line is a line the client started and left. It is dropped here
    // and never counted in the score.
    const criteria = rules.criteria.filter((c) => c.text.trim())
    const kept = criteria.length ? criteria : rules.criteria.slice(0, 1)
    if (JSON.stringify(niches) !== JSON.stringify(campaign.extracted.niches)) setNiches(campaignId, niches)
    saveGateSet(
      campaignId,
      { ...rules, criteria: kept, passScore: pointsFor(share / 100, kept.length), preset: presetOf(rules.hard, rules.passScore, lib) },
      'mem_1',
    )
    setDraft(null)
    setOffered(null)
    setSaved(true)
  }

  return (
    <>
      <div className="card gate-card">
        <h2>
          1. Size and activity
          <Info text="Every number is counted from their last 12 posts, never from anything an account declares. One number for the whole campaign: every niche below is measured against these." />
        </h2>
        <p className="gate-lede">{gateOneLine(live.hard)}</p>
        <div className="dials">
          {DIALS.map((dial) => (
            <Slider
              key={dial.key}
              dial={dial}
              hard={live.hard}
              value={(live.hard[dial.key as DialKey] as number) ?? dial.range(live.hard).min}
              onChange={(v) => setDial(dial.key, v)}
            />
          ))}
        </div>
      </div>

      <Niches niches={live.niches} onChange={(niches) => set({ niches })} />

      <div className="card gate-card">
        <h2>
          3. Deal breakers
          <Info text="Each one is a yes or no question about a person. One no and they are dropped, whatever else they score. They are the sharpest thing on this screen." />
        </h2>
        <p className="gate-lede">
          {asking} of {live.knockouts.length} switched on. These cut hardest: one no drops someone however well they
          score everywhere else. Switch on what you would genuinely refuse a call with, and leave the rest off.
        </p>
        <ul className="switches">
          {live.knockouts.map((k) => {
            const on = k.enabled !== false
            return (
              <li key={k.id} className={on ? undefined : 'off'}>
                <button
                  type="button"
                  className={`gate-switch${on ? ' on' : ''}`}
                  aria-pressed={on}
                  aria-label={k.question}
                  onClick={() =>
                    set({
                      knockouts: live.knockouts.map((x) => (x.id === k.id ? { ...x, enabled: !on } : x)),
                    })
                  }
                >
                  <i aria-hidden="true" />
                </button>
                <div className="switch-body">
                  <b>
                    {k.question}
                    <Info
                      text={[
                        k.why,
                        k.pass ? `A yes looks like: ${k.pass}` : '',
                        k.fail ? `A no looks like: ${k.fail}` : '',
                      ].filter(Boolean).join(' ')}
                    />
                  </b>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="card gate-card">
        <h2>
          4. Brand fit
          <Info text="Describe the people you want, one sentence a line. For each person we answer every sentence: true, partly true, or false. That is their brand fit." />
        </h2>
        <p className="gate-lede">
          {written} {written === 1 ? 'sentence' : 'sentences'} about who you want. Eight or more is where the score
          starts telling people apart: under that, one sentence swings it by more than a tenth.
        </p>
        <Sentences
          list={live.criteria}
          onChange={(criteria) => set({ criteria })}
        />

        {written < SENTENCES_ENOUGH && (
          <div className="suggest">
            {offered ? (
              <>
                <p className="gate-lede">
                  {offered.length} {offered.length === 1 ? 'sentence' : 'sentences'} from your brief and your library.
                  Every word is yours to change once they are in.
                </p>
                <ul className="facts">
                  {offered.map((c) => <li key={c.id} className="yes">{c.text}</li>)}
                </ul>
                <div className="verdict-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      set({ criteria: [...live.criteria.filter((c) => c.text.trim()), ...offered] })
                      setOffered(null)
                    }}
                  >
                    Use these
                  </button>
                  <button type="button" className="btn quiet" onClick={() => setOffered(null)}>No thanks</button>
                </div>
              </>
            ) : (
              <div className="verdict-actions">
                <span className="hint">
                  You have {written} of {SENTENCES_ENOUGH}. We can write the rest from your brief.
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOffered(suggest(campaign.brief, lib.id, live.criteria))}
                >
                  Write the rest for me
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card qualify-card">
        <h2>
          Qualified from
          <Info text="The one setting that decides who reaches you. Everything above narrows who we look at; this decides who you are handed. Lower means more people and more sorting for you." />
        </h2>
        <div className="qualify-body">
          <b className="qualify-num num">{share}%</b>
          <div className="qualify-dial">
            <input
              type="range"
              min={10}
              max={100}
              value={share}
              aria-label="Brand fit needed to qualify"
              onChange={(e) => set({ passScore: pointsFor(Number(e.target.value) / 100, live.criteria.length) })}
            />
            <div className="dial-foot">
              <span>10%, almost everyone</span>
              <span className="dial-limit">{band(share)}</span>
              <span>100%, every sentence true</span>
            </div>
          </div>
        </div>
        <p className="gate-lede">
          Someone is handed to you when they answer at least {share}% of your sentences. That is{' '}
          <b>{live.passScore} of {live.criteria.length * 2} points</b>, counting two for a true and one for a partly.
        </p>
      </div>

      <div className="save-bar">
        {saved && (
          <span className="hint">
            Saved as version {gates.version}.
            {campaign.status === 'live' ? ' We tested the new rules straight away.' : ''}
          </span>
        )}
        {dirty && (
          <span className="hint">
            Saving keeps a copy of the current rules, so leads you already have still make sense.
          </span>
        )}
        <span className="spacer" />
        {dirty && (
          <button type="button" className="btn" onClick={() => { setDraft(null); setSaved(false); setOffered(null) }}>
            Discard
          </button>
        )}
        <button type="button" className="btn primary" disabled={!dirty} onClick={save}>
          Save my rules
        </button>
        <a className="btn" href={`#/campaign/${campaignId}/feasibility`}>Test them</a>
      </div>
    </>
  )
}

/** What a share means in words, so the number is not read alone. */
function band(share: number): string {
  if (share >= 85) return 'Very few people, and they will be exactly right'
  if (share >= 65) return 'A good fit, and enough of them'
  if (share >= 45) return 'Worth a look, and you will sort some out'
  return 'Almost anyone your rules found'
}
