import { useEffect, useState } from 'react'
import {
  campaignLeadsPerDay, createCampaign, getCampaign, proposeAgents, removeCampaignAgent,
  runFirstCrawl, setCampaignWebsite, updateCampaign, updateCampaignAgent, type CrawlProgress,
} from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'

// Onboarding is three screens and about a minute.
//
//   1  Your website goes in. The model reads it and proposes the campaign and
//      three agents. You approve what you want.
//   2  Your first 500 land. The clock when they finish is the clock they land
//      on every morning after.
//   3  The offer, once the leads are on the screen and worth something: put a
//      card down now and hold $79, or decide later at $99. The three days are
//      free on either.

const INCLUDED_PER_DAY = 500

/** The moment onboarding ends is the moment the batch lands, every day. */
function clockNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="onboard-shell landing">
      <header className="onboard-top">
        <span className="brand-word">brandmatch</span>
        <span className="onboard-dots" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => <i key={n} className={n <= step ? 'on' : undefined} />)}
        </span>
      </header>
      {children}
    </div>
  )
}

/** No id yet: make a campaign and move to its first step. */
export function OnboardingStart() {
  useEffect(() => {
    const a = createCampaign()
    navigate(`onboarding/${a.id}`)
  }, [])
  return null
}

/** Step one: the website, then what the model proposes from it. */
export function OnboardingCampaign({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const [reading, setReading] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    if (!campaign) navigate('onboarding')
  }, [campaign])
  if (!campaign) return null

  const proposed = campaign.agents.filter((a) => a.status === 'proposed')
  const taken = campaign.agents.filter((a) => a.status === 'active')

  function read(): void {
    if (reading || !campaign || !campaign.website.trim()) return
    setReading(true)
    setFailed(null)
    proposeAgents(campaign.id, campaign.website)
      .then(() => {
        if (!campaign.name.trim()) {
          const domain = campaign.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0]
          updateCampaign(campaign.id, { name: domain.charAt(0).toUpperCase() + domain.slice(1) + ' creators' })
        }
      })
      .catch((e: Error) => setFailed(e.message || 'Could not read that site. Try the full address.'))
      .finally(() => setReading(false))
  }

  return (
    <Shell step={1}>
      <div className="onboard-body">
        <h1 className="onboard-h1">What do you sell?</h1>
        <p className="onboard-lede">
          Your website is enough. We read it and write who to reach, then propose three agents to go and find them.
        </p>

        <div className="onboard-field">
          <input
            className="onboard-input"
            placeholder="yourbrand.com"
            value={campaign.website}
            autoFocus
            aria-label="Your website"
            onChange={(e) => setCampaignWebsite(campaign.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') read() }}
          />
          <button type="button" className="btn primary" disabled={!campaign.website.trim() || reading} onClick={read}>
            {reading ? 'Reading it' : proposed.length || taken.length ? 'Read it again' : 'Read my site'}
          </button>
        </div>
        {failed && <p className="warn">{failed}</p>}

        {reading && (
          <div className="reading" aria-live="polite">
            <span className="dots"><i /><i /><i /></span>
            Reading {campaign.website} and writing your audience.
          </div>
        )}

        {campaign.brief.who && !reading && (
          <div className="onboard-brief">
            <span className="eyebrow">Looking for</span>
            <p>{campaign.brief.who}</p>
          </div>
        )}

        {proposed.length > 0 && (
          <div className="onboard-agents">
            <span className="eyebrow">Three agents proposed</span>
            {proposed.map((a) => (
              <div className="onboard-agent" key={a.id}>
                <div className="onboard-agent-head">
                  <b>{a.name}</b>
                  <span className="spacer" />
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => updateCampaignAgent(campaign.id, a.id, { status: 'active' })}
                  >
                    Take it
                  </button>
                  <button type="button" className="btn small" onClick={() => removeCampaignAgent(campaign.id, a.id)}>
                    Drop
                  </button>
                </div>
                <p>{a.focus}</p>
                {a.why && <p className="onboard-why">{a.why}</p>}
              </div>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() => proposed.forEach((a) => updateCampaignAgent(campaign.id, a.id, { status: 'active' }))}
            >
              Take all three
            </button>
          </div>
        )}

        {taken.length > 0 && (
          <div className="onboard-foot">
            <span className="faint">
              {taken.length} agent{taken.length === 1 ? '' : 's'} taken,{' '}
              {Math.min(campaignLeadsPerDay(campaign), INCLUDED_PER_DAY)} leads a day
            </span>
            <span className="spacer" />
            <button type="button" className="btn primary" onClick={() => navigate(`onboarding/${campaign.id}/running`)}>
              Find my first 500
            </button>
          </div>
        )}
      </div>
    </Shell>
  )
}

/**
 * Step three: the offer. It lands here, after the leads, because that is the
 * first moment the number on the card means anything.
 *
 * $99 is the price. A card now holds $79 for as long as they stay subscribed.
 * Later is $99 and the $79 is gone, which is the whole point of deciding now.
 */
export function ChoosePlan({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  useEffect(() => {
    if (!campaign) navigate('onboarding')
  }, [campaign])
  if (!campaign) return null

  const take = (locked: boolean) => {
    updateCampaign(campaign.id, { pricePlan: locked ? 'locked79' : 'later99' })
    navigate(`contacts/${campaign.id}`)
  }

  return (
    <Shell step={3}>
      <div className="onboard-body">
        <h1 className="onboard-h1">Hold $79, or pay $99 later.</h1>
        <p className="onboard-lede">
          brandmatch is $99 a month. Put a card down now and it stays $79 for as long as you stay subscribed.
          Three days free either way, and nothing is charged until they end.
        </p>

        <div className="prices onboard-prices">
          <div className="price-card now">
            <span className="price-tag">Card now</span>
            <p className="price"><span className="now">$79</span><small>a month, held</small></p>
            <p className="price-note">
              Charged when the three days end, and never more than $79 while you stay. This offer goes when you
              leave this screen.
            </p>
            <button type="button" className="btn primary" onClick={() => take(true)}>Hold $79</button>
          </div>
          <div className="price-card later">
            <span className="price-tag">Decide later</span>
            <p className="price"><span>$99</span><small>a month</small></p>
            <p className="price-note">
              No card now. Work the three days and choose at the end. The price then is $99, the standard one.
            </p>
            <button type="button" className="btn" onClick={() => take(false)}>Skip for now</button>
          </div>
        </div>

        <p className="onboard-note">
          Up to {INCLUDED_PER_DAY} scored leads a day on both. Cancel any morning.{' '}
          Need more? <a href="mailto:hey@jeremylasne.com">Chat with me</a>.
        </p>
      </div>
    </Shell>
  )
}

/** Step three: the first batch, and the clock it sets for every morning after. */
export function FirstRun({ campaignId }: { campaignId: string }) {
  useStore()
  const [p, setP] = useState<CrawlProgress>({ found: 0, scored: 0, done: false })
  const [landsAt, setLandsAt] = useState<string | null>(null)

  useEffect(() => runFirstCrawl(setP), [])

  // The clock when the first batch finishes is the clock it lands on daily.
  useEffect(() => {
    if (!p.done || landsAt) return
    const at = clockNow()
    setLandsAt(at)
    updateCampaign(campaignId, { runAt: at })
  }, [p.done, landsAt, campaignId])

  const target = 500
  const pct = Math.min(100, Math.round(((p.found + p.scored) / (target * 2)) * 100))

  return (
    <Shell step={2}>
      <div className="onboard-body centred-text" aria-live="polite">
        <h1 className="onboard-h1">{p.done ? 'Your first 500 are in.' : 'Finding your first 500.'}</h1>
        <p className="onboard-lede">
          {p.done
            ? `From tomorrow they land at ${landsAt} every morning, ranked, with the email on the row.`
            : 'The agents are searching now. This is the only time you wait for them.'}
        </p>

        <div className="progress">
          <div className="stat"><b>{p.found}</b><span>creators found</span></div>
          <div className="stat"><b>{p.scored}</b><span>creators ranked</span></div>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>

        {p.done ? (
          <div className="onboard-foot centred">
            <button type="button" className="btn primary" onClick={() => navigate(`onboarding/${campaignId}/plan`)}>
              See them
            </button>
          </div>
        ) : (
          <p className="onboard-note">Usually under ten minutes. This preview takes eight seconds.</p>
        )}
      </div>
    </Shell>
  )
}
