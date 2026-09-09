/**
 * Two circles overlapping, the middle knocked out. The overlap is the match.
 * Filled with the brand gradient, orange into purple.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="bm-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F2662A" />
          <stop offset="100%" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="#1B1420" />
      <path
        fill="url(#bm-mark)"
        fillRule="evenodd"
        d="M186 138a118 118 0 1 0 0 236 118 118 0 0 0 0-236zM326 138a118 118 0 1 0 0 236 118 118 0 0 0 0-236z"
      />
    </svg>
  )
}
