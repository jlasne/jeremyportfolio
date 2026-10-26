// Server clock offset. Every response carries the server's `now`; the offset is taken against the
// midpoint of the request, smoothed so one slow response does not jerk the countdown.

let offset = 0
let samples = 0

/** Records one sample: the server said `serverNow` for a request sent at `sentAt` and answered at `receivedAt`. */
export function noteServerTime(serverNow: number, sentAt: number, receivedAt: number): void {
  if (!Number.isFinite(serverNow) || receivedAt < sentAt) return
  const sample = serverNow - (sentAt + receivedAt) / 2
  // The first samples set it outright, later ones nudge it.
  offset = samples < 3 ? (offset * samples + sample) / (samples + 1) : offset * 0.8 + sample * 0.2
  samples++
}

/** Server time estimate, epoch ms. */
export function serverNow(): number {
  return Date.now() + offset
}

export function clockOffset(): number {
  return offset
}

export function resetClock(): void {
  offset = 0
  samples = 0
}
