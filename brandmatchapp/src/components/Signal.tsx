import type { Signal as SignalT } from '../types'
import { absolute, daysSince, relative } from '../lib/format'

export function Signal({ signal, fallback }: { signal: SignalT | null; fallback?: string }) {
  if (!signal) {
    return (
      <span className="signal none">
        <i className="dot" />
        <span className="what">{fallback ?? 'No signal in the last 90 days'}</span>
      </span>
    )
  }
  const fresh = daysSince(signal.date) <= 30
  return (
    <span className={`signal${fresh ? ' fresh' : ''}`}>
      <i className="dot" />
      <span className="what">{signal.label}</span>
      <time className="when" dateTime={signal.date} title={absolute(signal.date)}>
        {relative(signal.date)}
      </time>
    </span>
  )
}
