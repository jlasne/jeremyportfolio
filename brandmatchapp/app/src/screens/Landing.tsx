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
  { q: 'How many creators do I get?', a: 'You choose. Set 250 a day and 250 land every morning. Move it to 1,000 or down to 50 whenever you like.' },
  { q: 'What makes one qualified?', a: 'We only count creators who are active in your niche and show intent for collabs. A paid post this week, a rate card, collab wording in the bio.' },
  { q: 'Do I have to run it?', a: 'No. It runs every night on its own. You open the list in the morning, tick off the ones you have written to, and close it.' },
  { q: 'Can my own AI read the list?', a: 'Yes. Connect Claude, ChatGPT or your own tool with one key. Ask in plain words and it answers from your live list.' },
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
        <span className="pill-note"><i />Runs every night. You open the list.</span>
        <h1>
          <span className="rolling num">{volume.toLocaleString('en-US')}</span> creators a day,
          <br />
          <mark>ready to work</mark> with your brand.
        </h1>
        <p className="lede">
          We find active people in your niche with intent for collabs. You say who you want in one sentence, and your list is
          waiting every morning with their email attached.
        </p>
        <div className="hero-prompt" role="group" aria-label="Who are you looking for">
          <span className="prompt-text">Women lifting coaches who sell their own program</span>
          <a className="btn primary" href="#/onboarding">Get my first list</a>
        </div>
        <p className="hero-tag">You choose the volume. <b>We do the finding.</b></p>
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
        <p className="eyebrow">The agent</p>
        <h2 className="big">It hunts every night. <em>You read the good ones.</em></h2>
        <p className="section-lede">
          You write one sentence. From then on the agent works without you: it goes creator by creator, throws out the quiet
          accounts, and keeps the ones showing they want a brand deal.
        </p>
        <div className="steps3">
          <div className="step">
            <span className="step-n">IT LEARNS</span>
            <h3>Your sentence is the brief</h3>
            <p>"Women lifting coaches who sell their own program." The agent turns that into what it looks for and what it drops.</p>
          </div>
          <div className="step">
            <span className="step-n">IT WORKS</span>
            <h3>All night, on its own</h3>
            <p>It reads bios, audiences and the last 12 posts of every creator it finds. Quiet accounts and wrong audiences never reach you.</p>
          </div>
          <div className="step">
            <span className="step-n">IT LEARNS AGAIN</span>
            <h3>Your ticks teach it</h3>
            <p>Reject a creator and it stops bringing you that kind. Tick one off and it moves on. The list gets closer to your taste every week.</p>
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
        <p className="section-lede">$500 either way. Pick the one that matches how you buy.</p>
        <div className="plans">
          <div className="plan">
            <span className="plan-tag">Monthly</span>
            <h3>Brand</h3>
            <p className="price">$500 <small>a month</small></p>
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
            <p className="price">$500 <small>once</small></p>
            <p className="muted">The same price as one month, with no renewal.</p>
            <p className="big-figure">
              <b className="num">30,000</b>
              <span>leads, delivered at the pace you set</span>
            </p>
            <ul>
              <li>30,000 leads in total, no monthly bill</li>
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
