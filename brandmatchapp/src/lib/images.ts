// Placeholder pictures generated on the device. Nothing loads from the network.

const PALETTE = ['#D98E04', '#0F8A7A', '#2657D9', '#7A4FD1', '#C2478A', '#3B7D2E', '#B8561E', '#3A6D9E']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function svgUri(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function avatarFor(name: string, seed: string): string {
  const color = PALETTE[hash(seed) % PALETTE.length]
  const initials = name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/><text x="32" y="39" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="600" fill="#fff">${initials}</text></svg>`,
  )
}

export function thumbnailFor(seed: string, kind: 'reel' | 'post'): string {
  const h = hash(seed)
  const a = PALETTE[h % PALETTE.length]
  const b = PALETTE[(h >> 3) % PALETTE.length]
  const cx = 20 + (h % 40)
  const cy = 30 + ((h >> 5) % 40)
  const r = 14 + ((h >> 9) % 18)
  const ratio = kind === 'reel' ? 'viewBox="0 0 72 96"' : 'viewBox="0 0 72 72"'
  const height = kind === 'reel' ? 96 : 72
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" ${ratio}><rect width="72" height="${height}" fill="${a}" opacity="0.18"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${b}" opacity="0.55"/><rect x="8" y="${height - 22}" width="40" height="6" rx="3" fill="${a}" opacity="0.6"/></svg>`,
  )
}
