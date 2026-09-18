// A seeded generator, so the sample account is the same on every load and a
// screenshot taken today matches the one taken tomorrow.

export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]
}

export function between(rand: () => number, low: number, high: number): number {
  return Math.round(low + rand() * (high - low))
}

/** Pulls toward the low end, which is how follower counts actually sit. */
export function skewed(rand: () => number, low: number, high: number): number {
  const t = rand() * rand()
  return Math.round(low + t * (high - low))
}
