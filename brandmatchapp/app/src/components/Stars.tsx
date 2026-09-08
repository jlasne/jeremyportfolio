import type { Score } from '../types'

const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z'

/** One score, 0 to 3 stars, with the rung it sits on. */
export function Stars({ score, size = 'row' }: { score: Score; size?: 'row' | 'large' }) {
  return (
    <div className={`score${size === 'large' ? ' large' : ''}`}>
      <span className="row" role="img" aria-label={`${score.stars} of 3 stars, ${score.rung}`}>
        {[0, 1, 2].map((i) => (
          <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
            <path d={PATH} className={i < score.stars ? 'on' : 'off'} />
          </svg>
        ))}
      </span>
      <span className="rung">{score.rung}</span>
    </div>
  )
}

/** The ladder, written out. Shown wherever the score needs explaining. */
export const LADDER: { stars: number; rung: string; means: string }[] = [
  { stars: 3, rung: 'Ready now', means: 'Fits the brief, sells something, and a brand signal fired in the last 30 days' },
  { stars: 2, rung: 'Selling', means: 'Fits the brief and sells a program, coaching, an ebook or an app' },
  { stars: 1, rung: 'Niche fit', means: 'Fits the brief and sells nothing yet' },
  { stars: 0, rung: 'Outside', means: 'Content or audience sits outside the brief' },
]
