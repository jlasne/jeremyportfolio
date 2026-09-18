import { deliveredToday, getCampaigns, getFeasibility, getGateSet } from '../data'
import { useStore } from '../data/hooks'

// The way into the three campaign zones. Not one of the five itself: it is the
// index in front of them.

export function Campaigns() {
  useStore()
  const campaigns = getCampaigns()
  return (
    <div className="page">
      <div className="page-head">
        <h1>Campaigns</h1>
        <span className="spacer" />
        <a className="btn primary" href="#/campaign/new">New campaign</a>
      </div>
      <p className="subhead">Each campaign has its own brief, its own rules and its own daily limit. They share your monthly allowance.</p>
      <div className="list">
        {campaigns.map((c) => {
          const gates = getGateSet(c.id)
          const run = getFeasibility(c.id)
          return (
            <a key={c.id} className="campaign-row" href={`#/campaign/${c.id}/brief`}>
              <span className={`dot${c.status === 'live' ? ' on' : ''}`} />
              <span className="who">
                <span className="name">{c.name}</span>
                <span className="handle">{c.brief.audience}</span>
              </span>
              <span className="state">
                Rules version {gates?.version ?? 1}, pass mark {gates?.passScore ?? 0} of 14
              </span>
              <span className="metric">
                <b className="num">{deliveredToday(c.id)}</b>
                <small>today, {run ? `up to ${run.estimatedPerDay} a day` : 'not tested yet'}</small>
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
