import { getCampaign } from '../data'
import { LIBRARIES } from '../data/propose'
import { absolute } from '../lib/format'

// Zone 3. The two questions the campaign was born from, still in the client's
// own words, plus the handful of things we read out of them.
//
// Rewriting either answer proposes a new set of gates. It never rewrites them
// silently: the client sees the proposal and decides.

export function Brief({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId)
  if (!campaign) return null
  const { brief, extracted } = campaign
  const library = LIBRARIES.find((l) => l.id === extracted.templateId)

  return (
    <>
      <div className="card">
        <h2>Who you want to reach</h2>
        <textarea className="textarea" defaultValue={brief.audience} rows={3} />
      </div>

      <div className="card">
        <h2>What you sell them</h2>
        <textarea className="textarea" defaultValue={brief.offer} rows={3} />
        <p className="hint">Written on {absolute(brief.writtenAt)}. Changing either one proposes new gates.</p>
      </div>

      <div className="card">
        <h2>What we read out of it</h2>
        <dl className="pairs">
          <dt>Countries</dt>
          <dd>{extracted.countries.length ? extracted.countries.join(', ') : 'Anywhere'}</dd>
          <dt>Languages</dt>
          <dd>{extracted.languages.length ? extracted.languages.join(', ') : 'Any'}</dd>
          <dt>Gate 3 built from</dt>
          <dd>{library?.name ?? extracted.templateId}</dd>
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
