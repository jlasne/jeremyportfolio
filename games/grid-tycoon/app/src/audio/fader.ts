// A gain whose automation we model ourselves. Browsers disagree on what
// AudioParam.value returns while a ramp runs (Chrome: the live value, Firefox:
// the last value set directly), so a fade that starts from param.value can
// jump. The fader keeps the same piecewise-linear curve it gave the param and
// reads its level from that instead.

export interface Point {
  time: number
  value: number
}

/** Level of a piecewise-linear curve at `time`: flat before the first point and after the last. */
export function levelAt(points: readonly Point[], initial: number, time: number): number {
  if (points.length === 0 || time < points[0].time) return initial
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    if (time >= p.time) {
      const next = points[i + 1]
      if (!next) return p.value
      if (next.time === p.time) return next.value
      return p.value + ((next.value - p.value) * (time - p.time)) / (next.time - p.time)
    }
  }
  return initial
}

export class Fader {
  private points: Point[] = []
  private readonly initial: number

  constructor(private readonly param: AudioParam, initial: number) {
    this.initial = initial
    param.value = initial
  }

  levelAt(time: number): number {
    return levelAt(this.points, this.initial, time)
  }

  /** From the level at `at`, ramp linearly to `value` over `seconds`, replacing anything scheduled later. */
  rampTo(value: number, at: number, seconds: number): number {
    const from = this.levelAt(at)
    const end = at + Math.max(0.005, seconds)
    this.param.cancelScheduledValues(at)
    this.param.setValueAtTime(from, at)
    this.param.linearRampToValueAtTime(value, end)
    this.points = [...this.points.filter((p) => p.time < at), { time: at, value: from }, { time: end, value }]
    return end
  }

  /** Stay at the current target until `at`, then ramp to `value` over `seconds`. Appends to the curve. */
  thenRampTo(value: number, at: number, seconds: number): number {
    const hold = this.points.length ? this.points[this.points.length - 1].value : this.initial
    const end = at + Math.max(0.005, seconds)
    this.param.setValueAtTime(hold, at)
    this.param.linearRampToValueAtTime(value, end)
    this.points.push({ time: at, value: hold }, { time: end, value })
    return end
  }

  /** Forget points that are long past, so the curve stays short over a long session. */
  prune(before: number): void {
    const keepFrom = this.points.findIndex((p) => p.time >= before)
    if (keepFrom > 1) this.points = this.points.slice(keepFrom - 1)
    else if (keepFrom === -1 && this.points.length > 1) this.points = this.points.slice(-1)
  }
}
