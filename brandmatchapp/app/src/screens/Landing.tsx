import { useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'

// The landing, in six blocks: hero, video, the four steps, the two ways in,
// one price, one ask. Cream ground, one orange accent, wide corners.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

const STEPS = [
  {
    n: '01',
    title: 'Understand your ICP',
    note: 'Enter your website. It is read back to you as the creators you should reach: the niche, what they sell, who follows them. Change any word.',
  },
  {
    n: '02',
    title: 'Find leads',
    note: 'Agents search Instagram every night. Quiet accounts drop out before they reach you. The contact rides along where we find one.',
  },
  {
    n: '03',
    title: 'Score it',
    note: 'Three stars, one each: fits your niche, sells something of their own, fired a brand signal in the last 4 days. Best first.',
  },
  {
    n: '04',
    title: 'You close deals',
    note: 'Open the list, write to the top of it, tick them off. That is the only step left for you.',
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
            <h1>Your AI agent finds <br />high intent Instagram contacts.</h1>
            <p className="lede">
              Enter your website. brandmatch learns your brand, finds the creators ready for a deal, and ranks them
              before you wake up.
            </p>
            <EarlyAccess website="strongher.co" />
            <p className="hero-note">14,259 creators in the pool today. Instagram first, TikTok and YouTube next.</p>
          </section>

          <div className="video-wrap">
            <ProductVideo />
          </div>
        </div>

        <section className="land-section" id="how">
          <p className="eyebrow">How it works</p>
          <h2 className="big">Four steps. <em>You only do the last one.</em></h2>
          <div className="steps4">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="land-section" id="ways">
          <p className="eyebrow">AI native</p>
          <h2 className="big">Open the app. <em>Or never open it at all.</em></h2>
          <p className="section-lede">
            Same leads, same writes, two doors. Work the list here, or point the AI you already pay for at it and stay
            where you are.
          </p>
          <div className="doors">
            <div className="door">
              <span className="door-tag">The platform</span>
              <h3>Work the list here</h3>
              <p>
                Ranked every morning, filters on top, contact on the row. Tag, note, tick off, reject, export. It is
                the CRM as well as the feed, so nothing needs syncing.
              </p>
            </div>
            <div className="door">
              <span className="door-tag">Your own AI</span>
              <h3>API and MCP</h3>
              <p>
                One key reads your leads, classifies them and runs your campaigns. Point Claude, Cursor or your IDE at
                the MCP server and ask in words. Your AI subscription does the work.
              </p>
              <div className="asks">
                <span className="ask-line">"Who fired a brand signal this week?"</span>
                <span className="ask-line">"Tag the 3 star ones and draft my first message."</span>
              </div>
            </div>
          </div>
        </section>

        <section className="land-section centred" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2 className="big">One plan. <em>That is the whole page.</em></h2>
          <div className="one-plan">
            <div className="plan dark">
              <span className="plan-tag">Everything</span>
              <p className="price">$99<small>a month</small></p>
              <ul>
                <li>Up to 250 scored leads a day</li>
                <li>Their email where we find one</li>
                <li>Unlimited campaigns and agents</li>
                <li>API and MCP, same key, no extra tier</li>
                <li>Every lead yours alone for 14 days</li>
                <li>Cancel any morning</li>
              </ul>
              <a className="btn primary" href="#access">Get early access</a>
            </div>
          </div>
          <p className="section-lede">
            Need more than 250 a day? <a href="mailto:jeremy@brandmatch.app">Chat with me</a> and we size it together.
          </p>
        </section>

        <section className="land-cta" id="access">
          <h2>Your next 10 creators are already out there.</h2>
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
