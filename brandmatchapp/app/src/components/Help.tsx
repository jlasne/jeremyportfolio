import { useEffect, useRef, useState } from 'react'

// Getting hold of us.
//
// Three ways, and two of them do not exist yet. They are on the card anyway,
// greyed and labelled, because a help panel that hides what is coming is a
// panel people stop opening. The one that works is an email address, answered
// by the person who wrote this.

const EMAIL = 'hey@jeremylasne.com'

export function Help({ onClose }: { onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // Escape closes it, and so does the ground around it. A panel you can only
  // leave by finding a small cross is a panel that feels like a trap.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div
      className="sheet-ground"
      role="dialog"
      aria-modal="true"
      aria-label="Help Center"
      onMouseDown={(e) => { if (!card.current?.contains(e.target as Node)) onClose() }}
    >
      <div className="sheet" ref={card}>
        <div className="sheet-head">
          <h2>Help Center</h2>
          <button type="button" className="btn small quiet" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <ul className="help-ways">
          <li className="soon-row">
            <div>
              <b>Book a call with us</b>
              <small className="muted">Twenty minutes, screen shared, on your own rules.</small>
            </div>
            <span className="soon">soon</span>
          </li>
          <li className="soon-row">
            <div>
              <b>Ask the AI</b>
              <small className="muted">It reads your campaigns and answers about them.</small>
            </div>
            <span className="soon">soon</span>
          </li>
          <li>
            <div>
              <b>Send me an email</b>
              <small className="muted">I answer quickly. It is me, not a queue.</small>
            </div>
            <div className="help-mail">
              <a className="btn small primary" href={`mailto:${EMAIL}`}>{EMAIL}</a>
              <button
                type="button"
                className="btn small quiet"
                onClick={() => {
                  void navigator.clipboard?.writeText(EMAIL)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2_000)
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </li>
        </ul>

        <p className="hint">
          Something you want built? Put it on <a href="#/roadmap" onClick={onClose}>the roadmap</a> and other people
          can vote for it.
        </p>
      </div>
    </div>
  )
}
