import { useState } from 'react'
import { CRITERIA, QUALIFIED_RATIO, getContacts, qualifiedFrom } from '../data'
import { useStore } from '../data/hooks'
import { compact, relative } from '../lib/format'
import { Stars } from '../components/Stars'

// The landing, on Gojiberry's beats, written for a brand: how many creators
// land in the list every morning, and how fast you can message them.

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#0A0A0A" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#FA651E" />
  </svg>
)

const FAQ = [
  { q: 'How many creators do I get?', a: 'You pick. Set 250 a day and 250 land in your list every morning, ranked, with the email where we found one. Change the number any time.' },
  { q: 'Where do they come from?', a: 'We look through Instagram every night and read each creator the way you would: their bio, their audience, their last 12 posts, and what they have promoted lately.' },
  { q: 'Are the numbers real?', a: 'Engagement and views come from the last 12 posts we read ourselves. Databases copy an average that can run 74 times the real number, so we never use one.' },
  { q: 'How fast is the first list?', a: 'Under 10 minutes after you write your first sentence. Every morning after that, your list is ready before 7:00 in your timezone.' },
  { q: 'Can I run more than one search?', a: 'Yes. One for each launch, each product, each market. Every creator carries the search that found them, so your lists stay clean.' },
  { q: 'Does it message creators for me?', a: 'No. It finds them, ranks them and hands you the email. What you say to a creator stays yours.' },
]

export function Landing() {
  useStore()
  const top = getContacts({ minStars: 2 }).slice(0, 6)
  const [perDay, setPerDay] = useState(250)
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="landing">
      <header className="land-nav">
        <a className="brand" href="#/">
          <Mark />
          brandmatch
        </a>
        <nav>
          <a href="#features">What you get <small>01</small></a>
          <a href="#how">How it works <small>02</small></a>
          <a href="#connect">Connect <small>03</small></a>
          <a href="#pricing">Pricing <small>04</small></a>
        </nav>
        <span className="spacer" />
        <a className="login" href="#/contacts">Login</a>
        <a className="btn primary" href="#/onboarding">Start for free</a>
      </header>

      <section className="hero">
        <span className="pill-note"><i />For brands looking for creators</span>
        <h1>250 Instagram creators a day, <mark>ready to work</mark> with your brand.</h1>
        <p className="lede">
          Say who you want in one sentence. Every morning your list is waiting: creators who fit your brand, ranked by how ready
          they are, with their email attached.
        </p>
        <div className="hero-prompt" role="group" aria-label="Who are you looking for">
          <span className="prompt-text">Women lifting coaches who sell their own program</span>
          <a className="btn primary" href="#/onboarding">Get my first list free</a>
        </div>
        <p className="hero-tag">Stop scrolling Instagram. <b>Open the list and start messaging.</b></p>
      </section>

      <div className="browser">
        <div className="browser-frame">
          <div className="browser-bar">
            <i /><i /><i />
            <span className="url">app.brandmatch.app</span>
          </div>
          <div className="list">
            {top.map((c) => (
              <a className="contact" key={c.creator.id} href="#/contacts">
                <img className="avatar" src={c.creator.avatar} alt="" width={38} height={38} />
                <span className="who">
                  <span className="name">{c.creator.name}</span>
                  <span className="handle">@{c.creator.handle}</span>
                </span>
                <Stars score={c.score} />
                <span className="mail">{c.latestSignal ? `${c.latestSignal.label} ${relative(c.latestSignal.date)}` : c.creator.email}</span>
                <span className="metric">
                  <b className="num">{compact(c.creator.followers)}</b>
                  <small>followers</small>
                </span>
                <span className="metric">
                  <b className="num">{(c.creator.engagementRate * 100).toFixed(1)}%</b>
                  <small>engaged</small>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="strip">
        <div><b>250</b><span>creators in your list, every morning</span></div>
        <div><b>7:00</b><span>your list is ready before</span></div>
        <div><b>10 min</b><span>from one sentence to your first list</span></div>
        <div><b>1 in 2</b><span>has their email in the bio</span></div>
      </div>

      <section className="land-section grey" id="features">
        <div className="inner">
          <h2 className="big">A full list every morning. <em>Nothing to search for.</em></h2>
          <p className="section-lede">Your team stops hunting and starts talking to creators.</p>
          <div className="features">
            <div className="feature wide">
              <div>
                <h3>The ones ready to sign, at the top</h3>
                <p>We watch what creators do, not just who they are. A paid post this week, a rate card, a media kit. Those move to the top of your list, with the date attached.</p>
              </div>
              <div className="chips">
                <span className="chip on">Ran a sponsored post</span>
                <span className="chip">Promoted a brand like yours</span>
                <span className="chip">Posted their rates</span>
                <span className="chip">Opened their DMs to collabs</span>
                <span className="chip">Published a media kit</span>
                <span className="chip">Launched a program</span>
              </div>
            </div>
            <div className="feature">
              <h3>Only creators who fit your brand</h3>
              <p>Set the audience size, the engagement, the country and the language once. Every creator in your list already passed it.</p>
            </div>
            <div className="feature">
              <h3>Numbers you can quote</h3>
              <p>Engagement and views come from the last 12 posts we read ourselves. What you see is what a creator really gets.</p>
            </div>
            <div className="feature">
              <h3>Their email, on the row</h3>
              <p>About half of creators put an address in their bio. When it is there, it sits on the row. Copy it and write.</p>
            </div>
            <div className="feature">
              <h3>A different top every morning</h3>
              <p>A creator returns to the top when something new happens. Your team never reads the same five names twice.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="how">
        <h2 className="big">One sentence today. <em>Your first list in 10 minutes.</em></h2>
        <p className="section-lede">No categories to pick, no filters to learn first.</p>
        <div className="steps3">
          <div className="step">
            <span className="step-n">01 · SAY IT</span>
            <h3>Describe the creator</h3>
            <p>"Women lifting coaches who sell their own program." Add your audience size, country and language, or pick a preset.</p>
            <p className="quiet">Takes about a minute.</p>
          </div>
          <div className="step">
            <span className="step-n">02 · WE LOOK</span>
            <h3>We read Instagram for you</h3>
            <p>Every night we go through creators one by one, read their last 12 posts, and rank them on fit, business and how recently a brand paid them.</p>
            <p className="quiet">Runs while your team sleeps.</p>
          </div>
          <div className="step">
            <span className="step-n">03 · YOU WRITE</span>
            <h3>Open the list at 7:00</h3>
            <p>Best first, the reason attached, the email ready. Tag the ones you like, reject the rest, hand the list to your team.</p>
            <p className="quiet">This is the part your team actually enjoys.</p>
          </div>
        </div>
      </section>

      <section className="land-section grey">
        <div className="inner">
          <h2 className="big">Replaces the database, <em>the scrolling and the spreadsheet.</em></h2>
          <p className="section-lede">Stop paying for a database your team still has to read.</p>
          <div className="replaces">
            <div><b>Creator databases</b><span>A million names, sorted by follower count, ready by nobody.</span></div>
            <div><b>Manual scrolling</b><span>A full afternoon on Instagram for three usable names.</span></div>
            <div><b>Spreadsheets</b><span>Out of date the week after your team builds one.</span></div>
            <div><b>Agency retainers</b><span>A monthly invoice for a list you could read yourself.</span></div>
          </div>
        </div>
      </section>

      <section className="land-section" id="score">
        <p className="eyebrow">How we rank</p>
        <h2 className="big">Three stars. <em>You see why, every time.</em></h2>
        <p className="section-lede">Each star answers one question about a creator. Half a star when the answer is partly yes.</p>
        <div className="score-grid">
          {CRITERIA.map((c, i) => (
            <div className="score-card" key={c.key}>
              <div className="stars-demo">
                <Stars score={{ stars: 1, niche: i === 0 ? 1 : 0, active: i === 1 ? 1 : 0, intent: i === 2 ? 1 : 0, earned: CRITERIA.map((k, j) => ({ label: k.label, level: j === i ? 1 : 0, note: k.full })), why: '' }} />
              </div>
              <b>{c.label}</b>
              <p><span className="faint">Full.</span> {c.full}</p>
              <p><span className="faint">Half.</span> {c.half}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section grey" id="connect">
        <div className="inner">
          <p className="eyebrow">Agent</p>
          <h2 className="big">Your creator list, <em>inside the AI you already use.</em></h2>
          <p className="section-lede">Point Claude, ChatGPT or your own tool at brandmatch. Ask in plain words and it answers from your live list.</p>
          <div className="features">
            <div className="feature">
              <h3>Ask, and it answers</h3>
              <p>"Who came in today above 2 stars with an email?" "Show me UK creators who ran a paid post this week." Your AI reads the list and replies.</p>
            </div>
            <div className="feature">
              <h3>It writes back too</h3>
              <p>Tag a creator, leave a note, reject one. Your AI keeps your list tidy while it works.</p>
            </div>
            <div className="feature">
              <h3>Two ways in</h3>
              <p>MCP for Claude and anything that speaks it. A plain API for your own code or a workflow tool. One key covers both.</p>
            </div>
            <div className="feature">
              <h3>Nothing to install</h3>
              <p>Copy an address and a key from your Agent page. Paste them once. Your AI has your creators from that moment on.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="pricing">
        <h2 className="big">You pick how many creators a day</h2>
        <p className="section-lede">One price, the list included. Change the number any morning.</p>
        <div className="plans">
          <div className="plan">
            <h3>Brand</h3>
            <p className="muted">For a brand running its own creator outreach.</p>
            <div className="calc-line">
              <input className="slider" type="range" min={50} max={1000} step={50} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} aria-label="Creators a day" />
              <b className="num">{perDay}</b>
            </div>
            <p className="price">
              {perDay} <small>creators a day</small>
            </p>
            <ul>
              <li>{perDay * 22} creators a month, on 22 working days</li>
              <li>About {qualifiedFrom(perDay)} a day at 2 stars or more, ready to message</li>
              <li>Up to 3 searches, each with its own sentence and filters</li>
              <li>Their email attached where we find one</li>
              <li>Tags, notes, reject, export to a spreadsheet</li>
              <li>Connect your AI through MCP or the API</li>
              <li>Cancel any morning</li>
            </ul>
            <a className="btn primary" href="#/onboarding">Start with {perDay} a day</a>
            <p className="faint">About 1 creator in {QUALIFIED_RATIO} comes back qualified. Every one shows in your list either way.</p>
          </div>
          <div className="plan dark">
            <h3>Talk with us</h3>
            <p className="muted">For agencies and brands running several launches, or more than 1,000 creators a day.</p>
            <p className="price">Custom</p>
            <ul>
              <li>Everything in Brand</li>
              <li>Unlimited searches</li>
              <li>More creators a day</li>
              <li>Shared lists across your team</li>
              <li>Export to your CRM on a schedule</li>
              <li>A person on the other end</li>
            </ul>
            <a className="btn" href="#/contacts">Get a demo</a>
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
        <p>Tomorrow morning they are in your list.</p>
        <a className="btn primary" href="#/onboarding">Get my first list free</a>
        <a className="btn ghost" href="#/contacts">See a live list</a>
        <p className="fine">Free trial · First list in 10 minutes · Cancel any morning</p>
      </section>

      <footer className="land-foot">
        <div>
          <span className="brand-word">brandmatch</span>
          <p className="muted" style={{ marginTop: 8 }}>Creators for your brand, every morning. Instagram today, TikTok and YouTube next.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#features">What you get</a>
          <a href="#how">How it works</a>
          <a href="#connect">Connect your AI</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div>
          <h4>App</h4>
          <a href="#/contacts">See a live list</a>
          <a href="#/onboarding">Start a search</a>
          <a href="#/agent">Agent</a>
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
  )
}
