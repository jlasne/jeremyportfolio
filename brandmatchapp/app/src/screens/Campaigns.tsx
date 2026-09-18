import { deliveredToday, getCampaigns, getFeasibility, getGateSet, getSubscription } from '../data'
import { useStore } from '../data/hooks'

// The way into the campaign zones. Not one of them itself: it is the index in
// front of them.
//
// The number on the right is the campaign's daily limit, the same figure the
// dashboard and the lead list show. It used to be the test estimate, which is
// what the rules could bring rather than what the campaign may take, and the
// two screens disagreed about the same campaign on the same morning.

export function Campaigns() {
  useStore()
  const campaigns = getCampaigns()
  const plan = getSubscription()
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
                {run ? '' : ', not tested yet'}
              </span>
              <span className="metric">
                <b className="num">{deliveredToday(c.id)}</b>
                <small>today, up to {c.dailyCap ?? plan.tier} a day</small>
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
