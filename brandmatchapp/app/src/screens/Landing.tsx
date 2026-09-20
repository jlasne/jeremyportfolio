import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'

// The landing, in six blocks: hero, film, the three steps, why they answer,
// what a database is instead, one ask. Cream ground, one orange accent, wide
// corners, and no photography: every picture on this page is drawn from the
// same parts as the app, so the page weighs a tenth of what it did and says
// something true while it loads.
//
// Every line on it is an outcome. What the product does is on the page only
// where it explains why the outcome happens.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** What the people on your list do, not what we did to find them. */
const WHO = ['are ready to buy', 'already spend', 'post today', 'reply']

/** What the money buys. Outcomes, in the order they happen. */
const HAS = [
  'A fresh search every night, run by agents',
  'Every lead cleared against your own bar',
  'The first message sent in your name',
  'The follow up sent for you, on time',
  'Every lead yours alone, forever',
  'Cancel any morning',
]

/** Said in three, under the buttons, the way a launch says them. */
const FACTS = ['Searched last night', 'In your niche, active, spending', 'Yours alone, forever']

/**
 * The one thing every button asks for, said the same way in every place.
 * When the doors open this becomes 'Start for free' and the page follows.
 */
const CTA = 'Get early access'

/**
 * The three bars every lead clears, said as the reason they answer. Each one
 * carries the measurement behind it, because "highly relevant" is a word and
 * "12k views on a typical post" is a fact.
 */
const TESTS: { name: string; means: string }[] = [
  {
    name: 'In your niche',
    means: 'Judged against your own two sentences. They sell to the audience you sell to, so your first line already fits.',
  },
  {
    name: 'Active this week',
    means: 'Posted in the last 14 days, around 12k views on a typical post. They open the app the day your message lands.',
  },
  {
    name: 'Spending today',
    means: 'A paid offer at a public price, tools in the bio, partnerships in the feed. The money is already moving when you arrive.',
  },
]

/**
 * The category we are not in, named.
 *
 * Every line is about how the thing works, never about how good it is, and
 * every number is the one they publish themselves. A comparison that invents
 * a fault is a comparison a reader checks and stops trusting.
 */
const RIVALS: { name: string; meta: string; how: string }[] = [
  {
    name: 'Collabstr',
    meta: '1M creators, opted in',
    how: 'The creators who signed up to be hired, shown to everyone who signs up to hire. Your competitor writes to the same person on the same day.',
  },
  {
    name: 'Modash',
    meta: '350M profiles, stored',
    how: 'A search box and 350 million rows behind it. The reading, the judging and the writing land on your morning, one profile at a time.',
  },
  {
    name: 'TopYappers',
    meta: '27M creators, exportable',
    how: 'Twenty seven million rows you can export by the thousand. A bigger file is a longer afternoon spent deciding who is worth a message.',
  },
]

const STEPS = [
  {
    n: '1/3',
    title: 'You tell us what you sell',
    note: 'Who you want to reach, and what you sell them. Two sentences, in your own words. That is the whole of your part.',
    tick: 'Two minutes, once',
  },
  {
    n: '2/3',
    title: 'Agents go and find them tonight',
    note: 'They search while you sleep, read the last twelve posts of everyone they find, and keep the ones who clear your bar.',
    tick: 'New every morning',
  },
  {
    n: '3/3',
    title: 'We write first, and we follow up',
    note: 'The opening message goes out in your name. The follow up goes out on time. You step in the moment somebody replies.',
    tick: 'You step in at the reply',
  },
]

/** One visual per step, built from the same parts as the app. */
function StepVisual({ n }: { n: string }) {
  if (n === '1/3') {
    return (
      <div className="viz viz-icp">
        <div className="viz-input"><span className="viz-caret" />Women lifting coaches</div>
        <div className="viz-arrow" aria-hidden="true" />
        <div className="viz-brief">
          <span className="viz-label">Your filters</span>
          <p>15k to 400k followers, posted in the last 14 days, 12k views on a typical post, US and UK, English.</p>
          <div className="viz-chips">
            <span>Strength</span><span>Postnatal</span><span>Rehab</span>
          </div>
        </div>
      </div>
    )
  }
  if (n === '2/3') {
    // The simulation, in four bands. The last one is the answer: what a night
    // of searching leaves standing.
    const bands: [string, string, number][] = [
      ['Searches run', '8,000', 100],
      ['Big and active enough', '1,000', 46],
      ['In a niche you want', '920', 42],
      ['Qualified leads', '640', 29],
    ]
    return (
      <div className="viz viz-sim">
        <p className="viz-sim-head"><b>1 in 12</b> searches becomes a lead</p>
        <ul>
          {bands.map(([label, count, width], i) => (
            <li key={label} className={i === bands.length - 1 ? 'last' : undefined}>
              <span>{label}</span>
              <i style={{ width: `${width}%` }} aria-hidden="true" />
              <b>{count}</b>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  // The third step is the part nobody wants to do, so the visual is the
  // thread rather than the list: sent, chased, answered.
  const rows = [
    ['liftwithmaya', 'replied', true],
    ['jennakstrong', 'followed up', true],
    ['sophie.souleve', 'followed up', true],
    ['priyalifts', 'sent', false],
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

/**
 * The product in one take.
 *
 * Until the film exists, the frame holds the live demo behind a play button,
 * so the slot reads as a video and still shows something moving. Drop the
 * file in `app/src/video/` and set VIDEO_URL: the frame keeps its shape and
 * plays the real thing instead.
 */
function ProductVideo() {
  const [playing, setPlaying] = useState(false)

  if (VIDEO_URL && playing) {
    return (
      <div className="film">
        <video className="film-media" src={VIDEO_URL} controls autoPlay playsInline />
      </div>
    )
  }

  return (
    <figure className="film">
      <div className="film-frame">
        <HeroDemo />
        <button
          type="button"
          className="film-play"
          onClick={() => setPlaying(true)}
          disabled={!VIDEO_URL}
          aria-label={VIDEO_URL ? 'Play the film' : 'The film is on its way'}
        >
          <span className="film-play-mark" aria-hidden="true" />
          <span className="film-play-text">{VIDEO_URL ? 'Play the film' : 'Film on its way'}</span>
        </button>
      </div>
      <figcaption className="film-cap">
        {VIDEO_URL ? 'Sixty seconds, start to first lead.' : 'Sixty seconds, start to first lead. Recording now.'}
      </figcaption>
    </figure>
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
          <span>We open in batches of <b>20</b></span>
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
            <a href="#why">Why they answer</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <span className="spacer" />
          <a className="btn primary" href="#access">{CTA}</a>
        </header>

        <div className="hero-block">
          <section className="hero">
            <div className="hero-copy">
              <h1>Daily qualified leads<br />who <TurningWord words={WHO} />.</h1>
              <p className="lede">
                Tell us what you sell. Agents search for your buyers every night, keep the ones worth your time, write
                the first message and follow up. You step in when somebody replies.
              </p>
              <EarlyAccess website="strongher.co" />
              <p className="hero-meta">
                {FACTS.map((f, i) => (
                  <span key={f}>{i > 0 && <i aria-hidden="true" />}{f}</span>
                ))}
              </p>
            </div>
          </section>

          <div className="video-wrap">
            <ProductVideo />
          </div>
        </div>

        <section className="land-section" id="how">
          <p className="eyebrow">How it works</p>
          <h2 className="big">You write two sentences. <em>We do the rest.</em></h2>
          <p className="section-lede">
            Three steps, and two of them are ours. Your morning starts at the reply.
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
        </section>

        <section className="land-section" id="why">
          <p className="eyebrow">Why they answer</p>
          <h2 className="big">Every lead clears three bars. <em>That is why they answer.</em></h2>
          <p className="section-lede">
            A name and a follower count is a guess. These three are measured on every person, the night before you
            see them.
          </p>

          <div className="tests">
            <div className="tests-copy">
              <div className="tests-row">
                {TESTS.map((t) => (
                  <div className="test" key={t.name}>
                    <b>{t.name}</b>
                    <span>{t.means}</span>
                  </div>
                ))}
              </div>
              <p className="tests-after">
                Then every one is scored from 0 to 100 against your own words, and your morning starts at the top of
                that list.
              </p>
            </div>
          </div>
        </section>

        <section className="land-section" id="versus">
          <p className="eyebrow">The difference</p>
          <h2 className="big">A database hands you 350 million names. <em>We hand you ten.</em></h2>
          <p className="section-lede">
            One is a search box you work every morning. The other is a morning that is already worked.
          </p>

          <div className="versus">
            {RIVALS.map((r) => (
              <article className="versus-one" key={r.name}>
                <b>{r.name}</b>
                <span className="versus-meta">{r.meta}</span>
                <p>{r.how}</p>
              </article>
            ))}
          </div>

          <div className="versus-us">
            <div>
              <b>brandmatch</b>
              <span className="versus-meta">Found last night, written to this morning</span>
            </div>
            <p>
              Agents go looking tonight, for you alone. By 06:00 the people worth your time are on your list, the
              first message is out, and the follow up is scheduled. Your rows stay yours.
            </p>
          </div>
        </section>

        <section className="land-section centred" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2 className="big">One number, built on your volume.</h2>
          <p className="section-lede">
            Up to 3,000 fresh leads a day. What you pay follows how many you take, and how wide we search to find
            them.
          </p>

          <div className="one-price">
            <p className="price"><span className="now">3,000</span><small>fresh leads a day</small></p>
            <ul className="plan-has">
              {HAS.map((h) => <li key={h}>{h}</li>)}
            </ul>
            <a className="btn primary" href="mailto:hey@jeremylasne.com">Talk to us</a>
            <p className="price-note">One call, then three days free.</p>
          </div>

          <p className="section-lede compare">
            A subscription to a database buys you the same rows as everyone else on it. This buys you the mornings
            back.
          </p>
        </section>

        <section className="land-cta" id="access">
          <h2>Your next deal <em>is already out there.</em></h2>
          <p>Leave your email. We open in batches of 20 and write the morning yours is ready.</p>
          <EarlyAccess />
        </section>

        <footer className="land-foot">
          <div>
            <span className="brand-word">brandmatch</span>
            <p className="muted" style={{ marginTop: 8 }}>
              Daily qualified leads for your business. Instagram today, TikTok and YouTube next.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#how">How it works</a>
            <a href="#why">Why they answer</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <h4>Get in</h4>
            <a href="#access">Early access</a>
            <a href="mailto:hey@jeremylasne.com">Talk to us</a>
          </div>
          <p className="copy">© 2026 brandmatch. Daily qualified leads for your business.</p>
        </footer>
      </div>
    </>
  )
}
