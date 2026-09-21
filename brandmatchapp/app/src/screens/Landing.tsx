import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'

// The landing, rebuilt to the brief: hero, story, one ask.
//
// Cream ground, warm charcoal type, orange for the thing you click and purple
// for the numbers. One face, Satoshi, at two sizes that do the work: the
// display size the hero and the last ask share, and the reading size the
// story runs at. No boxes around the story, no grid of cards, no numbered
// steps. The page scrolls as one column of sentences that arrive a line at a
// time, and one mark sits on the outcome: bigger, orange, what brandmatch
// does. Everything before it is the same size and the same ink, because a
// page that marks its whole argument marks nothing.

const BADGE = 'New leads, scanned and scored every day'
const HEADLINE = 'First AI Agent that finds creators ready to close.'
const SUBHEAD = 'Describe the creator you want. Your agent scores every lead and delivers a fresh, qualified, ready-to-contact list, every day.'
const BRIEF_HINT = 'e.g. Fitness creators, 50k+ followers, active this week'

/** The one thing every button asks for, said the same way in both places. */
const CTA = 'Start my Campaign'

/** One line of the story. `out` marks what brandmatch does. */
type Line = { say: ReactNode; out?: true }

/**
 * The story, as paragraphs of lines.
 *
 * The outer array is the paragraph, which sets the breathing. The inner array
 * is the lines inside it, each on its own row, because a sentence that lands
 * alone reads slower than the same sentence in a block. A line arrives as it
 * is reached, one after the next, so the page is read rather than scanned.
 *
 * There is one mark on the page and it sits on the outcome: bigger, orange,
 * what brandmatch does. Everything that came before it is the same size and
 * the same ink, because a page that marks its whole argument marks nothing.
 */
const STORY: Line[][] = [
  [{ say: <>Built by two engineers, after four platforms failed us.</> }],
  [
    { say: <>We build mobile apps with content creators.</> },
    { say: <>Finding the right one ate our week, every week.</> },
  ],
  [
    { say: <>Collabstr worked, but payments lagged.</> },
    { say: <>14 creators got paid, 1 on time, 13 waited more than 14 days.</> },
  ],
  [
    { say: <>Topyappers gave us a list stuck in the past.</> },
    { say: <>Leads sat there for months without a refresh.</> },
  ],
  [{ say: <>Heepsy gave us contacts. Some numbers were dead, some people gone.</> }],
  [{ say: <>Modash sold us a list of 50,000 people. It closed 0 deals.</> }],
  [
    { say: <>So we built our own agent.</> },
    { say: <>One subscription now runs the full loop:</>, out: true },
    { say: <>search, qualify, outreach, and CRM, all connected.</> },
  ],
  [
    { say: <>The result: 3,000 profiles scanned a day turn into 200 qualified matches,</>, out: true },
    { say: <>already active and already earning from deals.</> },
  ],
  [
    { say: <>Replies land in your inbox, drafted and ready.</>, out: true },
    { say: <>Calls get booked while you sleep.</>, out: true },
    { say: <>Deals close in days, not weeks.</>, out: true },
  ],
]

/** The line the story lands on, set apart because it is the claim. */
const CLOSE = 'This is the same agent we sell you.'

/**
 * The ask, in two moves.
 *
 * The field takes the brief first, because that is the thing a reader already
 * has in their head and the cheapest thing to give. The address is asked for
 * second, once they have shown up, and the button keeps its label through
 * both so nothing moves under the cursor.
 */
function Start({ id }: { id?: string }) {
  const [step, setStep] = useState<'brief' | 'email'>('brief')
  const [brief, setBrief] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (state === 'done') {
    return <p className="start-done">You are on the list. We write when your first batch is ready.</p>
  }

  return (
    <form
      className="start"
      onSubmit={async (e) => {
        e.preventDefault()
        if (step === 'brief') { setStep('email'); return }
        setState('sending')
        try {
          await api.waitlist(email, brief)
          setState('done')
        } catch (err) {
          setState('error')
          setMessage(err instanceof Error ? err.message : 'That did not go through')
        }
      }}
    >
      <div className="start-field">
        {step === 'brief' ? (
          <input
            id={id}
            type="text"
            required
            placeholder={BRIEF_HINT}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            aria-label="The creator you want"
          />
        ) : (
          <input
            type="email"
            required
            autoFocus
            placeholder="you@yourbrand.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Your email"
          />
        )}
        <button className="start-go" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending' : CTA}
        </button>
      </div>
      {step === 'email' && <p className="start-note">Where we send your first list.</p>}
      {state === 'error' && <p className="start-error">{message}</p>}
      {/* The social proof row belongs here, once there is a real one to show. */}
    </form>
  )
}

/** True once the page has scrolled past the hero. */
function useFloated(after = 40): boolean {
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
 * A paragraph arrives as it is reached, so the story is told down the page.
 *
 * The class is what makes a paragraph visible, so anything that could keep
 * the observer from firing has to open them all instead: no observer in this
 * browser, and a reader who asked for stillness.
 */
function useTold(): void {
  useEffect(() => {
    const said = Array.from(document.querySelectorAll('.said'))
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || !('IntersectionObserver' in window)) {
      said.forEach((s) => s.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        io.unobserve(e.target)
      }),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.2 },
    )
    said.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])
}

export function Landing() {
  const floated = useFloated()
  useTold()
  return (
    <div className="landing lp">
      <header className={`lp-nav${floated ? ' floated' : ''}`}>
        <a className="brand" href="#/">
          <Logo size={22} />
          brandmatch
        </a>
        <span className="spacer" />
        <a className="lp-signin" href="#/signin">Sign in</a>
      </header>

      <section className="lp-hero">
        <p className="lp-badge">{BADGE}</p>
        <h1>{HEADLINE}</h1>
        <p className="lp-sub">{SUBHEAD}</p>
        <Start id="start-brief" />
      </section>

      <section className="lp-story">
        {STORY.map((para, i) => (
          <p className="said" key={i}>
            {para.map((line, j) => (
              <span
                key={j}
                className={line.out ? 'out' : undefined}
                style={{ '--i': j } as CSSProperties}
              >
                {line.say}
              </span>
            ))}
          </p>
        ))}
        <p className="said close">{CLOSE}</p>
      </section>

      <section className="lp-ask">
        <h2>Your next creator partner is already out there.</h2>
        <p className="lp-sub">Let your agent find them.</p>
        <Start />
      </section>

      <footer className="lp-foot">
        <span className="brand-word">brandmatch</span>
        <nav>
          <a href="mailto:hey@jeremylasne.com">Talk to us</a>
          <a href="#/signin">Sign in</a>
        </nav>
        <p>© 2026 brandmatch</p>
      </footer>
    </div>
  )
}
