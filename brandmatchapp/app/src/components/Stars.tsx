import type { Stars as StarCount } from '../types'

const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z'

function Row({ kind, stars }: { kind: 'intent' | 'match'; stars: StarCount }) {
  return (
    <span className={`row ${kind}`}>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d={PATH} className={i < stars ? 'on' : 'off'} />
        </svg>
      ))}
    </span>
  )
}

export function Stars({ intent, match, large = false }: { intent: StarCount; match: StarCount; large?: boolean }) {
  return (
    <div className={`stars${large ? ' large' : ''}`} role="img" aria-label={`Intent ${intent} of 3, match ${match} of 3`}>
      <span className="lbl">Intent</span>
      <Row kind="intent" stars={intent} />
      <span className="lbl">Match</span>
      <Row kind="match" stars={match} />
    </div>
  )
}
