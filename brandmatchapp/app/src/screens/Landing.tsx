import { useEffect, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'

// The landing, in three beats: a hero, a story, one ask.
//
// It used to be a page of sections, each with an eyebrow and a heading, which
// is a brochure: the reader picks the part they want and leaves. A story has
// no menu. It opens on the work we do, names the four platforms that took our
// money, turns at the agent we built instead, and ends on the number that
// makes the case. The thread down the left says there is one thing to read,
// and the only thing to do is at the bottom of it.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** The one thing every button asks for, said the same way in every place. */
const CTA = 'Start my Campaign'

/** Under the hero, once. Who the page is for, in their own words. */
const TRUST = 'Built for brands sick of searching manually and buying outdated datasets. We deliver fresh leads daily.'

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

/**
 * A night of work, drawn. Wide at the top where the agents look, narrow at the
 * bottom where the list you actually read begins. The shape carries the ratio
 * on its own, so the numbers beside it only have to name the two ends.
 */
function Night() {
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
 * The product in one take, shown at the turn of the story rather than under
 * the headline. The reader meets it at the line where we stopped buying lists
 * and built the thing instead.
 *
 * Until the film exists, the frame holds the live demo behind a play button.
 * Drop the file in `app/src/video/` and set VIDEO_URL: the frame keeps its
 * shape and plays the real thing instead.
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

/**
 * A beat arrives when it is reached, so the page is told rather than dumped.
 *
 * The class is what makes a beat visible, so anything that could keep the
 * observer from firing has to open them all instead: no observer in this
 * browser, and a reader who asked for stillness.
 */
function useTold(): void {
  useEffect(() => {
    const beats = Array.from(document.querySelectorAll('.beat'))
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || !('IntersectionObserver' in window)) {
      beats.forEach((b) => b.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        io.unobserve(e.target)
      }),
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    )
    beats.forEach((b) => io.observe(b))
    return () => io.disconnect()
  }, [])
}

export function Landing() {
  const floated = useFloated()
  useTold()
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

        {/* No section links: there are no sections to jump to. */}
        <header className={`land-nav${floated ? ' floated' : ''}`}>
          <a className="brand" href="#/">
            <Logo size={24} />
            brandmatch
          </a>
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
        </div>

        <section className="story" id="story">
          <span className="thread" aria-hidden="true" />

          <div className="beat">
            <p className="beat-lead">We build mobile apps with content creators.</p>
            <p>
              Two engineers, shipping apps. Finding the right creators, and running the outreach behind every
              launch, ate our weeks and our budget.
            </p>
          </div>

          <div className="beat">
            <h2>So we paid four platforms to fix it.</h2>
            <ol className="bills">
              {FAILURES.map((f) => (
                <li className="debt" key={f.name}>
                  <div className="debt-fig">
                    <span className="debt-figure">{f.figure}</span>
                    <span className="debt-unit">{f.unit}</span>
                  </div>
                  <div className="debt-body">
                    <b>{f.name}</b>
                    <p>{f.note}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="beat-close">
              Four invoices, four months, and still no repeatable way to reach one creator ready to sign.
            </p>
          </div>

          <div className="beat">
            <h2>So we built our own agent.</h2>
            <p>It runs the full loop, every day, while you sleep.</p>

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

            <ProductVideo />
          </div>

          <div className="beat">
            <h2>3,000 profiles scanned a day turn into <em>200 qualified matches.</em></h2>
            <Night />

            <div className="bars">
              <p className="bars-head">What is qualified?</p>
              <div className="bars-row">
                {QUALIFIED.map((q) => (
                  <div className="qual" key={q.name}>
                    <b>{q.name}</b>
                    <span>{q.means}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="beat-close last">This is what brandmatch is about.</p>
          </div>
        </section>

        <section className="land-cta" id="access">
          <h2>Your next deal <em>is tomorrow.</em></h2>
          <p>Let your agent find them.</p>
          <EarlyAccess />
          <p className="cta-terms">
            One call, then three days free. Cancel any morning. <a href="mailto:hey@jeremylasne.com">Talk to us</a>
          </p>
        </section>

        <footer className="land-foot">
          <div>
            <span className="brand-word">brandmatch</span>
            <p className="muted" style={{ marginTop: 8 }}>
              Daily qualified leads for your business. Instagram today, TikTok and YouTube next.
            </p>
          </div>
          <div>
            <h4>Get in</h4>
            <a href="#access">Early access</a>
            <a href="mailto:hey@jeremylasne.com">Talk to us</a>
            <a href="#/signin">Sign in</a>
          </div>
          <p className="copy">© 2026 brandmatch. Daily qualified leads for your business.</p>
        </footer>
      </div>
    </>
  )
}
