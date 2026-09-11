import { useState } from 'react'
import { useStore } from '../data/hooks'
import { Backdrop } from '../components/Backdrop'
import { Logo } from '../components/Logo'
import { HeroDemo } from '../components/HeroDemo'

// The landing: white ground, a faint grid, one orange accent, wide corners.
// Every call to action asks for the same thing, a demo.

/** What every lead carries. The four claims the section is built on. */
const PROMISES: { title: string; note: string }[] = [
  {
    title: 'Qualified in your niche',
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

const COMPARE: { row: string; database: string; scraper: string; agency: string; ours: string }[] = [
  {
    row: 'Qualified in your niche',
    database: 'By follower count',
    scraper: 'Raw rows, no order',
    agency: 'Their taste',
    ours: 'Read against your own audience',
  },
  {
    row: 'Actively posting',
    database: 'Nobody checks',
    scraper: 'You check',
    agency: 'Sometimes',
    ours: 'Last 12 posts, read this month',
  },
  {
    row: 'Collab intent',
    database: 'Not tracked',
    scraper: 'Not tracked',
    agency: 'They ask around',
    ours: 'Dated signals, ranked by freshness',
  },
  {
    row: 'Contact attached',
    database: 'Extra fee',
    scraper: 'You enrich it',
    agency: 'They keep it',
    ours: 'On the row',
  },
  {
    row: 'Arrives on its own',
    database: 'You search it',
    scraper: 'You run it',
    agency: 'For a retainer',
    ours: 'Every night, 100 to 1,000 a day',
  },
]

const FAQ = [
  {
    q: 'How do I set it up?',
    a: 'Enter your website. Your agents read it and write the audience they should hunt for: the niche, who follows them, the size band. Change any word of it, set your daily volume, and it starts that night.',
  },
  {
    q: 'How many leads do I get?',
    a: 'You choose, anywhere from 100 to 1,000 a day. Move the number any morning and the next batch follows it.',
  },
  {
    q: 'What makes a lead high intent?',
    a: 'Three things, each worth a star: the creator fits your niche, they already sell something of their own, and a brand signal fired in the last few days. Half a star or more counts as qualified.',
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
  useStore()
  const [perDay, setPerDay] = useState(250)
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
        <a className="login" href="#/contacts">Login</a>
        <a className="btn primary" href="#/onboarding">Book a demo</a>
      </header>

      <div className="hero-block">
      <section className="hero">
        <h1>Your AI agent finds <br />high intent influencers.</h1>
        <p className="lede">Enter your website. brandmatch learns your brand and brings you influencers ready for a deal, with their contact.</p>
        <div className="hero-prompt" role="group" aria-label="Your website">
          <span className="prompt-text">strongher.co</span>
          <a className="btn primary" href="#/onboarding">Book a demo</a>
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
          Every creator in your list is qualified in your niche, actively posting, showing collab intent, and carries
          their contact. Nothing else reaches the list.
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
        <p className="section-lede" style={{ marginTop: 46 }}>The same job, done four ways. Only one of them wakes up before you do.</p>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">What matters</span></th>
                <th scope="col">Creator database</th>
                <th scope="col">Scraping tool</th>
                <th scope="col">Agency</th>
                <th scope="col" className="ours">brandmatch</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) => (
                <tr key={c.row}>
                  <th scope="row">{c.row}</th>
                  <td>{c.database}</td>
                  <td>{c.scraper}</td>
                  <td>{c.agency}</td>
                  <td className="ours">{c.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <h2 className="big">One API. <em>Your leads and your campaigns.</em></h2>
        <p className="section-lede">
          One key, one base URL. Read this morning's list and run the campaigns that fill it, from your own code or from
          the AI tool you already point at your APIs.
        </p>
        <div className="doors">
          <div className="door">
            <span className="door-tag">Read</span>
            <h3>Your leads</h3>
            <p>Every lead with its stars, its dated signals and its email, filtered the same way the app filters them.</p>
            <div className="asks">
              <span className="ask-line">GET /leads?since=today&amp;email=yes</span>
              <span className="ask-line">GET /leads?country=UK&amp;signal_within=7</span>
              <span className="ask-line">POST /leads/:id/tags</span>
            </div>
          </div>
          <div className="door">
            <span className="door-tag">Write</span>
            <h3>Your campaigns</h3>
            <p>Create a campaign, add agents to it, move a daily volume, pause it. Every field the app has, reachable here.</p>
            <div className="asks">
              <span className="ask-line">POST /campaigns</span>
              <span className="ask-line">PATCH /campaigns/:id/agents/:id</span>
              <span className="ask-line">POST /campaigns/:id/pause</span>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="pricing">
        <p className="eyebrow">Your volume</p>
        <h2 className="big">You pick the leads a day. <em>Everything else follows.</em></h2>
        <p className="section-lede">
          Move the bar. That is the whole decision: how many creators land in your list each morning, anywhere from 100
          to 1,000 a day.
        </p>

        <div className="volume-picker">
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
          <div className="volume-out">
            <div>
              <b className="num">{(perDay * 7).toLocaleString('en-US')}</b>
              <span>a week</span>
            </div>
            <div>
              <b className="num">{(perDay * 30).toLocaleString('en-US')}</b>
              <span>a month</span>
            </div>
            <div>
              <b className="num">{Math.round(perDay * 30 * 0.9).toLocaleString('en-US')}</b>
              <span>of those qualified</span>
            </div>
          </div>
        </div>

        <h3 className="volume-sub">Two ways to take that volume</h3>
        <div className="plans">
          <div className="plan brand">
            <span className="plan-tag">Every month</span>
            <h3>Running</h3>
            <p className="muted">{perDay} leads land every morning, month after month.</p>
            <p className="big-figure">
              <b className="num">{(perDay * 30).toLocaleString('en-US')}</b>
              <span>leads a month, at {perDay} a day</span>
            </p>
            <ul>
              <li>Move your volume any morning, 100 to 1,000 a day</li>
              <li>Unlimited campaigns, each with its own agents</li>
              <li>Their email attached where we find one</li>
              <li>One API for your leads and your campaigns</li>
              <li>Change the volume or cancel any morning</li>
            </ul>
            <a className="btn primary" href="#/onboarding">Book a demo at {perDay} a day</a>
          </div>
          <div className="plan dark">
            <span className="plan-tag">One off</span>
            <h3>Pack</h3>
            <p className="muted">30,000 leads, spent at whatever pace you set. Nothing renews.</p>
            <p className="big-figure">
              <b className="num">{Math.round(30_000 / perDay)}</b>
              <span>days of delivery at {perDay} a day</span>
            </p>
            <ul>
              <li>30,000 leads in total, billed once</li>
              <li>Spread them over as many days as you like</li>
              <li>Unlimited campaigns while the pack lasts</li>
              <li>One API for your leads and your campaigns</li>
              <li>Nothing to cancel</li>
            </ul>
            <a className="btn" href="#/onboarding">Book a demo for the pack</a>
          </div>
        </div>
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

      <section className="land-cta">
        <h2>Your next 10 creators are already out there.</h2>
        <p>See them in your list on a 20 minute demo.</p>
        <a className="btn primary" href="#/onboarding">Book a demo</a>
        <a className="btn ghost" href="#/contacts">See a live list</a>
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
          <a href="#/contacts">See a live list</a>
          <a href="#/onboarding">Book a demo</a>
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
