import { getGateSet, getGateVersions, getVerdictCounts, VERDICT_LABEL } from '../data'
import { ruleLabel } from '../data/gates'
import { compact, absolute } from '../lib/format'
import type { HardRules } from '../types'

// Zone 4. Three gates, in the order they run.
//
// Gate 1 reads numbers we measured and costs nothing. Gate 2 asks yes or no and
// one no ends it. Gate 3 scores seven criteria out of 2 and the client sets the
// bar. Editing any of them writes a new version, so a lead delivered last week
// can still be explained against last week's rules.

const ORDER: (keyof HardRules)[] = [
  'followersMin', 'followersMax', 'medianViewsMin', 'medianCommentsMin', 'postsPerMonthMin', 'lastPostWithinDays',
]

function value(key: keyof HardRules, hard: HardRules): string {
  const raw = hard[key]
  if (typeof raw !== 'number') return 'not applied'
  if (key === 'lastPostWithinDays') return `${raw} days`
  return compact(raw)
}

export function Gates({ campaignId }: { campaignId: string }) {
  const gates = getGateSet(campaignId)
  const versions = getGateVersions(campaignId)
  const verdicts = getVerdictCounts(campaignId)
  if (!gates) return null

  return (
    <>
      <div className="card">
        <h2>Gate 1, hard filters</h2>
        <p className="muted">Measured on real posts. A profile that fails here never reaches the model.</p>
        <ul className="rules">
          {ORDER.map((key) => (
            <li key={key}>
              <span>{ruleLabel(key)}</span>
              <b className="num">{value(key, gates.hard)}</b>
            </li>
          ))}
          <li>
            <span>Languages</span>
            <b>{gates.hard.languages?.join(', ') ?? 'any'}</b>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Gate 2, knockouts</h2>
        <p className="muted">One no eliminates. {gates.knockouts.length} questions.</p>
        <ul className="rules stacked">
          {gates.knockouts.map((k) => (
            <li key={k.id}>
              <b>{k.question}</b>
              {k.why && <small className="muted">{k.why}</small>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Gate 3, score</h2>
        <p className="muted">
          Seven criteria, 0 to 2 each. Qualified at <b className="num">{gates.passScore}</b> out of{' '}
          {gates.criteria.length * 2}.
        </p>
        <ul className="rules stacked">
          {gates.criteria.map((c) => (
            <li key={c.id}>
              <b>{c.label}</b>
              {c.guide && <small className="muted">{c.guide}</small>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Where profiles stopped</h2>
        <ul className="rules">
          {verdicts.map((v) => (
            <li key={v.verdict}>
              <span>{VERDICT_LABEL[v.verdict]}</span>
              <b className="num">{v.count}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Versions</h2>
        <ul className="rules">
          {versions.map((v) => (
            <li key={v.id}>
              <span>
                Version {v.version}, {v.origin === 'generated' ? 'generated from the brief' : 'edited by you'}
                {v.id === gates.id ? ', live now' : ''}
              </span>
              <b>{absolute(v.createdAt)}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="page-head">
        <span className="spacer" />
        <a className="btn primary" href={`#/campaign/${campaignId}/feasibility`}>Next, test it</a>
      </div>
    </>
  )
}
