// mulberry32: a tiny 32-bit generator. Its whole state is one uint32, which is
// stored in GameState.rngState so a saved game resumes the exact same stream.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Standard normal (Box-Muller, two uniforms per draw). */
  normal(): number
  /** Current internal state, to store in GameState.rngState. */
  state(): number
}

const UINT32 = 4294967296
const GOLDEN = 0x6d2b79f5

export function createRng(seedOrState: number): Rng {
  let a = seedOrState >>> 0
  const next = (): number => {
    a = (a + GOLDEN) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / UINT32
  }
  return {
    next,
    normal() {
      // 1 - u keeps the log argument in (0, 1].
      const u1 = 1 - next()
      const u2 = next()
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    },
    state: () => a,
  }
}
