import { useEffect, useState } from 'react'
import { campaignLeadsPerDay, createCampaign, getCampaign, runFirstCrawl, type CrawlProgress } from '../data'
import { useStore } from '../data/hooks'
import { navigate } from '../lib/router'
import { CampaignEditor } from './Campaign'

// Onboarding is three screens: the campaign, the price, the first batch.

/** What $99 a month covers. Past this it is a conversation, not a checkout. */
const INCLUDED_PER_DAY = 250

/** No id yet: make a campaign and move to its editor. */
export function OnboardingStart() {
  useEffect(() => {
    const a = createCampaign()
    navigate(`onboarding/${a.id}`)
  }, [])
  return null
}

export function OnboardingCampaign({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  useEffect(() => {
    if (!campaign) navigate('onboarding')
  }, [campaign])
  if (!campaign) return null
  return (
    <div className="onboard-shell">
      <header className="onboard-top">
        <span className="brand-word">brandmatch</span>
        <span className="faint">Step 1 of 3</span>
      </header>
      <CampaignEditor campaignId={campaignId} firstRun />
    </div>
  )
}

/**
 * One plan, shown once the volume is set, so the number on the card is the
 * number the brand just chose. Above 250 a day it stops being self serve and
 * becomes a conversation.
 */
export function ChoosePlan({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  useEffect(() => {
    if (!campaign) navigate('onboarding')
  }, [campaign])
  if (!campaign) return null

  const perDay = campaignLeadsPerDay(campaign)
  const overflow = perDay > INCLUDED_PER_DAY

  return (
    <div className="onboard-shell">
      <header className="onboard-top">
        <span className="brand-word">brandmatch</span>
        <span className="faint">Step 2 of 3</span>
      </header>

      <div className="page editor centred">
        <div className="page-head">
          <h1>One plan</h1>
        </div>
        <p className="subhead">
          Your agents are set to {perDay} leads a day. Everything below is included at that volume.
        </p>

        <div className="one-plan">
          <div className="plan dark">
            <span className="plan-tag">Everything</span>
            <p className="price">$99<small>a month</small></p>
            <ul>
              <li>Up to {INCLUDED_PER_DAY} scored leads a day</li>
              <li>Their email where we find one</li>
              <li>Unlimited campaigns and agents</li>
              <li>API and MCP, same key, no extra tier</li>
              <li>Every lead yours alone for 14 days</li>
              <li>Cancel any morning</li>
            </ul>
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate(`onboarding/${campaign.id}/running`)}
            >
              {overflow ? 'Start at 250 a day' : 'Start my first batch'}
            </button>
          </div>
        </div>

        <p className="hint centred-text">
          {overflow
            ? `You asked for ${perDay} a day, which is past the plan. We start at ${INCLUDED_PER_DAY} and size the rest together.`
            : 'Need more than 250 a day later? Chat with me and we size it together.'}
          {' '}
          <a href="mailto:jeremy@brandmatch.app">jeremy@brandmatch.app</a>
        </p>
      </div>
    </div>
  )
}

export function FirstRun({ campaignId }: { campaignId: string }) {
  useStore()
  const campaign = getCampaign(campaignId)
  const [p, setP] = useState<CrawlProgress>({ found: 0, scored: 0, done: false })
  useEffect(() => runFirstCrawl(setP), [])
  useEffect(() => {
    if (p.done) {
      const t = window.setTimeout(() => navigate(`contacts/${campaignId}`), 500)
      return () => window.clearTimeout(t)
    }
  }, [p.done, campaignId])
  const pct = Math.round(((p.found + p.scored) / (412 * 2)) * 100)
  return (
    <div className="onboard">
      <div className="onboard-box" aria-live="polite">
        <p className="steps">Step 3 of 3</p>
        <h1>{campaign?.name || 'Your search'} is running now</h1>
        <div className="brief-line">
          <p>{campaign?.brief.summary ?? ''}</p>
          <a href={`#/onboarding/${campaignId}`}>Edit</a>
        </div>
        <div className="progress">
          <div className="stat">
            <b>{p.found}</b>
            <span>creators found</span>
          </div>
          <div className="stat">
            <b>{p.scored}</b>
            <span>creators ranked</span>
          </div>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="helper">{p.done ? 'Done. Opening your leads.' : 'Usually under 10 minutes. This preview takes 8 seconds.'}</p>
      </div>
    </div>
  )
}
