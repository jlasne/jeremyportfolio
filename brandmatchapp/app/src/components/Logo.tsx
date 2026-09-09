/**
 * Two circles overlapping, the middle knocked out. The overlap is the match.
 * Orange on the left, purple on the right, flat.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <rect width="512" height="512" rx="116" fill="#1B1420" />
      <circle cx="186" cy="256" r="118" fill="#F2662A" />
      <circle cx="326" cy="256" r="118" fill="#7C5CFF" />
      <path fill="#1B1420" d="M256 161A118 118 0 0 1 256 351A118 118 0 0 1 256 161Z" />
    </svg>
  )
}
