import { getDashboard } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import { getSettings } from '../data'
import type { Route } from '../lib/router'

const Mark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="7" fill="#17191F" />
    <path d="M16 5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L16 21.6l-6.7 3.9 1.7-7.6-5.8-5.1 7.7-.7z" fill="#D98E04" />
  </svg>
)

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/dashboard', label: 'Dashboard', name: 'dashboard' },
  { href: '#/feed', label: 'Feed', name: 'feed' },
  { href: '#/groups', label: 'Groups', name: 'groups' },
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/agents', label: 'Agents', name: 'agents' },
  { href: '#/lists', label: 'Saved lists', name: 'lists' },
  { href: '#/settings', label: 'Settings', name: 'settings' },
]

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  const newToday = d.today
  return (
    <nav className="sidenav" aria-label="Main">
      <a className="brand" href="#/dashboard">
        <Mark />
        brandmatch
      </a>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.href}>
            <a href={item.href} className={route.name === item.name ? 'on' : undefined} aria-current={route.name === item.name ? 'page' : undefined}>
              <span>{item.label}</span>
              {item.name === 'feed' && newToday ? <span className="pill num">{newToday}</span> : null}
            </a>
          </li>
        ))}
      </ul>
      <p className="sidenav-foot">Next batch {nextBatchLabel(getSettings().timezone)}</p>
    </nav>
  )
}
