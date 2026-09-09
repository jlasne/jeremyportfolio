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

const OBJECTIONS = [
  {
    old: 'A creator database',
    pain: 'You pay for a million profiles, then find half went quiet two years ago. Nobody tells you which.',
    ours: 'Every creator here posted this month and we read their last 12 posts to prove it.',
  },
  {
    old: 'A scraping tool',
    pain: 'Expensive, slow, and it hands back a wall of rows with no idea who is worth a message.',
    ours: 'You get a short list, ranked, with the reason and the date attached.',
  },
  {
    old: 'An agency',
    pain: 'A monthly invoice, someone else picking your creators, and no way to change your mind fast.',
    ours: 'Your sentence, your filters, your list. Change it any morning and the next batch follows.',
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
        <div className="objections">
          {OBJECTIONS.map((o) => (
            <div className="objection" key={o.old}>
              <b>{o.old}</b>
              <p className="pain">{o.pain}</p>
              <p className="ours">{o.ours}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section" id="how">
        <h2 className="big">Three minutes today. <em>Then it runs on its own.</em></h2>
        <div className="steps3">
          <div className="step">
            <span className="step-n">01</span>
            <h3>Write one sentence</h3>
            <p>"Women lifting coaches who sell their own program." Pick your audience size and country, or take a preset.</p>
          </div>
          <div className="step">
            <span className="step-n">02</span>
            <h3>It works every night</h3>
            <p>We read Instagram creator by creator and keep the active ones in your niche who show intent for collabs.</p>
          </div>
          <div className="step">
            <span className="step-n">03</span>
            <h3>You stay in control</h3>
            <p>Open the list, tick off the ones you wrote to, change the volume or the sentence. The next batch follows you.</p>
          </div>
        </div>
      </section>

      <section className="land-section" id="connect">
        <p className="eyebrow">Connect AI</p>
        <h2 className="big">Built for the AI you already use</h2>
        <p className="section-lede">
          One key connects Claude, ChatGPT or your own tool through MCP or a plain API. Ask in your own words and it answers
          from your live list. It can tag and tick things off for you too.
        </p>
        <div className="asks">
          <span className="ask-line">"Who came in today with an email?"</span>
          <span className="ask-line">"Show me UK creators who ran a paid post this week."</span>
          <span className="ask-line">"Tag the top ten for the spring launch."</span>
        </div>
      </section>

      <section className="land-section" id="pricing">
        <h2 className="big">Two ways to buy</h2>
        <p className="section-lede">Every creator we deliver is active in your niche with intent for collabs.</p>
        <div className="plans">
          <div className="plan">
            <span className="plan-tag">Monthly</span>
            <h3>Brand</h3>
            <p className="muted">You set the daily volume. It runs every night and you can change the number any morning.</p>
            <div className="calc-line">
              <input className="slider" type="range" min={50} max={1000} step={50} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} aria-label="Creators a day" />
              <b className="num">{perDay}</b>
            </div>
            <p className="price">
              {perDay} <small>creators a day</small>
            </p>
            <ul>
              <li>{(perDay * 30).toLocaleString('en-US')} creators a month</li>
              <li>Best rate per creator</li>
              <li>Unlimited agents, each with its own sentence</li>
              <li>Their email attached where we find one</li>
              <li>Connect your AI through MCP or the API</li>
              <li>Change the volume or cancel any morning</li>
            </ul>
            <a className="btn primary" href="#/onboarding">Start with {perDay} a day</a>
          </div>
          <div className="plan dark">
            <span className="plan-tag">One off</span>
            <h3>1,000 pack</h3>
            <p className="muted">One list, no subscription. Good for a single launch or a first test.</p>
            <p className="price">1,000 <small>creators, once</small></p>
            <ul>
              <li>Delivered over the days you choose</li>
              <li>50% more per creator than the monthly plan</li>
              <li>Same ranking, same emails, same export</li>
              <li>Connect your AI through MCP or the API</li>
              <li>No renewal, nothing to cancel</li>
            </ul>
            <a className="btn" href="#/onboarding">Buy 1,000 creators</a>
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
