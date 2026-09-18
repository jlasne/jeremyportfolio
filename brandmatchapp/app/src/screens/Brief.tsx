import { getCampaign, getGateSet } from '../data'
import { LIBRARIES } from '../data/propose'
import { checkSeeds, seedMismatch } from '../data/seeds'
import { absolute } from '../lib/format'

// Zone 3. The two questions the campaign was born from, still in the client's
// own words, plus the handful of things we read out of them.
//
// Rewriting either answer suggests a new set of rules. It never rewrites them
// silently: the client sees the suggestion and decides.

export function Brief({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  if (!campaign) return null
  const { brief, extracted } = campaign
  const library = LIBRARIES.find((l) => l.id === extracted.templateId)
  // Checked against the rules in use today, not against the ones they were
  // given under. A rule change can turn a good seed into a bad one.
  const seeds = checkSeeds(brief.seeds ?? [], gates, extracted.niches)
  const mismatch = gates ? seedMismatch(seeds, gates.hard) : null

  return (
    <>
      <div className="card">
        <h2>Who you want to reach</h2>
        <textarea className="textarea" defaultValue={brief.audience} rows={3} />
      </div>

      <div className="card">
        <h2>What you sell them</h2>
        <textarea className="textarea" defaultValue={brief.offer} rows={3} />
        <p className="hint">Written on {absolute(brief.writtenAt)}. Change either answer and we will suggest new rules.</p>
      </div>

      {seeds.length > 0 && (
        <div className="card">
          <h2>Accounts you gave us</h2>
          <p className="muted">
            {seeds.filter((v) => v.state !== 'fails').length} of {seeds.length} hold up against your rules today. We
            follow those to find people like them, and leave the rest alone.
          </p>
          {mismatch && <p className="notice warn">{mismatch}</p>}
          <ul className="rules stacked">
            {seeds.map((v) => (
              <li key={v.handle} className={v.state}>
                <b>
                  @{v.handle}
                  <span className={`seed-tag ${v.state}`}>
                    {v.state === 'fits' ? 'Fits' : v.state === 'fails' ? 'Does not fit' : 'New to us'}
                  </span>
                </b>
                <small className="muted">{v.note}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>What we read out of it</h2>
        <dl className="pairs">
          <dt>Countries</dt>
          <dd>{extracted.countries.length ? extracted.countries.join(', ') : 'Anywhere'}</dd>
          <dt>Languages</dt>
          <dd>{extracted.languages.length ? extracted.languages.join(', ') : 'Any'}</dd>
          <dt>Scoring started from</dt>
          <dd>{library?.name ?? extracted.templateId}</dd>
          <dt>Slices of your market</dt>
          <dd>
            {extracted.niches.filter((n) => n.enabled).map((n) => n.label).join(', ') || 'None picked yet'}
          </dd>
        </dl>
        <p className="hint">
          Read on {absolute(extracted.extractedAt)}. The slices are edited in{' '}
          <a href={`#/campaign/${campaignId}/gates`}>your rules</a>, where each one can carry its own numbers.
        </p>
      </div>

      <div className="page-head">
        <span className="spacer" />
        <a className="btn primary" href={`#/campaign/${campaignId}/gates`}>Next, your rules</a>
      </div>
    </>
  )
}
