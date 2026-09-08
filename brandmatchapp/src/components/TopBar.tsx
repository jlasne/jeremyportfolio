import type { Route } from '../lib/router'

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="7" fill="#17191F" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#D98E04" />
  </svg>
)

export function TopBar({ route }: { route: Route }) {
  const on = (name: Route['name']) => (route.name === name ? 'on' : undefined)
  return (
    <header className="topbar">
      <a className="brand" href="#/feed">
        <Mark />
        brandmatch
      </a>
      <nav className="nav" aria-label="Main">
        <a href="#/feed" className={on('feed')}>Feed</a>
        <a href="#/lists" className={on('lists')}>Saved lists</a>
        <a href="#/settings" className={on('settings')}>Settings</a>
      </nav>
      <span className="spacer" />
    </header>
  )
}
