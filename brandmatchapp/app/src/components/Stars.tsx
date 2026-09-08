import type { Score } from '../types'

const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z'

/** One score, 0 to 3 stars, with the criteria that earned them. */
export function Stars({ score, size = 'row' }: { score: Score; size?: 'row' | 'large' }) {
  const earned = score.earned.length ? score.earned.join(' · ') : 'Nothing yet'
  return (
    <div className={`score${size === 'large' ? ' large' : ''}`}>
      <span className="row" role="img" aria-label={`${score.stars} of 3 stars: ${earned}`}>
        {[0, 1, 2].map((i) => (
          <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
            <path d={PATH} className={i < score.stars ? 'on' : 'off'} />
          </svg>
        ))}
      </span>
      <span className={`earned${score.earned.length ? '' : ' none'}`}>{earned}</span>
    </div>
  )
}
