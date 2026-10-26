// Fourier series for chiptune pulse waves, fed to createPeriodicWave.
//
// A pulse that is high for `duty` of the period is
//   x(t) = duty + Σ (2 / nπ) sin(nπ·duty) cos(nωt − nπ·duty)
// which splits into cos and sin terms:
//   real[n] = sin(2nπ·duty) / nπ,   imag[n] = 2 sin²(nπ·duty) / nπ.
// Only a few dozen harmonics are kept: the top ones are what makes a raw square
// harsh, and the voices are low-passed anyway.

export const PULSE_HARMONICS = 32

export function pulseCoefficients(duty: number, harmonics = PULSE_HARMONICS): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    const a = n * Math.PI * duty
    real[n] = Math.sin(2 * a) / (n * Math.PI)
    imag[n] = (2 * Math.sin(a) ** 2) / (n * Math.PI)
  }
  return { real, imag }
}
