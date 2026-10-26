// Eases a number from its previous value to the new one (~400 ms, ease-out), so treasury and
// prices visibly move. Instant under reduced motion. Screen readers get the final value only.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './hooks'

interface Props {
  value: number
  format: (v: number) => string
  duration?: number
  className?: string
}

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

export function NumberTween({ value, format, duration = 400, className }: Props) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const frame = useRef(0)
  const shownRef = useRef(value)

  useEffect(() => {
    cancelAnimationFrame(frame.current)
    if (reduced || !Number.isFinite(value) || !Number.isFinite(shownRef.current)) {
      shownRef.current = value
      setShown(value)
      return
    }
    from.current = shownRef.current
    if (from.current === value) return
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = from.current + (value - from.current) * easeOut(t)
      shownRef.current = t >= 1 ? value : v
      setShown(shownRef.current)
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [value, reduced, duration])

  const final = format(value)
  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="visually-hidden">{final}</span>
    </span>
  )
}
