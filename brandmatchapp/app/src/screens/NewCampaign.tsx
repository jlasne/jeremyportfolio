import { useEffect, useMemo, useRef, useState } from 'react'
import type { CampaignBrief, TemplateId } from '../types'
import {
  clarifications,
  draftOnServer,
  propose,
  switchTemplate,
  LIBRARIES,
  type Answers,
  type Clarification,
  type Proposal,
} from '../data/propose'
import { ruleLabel } from '../data/gates'
import { eitherLine } from '../data/tuning'
import { checkSeeds, cleanHandles, recommendedSeeds, seedMismatch, SEEDS_ENOUGH } from '../data/seeds'
import { createCampaign } from '../data/store'
import { compact, COUNTRY_NAMES, LANGUAGE_NAMES } from '../lib/format'
import { navigate } from '../lib/router'
import { Sentences } from '../components/Sentences'

// Campaign creation, in two questions.
//
// The rule that shapes the whole screen: the client never starts from a blank
// page. They answer two questions in their own words and then correct a
// proposal. Nobody builds filters from scratch here, and nobody sees a form.

type Phase = 'brief' | 'asking' | 'building' | 'proposal'

const AUDIENCE_EXAMPLES = [
  'women lifting coaches who sell a program',
  'US skincare creators between 50k and 500k followers',
  'finance educators running a paid community',
  'home cooks in the UK posting weekly',
]

const SEED_EXAMPLES = [
  'paste a few handles you would love to work with',
  '@mara.strength @tobias.lift @lena.method',
  'anyone you already have in mind',
]

const OFFER_EXAMPLES = [
  'we build revenue-share mobile apps with creators',
  'we sell a SaaS for fitness coaches',
  'we sponsor creators to promote our supplement',
  'we run paid ads for course sellers',
]

/** Cycles the placeholder, so the examples teach without taking up the page. */
function useRotating(list: string[], on: boolean): string {
  const [at, setAt] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = window.setInterval(() => setAt((n) => (n + 1) % list.length), 3200)
    return () => window.clearInterval(t)
  }, [list.length, on])
  return list[at]
}

// ---------------------------------------------------------------------------
// Step one, the brief
// ---------------------------------------------------------------------------

function BriefStep({ onDone }: { onDone: (brief: CampaignBrief) => void }) {
  const [audience, setAudience] = useState('')
  const [offer, setOffer] = useState('')
  const [seeds, setSeeds] = useState('')
  const offerRef = useRef<HTMLTextAreaElement>(null)
  // The second question appears once the first has an answer. One thing at a
  // time, without a page turn, so the first stays readable while writing it.
  const second = audience.trim().length > 3
  const ready = second && offer.trim().length > 3

  const third = ready
  const named = cleanHandles(seeds)
  // Measured accounts, so the proposal can say what it found about each one
  // rather than promise to look. Computed once the brief stops changing.
  const suggestions = useMemo(
    () => (third ? recommendedSeeds(audience, offer) : []),
    [third, audience, offer],
  )
  const audiencePlaceholder = useRotating(AUDIENCE_EXAMPLES, audience.length === 0)
  const offerPlaceholder = useRotating(OFFER_EXAMPLES, offer.length === 0)
  const seedPlaceholder = useRotating(SEED_EXAMPLES, seeds.length === 0)

  return (
    <form
      className="ask"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) {
          onDone({
            audience: audience.trim(),
            offer: offer.trim(),
            seeds: cleanHandles(seeds),
            writtenAt: new Date().toISOString(),
          })
        }
      }}
    >
      <label className="ask-block">
        <h1>Who do you want to reach?</h1>
        <textarea
          className="textarea ask-field"
          rows={3}
          autoFocus
          value={audience}
          placeholder={audiencePlaceholder}
          onChange={(e) => setAudience(e.target.value)}
        />
      </label>

      <label className={`ask-block${second ? ' in' : ' out'}`} aria-hidden={!second}>
        <h1>What do you sell them?</h1>
        <textarea
          className="textarea ask-field"
          rows={3}
          ref={offerRef}
          value={offer}
          placeholder={offerPlaceholder}
          tabIndex={second ? 0 : -1}
          onChange={(e) => setOffer(e.target.value)}
        />
      </label>

      <label className={`ask-block${third ? ' in' : ' out'}`} aria-hidden={!third}>
        <h1>Know anyone already?</h1>
        <p className="ask-note">
          Optional, and the most useful thing you can give us. The people around a good account look like that
          account, so five names is the fastest way to a good first day. You have <b>{named.length} of
          {' '}{SEEDS_ENOUGH}</b>.
        </p>
        <textarea
          className="textarea ask-field short"
          rows={2}
          value={seeds}
          placeholder={seedPlaceholder}
          tabIndex={third ? 0 : -1}
          onChange={(e) => setSeeds(e.target.value)}
        />
        {third && suggestions.length > 0 && (
          <div className="seed-picks">
            <span className="faint">Accounts we already hold that look like your brief:</span>
            <div className="pill-row">
              {suggestions.map((v) => (
                <button
                  key={v.handle}
                  type="button"
                  className={`chip${named.includes(v.handle) ? ' on' : ''}`}
                  title={v.note}
                  onClick={() =>
                    setSeeds(
                      named.includes(v.handle)
                        ? named.filter((h) => h !== v.handle).map((h) => `@${h}`).join(' ')
                        : [...named, v.handle].map((h) => `@${h}`).join(' '),
                    )
                  }
                >
                  @{v.handle}
                </button>
              ))}
            </div>
          </div>
        )}
      </label>

      <div className={`ask-foot${second ? ' in' : ' out'}`}>
        <button type="submit" className="btn primary" disabled={!ready}>
          Write my rules
        </button>
        <span className="hint">You can change every rule after.</span>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Step one and a half, at most two questions
// ---------------------------------------------------------------------------

function AskStep({
  question,
  left,
  onAnswer,
}: {
  question: Clarification
  left: number
  onAnswer: (value: string | null) => void
}) {
  return (
    <div className="ask">
      <div className="ask-block in">
        <h1>{question.question}</h1>
        <div className="ask-options">
          {question.options.map((o) => (
            <button key={o.label} type="button" className="chip big" onClick={() => onAnswer(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="ask-foot in">
          <button type="button" className="btn quiet" onClick={() => onAnswer(null)}>
            Skip, use your best guess
          </button>
          {left > 0 && <span className="hint">One more after this.</span>}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step two, the wait that teaches the three gates
// ---------------------------------------------------------------------------

const STEPS = [
  'Reading your brief',
  'Setting the size and activity',
  'Picking the niches to search',
  'Writing your deal breakers',
  'Writing the brand fit sentences',
]

function BuildingStep({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [at, setAt] = useState(0)
  // The list walks itself, and holds on the last step until the rules are
  // actually back. A wait that ends before the work does is a wait that
  // shows an empty screen.
  useEffect(() => {
    if (at >= STEPS.length) {
      if (!ready) return
      const t = window.setTimeout(onDone, 350)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setAt((n) => n + 1), at === 0 ? 500 : 620)
    return () => window.clearTimeout(t)
  }, [at, ready, onDone])

  return (
    <div className="building" role="status" aria-live="polite">
      <ol>
        {STEPS.map((step, i) => (
          <li key={step} className={i < at ? 'done' : i === at ? 'now' : undefined}>
            <i aria-hidden="true" />
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step three, the proposal
// ---------------------------------------------------------------------------

const HARD_ORDER = [
  'followersMin', 'followersMax', 'medianViewsMin', 'medianCommentsMin', 'postsPerMonthMin', 'lastPostWithinDays',
] as const

function hardValue(key: (typeof HARD_ORDER)[number], hard: Proposal['hard']): string {
  const raw = hard[key]
  if (typeof raw !== 'number') return 'not applied'
  if (key === 'lastPostWithinDays') return `${raw} days`
  return compact(raw)
}

function ProposalStep({
  brief,
  proposal,
  draftId,
  onProposal,
  onRestart,
}: {
  brief: CampaignBrief
  proposal: Proposal
  /** The draft the model wrote on the server, when this browser is live. */
  draftId: string | null
  onProposal: (p: Proposal) => void
  onRestart: () => void
}) {
  const [name, setName] = useState(proposal.name)
  const [showBrief, setShowBrief] = useState(false)
  const [switching, setSwitching] = useState(false)
  const library = LIBRARIES.find((l) => l.id === proposal.templateId)!
  // A number a group decides is shown as the choice it is, once, and not also
  // as a demand with no value behind it.
  const decided = new Set<string>((proposal.either ?? []).flatMap((g) => g.options.flatMap((o) => Object.keys(o))))
  // The seeds go through the rules the client is about to accept, so the
  // verdict is about these rules and not about some general idea of quality.
  const verdicts = checkSeeds(brief.seeds ?? [], asGateSet(proposal), proposal.niches)
  const fits = verdicts.filter((v) => v.state !== 'fails').length
  const mismatch = seedMismatch(verdicts, proposal.hard)

  // Finishing lands on the campaign list. Nothing is simulated on the way
  // out: a run costs us real work and the client did not ask for one yet.
  //
  // The campaign is written on the server before the screen moves, because
  // the id it comes back with is what every later call addresses. Moving
  // first would navigate to a campaign the server has never heard of.
  const [making, setMaking] = useState(false)
  const [failed, setFailed] = useState('')
  const create = async (andEdit: boolean) => {
    setMaking(true)
    setFailed('')
    try {
      const id = await createCampaign(brief, proposal, name.trim() || proposal.name, draftId ?? undefined)
      navigate(andEdit ? `campaign/${id}/brief` : 'campaigns')
    } catch (err) {
      setMaking(false)
      setFailed(err instanceof Error ? err.message : 'That did not reach the server')
    }
  }

  return (
    <>
      <div className="page-head">
        <input
          className="input name-field"
          value={name}
          aria-label="Campaign name"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn quiet" onClick={onRestart}>Start over</button>
      </div>

      <button type="button" className="notice brief-peek" onClick={() => setShowBrief(!showBrief)}>
        <span>{showBrief ? 'Hide your brief' : 'Your brief'}</span>
        <span className="faint">{showBrief ? '' : brief.audience.slice(0, 70) + '...'}</span>
      </button>
      {showBrief && (
        <div className="card">
          <h2>Who you want to reach</h2>
          <p>{brief.audience}</p>
          <h2>What you sell them</h2>
          <p>{brief.offer}</p>
        </div>
      )}

      <div className="card gate-card">
        <h2>1. Size and activity</h2>
        <p className="gate-lede">{proposal.summaries.gate1}</p>
        <ul className="rules">
          {HARD_ORDER.filter((key) => !decided.has(key)).map((key) => (
            <li key={key}>
              <span>{ruleLabel(key)}</span>
              <b className="num">{hardValue(key, proposal.hard)}</b>
            </li>
          ))}
          {/* A choice, not a demand. One way through it is enough, so it reads
              as a line rather than a number the client could raise. */}
          {(proposal.either ?? []).map((group) => (
            <li className="rule-choice" key={group.label}>
              <span>{group.label}, either</span>
              <b>{eitherLine(group)}</b>
            </li>
          ))}
          <li>
            <span>{ruleLabel('countries')}</span>
            <b>{proposal.countries.map((c) => COUNTRY_NAMES[c] ?? c).join(', ') || 'Anywhere'}</b>
          </li>
          <li>
            <span>{ruleLabel('languages')}</span>
            <b>{proposal.languages.map((l) => LANGUAGE_NAMES[l] ?? l).join(', ') || 'Any language'}</b>
          </li>
        </ul>
      </div>

      <div className="card gate-card">
        <h2>2. Niches</h2>
        <p className="gate-lede">
          The slices we search, one search each. Someone who works in none of them is dropped.
        </p>
        <div className="pill-row">
          {proposal.niches.map((n) => <span key={n.id} className="tag-chip">{n.label}</span>)}
          {proposal.niches.length === 0 && <span className="faint">None read out of your brief yet</span>}
        </div>
      </div>

      <div className="card gate-card">
        <h2>3. Deal breakers</h2>
        <p className="gate-lede">{proposal.summaries.gate2}</p>
        <ul className="rules stacked">
          {proposal.knockouts.map((k) => (
            <li key={k.id} className="off">
              <b>
                {k.question}
                <span className="seed-tag unknown">off</span>
              </b>
              {k.why && <small className="muted">{k.why}</small>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card gate-card">
        <h2>4. Brand fit</h2>
        <p className="gate-lede">{proposal.summaries.gate3}</p>
        <Sentences list={proposal.criteria} onChange={(criteria) => onProposal({ ...proposal, criteria })} />
        <div className="from-lib">
          <span className="faint">Starting point: <b>{library.name}</b></span>
          <button type="button" className="btn small quiet" onClick={() => setSwitching(!switching)}>
            {switching ? 'Keep this one' : 'Wrong one?'}
          </button>
        </div>
        {switching && (
          <ul className="lib-switch">
            {LIBRARIES.map((lib) => (
              <li key={lib.id}>
                <button
                  type="button"
                  className={lib.id === proposal.templateId ? 'on' : undefined}
                  onClick={() => {
                    onProposal(switchTemplate(proposal, lib.id as TemplateId))
                    setSwitching(false)
                  }}
                >
                  <b>{lib.name}</b>
                  <small>{lib.when}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {brief.seeds && brief.seeds.length > 0 && (
        <div className="card gate-card">
          <h2>The accounts you gave us</h2>
          <p className="gate-lede">
            {fits} of {brief.seeds.length} hold up against these rules. We follow the ones that do, and leave the rest
            alone: their neighbours would be off target too.
          </p>
          {mismatch && <p className="notice warn">{mismatch}</p>}
          <ul className="rules stacked">
            {verdicts.map((v) => (
              <li key={v.handle} className={v.state}>
                <b>
                  @{v.handle}
                  <span className={`seed-tag ${v.state}`}>
                    {v.state === 'fits' ? 'Fits' : v.state === 'fails' ? 'Does not fit' : 'Reading them'}
                  </span>
                </b>
                <small className="muted">{v.note}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="page-head">
        <span className="hint">{failed || 'You can change every one of these afterwards.'}</span>
        <span className="spacer" />
        <button type="button" className="btn" disabled={making} onClick={() => void create(true)}>
          Change something
        </button>
        <button type="button" className="btn primary" disabled={making} onClick={() => void create(false)}>
          {making ? 'Creating' : 'Looks right, create it'}
        </button>
      </div>
    </>
  )
}

/** The proposal, shaped as a gate version so the seed check can run on it. */
function asGateSet(proposal: Proposal) {
  return {
    id: 'draft',
    campaignId: 'draft',
    accountId: 'draft',
    version: 1,
    origin: 'generated' as const,
    templateId: proposal.templateId,
    hard: proposal.hard,
    either: proposal.either,
    knockouts: proposal.knockouts,
    criteria: proposal.criteria,
    passScore: proposal.passScore,
    preset: 'balanced' as const,
    by: 'system',
    changes: [],
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------

export function NewCampaign() {
  const [phase, setPhase] = useState<Phase>('brief')
  const [brief, setBrief] = useState<CampaignBrief | null>(null)
  const [queue, setQueue] = useState<Clarification[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [failed, setFailed] = useState('')

  // The model writes the rules on the server, against the real brief. The
  // library in the browser is what the sample account uses, and what a
  // visitor without a key sees.
  const startBuilding = (b: CampaignBrief, a: Answers) => {
    setPhase('building')
    void (async () => {
      const { isLive } = await import('../lib/api')
      if (!isLive()) {
        setProposal(propose(b, a))
        return
      }
      try {
        const out = await draftOnServer(b)
        setDraftId(out.campaignId)
        setProposal(out.proposal)
      } catch (err) {
        setFailed(err instanceof Error ? err.message : 'The rules did not come back')
        setProposal(propose(b, a))
      }
    })()
  }

  const onBrief = (b: CampaignBrief) => {
    setBrief(b)
    const asks = clarifications(b)
    if (asks.length) {
      setQueue(asks)
      setPhase('asking')
      return
    }
    startBuilding(b, {})
  }

  const onAnswer = (value: string | null) => {
    const [current, ...rest] = queue
    const next: Answers = value ? { ...answers, [current.id]: value } : answers
    setAnswers(next)
    if (rest.length) {
      setQueue(rest)
      return
    }
    setQueue([])
    startBuilding(brief!, next)
  }

  const restart = () => {
    setPhase('brief')
    setBrief(null)
    setProposal(null)
    setDraftId(null)
    setFailed('')
    setAnswers({})
    setQueue([])
  }

  return (
    <div className="page narrow">
      {phase === 'brief' && <BriefStep onDone={onBrief} />}
      {phase === 'asking' && queue.length > 0 && (
        <AskStep question={queue[0]} left={queue.length - 1} onAnswer={onAnswer} />
      )}
      {phase === 'building' && <BuildingStep ready={Boolean(proposal)} onDone={() => setPhase('proposal')} />}
      {phase === 'proposal' && brief && proposal && (
        <>
          {failed && <p className="notice warn">{failed}</p>}
          <ProposalStep
            brief={brief}
            proposal={proposal}
            draftId={draftId}
            onProposal={setProposal}
            onRestart={restart}
          />
        </>
      )}
    </div>
  )
}
