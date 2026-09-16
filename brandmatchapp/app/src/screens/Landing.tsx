import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'

// The landing, in six blocks: hero, video, the four steps, the two ways in,
// one price, one ask. Cream ground, one orange accent, wide corners.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** The words that turn. Same people, three names; same thing, two names. */
const WHO = ['content creators', 'influencers', 'contacts']
const WHAT = ['agent', 'campaign']

/** Paste this and an agent is connected. Shown on the landing as is. */
const MCP_CONFIG = `{
  "mcpServers": {
    "brandmatch": {
      "type": "http",
      "url": "https://www.brandmatch.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}`

const STEPS = [
  {
    n: '1/4',
    title: 'Understand your ICP',
    note: 'Your website goes in. Out comes who to reach, in plain words: the discipline, what they sell, who follows them. Three agents proposed, each on its own angle. Change any word.',
  },
  {
    n: '2/4',
    title: 'Find leads',
    note: 'Three agents search Instagram every night. Quiet accounts drop out before they reach you. Email and handle ride along on every row.',
  },
  {
    n: '3/4',
    title: 'Score it',
    note: 'Three stars, one each: fits your niche, sells something of their own, fired a brand signal in the last 4 days. Best first, every morning.',
  },
  {
    n: '4/4',
    title: 'You close deals',
    note: 'Open the list, write to the top of it, move each one along: contacted, replied, deal. The only step left for you.',
  },
]

/** The four visuals, one per step, built from the same parts as the app. */
function StepVisual({ n }: { n: string }) {
  if (n === '1/4') {
    return (
      <div className="viz viz-icp">
        <div className="viz-input"><span className="viz-caret" />strongher.co</div>
        <div className="viz-arrow" aria-hidden="true" />
        <div className="viz-brief">
          <span className="viz-label">Looking for</span>
          <p>Women lifting coaches, sell an online program, technique content, audience of beginner women.</p>
          <div className="viz-chips">
            <span>Technique coaches</span><span>Program sellers</span><span>Paid post watchers</span>
          </div>
        </div>
      </div>
    )
  }
  if (n === '2/4') {
    const faces = ['LM', 'JK', 'SS', 'PL', 'TT', 'AL', 'RB', 'NK']
    return (
      <div className="viz viz-find">
        <div className="viz-tags">
          <span style={{ left: '4%', top: '10%' }}>Posted #ad 3 days ago</span>
          <span style={{ left: '40%', top: '0%' }}>Sells a program</span>
          <span style={{ left: '70%', top: '12%' }}>Media kit in bio</span>
        </div>
        <div className="viz-faces">
          {faces.map((f, i) => <i key={f} style={{ ['--i' as string]: i }}>{f}</i>)}
        </div>
        <div className="viz-box"><span>tonight's batch</span></div>
      </div>
    )
  }
  if (n === '3/4') {
    const rows = [
      ['liftwithmaya', '3', 'high intent'],
      ['jennakstrong', '2.5', 'high intent'],
      ['sophie.souleve', '2', 'warm'],
      ['priyalifts', '1', 'cold'],
    ]
    return (
      <div className="viz viz-score">
        {rows.map(([h, st, tag]) => (
          <div className="viz-row" key={h}>
            <i>{h.slice(0, 2).toUpperCase()}</i>
            <b>@{h}</b>
            <span className="viz-stars">{'★'.repeat(Math.floor(Number(st)))}{Number(st) % 1 ? '½' : ''}<small> {st}</small></span>
            <em className={tag.replace(' ', '-')}>{tag}</em>
          </div>
        ))}
      </div>
    )
  }
  const rows = [
    ['liftwithmaya', 'deal', true],
    ['jennakstrong', 'replied', true],
    ['sophie.souleve', 'contacted', true],
    ['priyalifts', 'to contact', false],
  ] as const
  return (
    <div className="viz viz-close">
      {rows.map(([h, stage, done]) => (
        <div className="viz-row" key={h}>
          <i className={done ? 'done' : ''}>{done ? '✓' : ''}</i>
          <b>@{h}</b>
          <em className={`stage ${stage.replace(' ', '-')}`}>{stage}</em>
        </div>
      ))}
    </div>
  )
}

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

/**
 * A word that turns every 2.4 seconds and holds still under reduced motion.
 * Each candidate sits in the same grid cell at its own width, and the box
 * animates to the width of the word on show. So the line never reflows and
 * never leaves a hole where a longer word used to be.
 */
function TurningWord({ words, every = 2400 }: { words: readonly string[]; every?: number }) {
  const still = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [i, setI] = useState(0)
  const box = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (still) return
    const t = window.setInterval(() => setI((n) => (n + 1) % words.length), every)
    return () => window.clearInterval(t)
  }, [still, words, every])

  // Measure the word on show. The display font arrives after the first paint
  // and the headline resizes with the viewport, so measure again on both:
  // a width taken from fallback metrics would clip the last letter.
  useLayoutEffect(() => {
    const live = box.current?.querySelector('.turn-word') as HTMLElement | null
    if (!live) return
    const measure = () => setWidth(Math.ceil(live.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(live)
    window.addEventListener('resize', measure)
    let gone = false
    void document.fonts?.ready.then(() => { if (!gone) measure() })
    return () => { gone = true; ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [i, words])

  return (
    <span className="turn" ref={box} style={width ? { width } : undefined} aria-label={words.join(', ')}>
      {words.map((w, n) => (
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
            <h1>Your AI <TurningWord words={WHAT} every={3600} /> finds <br />high intent <TurningWord words={WHO} />.</h1>
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
          <div className="hiw">
            {STEPS.map((st) => (
              <article className="hiw-panel" key={st.n}>
                <div className="hiw-text">
                  <span className="hiw-badge">{st.n}</span>
                  <h3>{st.title}</h3>
                  <p>{st.note}</p>
                </div>
                <div className="hiw-visual">
                  <StepVisual n={st.n} />
                </div>
              </article>
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
              <b>Forever</b>
              <span>every lead is yours alone. Nobody else on the platform is ever handed the same handle</span>
            </div>
          </div>

          <div className="one-plan">
            <div className="plan dark">
              <span className="plan-tag">Everything</span>
              <p className="price">$99<small>a month</small></p>
              <ul>
                <li className="lead">
                  Up to 500 scored leads a day
                  <small>15,000 a month. $0.0066 a lead, scored, with the contact on the row.</small>
                </li>
                <li>Email and Instagram handle on every row</li>
                <li>Unlimited campaigns and agents</li>
                <li>API and MCP, same key, no extra tier</li>
                <li>Every lead yours alone. Forever</li>
                <li>Cancel any morning</li>
              </ul>
              <a className="btn primary" href="#access">Start 3 days free</a>
            </div>
          </div>
          <p className="section-lede compare">
            A database at $120 to $400 a month sells you a search box. You still find, vet and score each one.
            Here the list is done when you wake up.
          </p>
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
