// The app reloads itself when a newer build is live.
//
// A tab opened before a deploy keeps running the old bundle, and a hash change
// is not a page load, so an address added in the new build lands on the old
// router and reads as unknown. The first time that happened, the demo address
// showed the landing page. Now every navigation asks the host which build is
// current and reloads once when it is not this one.

const SEEN = 'brandmatch.build'
const EVERY = 10_000
let last = 0

function running(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[src*="assets/index-"]')
  return script?.src.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1] ?? null
}

async function current(): Promise<string | null> {
  try {
    const res = await fetch(`${window.location.pathname}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.text()).match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1] ?? null
  } catch {
    return null
  }
}

async function check(): Promise<void> {
  const now = Date.now()
  if (now - last < EVERY) return
  last = now
  const mine = running()
  const live = await current()
  if (!mine || !live || mine === live) return
  // Once per new build. A host still serving the old page to this browser
  // would otherwise reload it forever.
  try {
    if (window.sessionStorage.getItem(SEEN) === live) return
    window.sessionStorage.setItem(SEEN, live)
  } catch {
    /* storage off: reload anyway, once is all a session gets without it */
  }
  window.location.reload()
}

/** Checks on every navigation and every return to the tab. */
export function keepFresh(): void {
  window.addEventListener('hashchange', () => void check())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
}
