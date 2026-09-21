import { useEffect, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'

// The landing, in five blocks: hero, film, the three steps, the story, one ask.
// Cream ground, one orange accent, wide corners, and no photography: every
// picture on this page is drawn from the same parts as the app.
//
// The middle of the page is now a story rather than a feature list, because
// proof that starts with pain converts better than a promise. Four platforms
// took our money and our months. Each one is named, with the number it cost
// us, and the agent lands after them as the answer to a bill already shown.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** The one thing every button asks for, said the same way in every place. */
const CTA = 'Start my Campaign'

/** Under the hero, once. Who the page is for, in their own words. */
const TRUST = 'Built for brands sick of searching manually and buying outdated datasets. We deliver fresh leads daily.'

/** What the money buys. Outcomes, in the order they happen. */
const HAS = [
  'A fresh search every night, run by agents',
  'Every lead cleared against your own bar',
  'The first message sent in your name',
  'The follow up sent for you, on time',
  'Every lead yours alone, forever',
  'Cancel any morning',
]

/**
 * The four bills, in the order we paid them.
 *
 * One number each, the one that ended the contract, because a number a reader
 * can hold beats a paragraph they skim. Every line is what the platform did,
 * never what we think of it: a complaint invites an argument, a receipt does
 * not.
 */
const FAILURES: { name: string; figure: string; unit: string; note: string }[] = [
  {
    name: 'Collabstr',
    figure: '1',
    unit: 'of 14 delivered on time',
    note: 'The marketplace worked. Payment lagged. We picked 14 creators, 7 cancelled after the deadline, and we cancelled the rest.',
  },
  {
    name: 'TopYappers',
    figure: '27M',
    unit: 'rows, sold to everyone',
    note: 'An old export, priced per thousand. We paid for the same database every other brand downloads the same week.',
  },
  {
    name: 'Heepsy',
    figure: '86%',
    unit: 'of numbers were dead',
    note: 'Contacts arrived in bulk. 86% of numbers rang out, 70% of emails bounced, and the rest came with fields missing.',
  },
  {
    name: 'Modash',
    figure: '0',
    unit: 'deals from 50,000 names',
    note: 'A list of 50,000 people, part of them in our niche. We worked it for weeks and closed nothing.',
  },
]

/** What the agent does between midnight and your coffee. */
const LOOP: { verb: string; what: string }[] = [
  { verb: 'Searches', what: 'New people, every night, in the places your buyers post.' },
  { verb: 'Qualifies', what: 'Every profile read and scored against your own brief.' },
  { verb: 'Reaches out', what: 'The first message goes out in your name, on time.' },
  { verb: 'Logs', what: 'Every send, open and reply lands in your CRM.' },
]

/**
 * The three bars, said as the reason a reply comes back. Each one carries the
 * measurement behind it, because "highly relevant" is a word and "active in
 * the last 3 days" is a fact.
 */
const QUALIFIED: { name: string; means: string }[] = [
  {
    name: 'In your niche',
    means: 'Matched to your offer on the requirements you write, past the point where a follower count stops telling you anything.',
  },
  {
    name: 'Active',
    means: 'Posts on a schedule, and posted in the last 3 days. They open the app the day your message lands.',
  },
  {
    name: 'Intent',
    means: 'Runs the account as a business, already sells products or takes collabs. This is the bar that moves reply rate.',
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
 * A day of work, drawn. Wide at the top where the agents look, narrow at the
 * bottom where the list you actually read begins. The shape carries the ratio
 * on its own, so the numbers beside it only have to name the two ends.
 */
function Funnel() {
  return (
    <div className="night">
      <div className="night-end top">
        <b>3,000</b>
        <span>profiles scanned a day</span>
      </div>
      <div className="night-cone" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="night-end bottom">
        <b>200</b>
        <span>qualified matches</span>
      </div>
      <p className="night-ratio">1 in 15 survives the night</p>
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
            <a href="#story">Our story</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <span className="spacer" />
          <a className="land-signin" href="#/signin">Sign in</a>
          <a className="btn primary" href="#access">{CTA}</a>
        </header>

        <div className="hero-block">
          <section className="hero">
            <div className="hero-copy">
              <h1>Your AI agent finds content creators <em>ready to close a deal.</em></h1>
              <p className="lede">
                Describe the creator you want. Your agent scores every lead and delivers a fresh, qualified,
                ready-to-contact list, every day.
              </p>
              <EarlyAccess website="strongher.co" />
              <p className="hero-trust">{TRUST}</p>
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

        <section className="land-section" id="story">
          <p className="eyebrow">Our story</p>
          <h2 className="big">We built our dreamed <em>deal gen AI agent.</em></h2>
          <p className="section-lede">
            Built by two engineers, after four platforms failed us. We build mobile apps with content creators.
            Finding the right ones, and running the outreach, ate our time and our budget.
          </p>

          <p className="ledger-head">Four platforms. Four bills.</p>
          <ol className="ledger">
            {FAILURES.map((f, i) => (
              <li className="bill" key={f.name}>
                <span className="bill-n">{String(i + 1).padStart(2, '0')}</span>
                <b className="bill-name">{f.name}</b>
                <span className="bill-figure">{f.figure}</span>
                <span className="bill-unit">{f.unit}</span>
                <p className="bill-note">{f.note}</p>
              </li>
            ))}
          </ol>

          <div className="turn-line">
            <h3>So we built our own agent.</h3>
            <p>It runs the full loop, every day, while you sleep.</p>
          </div>

          <ol className="loop">
            {LOOP.map((l, i) => (
              <li key={l.verb}>
                <span className="loop-n">{i + 1}</span>
                <b>{l.verb}</b>
                <p>{l.what}</p>
              </li>
            ))}
          </ol>
          <p className="loop-cycle"><i aria-hidden="true" />Repeats every day</p>

          <div className="result">
            <div className="result-figure">
              <p className="eyebrow">The result</p>
              <h3>3,000 profiles scanned a day turn into <em>200 qualified matches.</em></h3>
              <Funnel />
            </div>
            <div className="result-bars">
              <p className="bars-head">What is qualified?</p>
              <div className="tests-row">
                {QUALIFIED.map((q) => (
                  <div className="test" key={q.name}>
                    <b>{q.name}</b>
                    <span>{q.means}</span>
                  </div>
                ))}
              </div>
              <p className="tests-after">This is what brandmatch is about.</p>
            </div>
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
        </section>

        <section className="land-cta" id="access">
          <h2>Your next deal <em>is tomorrow.</em></h2>
          <p>Let your agent find them.</p>
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
            <a href="#story">Our story</a>
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
