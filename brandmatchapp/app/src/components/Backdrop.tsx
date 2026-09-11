/**
 * The ground under the landing and the onboarding: a faint grid with one warm
 * glow in the top right corner. Fixed, behind everything, never clickable.
 * Colours live in styles.css so the whole palette stays in one file.
 */
export function Backdrop() {
  return (
    <div className="backdrop-grid" aria-hidden="true">
      <div className="backdrop-glow" />
    </div>
  )
}
