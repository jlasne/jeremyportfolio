import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { api } from '../lib/api'

// The landing, as one page: hero, six outcomes, one ask.
//
// Cream ground, warm charcoal type, one orange for the thing you click and
// the thing you get. Satoshi at two sizes that do the work: the display size
// the hero and the last ask share, and the reading size everything else runs
// at. The six cards are what brandmatch gives back, one line of proof each,
// and they arrive as they are reached so the page is read rather than
// scanned. Nothing between the hero and them, and nothing above the hero,
// because a reader who came for leads should meet the headline first and see
// what they get straight after it. The only bar is the footer, and the only
// button is the one in the hero.

/**
 * The headline, word by word, so each one can rise on its own delay. `hot`
 * marks the three that say what nobody else delivers, and they take the
 * page's one colour.
 */
const HEADLINE: { w: string; hot?: true }[] = [
  { w: 'Your' }, { w: 'AI' }, { w: 'agent' }, { w: 'finds' },
  { w: 'high', hot: true }, { w: 'intent,', hot: true }, { w: 'active', hot: true },
  { w: 'creators.' },
]

const SUBHEAD = 'Describe the creators you want. Your agent learns and identifies them. Not generic and outdated: searched for you, active and high intent, every day.'
const BRIEF_HINT = 'e.g. Fitness creators, 50k+ followers, active this week'

/** The one thing every button asks for, said the same way in both places. */
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
function useTold(): void {
  useEffect(() => {
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
  }, [])
}

export function Landing() {
  useTold()
  return (
    <div className="landing lp">
      <section className="lp-hero">
        <h1>
          {HEADLINE.map((t, i) => (
            <span key={i} className={t.hot ? 'hot' : undefined} style={{ ['--i' as string]: i } as CSSProperties}>{t.w}</span>
          ))}
        </h1>
        <p className="lp-sub">{SUBHEAD}</p>
        <Start id="start-brief" />
      </section>

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
