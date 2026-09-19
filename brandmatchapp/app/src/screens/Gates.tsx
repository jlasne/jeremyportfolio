import { useMemo, useState } from 'react'
import type { Criterion, GateSet, HardRules, Knockout, Niche, PresetId } from '../types'
import { getCampaign, getGateSet } from '../data'
import { useStore } from '../data/hooks'
import { Info } from '../components/Info'
import { Sentences } from '../components/Sentences'
import { saveGateSet, setNiches } from '../data/store'
import { slug } from '../data/niches'
import { isLocked, LOCK_REASON, template } from '../data/templates'
import {
  bandOf, DIALS, dialByKey, fromPosition, hardness, perNicheKeys, pointsFor, preset, presetOf, PRESET_LIST, settle, shareOf, toPosition,
  type Dial, type DialKey,
} from '../data/tuning'
import { compact } from '../lib/format'

// Zone 4. Three checks, in the order they run, and the client tunes them.
//
// Nothing on this screen says gate, knockout, threshold or median. The three
// checks are named for what they ask: how big and how active, what would rule
// someone out, and how good a fit they are.
//
// The rule that shapes the screen is bounded personalisation. Every dial has
// limits, some fixed and some tied to another dial, so nobody can ask for one
// view or for 500k views off a 15k follower minimum. The limits are written
// next to the dial rather than enforced silently.
//
// Nothing is written until Save. An edit then writes the next version, never
// over the old one, so a lead delivered last week still has its rules.

interface Draft {
  hard: HardRules
  knockouts: Knockout[]
  criteria: Criterion[]
  passScore: number
  /** The niches ride in the draft too: a dial moving under them moves both. */
  niches: Niche[]
}

function draftOf(gates: GateSet, niches: Niche[]): Draft {
  return {
    hard: { ...gates.hard },
    knockouts: gates.knockouts.map((k) => ({ ...k })),
    criteria: gates.criteria.map((c) => ({ ...c })),
    passScore: gates.passScore,
    niches: niches.map((n) => ({ ...n, hard: n.hard ? { ...n.hard } : undefined })),
  }
}

/**
 * A dial goes under the niches: every niche gets the campaign's number to
 * start from, and the campaign stops carrying it.
 */
function toPerNiche(d: Draft, key: DialKey): Draft {
  const value = d.hard[key]
  if (typeof value !== 'number') return d
  const hard = { ...d.hard }
  delete hard[key]
  return {
    ...d,
    hard,
    niches: d.niches.map((n) => ({ ...n, hard: { ...(n.hard ?? {}), [key]: value } })),
  }
}

/** A dial comes back to the campaign, at the middle of what the niches had. */
function toCampaign(d: Draft, key: DialKey): Draft {
  const values = d.niches.map((n) => n.hard?.[key]).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b)
  const middle = values.length ? values[Math.floor(values.length / 2)] : undefined
  return {
    ...d,
    hard: middle === undefined ? d.hard : settle({ ...d.hard, [key]: middle }),
    niches: d.niches.map((n) => {
      if (!n.hard) return n
      const rest = { ...n.hard }
      delete rest[key]
      return { ...n, hard: Object.keys(rest).length ? rest : undefined }
    }),
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

/** The gauge. Where the campaign sits, with no volume figure anywhere on it. */
function Hardness({ score }: { score: number }) {
  return (
    <div className="gauge" title={`${bandOf(score)}`}>
      <div className="gauge-bar">
        <i style={{ left: `${Math.round(score * 100)}%` }} />
      </div>
      <div className="gauge-marks">
        <span>Broad</span>
        <span>Balanced</span>
        <span>Strict</span>
      </div>
    </div>
  )
}

/** The first check in one sentence, rewritten on every drag. */
function gateOneLine(hard: HardRules, perNiche: DialKey[]): string {
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
  const names = perNiche.map((k) => dialByKey.get(k)!.label.replace(/,.*$/, '').toLowerCase())
  const under = names.length
    ? ` ${(names.join(' and ').charAt(0).toUpperCase() + names.join(' and ').slice(1))} ${names.length === 1 ? 'is' : 'are'} set under each niche.`
    : ''
  return `We keep people with ${bits.join(', ')}.${under}`.replace('with .', 'with the numbers below.')
}

function cadence(perMonth: number): string {
  if (perMonth >= 26) return 'posting daily'
  if (perMonth >= 12) return 'posting several times a week'
  if (perMonth >= 4) return 'posting at least weekly'
  return `posting at least ${perMonth} times a month`
}

// ---------------------------------------------------------------------------
// The niches. Which slices of the target we look in, and what each one's
// numbers are, because what counts as big is not the same in every slice.
// ---------------------------------------------------------------------------

function Niches({ niches, hard, perNiche, onChange }: {
  niches: Niche[]
  hard: HardRules
  perNiche: DialKey[]
  onChange: (next: Niche[]) => void
}) {
  const [adding, setAdding] = useState('')
  const on = niches.filter((n) => n.enabled).length

  const patch = (id: string, change: Partial<Niche>) =>
    onChange(niches.map((n) => (n.id === id ? { ...n, ...change } : n)))

  const add = () => {
    const label = adding.trim()
    if (!label) return
    const id = slug(label)
    if (niches.some((n) => n.id === id)) return
    // A new niche takes the middle of what the others carry for each dial that
    // lives under the niches, so it starts where the campaign already is.
    const own: Partial<HardRules> = {}
    for (const key of perNiche) {
      const values = niches.map((n) => n.hard?.[key]).filter((v): v is number => typeof v === 'number').sort((x, y) => x - y)
      if (values.length) own[key] = values[Math.floor(values.length / 2)]
    }
    onChange([...niches, { id, label, enabled: true, hard: Object.keys(own).length ? own : undefined }])
    setAdding('')
  }

  return (
    <div className="card gate-card">
      <h2>
        2. Niches
        <Info text="The slices of your target we search in. Switching one off stops us looking there. A number set per niche appears here, under each one, and nowhere else." />
      </h2>
      <p className="gate-lede">
        Looking in {on} of {niches.length} niches. Anyone too small for every one of them is dropped before we look closer.
      </p>
      <ul className="switches">
        {niches.map((n) => {
          const own = n.hard ?? {}
          const merged = { ...hard, ...own }
          return (
            <li key={n.id} className={n.enabled ? undefined : 'off'}>
              <button
                type="button"
                className={`gate-switch${n.enabled ? ' on' : ''}`}
                aria-pressed={n.enabled}
                aria-label={n.label}
                onClick={() => patch(n.id, { enabled: !n.enabled })}
              >
                <i aria-hidden="true" />
              </button>
              <div className="switch-body">
                <b>
                  <input
                    className="input niche-name"
                    value={n.label}
                    aria-label={`Name of ${n.label}`}
                    onChange={(e) => patch(n.id, { label: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn small quiet drop"
                    aria-label={`Remove ${n.label}`}
                    onClick={() => onChange(niches.filter((x) => x.id !== n.id))}
                  >
                    ✕
                  </button>
                </b>
                {perNiche.length > 0 && n.enabled && (
                  <div className="niche-dials">
                    {perNiche.map((key) => {
                      const dial = dialByKey.get(key)!
                      const value = (own[key] as number) ?? dial.range(merged).min
                      return (
                        <Slider
                          key={key}
                          dial={dial}
                          hard={merged}
                          value={value}
                          onChange={(v) => {
                            const settled = settle({ ...merged, [key]: v })
                            patch(n.id, { hard: { ...own, [key]: settled[key] as number } })
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="niche-add">
        <input
          className="input"
          placeholder="Add a niche we missed"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button type="button" className="btn" onClick={add} disabled={!adding.trim()}>Add</button>
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

  const live = gates && campaign ? draft ?? draftOf(gates, campaign.extracted.niches) : null
  const lib = gates ? template(gates.templateId) : null

  const score = useMemo(
    () => (live && lib ? hardness(live.hard, live.passScore, lib) : 0),
    [live, lib],
  )
  if (!gates || !live || !lib || !campaign) return null

  const at: PresetId = presetOf(live.hard, live.passScore, lib)
  const dirty = !same(live, draftOf(gates, campaign.extracted.niches))
  const perNiche = perNicheKeys(live.hard, live.niches)
  const optional = live.knockouts.filter((k) => !isLocked(lib.id, k.id))
  const asking = live.knockouts.filter((k) => k.enabled !== false).length

  const set = (patch: Partial<Draft>) => {
    setSaved(false)
    setDraft({ ...live, ...patch })
  }
  const setDial = (key: Dial['key'], value: number) => {
    // Moving one dial moves what the others are allowed to be, so everything
    // is pulled back inside its range on every change and not only on save.
    set({ hard: settle({ ...live.hard, [key]: value }) })
  }
  const usePreset = (id: 'strict' | 'balanced' | 'broad') => {
    const tuned = preset(id, lib, live.hard)
    set({ hard: tuned.hard, passScore: tuned.passScore })
  }
  const save = () => {
    const { niches, ...rules } = live
    if (JSON.stringify(niches) !== JSON.stringify(campaign.extracted.niches)) setNiches(campaignId, niches)
    saveGateSet(campaignId, { ...rules, preset: at }, 'mem_1')
    setDraft(null)
    setSaved(true)
  }

  return (
    <>
      <div className="tune-bar">
        <div className="gate-presets">
          {PRESET_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`gate-preset${at === p.id ? ' on' : ''}`}
              onClick={() => usePreset(p.id)}
            >
              <b>{p.label}</b>
              <small>{p.blurb}</small>
            </button>
          ))}
        </div>
        <div className="tune-side">
          <span className="faint">{at === 'custom' ? 'Your own settings' : `Using ${at}`}</span>
          <Hardness score={score} />
        </div>
      </div>

      <div className="card gate-card">
        <h2>
          1. Size and activity
          <Info text="Every number is counted from their last 12 posts. These are your campaign numbers. Any niche below can use its own instead." />
        </h2>
        <p className="gate-lede">{gateOneLine(live.hard, perNiche)}</p>
        <div className="dials">
          {DIALS.map((dial) =>
            perNiche.includes(dial.key) ? (
              <div key={dial.key} className="dial elsewhere">
                <div className="dial-head">
                  <span>{dial.label}</span>
                  <b>Set under each niche</b>
                </div>
                <button type="button" className="btn small quiet" onClick={() => set(toCampaign(live, dial.key))}>
                  Same for every niche
                </button>
              </div>
            ) : (
              <div key={dial.key} className="dial-wrap">
                <Slider
                  dial={dial}
                  hard={live.hard}
                  value={(live.hard[dial.key] as number) ?? dial.range(live.hard).min}
                  onChange={(v) => setDial(dial.key, v)}
                />
                {live.niches.length > 1 && (
                  <button type="button" className="btn small quiet per-niche" onClick={() => set(toPerNiche(live, dial.key))}>
                    Per niche
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      <Niches niches={live.niches} hard={live.hard} perNiche={perNiche} onChange={(niches) => set({ niches })} />

      <div className="card gate-card">
        <h2>3. Deal breakers</h2>
        <p className="gate-lede">
          {asking} of {live.knockouts.length} questions switched on. One no about a person and we drop them.
        </p>
        <ul className="switches">
          {live.knockouts.map((k) => {
            const locked = isLocked(lib.id, k.id)
            const on = k.enabled !== false
            return (
              <li key={k.id} className={on ? undefined : 'off'}>
                <button
                  type="button"
                  className={`gate-switch${on ? ' on' : ''}${locked ? ' locked' : ''}`}
                  aria-pressed={on}
                  aria-label={k.question}
                  disabled={locked}
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
                        locked ? `Always asked. ${LOCK_REASON[k.id]}` : '',
                      ].filter(Boolean).join(' ')}
                    />
                  </b>
                  {locked && <small className="faint">Always asked</small>}
                </div>
              </li>
            )
          })}
        </ul>
        {optional.length === 0 && <p className="hint">Every question here is required.</p>}
      </div>

      <div className="card gate-card">
        <h2>
          4. Brand fit
          <Info text="Describe the people you want, one sentence a line. For each person we answer every sentence: true, partly true, or false. That is their brand fit. Someone reaches you from the share you set here." />
        </h2>
        <p className="gate-lede">
          {live.criteria.length} {live.criteria.length === 1 ? 'sentence' : 'sentences'} about who you want. Someone reaches you from{' '}
          <b className="num">{shareOf(live.passScore, live.criteria.length)}%</b> brand fit.
        </p>
        <Sentences
          list={live.criteria}
          onChange={(next) => {
            // The share stays where it was when a sentence comes or goes; only
            // the points behind it move.
            const share = shareOf(live.passScore, live.criteria.length) / 100
            const kept = next.filter((c) => c.text.trim() || next.length === 1)
            set({ criteria: kept.length ? kept : next.slice(0, 1), passScore: pointsFor(share, Math.max(1, kept.length || 1)) })
          }}
        />
        <div className="dial">
          <div className="dial-head">
            <span>Qualified from</span>
            <b className="num">{shareOf(live.passScore, live.criteria.length)}% brand fit</b>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={shareOf(live.passScore, live.criteria.length)}
            aria-label="Brand fit needed to qualify"
            onChange={(e) => set({ passScore: pointsFor(Number(e.target.value) / 100, live.criteria.length) })}
          />
          <div className="dial-foot">
            <span>10%</span>
            <span className="dial-limit">Lower means more people, and more sorting for you.</span>
            <span>100%</span>
          </div>
        </div>
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
          <button type="button" className="btn" onClick={() => { setDraft(null); setSaved(false) }}>
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
