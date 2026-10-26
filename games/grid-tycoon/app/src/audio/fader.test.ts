import { describe, expect, it } from 'vitest'
import { Fader, levelAt } from './fader'

/** An AudioParam whose `value` getter behaves like Firefox: the last value set directly, never the ramp. */
function staticParam() {
  const calls: [string, number, number?][] = []
  const param = {
    value: 0,
    cancelScheduledValues: (t: number) => calls.push(['cancel', t]),
    setValueAtTime: (v: number, t: number) => calls.push(['set', v, t]),
    linearRampToValueAtTime: (v: number, t: number) => calls.push(['linear', v, t]),
  }
  return { param: param as unknown as AudioParam, calls }
}

describe('levelAt', () => {
  const pts = [
    { time: 1, value: 0 },
    { time: 3, value: 1 },
  ]

  it('is flat before the first point and after the last', () => {
    expect(levelAt(pts, 0.5, 0)).toBe(0.5)
    expect(levelAt(pts, 0.5, 9)).toBe(1)
    expect(levelAt([], 0.7, 4)).toBe(0.7)
  })

  it('interpolates linearly between points', () => {
    expect(levelAt(pts, 0, 2)).toBe(0.5)
    expect(levelAt(pts, 0, 2.5)).toBe(0.75)
  })

  it('treats two points at the same time as a jump', () => {
    expect(levelAt([{ time: 1, value: 0 }, { time: 1, value: 1 }], 0, 1)).toBe(1)
  })
})

describe('Fader', () => {
  it('starts a fade-out from the real level of an unfinished fade-in, even when param.value lies', () => {
    const { param, calls } = staticParam()
    const f = new Fader(param, 0)
    f.rampTo(1, 10, 1.5) // fade in from t=10 to 11.5
    calls.length = 0
    f.rampTo(0, 10.75, 1.5) // season changes again halfway through
    expect(calls).toEqual([
      ['cancel', 10.75],
      ['set', 0.5, 10.75],
      ['linear', 0, 12.25],
    ])
    expect(f.levelAt(11.5)).toBeCloseTo(0.25, 12)
  })

  it('dips and recovers for a duck, and a second duck mid-recovery starts where the first one is', () => {
    const { param } = staticParam()
    const f = new Fader(param, 1)
    f.rampTo(0.6, 0, 0.02)
    f.thenRampTo(1, 0.1, 0.4)
    expect(f.levelAt(0.05)).toBe(0.6)
    expect(f.levelAt(0.3)).toBeCloseTo(0.8, 12)
    f.rampTo(0.6, 0.3, 0.02)
    expect(f.levelAt(0.3)).toBeCloseTo(0.8, 12)
    expect(f.levelAt(0.4)).toBe(0.6)
  })

  it('prunes old points without changing the current level', () => {
    const { param } = staticParam()
    const f = new Fader(param, 1)
    for (let i = 0; i < 50; i++) {
      f.rampTo(0.6, i, 0.02)
      f.thenRampTo(1, i + 0.1, 0.4)
      f.prune(i - 1)
    }
    expect(f.levelAt(49.3)).toBeCloseTo(0.8, 12)
    expect(f.levelAt(100)).toBe(1)
    f.prune(100)
    expect(f.levelAt(100)).toBe(1)
  })
})
