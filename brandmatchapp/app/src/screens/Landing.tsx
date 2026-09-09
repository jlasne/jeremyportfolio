import { useState } from 'react'
import { CRITERIA, QUALIFIED_RATIO, getContacts, leadsNeeded } from '../data'
import { useStore } from '../data/hooks'
import { compact, relative } from '../lib/format'
import { Stars } from '../components/Stars'

// The landing. Same promise as Gojiberry, for Instagram creators:
// stop scrolling through a database, open the app and see who is ready today.

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#1A1A17" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#C8860D" />
  </svg>
)

const SIGNALS = [
  { label: 'Ran a sponsored post', note: 'Paid content went live. The creator is taking deals right now.' },
  { label: 'Promoted a brand in your category', note: 'A competitor already pays them. Your pitch lands on a warm inbox.' },
  { label: 'Posted about brand deal rates', note: 'Rates in public means a rate card is ready.' },
  { label: 'Added collab wording to the bio', note: '"DM for collabs" is an open door.' },
  { label: 'Published a media kit', note: 'Audience numbers packaged for brands.' },
  { label: 'Launched a program or merch', note: 'Selling to their audience, so they know their audience buys.' },
]

const FAQ = [
  { q: 'Where does the data come from?', a: 'We crawl Instagram every night, 300 to 500 profiles per agent. Engagement and views come from the last 12 posts we pulled ourselves, never from an aggregator average.' },
  { q: 'What counts as qualified?', a: '2 stars or more. One star each for niche, selling and signal, half a star when it half fits. About 1 lead in 10 comes back qualified.' },
  { q: 'How fast is the first batch?', a: 'Under 10 minutes after you create your first agent. Every morning after that, the batch is ready before 7:00 in your timezone.' },
  { q: 'Can I run more than one search?', a: 'Yes. Each agent is one search with its own sentence, filters and daily target. Every contact carries the agent that found it.' },
  { q: 'Does it send messages?', a: 'No. It finds, scores and hands you the email. Outreach stays in your hands.' },
]

export function Landing() {
  useStore()
  const top = getContacts({ minStars: 2 }).slice(0, 6)
  const [target, setTarget] = useState(25)
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="landing">
      <header className="land-nav">
        <a className="brand" href="#/">
          <Mark />
          brandmatch
        </a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#signals">Signals</a>
          <a href="#score">The score</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <span className="spacer" />
        <a className="btn" href="#/contacts">Open the demo</a>
        <a className="btn primary" href="#/onboarding">Create your first agent</a>
      </header>

      <section className="hero">
        <p className="kicker">Instagram creators, scored for intent, every morning</p>
        <h1>See which creators are ready for a brand deal today.</h1>
        <p className="lede">
          Describe the creator you want in one sentence. Every night an agent crawls Instagram, scores each profile on niche,
          selling and intent, and the list is sorted before 7:00.
        </p>
        <div className="hero-prompt" role="group" aria-label="Who are you looking for">
          <span className="faint">Who are you looking for?</span>
          <span className="prompt-text">Women lifting coaches who sell their own program</span>
          <a className="btn primary" href="#/onboarding">Find contacts</a>
        </div>
        <p className="hero-meta">300 to 500 profiles crawled a night · about 1 in 10 comes back qualified · first batch under 10 minutes</p>
      </section>

      <section className="demo-list">
        <div className="demo-head">
          <span className="chip on">Qualified today</span>
          <span className="muted">Live from the demo data. Click any row in the app for the full profile.</span>
        </div>
        <div className="list">
          {top.map((c) => (
            <a className="contact" key={c.creator.id} href={`#/contacts`}>
              <img className="avatar" src={c.creator.avatar} alt="" width={38} height={38} />
              <span className="who">
                <span className="name">{c.creator.name}</span>
                <span className="handle">@{c.creator.handle}</span>
              </span>
              <Stars score={c.score} />
              <span className="mail">{c.latestSignal ? `${c.latestSignal.label} ${relative(c.latestSignal.date)}` : c.creator.email}</span>
              <span className="metric">
                <b className="num">{compact(c.creator.followers)}</b>
                <small>followers</small>
              </span>
              <span className="metric">
                <b className="num">{(c.creator.engagementRate * 100).toFixed(1)}%</b>
                <small>engaged</small>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="land-section" id="how">
        <h2>Three steps, then it runs on its own</h2>
        <div className="steps3">
          <div className="step">
            <span className="step-n num">1</span>
            <h3>Say who you want</h3>
            <p>One sentence. "Women lifting coaches who sell their own program." Add filters for size, engagement, country and language.</p>
          </div>
          <div className="step">
            <span className="step-n num">2</span>
            <h3>The agent crawls every night</h3>
            <p>Keyword and hashtag search, then the full profile and the last 12 posts for each new handle. Engagement is computed from those posts, never copied from a database.</p>
          </div>
          <div className="step">
            <span className="step-n num">3</span>
            <h3>Open the list at 7:00</h3>
            <p>Sorted by stars, the signal dated, the email attached. Tag, note, reject, export. The same face never sits at the top two mornings in a row.</p>
          </div>
        </div>
      </section>

      <section className="land-section" id="signals">
        <h2>The signals we watch</h2>
        <p className="section-lede">Every signal carries a date. A signal inside 4 days earns a full star, inside 10 days half a star.</p>
        <div className="signal-grid">
          {SIGNALS.map((s) => (
            <div className="signal-card" key={s.label}>
              <b>{s.label}</b>
              <p>{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section" id="score">
        <h2>One score, three stars</h2>
        <p className="section-lede">Each criterion is one star, added up. Half a star when it half fits. The stars sit in a fixed order, so a row shows which fired, not only how many.</p>
        <div className="score-grid">
          {CRITERIA.map((c) => (
            <div className="score-card" key={c.key}>
              <b>{c.label}</b>
              <p><span className="faint">Full.</span> {c.full}</p>
              <p><span className="faint">Half.</span> {c.half}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section" id="pricing">
        <h2>Priced on what you asked for</h2>
        <p className="section-lede">You pick how many qualified leads a day. We crawl what it takes to find them, and you pay for the crawl.</p>
        <div className="calc">
          <label className="field">
            <span>Qualified leads a day</span>
            <input className="slider" type="range" min={5} max={100} step={5} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Qualified leads a day" />
          </label>
          <div className="calc-out">
            <div>
              <b className="num">{target}</b>
              <span>qualified a day</span>
            </div>
            <div>
              <b className="num">{leadsNeeded(target)}</b>
              <span>leads crawled a day, about 1 in {QUALIFIED_RATIO} qualifies</span>
            </div>
            <div>
              <b className="num">{target * 22}</b>
              <span>qualified a month, on 22 working days</span>
            </div>
          </div>
          <a className="btn primary" href="#/onboarding">Start with {target} a day</a>
          <p className="hint">Monthly plan with the crawl included. Extra days on top. Cancel any morning.</p>
        </div>
      </section>

      <section className="land-section" id="faq">
        <h2>Questions</h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div className={`faq-item${open === i ? ' open' : ''}`} key={f.q}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                {f.q}
              </button>
              {open === i && <p>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="land-cta">
        <h2>Your first batch in under 10 minutes.</h2>
        <a className="btn primary" href="#/onboarding">Create your first agent</a>
        <a className="btn" href="#/contacts">Open the demo</a>
      </section>

      <footer className="land-foot">
        <span className="brand-word">brandmatch</span>
        <span className="faint">Instagram only. TikTok and YouTube later.</span>
        <span className="spacer" />
        <a href="#how">How it works</a>
        <a href="#signals">Signals</a>
        <a href="#pricing">Pricing</a>
      </footer>
    </div>
  )
}
