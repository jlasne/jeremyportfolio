import { useState } from 'react'
import { CRITERIA, QUALIFIED_RATIO, getContacts, leadsNeeded } from '../data'
import { useStore } from '../data/hooks'
import { compact, relative } from '../lib/format'
import { Stars } from '../components/Stars'

// The landing, on Gojiberry's beats: nav with numbered items, a hero with the
// prompt, the app in a browser frame, a numbers strip, what the agent does,
// three steps, what it replaces, the score, two plans, questions, a dark close.

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#0A0A0A" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#FA651E" />
  </svg>
)

const FAQ = [
  { q: 'Where does the data come from?', a: 'An agent crawls Instagram every night, 300 to 500 profiles a run. Engagement and views come from the last 12 posts we pull ourselves, never from an aggregator average.' },
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
          <a href="#features">Features <small>01</small></a>
          <a href="#how">How it works <small>02</small></a>
          <a href="#score">The score <small>03</small></a>
          <a href="#pricing">Pricing <small>04</small></a>
        </nav>
        <span className="spacer" />
        <a className="login" href="#/contacts">Login</a>
        <a className="btn primary" href="#/onboarding">Start for free</a>
      </header>

      <section className="hero">
        <span className="pill-note"><i />Instagram creators, scored for intent, every morning</span>
        <h1>Your AI agent finds creators ready for a <mark>brand deal</mark> and hands you their email.</h1>
        <p className="lede">
          Describe the creator you want in one sentence. brandmatch crawls Instagram every night, scores each profile on niche,
          selling and intent, and the list is sorted before 7:00.
        </p>
        <div className="hero-prompt" role="group" aria-label="Who are you looking for">
          <span className="prompt-text">Women lifting coaches who sell their own program</span>
          <a className="btn primary" href="#/onboarding">Launch my agent for free</a>
        </div>
        <p className="hero-tag">It's like having a <b>radar for creators ready to sign.</b></p>
      </section>

      <div className="browser">
        <div className="browser-frame">
          <div className="browser-bar">
            <i /><i /><i />
            <span className="url">app.brandmatch.app</span>
          </div>
          <div className="list">
            {top.map((c) => (
              <a className="contact" key={c.creator.id} href="#/contacts">
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
        </div>
      </div>

      <div className="strip">
        <div><b>300 to 500</b><span>profiles crawled a night, per agent</span></div>
        <div><b>1 in 10</b><span>comes back qualified</span></div>
        <div><b>7:00</b><span>the list is sorted before</span></div>
        <div><b>10 min</b><span>from signup to the first batch</span></div>
      </div>

      <section className="land-section grey" id="features">
        <div className="inner">
          <h2 className="big">Your agent runs every night. <em>The list is ready every morning.</em></h2>
          <p className="section-lede">From finding the right creators to attaching the right email, your agent handles it, on its own.</p>
          <div className="features">
            <div className="feature wide">
              <div>
                <h3>Finds and scores the ready ones first</h3>
                <p>Your agent watches for brand signals, scores every creator against your sentence, and puts the ones most likely to sign at the top, before you write a word.</p>
              </div>
              <div className="chips">
                <span className="chip on">Ran a sponsored post</span>
                <span className="chip">Promoted a brand in your category</span>
                <span className="chip">Posted about brand deal rates</span>
                <span className="chip">Added collab wording to the bio</span>
                <span className="chip">Published a media kit</span>
                <span className="chip">Launched a program or merch</span>
              </div>
            </div>
            <div className="feature">
              <h3>Only the creators that fit. Nothing else.</h3>
              <p>Every lead passes your filters first: audience size, engagement, reel views, posting cadence, country, language. No message wasted on the wrong audience.</p>
            </div>
            <div className="feature">
              <h3>Numbers you can trust</h3>
              <p>Engagement and views come from the last 12 posts we pull ourselves. An aggregator's average can run 74 times the real number, so we never use one.</p>
            </div>
            <div className="feature">
              <h3>The email, attached</h3>
              <p>When the address is in the bio, it sits on the row. Copy it in one click, or export the list as a CSV with notes and tags.</p>
            </div>
            <div className="feature">
              <h3>A fresh top every morning</h3>
              <p>A creator returns to the top only when a new signal fires or the score goes up. The same face never sits there two mornings in a row.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="how">
        <h2 className="big">10 minutes to set up. <em>First batch today.</em></h2>
        <p className="section-lede">Write one sentence. Your agent takes it from there.</p>
        <div className="steps3">
          <div className="step">
            <span className="step-n">01 · DESCRIBE</span>
            <h3>Say who you want</h3>
            <p>"Women lifting coaches who sell their own program." Add filters for size, engagement, country and language, or pick a preset.</p>
            <p className="quiet">No categories to pick. No forms.</p>
          </div>
          <div className="step">
            <span className="step-n">02 · CRAWL</span>
            <h3>Your agent finds them</h3>
            <p>Keyword and hashtag search, then the full profile and the last 12 posts for every new handle. Each one scored on niche, selling and signal.</p>
            <p className="quiet">What used to take an afternoon of scrolling runs while you sleep.</p>
          </div>
          <div className="step">
            <span className="step-n">03 · CONTACT</span>
            <h3>Open the list at 7:00</h3>
            <p>Sorted by stars, the signal dated, the email attached. Tag, note, reject, export. Your pipeline grows in the background every single day.</p>
            <p className="quiet">This is what creator sourcing was always supposed to feel like.</p>
          </div>
        </div>
      </section>

      <section className="land-section grey">
        <div className="inner">
          <h2 className="big">One agent. <em>Replaces the database, the scrolling and the spreadsheet.</em></h2>
          <p className="section-lede">Stop paying for a database you still have to read. brandmatch reads it for you and hands you the ones that are ready.</p>
          <div className="replaces">
            <div><b>Creator databases</b><span>A million profiles, none of them sorted by intent.</span></div>
            <div><b>Manual scrolling</b><span>Hours on Instagram to find three names.</span></div>
            <div><b>Spreadsheets</b><span>Stale the day after you build them.</span></div>
            <div><b>Agency retainers</b><span>A monthly fee for a list you could read yourself.</span></div>
          </div>
        </div>
      </section>

      <section className="land-section" id="score">
        <p className="eyebrow">Lead scoring</p>
        <h2 className="big">One score. <em>Three stars, half steps.</em></h2>
        <p className="section-lede">Each criterion is one star, added up. Half a star when it half fits. The stars sit in a fixed order, so a row shows which fired, not only how many.</p>
        <div className="score-grid">
          {CRITERIA.map((c, i) => (
            <div className="score-card" key={c.key}>
              <div className="stars-demo">
                <Stars score={{ stars: 1, niche: i === 0 ? 1 : 0, active: i === 1 ? 1 : 0, intent: i === 2 ? 1 : 0, earned: CRITERIA.map((k, j) => ({ label: k.label, level: j === i ? 1 : 0, note: k.full })), why: '' }} />
              </div>
              <b>{c.label}</b>
              <p><span className="faint">Full.</span> {c.full}</p>
              <p><span className="faint">Half.</span> {c.half}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section grey" id="pricing">
        <div className="inner">
          <h2 className="big">Simple pricing for what you asked for</h2>
          <p className="section-lede">Qualified leads found. The email attached. All before 7:00.</p>
          <div className="plans">
            <div className="plan">
              <h3>Solo</h3>
              <p className="muted">Your first sourcing agent. For a brand running its own creator outreach.</p>
              <div className="calc-line">
                <input className="slider" type="range" min={5} max={100} step={5} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Qualified leads a day" />
                <b className="num">{target}</b>
              </div>
              <p className="price">
                {target} <small>qualified leads a day</small>
              </p>
              <ul>
                <li>{leadsNeeded(target)} leads crawled a night, about 1 in {QUALIFIED_RATIO} qualifies</li>
                <li>{target * 22} qualified a month, on 22 working days</li>
                <li>Up to 3 agents, each with its own sentence and filters</li>
                <li>Email found and attached where it exists</li>
                <li>Tags, notes, reject, CSV export</li>
                <li>Cancel any morning</li>
              </ul>
              <a className="btn primary" href="#/onboarding">Start with {target} a day</a>
              <p className="faint">Monthly plan with the crawl included. Extra days on top.</p>
            </div>
            <div className="plan dark">
              <h3>Talk with us</h3>
              <p className="muted">For agencies and brands running several launches, or more than 100 qualified a day.</p>
              <p className="price">Custom</p>
              <ul>
                <li>Everything in Solo</li>
                <li>Custom number of agents</li>
                <li>Custom qualified leads a day</li>
                <li>Shared lists across the team</li>
                <li>CRM export on a schedule</li>
                <li>A person on the other end</li>
              </ul>
              <a className="btn" href="#/contacts">Get a demo</a>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="faq">
        <h2 className="big">Questions</h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div className={`faq-item${open === i ? ' open' : ''}`} key={f.q}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{f.q}</button>
              {open === i && <p>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="land-cta">
        <h2>Your next 10 creators are already out there.</h2>
        <p>Let your agent find them.</p>
        <a className="btn primary" href="#/onboarding">Launch my agent for free</a>
        <a className="btn ghost" href="#/contacts">Open the demo</a>
        <p className="fine">Free trial · Live in 10 minutes · Cancel any morning</p>
      </section>

      <footer className="land-foot">
        <div>
          <span className="brand-word">brandmatch</span>
          <p className="muted" style={{ marginTop: 8 }}>Your creator sourcing agent. Instagram today, TikTok and YouTube next.</p>
        </div>
        <div>
          <h4>Sections</h4>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#/contacts">Open the demo</a>
          <a href="#/onboarding">Create an agent</a>
          <a href="#score">The score</a>
        </div>
        <div>
          <h4>Information</h4>
          <a href="#faq">FAQ</a>
          <a href="#/">Legal notice</a>
          <a href="#/">Privacy</a>
        </div>
        <p className="copy">© 2026 brandmatch. Front end prototype on demo data.</p>
      </footer>
    </div>
  )
}
