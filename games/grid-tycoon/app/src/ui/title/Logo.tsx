// The game logo: "Grid Tycoon" in the pixel face with a pixel bolt, hard pixel shadow, and a row of
// "power dots" that run under the word (still under reduced motion).

import { Icon } from '../kit'

export function Logo({ size = 'hero' }: { size?: 'hero' | 'small' }) {
  return (
    <div className={`logo logo-${size}`}>
      <span className="logo-bolt" aria-hidden="true">
        <Icon name="bolt" size={size === 'hero' ? 64 : 24} />
      </span>
      <h1 className="logo-word">
        <span className="logo-line">Grid</span> <span className="logo-line logo-line-2">Tycoon</span>
      </h1>
      {size === 'hero' ? (
        <span className="logo-dots" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </span>
      ) : null}
    </div>
  )
}
