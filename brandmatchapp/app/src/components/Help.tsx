import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Getting hold of us.
//
// One way, and it works: an email address, answered by the person who wrote
// this. The panel used to list two more that did not exist yet, greyed and
// labelled soon. A help panel is opened by somebody who needs an answer now,
// and two thirds of it being unavailable is what makes them close it.
//
// It is drawn into the body rather than where it is written. The button that
// opens it lives in the rail, and the rail is sticky, which makes it a
// stacking context: a fixed panel inside one is trapped underneath the page,
// and this one was coming up behind the dashboard's chart.

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

  return createPortal(
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
      </div>
    </div>,
    document.body,
  )
}
