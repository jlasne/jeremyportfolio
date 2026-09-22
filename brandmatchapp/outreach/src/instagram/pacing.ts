// Pauses, drawn fresh each time.
//
// A fixed interval is a signature. Between two messages the wait is anywhere
// in the configured range, and between two characters it changes on every
// keystroke, so the run reads at human speed rather than machine speed.

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** A whole number inside the range, both ends included. */
export function pick([min, max]: [number, number]): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

export async function pause(rangeSeconds: [number, number]): Promise<number> {
  const s = pick(rangeSeconds)
  await sleep(s * 1000)
  return s
}
