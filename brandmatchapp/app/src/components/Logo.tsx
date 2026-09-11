import { useId } from 'react'

/**
 * Two circles overlapping, the overlap knocked out. The gap is the match.
 * Two shades of orange and nothing else: no frame, no second hue.
 * The mask id comes from useId, so two marks on one page stay separate.
 */
export function Logo({ size = 22 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <mask id={id}>
        <rect width="512" height="512" fill="#fff" />
        <path fill="#000" d="M256 126.1A150 150 0 0 1 256 385.9A150 150 0 0 1 256 126.1Z" />
      </mask>
      <g mask={`url(#${id})`}>
        <circle cx="181" cy="256" r="150" fill="#FFA277" />
        <circle cx="331" cy="256" r="150" fill="#FF5C2B" />
      </g>
    </svg>
  )
}
