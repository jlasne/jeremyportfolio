import { useState } from 'react'
import { getCampaign, getGateSet } from '../data'
import { checkSeeds, cleanHandles, seedJobs, seedMismatch, SEEDS_ENOUGH } from '../data/seeds'
import { addSeeds, removeSeed, setBrief } from '../data/store'
import { SizeAndActivity } from '../components/SizeAndActivity'

// Zone 3. The two questions the campaign was born from, still in the client's
// own words, the accounts they named, and the first hard filter.
//
// Everything on this screen can be changed, because everything on it is
// either something the client wrote or a measurement of the people they are
// describing. Size and activity sits here and not with the rules because it
// is part of the description: how big, how active, where, in what language.
//
// What is not here is the scoring. Rewriting an answer suggests new
// sentences, it never writes them.

export function Brief({ campaignId }: { campaignId: string }) {
  const campaign = getCampaign(campaignId)
  const gates = getGateSet(campaignId)
  const [adding, setAdding] = useState('')
  if (!campaign) return null
  const { brief, extracted } = campaign
  // Checked against the rules in use today, not against the ones they were
  // given under. A rule change can turn a good seed into a bad one.
  const seeds = checkSeeds(brief.seeds ?? [], gates, extracted.niches)
  const mismatch = gates ? seedMismatch(seeds, gates.hard) : null
  const short = Math.max(0, SEEDS_ENOUGH - seeds.length)
  // Below a 500k ceiling these names cannot lead anywhere: Instagram suggests
  // almost nobody beside an account that size. They still hold the rules to
  // something real, which is the job worth asking for.
  const jobs = gates ? seedJobs(gates.hard) : null

  return (
    <>
      <div className="card">
        <h2>Who you want to reach</h2>
        <textarea
          className="textarea"
          defaultValue={brief.audience}
          rows={3}
          onBlur={(e) => setBrief(campaignId, { audience: e.target.value.trim() })}
        />
      </div>

      <div className="card">
        <h2>What you sell them</h2>
        <textarea
          className="textarea"
          defaultValue={brief.offer}
          rows={3}
          onBlur={(e) => setBrief(campaignId, { offer: e.target.value.trim() })}
        />
      </div>

      <div className="card">
        <h2>Accounts you gave us</h2>
        <p className="muted">
          {seeds.length === 0
            ? `None yet. Name ${SEEDS_ENOUGH} accounts you already know fit, and we hold your rules against them.`
            : `${seeds.filter((v) => v.state !== 'fails').length} of ${seeds.length} hold up against your rules today.${
                jobs?.drives ? ' We follow those to find people like them, and leave the rest alone.' : ''
              }`}
        </p>
        {jobs && <p className="muted">{jobs.note}</p>}
        {short > 0 && seeds.length > 0 && jobs?.drives && (
          <p className="hint">{short} more would help. Five is where the people around them start to add up.</p>
        )}
        {mismatch && <p className="notice warn">{mismatch}</p>}
        {seeds.length > 0 && (
          <ul className="rules stacked">
            {seeds.map((v) => (
              <li key={v.handle} className={v.state}>
                <b>
                  @{v.handle}
                  <span className={`seed-tag ${v.state}`}>
                    {v.state === 'fits' ? 'Fits' : v.state === 'fails' ? 'Does not fit' : 'Reading them'}
                  </span>
                  <button
                    type="button"
                    className="btn small quiet drop"
                    aria-label={`Remove @${v.handle}`}
                    onClick={() => removeSeed(campaignId, v.handle)}
                  >
                    ✕
                  </button>
                </b>
                <small className="muted">{v.note}</small>
              </li>
            ))}
          </ul>
        )}
        <div className="file-new">
          <input
            className="input"
            placeholder="@handle, @handle"
            aria-label="Handles to add"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const list = cleanHandles(adding)
              if (list.length) { addSeeds(campaignId, list); setAdding('') }
            }}
          />
          <button
            type="button"
            className="btn small"
            disabled={!cleanHandles(adding).length}
            onClick={() => { addSeeds(campaignId, cleanHandles(adding)); setAdding('') }}
          >
            Add
          </button>
        </div>
      </div>

      <SizeAndActivity campaignId={campaignId} />

      <div className="page-head">
        <span className="spacer" />
        <a className="btn primary" href={`#/campaign/${campaignId}/gates`}>Next, your rules</a>
      </div>
    </>
  )
}
