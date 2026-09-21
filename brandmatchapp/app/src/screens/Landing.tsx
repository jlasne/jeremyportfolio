import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'

// The landing, rebuilt to the brief: hero, story, one ask.
//
// Cream ground, warm charcoal type, orange for the thing you click and purple
// for the numbers. One face, Satoshi, at two sizes that do the work: the
// display size the hero and the last ask share, and the reading size the
// story runs at. No boxes around the story, no grid of cards, no numbered
// steps. The page scrolls as one column of sentences, and three marks break
// the line: the figures, what a platform cost us, and what the agent gives
// back. The ground under the story turns from peach to purple at the sentence
// where we stopped buying lists, which is the whole argument in one colour.

const BADGE = 'New leads, scanned and scored every day'
const HEADLINE = 'First AI Agent that finds creators ready to close.'
const SUBHEAD = 'Describe the creator you want. Your agent scores every lead and delivers a fresh, qualified, ready-to-contact list, every day.'
const BRIEF_HINT = 'e.g. Fitness creators, 50k+ followers, active this week'

/** The one thing every button asks for, said the same way in both places. */
const CTA = 'Start my Campaign'

/** A figure in the story. Purple and a size up, so scrolling catches it. */
function N({ children }: { children: ReactNode }) {
  return <b className="n">{children}</b>
}

/** What a platform cost us. Peach behind it, the way a page gets marked up. */
function P({ children }: { children: ReactNode }) {
  return <mark className="pain">{children}</mark>
}

/** What the agent gives back. Purple, the colour every good number is in. */
function O({ children }: { children: ReactNode }) {
  return <mark className="win">{children}</mark>
}

/**
 * The story, as paragraphs of lines.
 *
 * The outer array is the paragraph, which sets the breathing. The inner array
 * is the lines inside it, each on its own row, because a sentence that lands
 * alone reads slower than the same sentence in a block.
 */
const STORY: ReactNode[][] = [
  [<>Built by two engineers, after <P>four platforms failed us.</P></>],
  [
    <>We build mobile apps with content creators.</>,
    <>Finding the right one <P>ate our week, every week.</P></>,
  ],
  [
    <>Collabstr worked, but <P>payments lagged.</P></>,
    <><N>14</N> creators got paid, <N>1</N> on time, <N>13</N> waited more than <N>14</N> days.</>,
  ],
  [
    <>Topyappers gave us a list <P>stuck in the past.</P></>,
    <>Leads sat there for months without a refresh.</>,
  ],
  [<>Heepsy gave us contacts. <P>Some numbers were dead, some people gone.</P></>],
  [<>Modash sold us a list of <N>50,000</N> people. <P>It closed <N>0</N> deals.</P></>],
  [
    <>So we built our own agent.</>,
    <>One subscription now <O>runs the full loop:</O> search, qualify, outreach, and CRM, all connected.</>,
  ],
  [<>The result: <N>3,000</N> profiles scanned a day turn into <N>200</N> qualified matches, <O>already active and already earning from deals.</O></>],
  [
    <>Replies land in your inbox, drafted and ready.</>,
    <>Calls get booked while you sleep.</>,
    <><O>Deals close in days, not weeks.</O></>,
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
            {para.map((line, j) => <span key={j}>{line}</span>)}
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
