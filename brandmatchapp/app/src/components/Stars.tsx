import type { Score } from '../types'

const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z'

/**
 * Three stars, one per criterion, each empty, half or full. Position is fixed:
 * niche, then selling, then signal. Half means the criterion half fits.
 */
export function Stars({ score, size = 'row' }: { score: Score; size?: 'row' | 'large' }) {
  const label = score.earned.map((e) => `${e.label} ${e.level === 1 ? 'full' : e.level === 0.5 ? 'half' : 'none'}`).join(', ')
  return (
    <span className={`score${size === 'large' ? ' large' : ''}`} role="img" aria-label={`${score.stars} of 3 stars. ${label}`}>
      {score.earned.map((e) => (
        <span key={e.label} className="star" title={`${e.label}: ${e.note}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={PATH} className="off" />
            {e.level > 0 && (
              <g clipPath={e.level === 0.5 ? 'url(#half-star)' : undefined}>
                <path d={PATH} className="on" />
              </g>
            )}
          </svg>
        </span>
      ))}
      <b className="num">{score.stars % 1 === 0 ? score.stars : score.stars.toFixed(1)}</b>
    </span>
  )
}

/** The clip every half star uses. Rendered once, at the root. */
export function StarClip() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <clipPath id="half-star" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
    </svg>
  )
}
