// Small hooks shared by the multiplayer screens.

import { useEffect, useRef, useState } from 'react'
import { useUi } from '../../store/ui'

/** Re-renders every `ms` while `active`, returning Date.now() (for countdowns and "away" checks). */
export function useNow(ms = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms, active])
  return now
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission refused or insecure context: fall back below.
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * Copy with feedback: `copied` holds the key of what was just copied for 2 s (the button shows
 * "Copied"), and the result is announced for screen readers.
 */
export function useCopy(): { copied: string | null; failed: string | null; copy: (key: string, text: string, spoken: string) => void } {
  const [copied, setCopied] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current != null && window.clearTimeout(timer.current)), [])
  const copy = (key: string, text: string, spoken: string) => {
    void writeClipboard(text).then((ok) => {
      if (timer.current != null) window.clearTimeout(timer.current)
      setCopied(ok ? key : null)
      setFailed(ok ? null : key)
      useUi.getState().announce(ok ? `${spoken} copied.` : `Could not copy. ${spoken}: ${text}`)
      timer.current = window.setTimeout(() => {
        setCopied(null)
        setFailed(null)
      }, 2000)
    })
  }
  return { copied, failed, copy }
}
