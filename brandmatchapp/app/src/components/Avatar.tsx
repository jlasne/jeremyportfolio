/**
 * Initials on a colour picked from the handle. No face, no request out.
 *
 * Instagram avatar URLs expire and rewriting them through a proxy would put a
 * real person's picture on our servers for nothing. Initials say who the row is
 * about just as well at 36 pixels.
 */
const TINTS = ['#ff5c2b', '#2aa17a', '#4762d6', '#b4467f', '#c98a12', '#1d1d1f']

export function Avatar({ name, handle, size = 36 }: { name: string; handle: string; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || handle.slice(0, 2).toUpperCase()

  let hash = 0
  for (const ch of handle) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0

  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: TINTS[hash % TINTS.length],
        fontSize: Math.round(size * 0.38),
      }}
    >
      {letters}
    </span>
  )
}
