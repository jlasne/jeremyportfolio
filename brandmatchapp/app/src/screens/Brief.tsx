import { useState } from 'react'
import { getCampaign, getGateSet } from '../data'
import { LIBRARIES } from '../data/propose'
import { checkSeeds, cleanHandles, seedMismatch } from '../data/seeds'
import { addSeeds, removeSeed, setBrief, setExtracted } from '../data/store'
import { COUNTRY_NAMES } from '../lib/format'
import type { TemplateId } from '../types'

// Zone 3. The two questions the campaign was born from, still in the client's
// own words, plus the handful of things we read out of them.
//
// Everything on this screen can be changed, because everything on it is either
// something the client wrote or a machine's reading of it, and a machine's
// reading of two sentences is the thing most worth being able to correct. What
// cannot be changed here is the rules: rewriting an answer suggests new ones,
// it never writes them.
//
// Niches are the one reading kept off this page. They carry their own numbers,
// so they are edited where those numbers are.

/** The countries we are willing to look in. Offered, not typed. */
const PLACES = Object.keys(COUNTRY_NAMES)

function Countries({ picked, onChange }: { picked: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="pill-row">
        {picked.map((code) => (
          <button
            key={code}
            type="button"
            className="chip on"
            title={`Stop looking in ${COUNTRY_NAMES[code] ?? code}`}
            onClick={() => onChange(picked.filter((c) => c !== code))}
          >
            {COUNTRY_NAMES[code] ?? code} <span aria-hidden="true">✕</span>
          </button>
        ))}
        {picked.length === 0 && <span className="faint">Anywhere</span>}
        <button type="button" className="chip" onClick={() => setOpen(!open)}>
          {open ? 'Done' : 'Add a country'}
        </button>
      </div>
      {open && (
        <div className="pill-row pick-row">
          {PLACES.filter((c) => !picked.includes(c)).map((code) => (
            <button key={code} type="button" className="chip" onClick={() => onChange([...picked, code])}>
              {COUNTRY_NAMES[code]}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

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
            ? 'None yet. Name accounts you already know fit, and we look at the people around them.'
            : `${seeds.filter((v) => v.state !== 'fails').length} of ${seeds.length} hold up against your rules today. We follow those to find people like them, and leave the rest alone.`}
        </p>
        {mismatch && <p className="notice warn">{mismatch}</p>}
        {seeds.length > 0 && (
          <ul className="rules stacked">
            {seeds.map((v) => (
              <li key={v.handle} className={v.state}>
                <b>
                  @{v.handle}
                  <span className={`seed-tag ${v.state}`}>
                    {v.state === 'fits' ? 'Fits' : v.state === 'fails' ? 'Does not fit' : 'New to us'}
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

      <div className="card">
        <h2>What we read out of it</h2>
        <div className="read-field">
          <span className="drawer-label">Countries we look in</span>
          <Countries
            picked={extracted.countries}
            onChange={(countries) => setExtracted(campaignId, { countries })}
          />
        </div>
        <div className="read-field">
          <span className="drawer-label">Scoring started from</span>
          <div className="pill-row">
            {LIBRARIES.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`chip${extracted.templateId === l.id ? ' on' : ''}`}
                title={l.when}
                onClick={() => setExtracted(campaignId, { templateId: l.id as TemplateId })}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="read-field">
          <span className="drawer-label">Niches, set with your rules</span>
          <div className="pill-row">
            {extracted.niches.filter((n) => n.enabled).map((n) => (
              <span key={n.id} className="tag-chip">{n.label}</span>
            ))}
            {extracted.niches.filter((n) => n.enabled).length === 0 && <span className="faint">None picked yet</span>}
          </div>
        </div>
      </div>

      <div className="page-head">
        <span className="spacer" />
        <a className="btn primary" href={`#/campaign/${campaignId}/gates`}>Next, your rules</a>
      </div>
    </>
  )
}
