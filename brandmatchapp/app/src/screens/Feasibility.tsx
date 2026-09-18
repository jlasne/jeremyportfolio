import { getCampaign, getFeasibility, getGateSet, getQuota } from '../data'
import { absolute } from '../lib/format'

// Zone 5. It answers one question: do these gates hold my quota.
//
// It shows how many profiles survive each gate and what that ratio turns into
// per day. What it never shows is how many profiles were analysed to find out,
// or what the run cost. That is rule one.

export function Feasibility({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  const run = getFeasibility(campaignId)
  const quota = getQuota()
  if (!campaign || !gates) return null

  if (!run) {
    return (
      <div className="empty">
        <h2>Not tested yet</h2>
        <p>Run the simulator to see what these gates would deliver in a day.</p>
        <div className="actions"><button type="button" className="btn primary">Run the test</button></div>
      </div>
    )
  }

  const cap = campaign.dailyCap ?? quota.remaining
  const holds = run.estimatedPerDay >= cap
  const qualified = run.scoreHistogram
    .filter((h) => h.score >= gates.passScore)
    .reduce((sum, h) => sum + h.count, 0)
  // Widest bar is the commonest score, so the shape reads at any sample size.
  const tallest = Math.max(1, ...run.scoreHistogram.map((h) => h.count))

  return (
    <>
      <div className={`notice${holds ? '' : ' warn'}`}>
        {holds ? (
          <span>
            These gates deliver about <b className="num">{run.estimatedPerDay}</b> a day. Your cap is{' '}
            <b className="num">{cap}</b>. It holds.
          </span>
        ) : (
          <span>
            These gates deliver about <b className="num">{run.estimatedPerDay}</b> a day and your cap is{' '}
            <b className="num">{cap}</b>. Loosen a threshold or lower the score.
          </span>
        )}
      </div>

      <div className="card">
        <h2>Survival, gate by gate</h2>
        <ul className="rules">
          <li><span>Profiles tested</span><b className="num">{run.sampleSize}</b></li>
          <li><span>Past gate 1, hard filters</span><b className="num">{run.passedHard}</b></li>
          <li><span>Past gate 2, knockouts</span><b className="num">{run.passedKnockouts}</b></li>
          <li><span>Past gate 3, at {gates.passScore} or above</span><b className="num">{qualified}</b></li>
        </ul>
      </div>

      <div className="card">
        <h2>Score spread</h2>
        <ul className="spread">
          {run.scoreHistogram.map((h) => (
            <li key={h.score} className={h.score >= gates.passScore ? 'in' : undefined}>
              <b className="num">{h.score}</b>
              <i style={{ width: `${Math.max(2, Math.round((h.count / tallest) * 300))}px` }} />
              <span className="num">{h.count}</span>
            </li>
          ))}
        </ul>
        <p className="hint">
          Moving the bar changes what you get, not what you pay. Tested against gate version {run.gateSetVersion} on{' '}
          {absolute(run.ranAt)}.
        </p>
      </div>
    </>
  )
}
