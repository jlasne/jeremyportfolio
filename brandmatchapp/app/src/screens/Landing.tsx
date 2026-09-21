import { useEffect, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'

// The landing, in three beats: a hero, a story, one ask.
//
// It used to be a page of sections, each with an eyebrow and a heading, which
// is a brochure: the reader picks the part they want and leaves. A story has
// no menu. It opens on the agent we built, puts the four platforms that
// failed us in a table you can read straight down, and ends on the number
// that makes the case. The thread down the left says there is one thing to
// read, and the only thing to do is at the bottom of it.

/** The one thing every button asks for, said the same way in every place. */
const CTA = 'Start my Campaign'

/** Under the hero, once. Who the page is for, in their own words. */
const TRUST = 'Built for brands sick of searching manually and buying outdated datasets. We deliver fresh leads daily.'

/**
 * The four platforms, as a table rather than four cards.
 *
 * A table is the one shape that lets a reader compare without being told
 * what to conclude: same columns, four rows, one result each. The result
 * column carries the number that ended the contract, because a number a
 * reader can hold beats a paragraph they skim. Every line is what the
 * platform did, never what we think of it.
 */
const FAILURES: { name: string; result: string; what: string }[] = [
  {
    name: 'Collabstr',
    result: '1 of 14',
    what: 'It worked, but payments lagged. We selected 14 creators. 1 delivered on time, 7 cancelled after the deadline. We cancelled the rest.',
  },
  {
    name: 'TopYappers',
    result: 'Outdated list',
    what: 'It gave us an outdated list. We bought the same database everyone buys.',
  },
  {
    name: 'Heepsy',
    result: '86% dead',
    what: 'It gave us contacts. 86% of numbers were dead, 70% of emails wrong, information missing.',
  },
  {
    name: 'Modash',
    result: '0 deals',
    what: 'It sold us a list of 50,000 people, partially in our niche. It closed 0 deals.',
  },
]

/** What the agent does between midnight and your coffee. */
const LOOP = [
  'Searches new people',
  'Qualifies them against your need',
  'Reaches out to them',
  'Logs every interaction in the CRM',
]

/**
 * The three bars, said as the reason a reply comes back. Each one carries the
 * measurement behind it, because "highly relevant" is a word and "active in
 * the last 3 days" is a fact.
 */
const QUALIFIED: { name: string; means: string }[] = [
  {
    name: 'In your niche',
    means: 'Fits your offer on filters and specific requirements, past the classic follower count.',
  },
  {
    name: 'Active',
    means: 'Posts content regularly, and was active in the last 3 days.',
  },
  {
    name: 'Intent',
    means: 'Runs as a business, already does collabs or sells products. Reply rate climbs.',
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
        {state === 'sending' ? 'Sending' : CTA}
      </button>
      {state === 'error' && <span className="waitlist-error">{message}</span>}
    </form>
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
            <h2>We built our dreamed <em>deal gen AI agent.</em></h2>
            <p>Built by two engineers, after four platforms failed us.</p>
            <p>
              We build mobile apps with content creators. Finding the right ones, creating outreach campaigns
              destroyed our time management and budget.
            </p>
          </div>

          <div className="beat">
            <h2>We tried four platforms.</h2>
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Platform</th>
                  <th scope="col">Result</th>
                  <th scope="col">What happened</th>
                </tr>
              </thead>
              <tbody>
                {FAILURES.map((f) => (
                  <tr key={f.name}>
                    <th scope="row">{f.name}</th>
                    <td className="fig">{f.result}</td>
                    <td className="what">{f.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="beat">
            <h2>So we built our own agent.</h2>
            <p>It runs the full loop, every day:</p>

            <ol className="loop">
              {LOOP.map((step, i) => (
                <li key={step}>
                  <span className="loop-n">{i + 1}</span>
                  <b>{step}</b>
                </li>
              ))}
            </ol>
            <p className="loop-cycle"><i aria-hidden="true" />Repeats every day</p>
          </div>

          <div className="beat">
            <h2>The result: 3,000 profiles scanned/day turned into <em>200 qualified matches.</em></h2>

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
        </section>

        <footer className="land-foot">
          <div className="foot-say">
            <span className="brand-word">brandmatch</span>
            <p className="foot-head">Your AI agent finds content creators <em>ready to close a deal.</em></p>
            <p className="muted">Instagram today, TikTok and YouTube next.</p>
          </div>
          <div className="foot-links">
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
