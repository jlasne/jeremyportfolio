import { useEffect, useState } from 'react'
import { getContacts } from '../data'
import { useStore } from '../data/hooks'
import { compact, percent } from '../lib/format'
import { Logo } from '../components/Logo'
import { Stars } from '../components/Stars'

// The landing, in the CreatorMatch mood: navy, off white, hairlines, no shadows.
// One promise: it runs on its own, and what lands is qualified.

/** Different brands ask for different volumes, so the number keeps moving. */
const VOLUMES = [120, 250, 400, 640, 800, 1000]

function useRollingVolume(): number {
  const [i, setI] = useState(1)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setI(() => Math.floor(Math.random() * VOLUMES.length)), 1800)
    return () => window.clearInterval(t)
  }, [])
  return VOLUMES[i]
}

const COMPARE: { row: string; database: string; scraper: string; agency: string; ours: string }[] = [
  {
    row: 'Still posting',
    database: 'Nobody checks',
    scraper: 'You check',
    agency: 'Sometimes',
    ours: 'Read this month, last 12 posts',
  },
  {
    row: 'Ranked by intent',
    database: 'By follower count',
    scraper: 'Raw rows, no order',
    agency: 'Their taste',
    ours: 'Active in your niche, showing intent',
  },
  {
    row: 'Email attached',
    database: 'Extra fee',
    scraper: 'You enrich it',
    agency: 'They keep it',
    ours: 'On the row',
  },
  {
    row: 'You stay in control',
    database: 'Fixed filters',
    scraper: 'You maintain it',
    agency: 'Their picks',
    ours: 'Your sentence, change it any morning',
  },
  {
    row: 'Runs on its own',
    database: 'You search it',
    scraper: 'You run it',
    agency: 'For a retainer',
    ours: 'Every night',
  },
]

const FAQ = [
  {
    q: 'How do I set it up?',
    a: 'Enter your website. Your agent reads it and writes the audience it should hunt for: the niche, who follows them, the size band. Change any word of it, set your daily volume, and it starts that night.',
  },
  {
    q: 'How many leads do I get?',
    a: 'You choose, anywhere from 100 to 1,000 a day. Move the number any morning and the next batch follows it.',
  },
  {
    q: 'What makes a lead high intent?',
    a: 'Three things, each worth a star: the creator fits your niche, they already sell something of their own, and a brand signal fired in the last few days. A paid post, a rate card, collab wording in the bio.',
  },
  {
    q: 'Can I run more than one agent?',
    a: 'Yes. One per launch, per product or per market. Every contact carries the agent that found it, so you can read them together or apart.',
  },
  {
    q: 'What do I do with the list?',
    a: 'Open it, tick off the ones you wrote to, tag the rest in bulk, and export whatever you want to keep. The contact is on the row where we found one.',
  },
  {
    q: 'Can my own AI read the list?',
    a: 'That is Connect AI, and it is coming soon. MCP will hand your leads to Claude or ChatGPT, and an API will create and pause your agents from your own code.',
  },
]

export function Landing() {
  useStore()
  const volume = useRollingVolume()
  const top = getContacts({ minStars: 2 }).slice(0, 5)
  const [perDay, setPerDay] = useState(250)
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="landing">
      <header className="land-nav">
        <a className="brand" href="#/">
          <Logo size={24} />
          brandmatch
        </a>
        <nav>
          <a href="#why">Why</a>
          <a href="#how">How it works</a>
          <a href="#connect">Connect AI</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <span className="spacer" />
        <a className="login" href="#/contacts">Login</a>
        <a className="btn primary" href="#/onboarding">Start free</a>
      </header>

      <section className="hero">
        <h1>Your AI agent finds <mark>high intent influencers</mark> for you.</h1>
        <p className="lede">
          Enter your website. brandmatch learns your brand, finds the influencers whose audience matches yours, and brings you
          the ones ready for a deal with their contact attached.
        </p>
        <div className="hero-prompt" role="group" aria-label="Your website">
          <span className="prompt-text">strongher.co</span>
          <a className="btn primary" href="#/onboarding">Launch my agent</a>
        </div>
        <p className="hero-tag">{volume.toLocaleString('en-US')} leads a day, <b>picked while you sleep.</b></p>
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
                <span className="tick" aria-hidden="true"><input type="checkbox" readOnly tabIndex={-1} /></span>
                <span className="handle-btn">@{c.creator.handle}</span>
                <Stars score={c.score} />
                <span className="mail">{c.creator.email ?? 'No email found'}</span>
                <span className="metric">
                  <b className="num">{compact(c.creator.followers)}</b>
                  <small>followers</small>
                </span>
                <span className="metric">
                  <b className="num">{percent(c.creator.engagementRate)}</b>
                  <small>engaged</small>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <section className="land-section" id="why">
        <h2 className="big">Better than what you use today</h2>
        <p className="section-lede">The same job, done four ways. Only one of them wakes up before you do.</p>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">What matters</span></th>
                <th scope="col">Creator database</th>
                <th scope="col">Scraping tool</th>
                <th scope="col">Agency</th>
                <th scope="col" className="ours">brandmatch</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) => (
                <tr key={c.row}>
                  <th scope="row">{c.row}</th>
                  <td>{c.database}</td>
                  <td>{c.scraper}</td>
                  <td>{c.agency}</td>
                  <td className="ours">{c.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="land-section" id="how">
        <p className="eyebrow">Two steps</p>
        <h2 className="big">That is the whole setup.</h2>
        <div className="steps2">
          <div className="step">
            <span className="step-n">01</span>
            <h3>Enter your website</h3>
            <p>Your agent reads it and writes who it should hunt for: the niche, the audience, the size. Change any word of it.</p>
          </div>
          <div className="step">
            <span className="step-n">02</span>
            <h3>Your agents find high intent influencers</h3>
            <p>Every night they go creator by creator, drop the quiet accounts, and bring you the ones showing they want a brand deal, with their contact attached.</p>
          </div>
        </div>
      </section>

      <section className="land-section" id="connect">
        <p className="eyebrow">Connect AI</p>
        <h2 className="big">Your agents and your leads, <em>reachable from your own AI.</em></h2>
        <p className="section-lede">One key, two doors. Nothing to install.</p>
        <div className="doors">
          <div className="door">
            <span className="door-tag">MCP</span>
            <h3>Get your leads</h3>
            <p>Connect Claude, ChatGPT or your own tool. Ask in plain words and it answers from this morning's list.</p>
            <div className="asks">
              <span className="ask-line">"Who came in today with an email?"</span>
              <span className="ask-line">"UK creators who ran a paid post this week."</span>
              <span className="ask-line">"Tag the top ten for the spring launch."</span>
            </div>
          </div>
          <div className="door">
            <span className="door-tag">API</span>
            <h3>Manage your agents</h3>
            <p>Create an agent, change its sentence, move its daily volume, pause it. Your own code or a workflow tool drives it.</p>
            <div className="asks">
              <span className="ask-line">Create an agent for a new launch</span>
              <span className="ask-line">Raise a volume from 100 to 800 a day</span>
              <span className="ask-line">Pause every agent while you are closed</span>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="pricing">
        <h2 className="big">One price. <em>Two ways to take it.</em></h2>
        <p className="section-lede">The same price either way. Pick the one that matches how you buy.</p>
        <div className="plans">
          <div className="plan">
            <span className="plan-tag">Monthly</span>
            <h3>Brand</h3>
            <p className="muted">Set the daily volume. Move it any morning.</p>
            <div className="calc-line">
              <input className="slider" type="range" min={100} max={1000} step={50} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} aria-label="Leads a day" />
              <b className="num">{perDay}</b>
            </div>
            <p className="big-figure">
              <b className="num">{(perDay * 30).toLocaleString('en-US')}</b>
              <span>leads a month, at {perDay} a day</span>
            </p>
            <ul>
              <li>Anywhere from 100 to 1,000 leads a day</li>
              <li>Unlimited agents, each with its own sentence</li>
              <li>Their email attached where we find one</li>
              <li>MCP for your leads, API for your agents</li>
              <li>Change the volume or cancel any morning</li>
            </ul>
            <a className="btn primary" href="#/onboarding">Start at {perDay} a day</a>
          </div>
          <div className="plan dark">
            <span className="plan-tag">One off</span>
            <h3>Pack</h3>
            <p className="muted">The same price as one month, with no renewal.</p>
            <p className="big-figure">
              <b className="num">30,000</b>
              <span>leads, delivered at the pace you set</span>
            </p>
            <ul>
              <li>30,000 leads in total, billed once</li>
              <li>Spread them over as many days as you like</li>
              <li>Unlimited agents while the pack lasts</li>
              <li>MCP for your leads, API for your agents</li>
              <li>Nothing to cancel</li>
            </ul>
            <a className="btn" href="#/onboarding">Buy 30,000 leads</a>
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
        <p>Tomorrow morning they are in your list.</p>
        <a className="btn primary" href="#/onboarding">Get my first list</a>
        <a className="btn ghost" href="#/contacts">See a live list</a>
      </section>

      <footer className="land-foot">
        <div>
          <span className="brand-word">brandmatch</span>
          <p className="muted" style={{ marginTop: 8 }}>Creators for your brand, every morning. Instagram today, TikTok and YouTube next.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#why">Why</a>
          <a href="#how">How it works</a>
          <a href="#connect">Connect AI</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div>
          <h4>App</h4>
          <a href="#/contacts">See a live list</a>
          <a href="#/onboarding">Create an agent</a>
          <a href="#/connect">Connect AI</a>
        </div>
        <div>
          <h4>Information</h4>
          <a href="#faq">Questions</a>
          <a href="#/">Legal notice</a>
          <a href="#/">Privacy</a>
        </div>
        <p className="copy">© 2026 brandmatch. Front end prototype on demo data.</p>
      </footer>
    </div>
  )
}
