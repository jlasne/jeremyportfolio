import { getCampaigns, getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'
import { Logo } from './Logo'

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/campaign', label: 'Campaigns', name: 'campaign' },
  { href: '#/connect', label: 'Connect AI', name: 'connect' },
  { href: '#/settings', label: 'Settings', name: 'settings' },
]

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  const campaigns = getCampaigns()
  return (
    <nav className="sidenav" aria-label="Main">
      <a className="brand" href="#/contacts">
        <Logo size={22} />
        brandmatch
      </a>
      <ul>
        {ITEMS.map((item) => {
          const on = route.name === item.name
          return (
            <li key={item.href}>
              <a href={item.href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
                <span>{item.label}</span>
                {item.name === 'contacts' && d.today ? <span className="pill num">{d.today}</span> : null}
                {item.name === 'connect' ? <span className="soon">Soon</span> : null}
              </a>
              {/* A campaign is a group. Its agents run under it, so the nav shows them that way. */}
              {item.name === 'campaign' && campaigns.length > 0 && (
                <ul className="sub">
                  {campaigns.map((c) => {
                    const here = route.name === 'campaign' && route.campaignId === c.id
                    const running = c.agents.filter((a) => a.active).length
                    return (
                      <li key={c.id}>
                        <a href={`#/campaign/${c.id}`} className={here ? 'on' : undefined} aria-current={here ? 'page' : undefined}>
                          <span>{c.name || 'Untitled'}</span>
                          <span className="count num">{running}/{c.agents.length}</span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <p className="sidenav-foot">Next batch {nextBatchLabel(getSettings().timezone)}</p>
    </nav>
  )
}
