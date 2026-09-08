import { useEffect, useState } from 'react'
import type { BriefAnswer, Filters } from '../types'
import { buildSummary, getBrief, getFilters, getFollowUpQuestions, runFirstCrawl, setBrief, setFilters, type CrawlProgress } from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { FilterForm } from '../components/FilterForm'

const PLACEHOLDER = 'Women lifting coaches who sell their own program'

// Draft answers live here between the three steps. Nothing is stored until the brand finishes step 2.
let draftWho = ''
let draftAnswers: BriefAnswer[] = []

export function OnboardingWho() {
  useStore()
  const [who, setWho] = useState(() => draftWho || getBrief()?.who || '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    draftWho = who.trim() || PLACEHOLDER
    navigate('onboarding/details')
  }
  return (
    <div className="onboard">
      <form className="onboard-box" onSubmit={submit}>
        <h1>
          <label htmlFor="who">Who are you looking for?</label>
        </h1>
        <input id="who" className="input big" autoFocus placeholder={PLACEHOLDER} value={who} onChange={(e) => setWho(e.target.value)} />
        <p className="helper">One sentence. We will ask for details next.</p>
        <div className="foot">
          <span className="spacer" />
          <button type="submit" className="btn primary">Continue</button>
        </div>
      </form>
    </div>
  )
}

export function OnboardingDetails() {
  useStore()
  const who = draftWho || getBrief()?.who || PLACEHOLDER
  const questions = getFollowUpQuestions(who)
  const saved = getBrief()
  const existing = saved && saved.who === who ? saved.answers : []
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, draftAnswers.find((a) => a.questionId === q.id)?.value ?? existing.find((a) => a.questionId === q.id)?.value ?? ''])),
  )
  const set = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }))
  const list: BriefAnswer[] = questions.map((q) => ({ questionId: q.id, value: answers[q.id]?.trim() || null }))
  const summary = buildSummary(who, list)

  const finish = (e: React.FormEvent) => {
    e.preventDefault()
    draftAnswers = list
    setBrief(who, list)
    navigate('onboarding/filters')
  }

  return (
    <div className="onboard">
      <form className="onboard-box" onSubmit={finish}>
        <p className="steps">Step 2 of 3. Every question is optional.</p>
        <h1>Three details to sharpen the search</h1>
        {questions.map((q) => (
          <div className="question" key={q.id}>
            <h2>{q.text}</h2>
            <div className="chips" role="group" aria-label={q.text}>
              {q.chips.map((chip) => {
                const on = answers[q.id] === chip
                return (
                  <button key={chip} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set(q.id, on ? '' : chip)}>
                    {chip}
                  </button>
                )
              })}
            </div>
            <input className="input" placeholder="Or type your own" value={q.chips.includes(answers[q.id]) ? '' : answers[q.id]} onChange={(e) => set(q.id, e.target.value)} aria-label={`${q.text} Free text`} />
          </div>
        ))}
        <div className="brief-line">
          <p>{summary}</p>
        </div>
        <div className="foot">
          <a href="#/onboarding/who">Back</a>
          <span className="spacer" />
          <button type="button" className="btn quiet" onClick={() => { draftAnswers = []; setBrief(who, questions.map((q) => ({ questionId: q.id, value: null }))); navigate('onboarding/filters') }}>Skip all</button>
          <button type="submit" className="btn primary">Continue</button>
        </div>
      </form>
    </div>
  )
}

export function OnboardingFilters() {
  useStore()
  const filters = getFilters()
  const onChange = (patch: Partial<Filters>) => setFilters(patch)
  return (
    <div className="onboard">
      <div className="onboard-box">
        <p className="steps">Step 3 of 3. Change these any time from the feed.</p>
        <h1>Set the filters</h1>
        <div className="card">
          <FilterForm value={filters} onChange={onChange} />
        </div>
        <p className="helper">Filters cut the volume. Stars set the order. Filters never change a score.</p>
        <div className="foot">
          <a href="#/onboarding/details">Back</a>
          <span className="spacer" />
          <button type="button" className="btn primary" onClick={() => navigate('onboarding/running')}>Find creators</button>
        </div>
      </div>
    </div>
  )
}

export function FirstRun() {
  useStore()
  const brief = getBrief()
  const [p, setP] = useState<CrawlProgress>({ found: 0, scored: 0, done: false })
  useEffect(() => {
    const stop = runFirstCrawl(setP)
    return stop
  }, [])
  useEffect(() => {
    if (p.done) {
      const t = window.setTimeout(() => navigate('feed'), 500)
      return () => window.clearTimeout(t)
    }
  }, [p.done])
  const pct = Math.round(((p.found + p.scored) / (412 * 2)) * 100)
  return (
    <div className="onboard">
      <div className="onboard-box" aria-live="polite">
        <h1>Building your first batch</h1>
        <div className="brief-line">
          <p>{brief?.summary ?? 'No brief yet.'}</p>
          <a href="#/onboarding/who">Edit</a>
        </div>
        <div className="progress">
          <div className="stat">
            <b>{p.found}</b>
            <span>profiles found</span>
          </div>
          <div className="stat">
            <b>{p.scored}</b>
            <span>profiles scored</span>
          </div>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="helper">{p.done ? 'Done. Opening the feed.' : 'Usually under 10 minutes. This preview takes 8 seconds.'}</p>
      </div>
    </div>
  )
}
