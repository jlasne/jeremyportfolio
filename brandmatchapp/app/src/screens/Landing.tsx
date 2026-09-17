import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'
import art from '../art/creator-cards.png'

// The landing, in six blocks: hero, video, the four steps, the two ways in,
// one price, one ask. Cream ground, one orange accent, wide corners.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** What the creators on your list have already done. The turn is the point. */
const WHO = ['take deals', 'post weekly', 'highly perform', 'sell already', 'reply']

/** What both prices include. Said once, under them. */
const HAS = [
  'Up to 500 scored leads a day',
  'Email and Instagram handle on every row',
  'Unlimited campaigns and agents',
  'API and MCP on the same key',
  'Every lead yours alone, forever',
  'Cancel any morning',
]

/** Said in three, under the buttons, the way a launch says them. */
const FACTS = ['500 a day', 'Email on the row', 'Yours alone, forever']

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

/**
 * The one thing every button asks for, said the same way in every place.
 * When the doors open this becomes 'Start for free' and the page follows.
 */
const CTA = 'Get early access'

/** The three tests a lead passes before it reaches your list. */
const TESTS: { name: string; means: string }[] = [
  { name: 'Intent', means: 'They take brand deals already: a sponsored post, rates in the bio, a media kit.' },
  { name: 'Active', means: 'They posted this week. A dormant account is a dead lead however big it is.' },
  { name: 'Scope', means: 'They are in your niche, judged against your own words, not a category tag.' },
]

/** Where the config block goes. Named, so nobody wonders about theirs. */
const CLIENTS = ['Claude', 'Claude Code', 'Cursor', 'Codex', 'VS Code', 'Windsurf', 'Zed', 'any MCP client']

const STEPS = [
  {
    n: '1/3',
    title: 'We learn what you sell',
    note: 'Your website goes in. Out comes who to reach and three agents to go and find them. You approve before anything searches.',
    tick: 'One minute, once',
  },
  {
    n: '2/3',
    title: 'We find who is ready',
    note: 'The agents search every night, then cut. What is left is ranked best first, by how ready each one is to take a deal.',
    tick: 'Runs while you sleep',
  },
  {
    n: '3/3',
    title: 'You write and close',
    note: 'The handle and the email sit on the row. Open the list, send, and move each one along as they answer.',
    tick: 'The only step left for you',
  },
]

/** One visual per step, built from the same parts as the app. */
function StepVisual({ n }: { n: string }) {
  if (n === '1/3') {
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
  if (n === '2/3') {
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
        {state === 'sending' ? 'Sending' : CTA}
      </button>
      {state === 'error' && <span className="waitlist-error">{message}</span>}
    </form>
  )
}

/**
 * A word that turns every 2.4 seconds and holds still under reduced motion.
 * Each candidate sits in the same grid cell at its own width, and the box takes
 * the width of the word on show. So the line never leaves a hole where a longer
 * word used to be. The width changes with the word rather than easing into it:
 * a box easing open clips the incoming word mid-letter for the whole ease.
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

/** True once the page has scrolled past the hero. */
function useFloated(after = 120): boolean {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const read = () => setPast(window.scrollY > after)
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [after])
  return past
}

/** The nav links name sections, not routes. Take the page to them. */
function useSectionScroll(): void {
  useEffect(() => {
    const go = () => {
      const id = window.location.hash.replace(/^#\/?/, '')
      if (!id || id.includes('/')) return
      const el = document.getElementById(id)
      if (el) window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    go()
    window.addEventListener('hashchange', go)
    return () => window.removeEventListener('hashchange', go)
  }, [])
}

export function Landing() {
  const floated = useFloated()
  useSectionScroll()
  return (
    <>
      <Backdrop />
      <div className="landing">
        <div className="land-banner">
          <span>Early access</span>
          <i aria-hidden="true" />
          <span><b>500 scored leads a day</b> for $99 a month</span>
          <i aria-hidden="true" />
          <a href="#access">Get in →</a>
        </div>

        <header className={`land-nav${floated ? ' floated' : ''}`}>
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
          <a className="btn primary" href="#access">{CTA}</a>
        </header>

        <div className="hero-block">
          <section className="hero">
            <h1>Find creators <br />who <TurningWord words={WHO} />.</h1>
            <p className="lede">
              Enter your website. Every morning you get 500 creators who take brand deals, ranked, with the email on
              the row.
            </p>
            <EarlyAccess website="strongher.co" />
            <p className="hero-meta">
              {FACTS.map((f, i) => (
                <span key={f}>{i > 0 && <i aria-hidden="true" />}{f}</span>
              ))}
            </p>
            <img className="hero-art" src={art} alt="" width={1254} height={1254} />
          </section>

          <div className="video-wrap">
            <ProductVideo />
          </div>
        </div>

        <section className="land-section" id="how">
          <p className="eyebrow">How it works</p>
          <h2 className="big">Three steps. <em>You do the last one.</em></h2>
          <p className="section-lede">
            A qualified list, not a directory dump. Here is how it gets built while you sleep.
          </p>

          <div className="steps3">
            {STEPS.map((st, i) => (
              <article className="step3" key={st.n}>
                <div className="step3-art">
                  <StepVisual n={st.n} />
                </div>
                <span className="step3-n">{i + 1}</span>
                <h3>{st.title}</h3>
                <p>{st.note}</p>
                <span className="step3-tick">{st.tick}</span>
              </article>
            ))}
          </div>

          <div className="tests">
            <p className="tests-head">Every lead passes three tests, or it never reaches you.</p>
            <div className="tests-row">
              {TESTS.map((t) => (
                <div className="test" key={t.name}>
                  <b>{t.name}</b>
                  <span>{t.means}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section" id="ways">
          <p className="eyebrow">Connect your agent</p>
          <h2 className="big">Built for agents. <em>Yours drives it.</em></h2>
          <p className="section-lede">
            brandmatch is built for an agent to drive. Yours reads the list, scores it, moves each lead along a
            stage and starts the next search, on your key. The app is the same account, for when you want to look.
          </p>

          <div className="connect">
            <div className="connect-code">
              <pre><code>{MCP_CONFIG}</code></pre>
            </div>
            <div className="connect-side">
              <span className="connect-where">Add it to</span>
              <ul className="clients">
                {CLIENTS.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <a className="btn primary" href="#access">{CTA}</a>
            </div>
          </div>

          <ul className="connect-notes">
            <li>Ask in words: who fired a brand signal this week</li>
            <li>Nine tools, one key: read, score, classify, create, approve, pause</li>
            <li>What your agent writes is what the app shows, because the app is the CRM</li>
          </ul>
        </section>

        <section className="land-section centred" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2 className="big">One plan. <em>One price.</em></h2>
          <p className="section-lede">
            Everything, for every account, at one number. Three days free before it starts.
          </p>

          <div className="one-price">
            <p className="price"><span className="now">$99</span><small>a month</small></p>
            <ul className="plan-has">
              {HAS.map((h) => <li key={h}>{h}</li>)}
            </ul>
            <a className="btn primary" href="#access">{CTA}</a>
            <p className="price-note">Three days free. No card to start.</p>
          </div>

          <p className="section-lede compare">
            A database at $120 to $400 a month sells you a search box. You still find, vet and score each one.
            Here the list is done when you wake up.
          </p>
          <p className="section-lede">
            Need more than 500 a day? <a href="mailto:hey@jeremylasne.com">Chat with me</a> and we size it together.
          </p>
        </section>

        <section className="land-cta" id="access">
          <h2>Your next deal <em>is already out there.</em></h2>
          <p>Leave your email. We open in batches and write the morning yours is ready.</p>
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
            <a href="mailto:hey@jeremylasne.com">Chat with me</a>
          </div>
          <p className="copy">© 2026 brandmatch. Creators for your brand, every morning.</p>
        </footer>
      </div>
    </>
  )
}
