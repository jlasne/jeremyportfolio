import { useMemo, useState } from 'react'
import type { Criterion, GateSet, HardRules, Knockout, PresetId } from '../types'
import { getCampaign, getGateSet, getGateVersions, getMembers } from '../data'
import { useStore } from '../data/hooks'
import { saveGateSet } from '../data/store'
import { isLocked, LOCK_REASON, template } from '../data/templates'
import {
  bandOf, DIALS, fromPosition, hardness, preset, presetOf, PRESET_LIST, settle, toPosition,
  type Dial,
} from '../data/tuning'
import { absolute, compact } from '../lib/format'

// Zone 4. Three gates, in the order they run, and the client tunes them.
//
// The rule that shapes this screen is bounded personalisation. Every dial has
// limits, some fixed and some tied to another dial, so nobody can set median
// views to 1 or ask for 500k views off a 15k follower floor. The limits are
// written next to the dial rather than enforced silently.
//
// Nothing is written until Save. An edit then writes the next version, never
// over the old one, so a lead delivered last week still has its rules.

interface Draft {
  hard: HardRules
  knockouts: Knockout[]
  criteria: Criterion[]
  passScore: number
}

function draftOf(gates: GateSet): Draft {
  return {
    hard: { ...gates.hard },
    knockouts: gates.knockouts.map((k) => ({ ...k })),
    criteria: gates.criteria.map((c) => ({ ...c })),
    passScore: gates.passScore,
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

/** Gate 1 in one sentence, rewritten on every drag. */
function gateOneLine(hard: HardRules): string {
  const bits = [
    `${compact(hard.followersMin ?? 0)} to ${hard.followersMax && hard.followersMax >= 5_000_000 ? 'any' : compact(hard.followersMax ?? 0)} followers`,
    hard.postsPerMonthMin ? cadence(hard.postsPerMonthMin) : null,
    hard.medianViewsMin ? `${compact(hard.medianViewsMin)} median views` : null,
    hard.lastPostWithinDays ? `posted in the last ${hard.lastPostWithinDays} days` : null,
    hard.medianCommentsMin ? `${hard.medianCommentsMin} median comments` : null,
  ].filter(Boolean)
  return `We keep creators at ${bits.join(', ')}.`
}

function cadence(perMonth: number): string {
  if (perMonth >= 26) return 'posting daily'
  if (perMonth >= 12) return 'posting several times a week'
  if (perMonth >= 4) return 'posting at least weekly'
  return `posting at least ${perMonth} times a month`
}

// ---------------------------------------------------------------------------

export function Gates({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  const versions = getGateVersions(campaignId)
  const members = getMembers()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saved, setSaved] = useState(false)

  const live = gates ? draft ?? draftOf(gates) : null
  const lib = gates ? template(gates.templateId) : null

  const score = useMemo(
    () => (live && lib ? hardness(live.hard, live.passScore, lib) : 0),
    [live, lib],
  )
  if (!gates || !live || !lib || !campaign) return null

  const at: PresetId = presetOf(live.hard, live.passScore, lib)
  const dirty = !same(live, draftOf(gates))
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
    saveGateSet(campaignId, { ...live, preset: at }, 'mem_1')
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
          <span className="faint">{at === 'custom' ? 'Tuned by hand' : `On ${at}`}</span>
          <Hardness score={score} />
        </div>
      </div>

      <div className="card gate-card">
        <h2>Gate 1, hard filters</h2>
        <p className="gate-lede">{gateOneLine(live.hard)}</p>
        <p className="hint">Measured on real posts. A profile that fails here never reaches the model.</p>
        <div className="dials">
          {DIALS.map((dial) => (
            <Slider
              key={dial.key}
              dial={dial}
              hard={live.hard}
              value={(live.hard[dial.key] as number) ?? dial.range(live.hard).min}
              onChange={(v) => setDial(dial.key, v)}
            />
          ))}
        </div>
      </div>

      <div className="card gate-card">
        <h2>Gate 2, knockouts</h2>
        <p className="gate-lede">
          {asking} of {live.knockouts.length} questions on. One no and the profile is out.
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
                    {locked && <span className="lock" title={LOCK_REASON[k.id]}>Always on</span>}
                  </b>
                  {k.pass && <small><b>Pass:</b> {k.pass}</small>}
                  {k.fail && <small><b>Fail:</b> {k.fail}</small>}
                  {locked && <small className="faint">{LOCK_REASON[k.id]}</small>}
                </div>
              </li>
            )
          })}
        </ul>
        {optional.length === 0 && <p className="hint">Every question in this library is required.</p>}
      </div>

      <div className="card gate-card">
        <h2>Gate 3, score</h2>
        <p className="gate-lede">
          Seven things we score, 0 to 2 each. A profile needs {live.passScore} out of {live.criteria.length * 2} to
          reach you.
        </p>
        <div className="dial">
          <div className="dial-head">
            <span>Qualifying score</span>
            <b className="num">{live.passScore} of {live.criteria.length * 2}</b>
          </div>
          <input
            type="range"
            min={5}
            max={live.criteria.length * 2}
            value={live.passScore}
            aria-label="Qualifying score"
            onChange={(e) => set({ passScore: Number(e.target.value) })}
          />
          <div className="dial-foot">
            <span>5</span>
            <span className="dial-limit">Under 5 the score stops deciding anything.</span>
            <span>{live.criteria.length * 2}</span>
          </div>
        </div>
        <ul className="criteria-edit">
          {live.criteria.map((c, i) => (
            <li key={c.id}>
              <input
                className="input"
                value={c.label}
                aria-label={`Criterion ${i + 1}`}
                onChange={(e) =>
                  set({ criteria: live.criteria.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })
                }
              />
              <input
                className="input guide"
                value={c.guide ?? ''}
                placeholder="What a 2 looks like"
                aria-label={`What scores 2 on ${c.label}`}
                onChange={(e) =>
                  set({ criteria: live.criteria.map((x) => (x.id === c.id ? { ...x, guide: e.target.value } : x)) })
                }
              />
            </li>
          ))}
        </ul>
        <p className="hint">Seven criteria, always. Reword them to fit your offer.</p>
      </div>

      <div className="card">
        <h2>History</h2>
        <ul className="history">
          {versions.map((v) => (
            <li key={v.id}>
              <div className="history-head">
                <b>
                  Version {v.version}, {v.origin === 'generated' ? 'proposed from the brief' : 'edited'}
                  {v.id === gates.id ? ', live now' : ''}
                </b>
                <span className="faint">
                  {members.find((m) => m.id === v.by)?.name ?? 'brandmatch'}, {absolute(v.createdAt)}
                </span>
              </div>
              {v.changes.length > 0 && (
                <ul className="history-changes">
                  {v.changes.map((line) => <li key={line}>{line}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="save-bar">
        {saved && (
          <span className="hint">
            Saved as version {gates.version}.
            {campaign.status === 'live' ? ' The simulator has been run again.' : ''}
          </span>
        )}
        {dirty && <span className="hint">Saving writes version {gates.version + 1}. The old one stays.</span>}
        <span className="spacer" />
        {dirty && (
          <button type="button" className="btn" onClick={() => { setDraft(null); setSaved(false) }}>
            Discard
          </button>
        )}
        <button type="button" className="btn primary" disabled={!dirty} onClick={save}>
          Save the gates
        </button>
        <a className="btn" href={`#/campaign/${campaignId}/feasibility`}>Test it</a>
      </div>
    </>
  )
}
