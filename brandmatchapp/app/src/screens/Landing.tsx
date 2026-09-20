import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'
import { api } from '../lib/api'
import stackArt from '../art/stack.png'
import connectArt from '../art/connect.png'
import priceArt from '../art/price-tag.png'
import testsArt from '../art/tests.png'

// The landing, in six blocks: hero, video, the four steps, the two ways in,
// one price, one ask. Cream ground, one orange accent, wide corners.

/** Drop the recording in here and the animation below steps aside for it. */
const VIDEO_URL = ''

/** What the creators on your list have already done. The turn is the point. */
const WHO = ['post this week', 'sell already', 'fit your size', 'work your niche', 'reply']

/** What both prices include. Said once, under them. */
const HAS = [
  'A fresh search every night',
  'Handle and email on every row',
  'Unlimited campaigns and agents',
  'API and MCP on the same key',
  'Every lead yours alone, forever',
  'Cancel any morning',
]

/** Said in three, under the buttons, the way a launch says them. */
const FACTS = ['Handle and email on every row', 'Up to 3,000 a day', 'Yours alone, forever']

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

/**
 * The four filters every profile has to clear. Pass all four and you are a
 * qualified lead. Brand fit then scores that lead and orders the list, which
 * is the line under the block: a score is a ranking, never a fifth filter.
 */
const TESTS: { name: string; means: string }[] = [
  {
    name: 'Size and activity',
    means: 'Followers, views, comments, posting rhythm. Measured on their last 12 posts, never on what an account declares.',
  },
  {
    name: 'Where they are',
    means: 'The country we read off the profile and the posts. Your list of countries, not ours.',
  },
  {
    name: 'What they post in',
    means: 'The language of their captions. Write to people who answer in the language you sell in.',
  },
  {
    name: 'Their niche',
    means: 'The slices of your market you want, one search each. Work in none of them and you are out.',
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
    how: 'A marketplace of creators who signed up to be hired. You get the ones who put their hand up, and so does everyone else.',
  },
  {
    name: 'Modash',
    meta: '350M profiles, stored',
    how: 'A stored index you search yourself. You read the profiles, you judge each one, and the emails arrive on a monthly allowance.',
  },
  {
    name: 'TopYappers',
    meta: '27M creators, exportable',
    how: 'A file you can export by the thousand. A bigger file is still a file, and it is still you doing the vetting.',
  },
]

const STEPS = [
  {
    n: '1/3',
    title: 'Two questions, and you have your filters',
    note: 'Who you want to reach. What you sell them. We turn that into filters you can read, and you change every one.',
    tick: 'Two minutes, once',
  },
  {
    n: '2/3',
    title: 'You see the rate before you commit',
    note: 'Run the simulation. It says how many searches it takes to produce one lead: 1 in 12, or 1 in 400. You widen a filter, or you take the number.',
    tick: 'One run a day',
  },
  {
    n: '3/3',
    title: 'The list is done when you wake up',
    note: 'Qualified leads, ranked by brand fit, with the handle and the email on every row. Searched last night, not two years ago.',
    tick: 'New every morning',
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
  // The morning list: who, and how close they sit to the client's own words.
  // The email lives on the row in the app, and the block under these steps
  // says so. Squeezing it in here as a chip only cost the score its room.
  const rows = [
    ['liftwithmaya', '94'],
    ['jennakstrong', '88'],
    ['sophie.souleve', '76'],
    ['priyalifts', '61'],
  ] as const
  return (
    <div className="viz viz-score">
      {rows.map(([h, fit]) => (
        <div className="viz-row" key={h}>
          <i>{h.slice(0, 2).toUpperCase()}</i>
          <b>@{h}</b>
          <span className="viz-stars">{fit}%<small>brand fit</small></span>
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
          <span><b>3,000 fresh leads a day</b>, searched last night</span>
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
            <div className="hero-copy">
              <h1>Find creators <br />who <TurningWord words={WHO} />.</h1>
              <p className="lede">
                You set the filters. We search Instagram every night. What passes is a qualified lead, ranked by how
                close it sits to your own words. Handle and email on every row.
              </p>
              <EarlyAccess website="strongher.co" />
              <p className="hero-meta">
                {FACTS.map((f, i) => (
                  <span key={f}>{i > 0 && <i aria-hidden="true" />}{f}</span>
                ))}
              </p>
            </div>
            <img className="hero-art" src={stackArt} alt="" width={1254} height={1254} />
          </section>

          <div className="video-wrap">
            <ProductVideo />
          </div>
        </div>

        <section className="land-section" id="how">
          <p className="eyebrow">How it works</p>
          <h2 className="big">Not a database. <em>A search run for you every night.</em></h2>
          <p className="section-lede">
            Every directory sells the same scraped list to everyone. Half of it is dead. We go looking for your buyer
            instead, and we go again tonight.
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

          <div className="reach">
            <div className="reach-one">
              <span className="reach-k">Instagram handle</span>
              <p>
                Where they already are, every day. A DM lands in the same place their work does, which is why it gets
                answered far more often than a cold email to a brand address.
              </p>
            </div>
            <div className="reach-one">
              <span className="reach-k">Email</span>
              <p>
                For the part that is business. The rate card, the brief, the contract. One inbox, one thread, and
                something you can forward to whoever signs.
              </p>
            </div>
          </div>

          <div className="tests">
            <div className="tests-copy">
              <p className="tests-head">Four hard filters. Fail one and we stop there.</p>
              <div className="tests-row">
                {TESTS.map((t) => (
                  <div className="test" key={t.name}>
                    <b>{t.name}</b>
                    <span>{t.means}</span>
                  </div>
                ))}
              </div>
              <p className="tests-after">
                Then a score, 0 to 100. It ranks your list by how close each one sits to your own words. It removes
                nobody.
              </p>
            </div>
            <img className="tests-art" src={testsArt} alt="" width={1774} height={887} />
          </div>
        </section>

        <section className="land-section" id="versus">
          <p className="eyebrow">The difference</p>
          <h2 className="big">They sell the same rows to everyone. <em>We go and look tonight.</em></h2>
          <p className="section-lede">
            A stored index answers who exists. It never answers who to write to this morning. That is a different job,
            and it is the one we do.
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
              <span className="versus-meta">Searched last night, against your filters</span>
            </div>
            <p>
              We search Instagram tonight against the filters you set. What passes is on your list by 06:00, ranked,
              with the handle and the email on the row. Your rows are yours alone.
            </p>
          </div>
        </section>

        <section className="land-section" id="ways">
          <div className="split">
            <div>
              <p className="eyebrow">Connect your agent</p>
              <h2 className="big">Built for agents. <em>Yours drives it.</em></h2>
              <p className="section-lede">
                brandmatch is built for an agent to drive. Yours reads the list, tags it, moves each lead along a
                stage and starts the next search, on your key. The app is the same account, for when you want to look.
              </p>
            </div>
            <img className="connect-art" src={connectArt} alt="" width={1586} height={992} />
          </div>

          <div className="connect">
            <div className="connect-code">
              <pre><code>{MCP_CONFIG}</code></pre>
            </div>
            <div className="connect-side">
              <a className="btn primary" href="#access">{CTA}</a>
            </div>
          </div>

          <ul className="connect-notes">
            <li>Ask in words: who sells already and posted this week</li>
            <li>Nine tools, one key: read, score, tag, move, create, pause</li>
            <li>Status, tags and notes are all on the API. A model files 100 rows while you file 3</li>
          </ul>
        </section>

        <section className="land-section centred" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2 className="big">Tell us your volume. <em>We price it.</em></h2>
          <p className="section-lede">
            What you pay follows how many leads you want a day, and how many niches we search to find them.
          </p>

          <div className="one-price">
            <img className="price-art" src={priceArt} alt="" width={1254} height={1254} />
            <p className="price"><span className="now">3,000</span><small>fresh leads a day</small></p>
            <ul className="plan-has">
              {HAS.map((h) => <li key={h}>{h}</li>)}
            </ul>
            <a className="btn primary" href="mailto:hey@jeremylasne.com">Contact us</a>
            <p className="price-note">One call, then three days free. No card to start.</p>
          </div>

          <p className="section-lede compare">
            A database sells you a search box, and every subscriber searches the same rows. You still find, vet and
            score each one. Here the list is done when you wake up, and nobody else gets it.
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
