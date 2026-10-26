import { describe, expect, it } from 'vitest'
import { pulseCoefficients } from './waves'

/** Rebuild the wave from its coefficients at phase p (0..1). */
function sample(real: Float32Array, imag: Float32Array, p: number, dc: number): number {
  let x = dc
  for (let n = 1; n < real.length; n++) x += real[n] * Math.cos(2 * Math.PI * n * p) + imag[n] * Math.sin(2 * Math.PI * n * p)
  return x
}

describe('pulse waves', () => {
  it('gives a square wave (odd sine harmonics only) at 50% duty', () => {
    const { real, imag } = pulseCoefficients(0.5, 9)
    for (let n = 1; n <= 9; n++) {
      expect(real[n]).toBeCloseTo(0, 6)
      expect(imag[n]).toBeCloseTo(n % 2 ? 2 / (n * Math.PI) : 0, 6)
    }
  })

  it('is high for `duty` of the period and low for the rest', () => {
    const duty = 0.25
    const { real, imag } = pulseCoefficients(duty, 400)
    expect(sample(real, imag, 0.125, duty)).toBeCloseTo(1, 1)
    expect(sample(real, imag, 0.6, duty)).toBeCloseTo(0, 1)
  })

  it('keeps the DC term out (WebAudio ignores index 0)', () => {
    const { real, imag } = pulseCoefficients(0.125)
    expect(real[0]).toBe(0)
    expect(imag[0]).toBe(0)
  })
})
