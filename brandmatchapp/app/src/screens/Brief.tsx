import { getCampaign } from '../data'
import { absolute } from '../lib/format'

// Zone 3. The client writes who they want to reach in plain words. The model
// reads it back as structure, and the client corrects the structure rather than
// filling a form. The gates are generated from what is on this page.

export function Brief({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId)
  if (!campaign) return null
  const { extracted } = campaign
  return (
    <>
      <div className="card">
        <h2>What you wrote</h2>
        <textarea className="textarea" defaultValue={campaign.brief} rows={6} />
        <p className="hint">Kept word for word. Changing it proposes a new set of gates.</p>
      </div>

      <div className="card">
        <h2>What we read out of it</h2>
        <dl className="pairs">
          <dt>You sell</dt>
          <dd>{extracted.sells}</dd>
          <dt>You want to reach</dt>
          <dd>{extracted.audience}</dd>
          <dt>You want them to</dt>
          <dd>{extracted.outcome}</dd>
          <dt>Countries</dt>
          <dd>{extracted.countries.join(', ')}</dd>
          <dt>Languages</dt>
          <dd>{extracted.languages.join(', ')}</dd>
        </dl>
        <p className="hint">Read on {absolute(extracted.extractedAt)}. Correct anything here before touching the gates.</p>
      </div>

      <div className="page-head">
        <span className="spacer" />
        <a className="btn primary" href={`#/campaign/${campaignId}/gates`}>Next, the gates</a>
      </div>
    </>
  )
}
