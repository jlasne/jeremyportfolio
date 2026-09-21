import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import GlyphPortal from '../components/GlyphPortal'
import sky from '../art/bg.webp'
import { api } from '../lib/api'

// The landing, as one page you scroll into.
//
// The hero is the name, set as big as the screen allows, and the only things
// beside it are one line and the field. Scrolling drives a camera into the
// counter of a letter, and what is on the other side of it is the six cards
// and the last ask, over the sunrise.
//
// The portal freezes whatever face is loaded at mount, so it waits for
// Satoshi's heaviest cut before it goes up. Without that wait a fallback face
// is measured, the camera aims at the wrong ink, and the component falls back
// to a still frame.

/** The tagline the portal is set in. 41 characters, so 63px on a desktop. */
const TAGLINE = 'Your AI agent finds high intent creators.'
/** A phone gives the tagline 17px, which is a caption. It gets the name. */
const WORD = 'BRANDMATCH'
const BRIEF_HINT = 'e.g. Fitness creators, 50k+ followers, active this week'

/** Under the word, once. The two words the whole page turns on take colour. */
const SUBTAG = [
  { w: 'Describe the creators you want. Your agent learns and identifies them. Not generic and outdated: searched for you, ' },
  { w: 'active and high intent', hot: true },
  { w: ', every day.' },
]

const CTA = 'Start my Campaign'

/** The line that says who wrote the page, kept when the story went. */
const PROOF = 'Built by two engineers, after four platforms gave us generic outdated leads.'

/**
 * Six marks, drawn from the same parts as everything else on this page: one
 * stroke weight, round caps, no fill. They label a card, so they carry no
 * detail a reader would have to stop and work out.
 */
const ICONS: Record<string, ReactNode> = {
  fresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 3.5v5h-5" /></>,
  reply: <><path d="M20.5 12.8a7.7 7.7 0 0 1-8.3 7.7L4 21.5l1-4.2A7.7 7.7 0 1 1 20.5 12.8Z" /><path d="m11.8 9.2-2.4 2.4 2.4 2.4" /><path d="M9.4 11.6h3.4a2.8 2.8 0 0 1 2.8 2.8" /></>,
  niche: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" /></>,
  human: <><path d="M3.5 4.5h17l-6.6 7.8v6.4l-3.8 2.3v-8.7Z" /><path d="M16.8 3 18 5.6 20.6 6.8 18 8l-1.2 2.6L15.6 8 13 6.8l2.6-1.2Z" /></>,
  send: <><path d="m21 3.5-8.2 17-2.4-7-7-2.4Z" /><path d="m10.4 13.6 5.1-5.1" /></>,
  wire: <><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /><circle cx="12" cy="5" r="2.5" /><path d="M7.4 16.7 10.6 7.2" /><path d="m13.4 7.2 3.2 9.5" /><path d="M8 18.5h8" /></>,
}

/** What the money buys, one card each, in the order a reader meets them. */
const OUTCOMES: { icon: keyof typeof ICONS; name: string; what: string }[] = [
  {
    icon: 'fresh',
    name: 'Fresh every day',
    what: 'Scraped daily for you. Every lead was active in the last 3 days, so the list is alive when you write.',
  },
  {
    icon: 'reply',
    name: 'Higher reply rate',
    what: 'People with intent, already selling products and taking collabs. That is the bar that moves replies.',
  },
  {
    icon: 'niche',
    name: 'In your niche',
    what: 'Filtered on your offer and your own requirements, past what a follower count says about anyone.',
  },
  {
    icon: 'human',
    name: 'Human filters',
    what: 'Write the filter as a sentence. "Influencer with a dog" is a valid one.',
  },
  {
    icon: 'send',
    name: 'Outreach included',
    what: 'The first message and the follow up go out in your name. Every reply lands in your CRM.',
  },
  {
    icon: 'wire',
    name: 'AI, API and MCP',
    what: 'Connect over API or MCP and drive the agent from your own AI subscription.',
  },
]

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
      <div className="start-row">
        <div className="start-box">
          {step === 'brief' ? (
            <input
              id={id}
              type="text"
              required
              placeholder={BRIEF_HINT}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              aria-label="The creators you want"
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
        </div>
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

/**
 * A card arrives when it is reached, so the grid fills in as it is read.
 *
 * The class is what makes a card visible, so anything that could keep the
 * observer from firing has to open them all instead: no observer in this
 * browser, and a reader who asked for stillness.
 */
function useTold(on: boolean): void {
  useEffect(() => {
    if (!on) return
    const perks = Array.from(document.querySelectorAll('.perk'))
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || !('IntersectionObserver' in window)) {
      perks.forEach((c) => c.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        io.unobserve(e.target)
      }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    )
    perks.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [on])
}

/** True once Satoshi's heaviest cut is measurable, or 1.8s has passed. */
function useFace(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; setReady(true) } }
    const timeout = window.setTimeout(finish, 1800)
    document.fonts.load('900 100px Satoshi', WORD + TAGLINE).then(finish, finish)
    return () => { done = true; window.clearTimeout(timeout) }
  }, [])
  return ready
}

/** True on the widths where the tagline would render at caption size. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const read = () => setNarrow(mq.matches)
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])
  return narrow
}

export function Landing() {
  const faced = useFace()
  const narrow = useNarrow()
  useTold(faced)
  if (!faced) return <div className="landing lp lp-boot" />
  return (
    <div className="landing lp">
      <GlyphPortal
        className="lp-portal"
        word={narrow ? WORD : TAGLINE}
        focusChar={narrow ? 'D' : 'o'}
        fontFamily="'Satoshi', ui-sans-serif, system-ui, sans-serif"
        fontWeight={900}
        scrollLength={1.6}
        enterLabel="See what you get"
        background={<div className="lp-sky" style={{ backgroundImage: `url(${sky})` }} />}
        style={{
          '--gp-paper': '#faf6ec',
          '--gp-ink': '#23211c',
          '--gp-field': '#faf6ec',
          '--gp-foreground': '#23211c',
        }}
        front={(
          <div className="lp-front">
            <div className="lp-front-ask">
              <p className="lp-line">
                {SUBTAG.map((t, i) => (
                  <span key={i} className={t.hot ? 'hot' : undefined}>{t.w}</span>
                ))}
              </p>
              <Start id="start-brief" />
            </div>
          </div>
        )}
      >
        <div className="lp-inside">
          <section className="lp-grid">
            {OUTCOMES.map((o, i) => (
              <article className="perk" key={o.name} style={{ ['--i' as string]: i % 3 } as CSSProperties}>
                <span className="perk-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {ICONS[o.icon]}
                  </svg>
                </span>
                <h3>{o.name}</h3>
                <p>{o.what}</p>
              </article>
            ))}
          </section>

          <p className="lp-proof">{PROOF}</p>

          <section className="lp-ask">
            <h2>Your next 10 deals are tomorrow.</h2>
            <p className="lp-sub">Let your agent find them.</p>
            <Start />
          </section>
        </div>
      </GlyphPortal>

      <footer className="lp-foot">
        <span className="brand-word">brandmatch</span>
        <nav>
          <a href="mailto:hey@jeremylasne.com">Talk to us</a>
          <a href="#/signin">Sign in</a>
        </nav>
        <p>© 2026</p>
      </footer>
    </div>
  )
}
