/**
 * Two circles overlapping, the middle knocked out. The overlap is the match.
 * A sibling to the CreatorMatch mark, in the same navy and off white.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <rect width="512" height="512" rx="116" fill="#070a12" />
      <path
        fill="#f2f3f7"
        fillRule="evenodd"
        d="M186 138a118 118 0 1 0 0 236 118 118 0 0 0 0-236zM326 138a118 118 0 1 0 0 236 118 118 0 0 0 0-236z"
      />
    </svg>
  )
}

/** The same mark as a data URI, for the browser tab. */
export const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='116' fill='%23070a12'/%3E%3Cpath fill='%23f2f3f7' fill-rule='evenodd' d='M186 138a118 118 0 1 0 0 236 118 118 0 0 0 0-236zM326 138a118 118 0 1 0 0 236 118 118 0 0 0 0-236z'/%3E%3C/svg%3E"
