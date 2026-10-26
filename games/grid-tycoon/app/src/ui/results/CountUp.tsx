// A number that counts up from 0 to its value once `active` turns on (~700 ms, ease-out), for the
// results beats. Shows the final value at once under reduced motion. Screen readers only ever get
// the final value.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../kit'

interface Props {
  value: number
  format: (v: number) => string
  active?: boolean
  delay?: number
  duration?: number
  className?: string
}

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

export function CountUp({ value, format, active = true, delay = 0, duration = 700, className }: Props) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  const done = useRef(reduced)
  const frame = useRef(0)

  useEffect(() => {
    if (reduced || done.current) {
      setShown(value)
      return
    }
    if (!active) return
    let start = 0
    const step = (now: number) => {
      if (!start) start = now + delay
      const t = Math.max(0, Math.min(1, (now - start) / duration))
      setShown(value * easeOut(t))
      if (t < 1) frame.current = requestAnimationFrame(step)
      else done.current = true
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [active, value, reduced, delay, duration])

  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="visually-hidden">{format(value)}</span>
    </span>
  )
}
