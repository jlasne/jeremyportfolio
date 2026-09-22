import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useState } from 'react'

// An explanation that waits to be asked for.
//
// Every screen has a paragraph that helps the first time and is noise the
// hundredth. It used to sit above the thing it explained, in permanent ink,
// so a screen with three ideas on it opened with three paragraphs before the
// first control. Now it sits behind a small mark and opens in a panel over
// the page, like the help panel does, which is the one dialog this app has.
//
// It opened in place before, pushing the page down as it went. A block that
// appears between a heading and its controls moves everything the reader was
// about to click, which is the one thing an explanation must not do.
//
// Escape closes it, and so does the ground around it. Focus goes to the close
// button and comes back to the mark, so the keyboard does not lose its place.

export function Info({ title, text }: { title?: string; text: string | string[] }) {
  const [open, setOpen] = useState(false)
  const mark = useRef<HTMLButtonElement>(null)
  return (
    <span className="info">
      <button
        ref={mark}
        type="button"
        className={`info-mark${open ? ' on' : ''}`}
        aria-label={open ? 'Hide the explanation' : 'Explain this'}
        aria-expanded={open}
        title={open ? undefined : 'Explain this'}
        onClick={() => setOpen(!open)}
      >
        i
      </button>
      {open && (
        <InfoSheet
          title={title}
          text={text}
          onClose={() => {
            setOpen(false)
            mark.current?.focus()
          }}
        />
      )}
    </span>
  )
}

function InfoSheet({ title, text, onClose }: { title?: string; text: string | string[]; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const shut = useRef<HTMLButtonElement>(null)
  const paragraphs = Array.isArray(text) ? text : [text]

  useEffect(() => {
    shut.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return createPortal(
    <div
      className="sheet-ground"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Explanation'}
      onMouseDown={(e) => { if (!card.current?.contains(e.target as Node)) onClose() }}
    >
      <div className="sheet info-sheet" ref={card}>
        <div className="sheet-head">
          <h2>{title ?? 'What this is'}</h2>
          <button ref={shut} type="button" className="btn small quiet" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {paragraphs.map((p) => <p key={p}>{p}</p>)}
      </div>
    </div>,
    document.body,
  )
}
