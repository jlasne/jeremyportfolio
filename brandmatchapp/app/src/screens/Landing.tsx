import { useEffect, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'

// The landing, in six blocks: hero, video, the four steps, the two ways in,
// one price, one ask. Cream ground, one orange accent, wide corners.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** The word that turns. Same people, three names, depending who is asking. */
const WORDS = ['content creators', 'influencers', 'contacts']

/** Paste this and an agent is connected. Shown on the landing as is. */
const MCP_CONFIG = `{
  "mcpServers": {
    "brandmatch": {
      "type": "http",
      "url": "https://brandmatch.app/api/mcp"
    }
  }
}`

const STEPS = [
  {
    n: '01',
    title: 'Understand your ICP',
    note: 'Your website goes in. It comes back as the creators you should reach, in plain words. No forms, no manual setup. Change any word.',
    tick: 'strongher.co read in 8 seconds',
  },
  {
    n: '02',
    title: 'Find leads',
    note: 'Three agents search Instagram every night, each on its own angle. Quiet accounts drop out before they reach you. The email rides along.',
    tick: '500 a night, while you sleep',
  },
  {
    n: '03',
    title: 'Score it',
    note: 'Three stars, one each: fits your niche, sells something of their own, fired a brand signal in the last 4 days.',
    tick: 'Best first, every morning',
  },
  {
    n: '04',
    title: 'You close deals',
    note: 'Open the list, write to the top of it, tick them off. Sourcing that used to take an intern a week now lands before breakfast.',
    tick: 'The only one you do',
  },
]

/**
 * Every call to action asks for the same thing: an email. The list is the
 * product until the doors open, so the form is the only way in from here.
 */
function EarlyAccess({ size = 'normal', website }: { size?: 'normal' | 'small'; website?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (state === 'done') {
    return <p className="waitlist-done">You are on the list. We write when your first batch is ready.</p>
  }

  return (
    <form
      className={`waitlist${size === 'small' ? ' small' : ''}`}
      onSubmit={async (e) => {
        e.preventDefault()
        setState('sending')
        try {
          await api.waitlist(email, website)
          setState('done')
        } catch (err) {
          setState('error')
          setMessage(err instanceof Error ? err.message : 'That did not go through')
        }
      }}
    >
      <input
        type="email"
        required
        placeholder="you@yourbrand.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Your email"
      />
      <button className="btn primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending' : 'Get early access'}
      </button>
      {state === 'error' && <span className="waitlist-error">{message}</span>}
    </form>
  )
}

/** The word turns every 2.4 seconds, and holds still under reduced motion. */
function TurningWord() {
  const still = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [i, setI] = useState(0)

  useEffect(() => {
    if (still) return
    const t = window.setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400)
    return () => window.clearInterval(t)
  }, [still])

  // Every word sits in the same grid cell, so the box is as wide as the
  // widest one and the line never reflows as the word turns.
  return (
    <span className="turn" aria-label={WORDS.join(', ')}>
      {WORDS.map((w, n) => (
        <span key={w} className={n === i ? 'turn-word' : 'turn-ghost'} aria-hidden={n !== i}>{w}</span>
      ))}
    </span>
  )
}

/** The product in one take. The looping animation holds the frame until then. */
function ProductVideo() {
  if (!VIDEO_URL) return <HeroDemo />
  return (
    <video className="product-video" controls playsInline preload="metadata" poster="/og-image.png">
      <source src={VIDEO_URL} type="video/mp4" />
    </video>
  )
}

export function Landing() {
  return (
    <>
      <Backdrop />
      <div className="landing">
        <header className="land-nav">
          <a className="brand" href="#/">
            <Logo size={24} />
            brandmatch
          </a>
          <nav>
            <a href="#how">How it works</a>
            <a href="#ways">API and MCP</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <span className="spacer" />
          <a className="btn primary" href="#access">Get early access</a>
        </header>

        <div className="hero-block">
          <section className="hero">
            <h1>Your AI agent finds <br />high intent <TurningWord />.</h1>
            <p className="lede">
              Enter your website. brandmatch learns your brand, finds the creators ready for a deal, and ranks them
              before you wake up.
            </p>
            <EarlyAccess website="strongher.co" />
            <p className="hero-note">Three days free on 14,259 creators already in the pool. No card.</p>
          </section>

          <div className="video-wrap">
            <ProductVideo />
          </div>
        </div>

        <section className="land-section" id="how">
          <p className="eyebrow">How it works</p>
          <h2 className="big">Four steps. <em>You only do the last one.</em></h2>
          <p className="section-lede">
            Enter your website. Everything from there to a ranked list with emails on it runs on its own, every night.
          </p>
          <div className="steps4">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.note}</p>
                <span className="step-tick">{s.tick}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="land-section" id="ways">
          <p className="eyebrow">Connect your agent</p>
          <h2 className="big">Hooked up in <em>one config block.</em></h2>
          <p className="section-lede">
            One click for Claude, or paste this into any MCP agent: Cursor, an IDE, your own. The REST API covers
            everything else. Work the list here, or never open the app at all.
          </p>

          <div className="connect">
            <div className="connect-code">
              <pre><code>{MCP_CONFIG}</code></pre>
            </div>
            <div className="connect-side">
              <a className="btn primary" href="#access">Add to Claude</a>
              <a className="btn" href="#/connect">View API docs</a>
            </div>
          </div>

          <ul className="connect-notes">
            <li>MCP and REST on every plan, same key, no extra tier</li>
            <li>Ask in words: who fired a brand signal this week</li>
            <li>Writes land in the app, because the app is the CRM</li>
          </ul>
        </section>

        <section className="land-section centred" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2 className="big">One plan. <em>That is the whole page.</em></h2>
          <p className="section-lede">
            Your first sourcing hire, for founders and small brand teams who would rather write to creators than
            search for them.
          </p>

          <div className="outcomes">
            <div className="outcome">
              <b>500</b>
              <span>scored leads land every morning, best first, emails on the row</span>
            </div>
            <div className="outcome">
              <b>0 hours</b>
              <span>of searching. The list is built while you sleep, from your website alone</span>
            </div>
            <div className="outcome">
              <b>14 days</b>
              <span>every lead is yours alone. Nobody else on the platform is handed the same handle</span>
            </div>
          </div>

          <div className="one-plan">
            <div className="plan dark">
              <span className="plan-tag">Everything</span>
              <p className="price">$99<small>a month</small></p>
              <ul>
                <li>Up to 500 scored leads a day</li>
                <li>Their email where we find one</li>
                <li>Unlimited campaigns and agents</li>
                <li>API and MCP, same key, no extra tier</li>
                <li>Every lead yours alone for 14 days</li>
                <li>Cancel any morning</li>
              </ul>
              <a className="btn primary" href="#access">Start 3 days free</a>
            </div>
          </div>
          <p className="section-lede">
            Three days free on the 14,259 creators already in the pool. No card.
            Need more than 500 a day? <a href="mailto:jeremy@brandmatch.app">Chat with me</a> and we size it together.
          </p>
        </section>

        <section className="land-cta" id="access">
          <h2>Your next 10 leads are already out there.</h2>
          <p>Leave your email. We open the doors in batches and write when yours is ready.</p>
          <EarlyAccess />
        </section>

        <footer className="land-foot">
          <div>
            <span className="brand-word">brandmatch</span>
            <p className="muted" style={{ marginTop: 8 }}>
              Creators for your brand, every morning. Instagram today, TikTok and YouTube next.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#how">How it works</a>
            <a href="#ways">API and MCP</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <h4>Get in</h4>
            <a href="#access">Early access</a>
            <a href="mailto:jeremy@brandmatch.app">Chat with me</a>
          </div>
          <p className="copy">© 2026 brandmatch. Creators for your brand, every morning.</p>
        </footer>
      </div>
    </>
  )
}
