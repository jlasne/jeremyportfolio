import { getCampaign } from '../data'
import { useStore } from '../data/hooks'
import type { CampaignTab } from '../lib/router'
import { Brief } from './Brief'
import { Feasibility } from './Feasibility'
import { Gates } from './Gates'
import { Room } from './Room'

// The four campaign zones, chained in the order they are filled at creation
// and editable one by one afterwards. Each tab answers one question.

const TABS: { id: CampaignTab; label: string; question: string }[] = [
  { id: 'brief', label: 'Your brief', question: 'Who you want to reach, and what you sell them' },
  { id: 'gates', label: 'Your rules', question: 'What makes someone a lead' },
  { id: 'feasibility', label: 'Test it', question: 'Can this deliver every day' },
  { id: 'room', label: 'Room left', question: 'How long these rules keep delivering' },
]

export function CampaignZone({ campaignId, tab }: { campaignId: string; tab: CampaignTab }) {
  useStore()
  const campaign = getCampaign(campaignId)
  if (!campaign) {
    return (
      <div className="page">
        <div className="empty">
          <h2>No such campaign</h2>
          <p>It may have been archived.</p>
          <div className="actions"><a className="btn" href="#/campaigns">Back to campaigns</a></div>
        </div>
      </div>
    )
  }
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  return (
    <div className="page">
      <div className="page-head">
        <a className="btn small quiet" href="#/campaigns">Campaigns</a>
        <h1>{campaign.name}</h1>
      </div>
      <div className="filter-row">
        {TABS.map((t) => (
          <a key={t.id} className={`chip${t.id === tab ? ' on' : ''}`} href={`#/campaign/${campaign.id}/${t.id}`}>
            {t.label}
          </a>
        ))}
      </div>
      <p className="subhead">{current.question}</p>
      {tab === 'brief' && <Brief campaignId={campaign.id} />}
      {tab === 'gates' && <Gates campaignId={campaign.id} />}
      {tab === 'feasibility' && <Feasibility campaignId={campaign.id} />}
      {tab === 'room' && <Room campaignId={campaign.id} />}
    </div>
  )
}
