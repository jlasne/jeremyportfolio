import { useState } from 'react'

// An explanation that waits to be asked for.
//
// Every screen has a sentence that helps the first time and is noise the
// hundredth. It sits behind a small mark, opens on a click, and closes on the
// next one. The mark carries the text as a title too, so a hover is enough.

export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="info">
      <button
        type="button"
        className={`info-mark${open ? ' on' : ''}`}
        aria-label={open ? 'Hide the explanation' : 'Explain this'}
        aria-expanded={open}
        title={open ? undefined : text}
        onClick={() => setOpen(!open)}
      >
        i
      </button>
      {open && <span className="info-text">{text}</span>}
    </span>
  )
}
