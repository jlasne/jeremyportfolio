// One polite live region for the whole app: round changes and round results are announced from
// the store (useUi.announce), so screen-reader users hear what sighted players see animate.

import { useEffect, useState } from 'react'
import { useUi } from '../../store/ui'

export function LiveRegion() {
  const message = useUi((s) => s.liveMessage)
  const id = useUi((s) => s.liveId)
  const [text, setText] = useState('')

  useEffect(() => {
    // Clear then set, so the same sentence twice is still announced.
    setText('')
    const t = window.setTimeout(() => setText(message), 60)
    return () => window.clearTimeout(t)
  }, [message, id])

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  )
}
