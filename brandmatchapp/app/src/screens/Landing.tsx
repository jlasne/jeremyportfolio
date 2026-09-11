import { useState } from 'react'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'

// The landing: white ground, a faint grid, one orange accent, wide corners.
// Every call to action asks for the same thing, a demo.

/** What every lead carries. The four claims the section is built on. */
const PROMISES: { title: string; note: string }[] = [
  {
    title: 'Matched to your niche',
    note: 'Your website writes the audience. Content, followers and size band are read against it, creator by creator.',
  },
  {
    title: 'Actively posting',
    note: 'Last 12 posts read every night. Quiet accounts drop out before they reach your list.',
  },
  {
    title: 'Collab intent',
    note: 'A paid post, a rate card, a media kit or collab wording, each dated. A signal in the last 4 days counts full.',
  },
  {
    title: 'Contact attached',
    note: 'The email sits on the row where we find one. Nothing to enrich, nothing to buy twice.',
  },
]

const FAQ = [
  {
    q: 'How do I set it up?',
    a: 'Enter your website. Your agents read it and write the audience they should hunt for: the niche, who follows them, the size band. Change any word of it, set each agent a daily quota, and they start that night.',
  },
  {
    q: 'How many leads do I get?',
    a: 'You choose, anywhere from 100 to 1,000 a day. Move the number any morning and the next batch follows it.',
  },
  {
    q: 'What makes a lead high intent?',
    a: 'Three things, each worth a star: the creator fits your niche, they already sell something of their own, and a brand signal fired in the last few days. The list comes ranked, best first.',
  },
  {
    q: 'Can I run more than one campaign?',
    a: 'Yes. One per launch, per product or per market. Every contact carries the campaign that found it, so you can read them together or apart.',
  },
  {
    q: 'What do I do with the list?',
    a: 'Open it, tick off the ones you wrote to, tag the rest in bulk, and export whatever you want to keep. The contact is on the row where we found one.',
  },
  {
    q: 'Can my own code read the list?',
    a: 'Yes, through one API, coming soon. The same key reads this morning\'s leads and runs the campaigns that fill it: create one, add agents, move a daily volume, pause it.',
  },
]

export function Landing() {
  const [perDay, setPerDay] = useState(250)
  /** How you pay for that volume: every month, or once. */
  const [term, setTerm] = useState<'monthly' | 'once'>('monthly')
  const [open, setOpen] = useState<number | null>(0)

  return (
    <>
      <Backdrop />
      <div className="landing">
      <header className="land-nav">
        <a className="brand" href="#/">
          <Logo size={24} />
          brandmatch
        </a>
        <nav>
          <a href="#why">What lands</a>
          <a href="#how">How it works</a>
          <a href="#api">API</a>
          <a href="#pricing">Volume</a>
        </nav>
        <span className="spacer" />
        <a className="btn primary" href="#/contacts">See demo</a>
      </header>

      <div className="hero-block">
      <section className="hero">
        <h1>Your AI agent finds <br />high intent influencers.</h1>
        <p className="lede">Enter your website. brandmatch learns your brand and brings you influencers ready for a deal, with their contact.</p>
        <div className="hero-prompt" role="group" aria-label="Your website">
          <span className="prompt-text">strongher.co</span>
          <a className="btn primary" href="#/contacts">See demo</a>
        </div>
      </section>

      <div className="demo-wrap">
        <HeroDemo />
      </div>
      </div>

      <section className="land-section" id="why">
        <p className="eyebrow">What lands every morning</p>
        <h2 className="big">Daily leads, found for you, <em>while you sleep.</em></h2>
        <p className="section-lede">
          Every creator in your list matches your niche, posts actively, shows collab intent, and carries their contact.
          Nothing else reaches the list.
        </p>
        <div className="promises">
          {PROMISES.map((pm, i) => (
            <div className="promise" key={pm.title}>
              <span className="promise-n">0{i + 1}</span>
              <h3>{pm.title}</h3>
              <p>{pm.note}</p>
            </div>
          ))}
        </div>
        <div className="section-cta">
          <a className="btn primary" href="#/contacts">See demo</a>
          <span className="faint">45,000 creators already in the demo list.</span>
        </div>
      </section>

      <section className="land-section" id="how">
        <p className="eyebrow">Two steps</p>
        <h2 className="big">That is the whole setup.</h2>
        <div className="steps2">
          <div className="step">
            <span className="step-n">01</span>
            <h3>Enter your website</h3>
            <p>Your agents read it and write who they should hunt for: the niche, the audience, the size. Change any word of it.</p>
          </div>
          <div className="step">
            <span className="step-n">02</span>
            <h3>Your campaigns find high intent influencers</h3>
            <p>Every night they go creator by creator, drop the quiet accounts, and bring you the ones showing they want a brand deal, with their contact attached.</p>
          </div>
        </div>
      </section>

      <section className="land-section" id="api">
        <p className="eyebrow">API</p>
        <h2 className="big">One API. <em>And the app is your CRM.</em></h2>
        <p className="section-lede">
          One key, one base URL. Read this morning's list, classify it in the same place you work, and run the campaigns
          that fill it. Your own code, or the AI tool you already point at your APIs.
        </p>
        <div className="doors three">
          <div className="door">
            <span className="door-tag">Read</span>
            <h3>Your leads</h3>
            <p>Every lead with its stars, its dated signals and its email, filtered the way the app filters them.</p>
            <div className="asks">
              <span className="ask-line">GET /leads?since=today&amp;email=yes</span>
              <span className="ask-line">GET /leads?country=UK&amp;signal_within=7</span>
            </div>
          </div>
          <div className="door">
            <span className="door-tag">Classify</span>
            <h3>Your CRM</h3>
            <p>Tag, note, tick off, reject. The list you work in is the record, so a write here shows in the app.</p>
            <div className="asks">
              <span className="ask-line">POST /leads/:id/tags</span>
              <span className="ask-line">POST /leads/:id/done</span>
            </div>
          </div>
          <div className="door">
            <span className="door-tag">Run</span>
            <h3>Your campaigns</h3>
            <p>Create a campaign, add agents, move a daily quota, pause it. Every field the app has, reachable here.</p>
            <div className="asks">
              <span className="ask-line">POST /campaigns</span>
              <span className="ask-line">PATCH /campaigns/:id/agents/:id</span>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section centred" id="pricing">
        <p className="eyebrow">Your volume</p>
        <h2 className="big">You pick the leads. <em>That is the whole decision.</em></h2>
        <p className="section-lede">
          Set how many creators land each morning, then say how you want to pay for them. Monthly costs 30% less per
          lead than the one off pack.
        </p>

        <div className="volume-picker">
          <div className="term-wrap">
            <div className="term-toggle" role="group" aria-label="How you pay">
              <button type="button" className={term === 'monthly' ? 'on' : ''} aria-pressed={term === 'monthly'} onClick={() => setTerm('monthly')}>
                Monthly
                <span className="term-off">30% off</span>
              </button>
              <button type="button" className={term === 'once' ? 'on' : ''} aria-pressed={term === 'once'} onClick={() => setTerm('once')}>
                One off
              </button>
            </div>
          </div>

          <div className="volume-read">
            <b className="num">{perDay}</b>
            <span>leads a day</span>
          </div>
          <input
            className="slider"
            type="range"
            min={100}
            max={1000}
            step={50}
            value={perDay}
            style={{ ['--fill' as string]: `${((perDay - 100) / 900) * 100}%` }}
            onChange={(e) => setPerDay(Number(e.target.value))}
            aria-label="Leads a day"
            aria-valuetext={`${perDay} leads a day`}
          />
          <div className="bar-ends"><span>100 a day</span><span>1,000 a day</span></div>

          <div className="plan-single">
            <p className="big-figure">
              <b className="num">{(perDay * 30).toLocaleString('en-US')}</b>
              <span>{term === 'monthly' ? `leads every month, at ${perDay} a day` : `leads in the pack, at ${perDay} a day for 30 days`}</span>
            </p>
            <ul>
              <li className="yes">{term === 'monthly' ? '30% less per lead than the one off pack' : 'Billed once, spread over as many days as you like'}</li>
              <li className="yes">{term === 'monthly' ? 'Move your volume any morning, 100 to 1,000 a day' : 'Unlimited campaigns while the pack lasts'}</li>
              <li className="yes">Their email attached where we find one</li>
              {term === 'monthly'
                ? <li className="yes">API and CRM, so your code reads and classifies the list</li>
                : <li className="no">No API, no CRM writes. The app only</li>}
              <li className="yes">{term === 'monthly' ? 'Change the volume or cancel any morning' : 'Nothing renews, nothing to cancel'}</li>
            </ul>
            <a className="btn primary" href="#/contacts">See demo</a>
          </div>
        </div>
      </section>

      <section className="land-cta">
        <h2>Your next 10 creators are already out there.</h2>
        <p>Open the demo and read the list as it stands this morning.</p>
        <a className="btn primary" href="#/contacts">See demo</a>
      </section>

      <section className="land-section" id="faq">
        <h2 className="big">Questions</h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div className={`faq-item${open === i ? ' open' : ''}`} key={f.q}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{f.q}</button>
              {open === i && <p>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="land-foot">
        <div>
          <span className="brand-word">brandmatch</span>
          <p className="muted" style={{ marginTop: 8 }}>Creators for your brand, every morning. Instagram today, TikTok and YouTube next.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#why">What lands</a>
          <a href="#how">How it works</a>
          <a href="#api">API</a>
          <a href="#pricing">Volume</a>
        </div>
        <div>
          <h4>App</h4>
          <a href="#/contacts">See demo</a>
          <a href="#/connect">API</a>
        </div>
        <div>
          <h4>Information</h4>
          <a href="#faq">Questions</a>
          <a href="#/">Legal notice</a>
          <a href="#/">Privacy</a>
        </div>
        <p className="copy">© 2026 brandmatch. Front end prototype on demo data.</p>
      </footer>
      </div>
    </>
  )
}
