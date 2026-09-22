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
import { perNicheKeys, presetOf, settle } from '../data/tuning'

// Zone 4. Three checks, in the order they run, and the client tunes them.
//
// The first one, size and activity, lives on the brief: it describes who the
// client is after. The three here decide. Niches and deal breakers are hard
// filters, and someone who clears them is a qualified lead. Brand fit is then
// a score on that lead, from 0 to 100, and it sorts the list. It never turns
// anyone away, so there is no pass mark on this screen and nothing to guess.
//
// Nothing here says gate, knockout, threshold or median. The checks are named
// for what they ask: which niches, what would rule someone out, and how good
// a fit they are.
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
        <Info
          title="Niches"
          text={[
            'The slices of your target we search in, one search each. Anything you would say yes to belongs here.',
            'This one is a hard filter. Somebody who works in none of them is dropped before anything else is asked, which is what stops another campaign\'s people arriving in your list wearing the wrong job.',
            'Remove one and we stop looking there tonight. Add one and we start the next morning.',
          ]}
        />
      </h2>
      <p className="gate-lede">
        We search these {niches.length} {niches.length === 1 ? 'niche' : 'niches'}, one at a time.
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
  const written = live.criteria.filter((c) => c.text.trim()).length
  // Brand fit no longer decides anything, so the stored pass mark is carried
  // untouched: an old number nobody reads is better than a migration that
  // rewrites versions a delivered lead was judged under.

  const set = (patch: Partial<Draft>) => {
    setSaved(false)
    setDraft({ ...live, ...patch })
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
      { ...rules, criteria: kept, preset: presetOf(rules.hard, rules.passScore, lib) },
      'mem_1',
    )
    setDraft(null)
    setOffered(null)
    setSaved(true)
  }

  return (
    <>
      <Niches niches={live.niches} onChange={(niches) => set({ niches })} />

      <div className="card gate-card">
        <h2>
          3. Who you want
          <Info
            title="Who you want"
            text={[
              'One sentence a line, in your own words. We answer each one about every lead: true, partly true, or false. That is their brand fit, and it orders your list without removing anyone.',
              'Eight sentences or more is where the score starts telling people apart. Under that, one sentence swings it by more than a tenth.',
              'Mark up to three as must have. A marked sentence leaves the score, because a rule you will not argue about is not a matter of degree.',
              'A must have still removes nobody. A lead that plainly misses one arrives marked, and you decide what to do about it. Partly true is not a miss.',
            ]}
          />
        </h2>
        <p className="gate-lede">
          {written} {written === 1 ? 'sentence' : 'sentences'} about who you want, and{' '}
          {live.criteria.filter((c) => c.breaker).length} of them marked must have.
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
        <a className="btn" href={`#/campaign/${campaignId}/feasibility`}>Run a simulation</a>
      </div>
    </>
  )
}
