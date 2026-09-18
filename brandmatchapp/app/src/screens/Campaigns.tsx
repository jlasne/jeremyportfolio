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
      <p className="subhead">One brief, one set of gates, one daily cap. The quota is shared across them.</p>
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
                Gate version {gates?.version ?? 1}, pass at {gates?.passScore ?? 0} of 14
              </span>
              <span className="metric">
                <b className="num">{deliveredToday(c.id)}</b>
                <small>today, {run ? `${run.estimatedPerDay} a day possible` : 'not simulated'}</small>
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
