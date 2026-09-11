import { agentTally, getCampaigns, getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'
import type { Route } from '../lib/router'
import { Logo } from './Logo'

const ITEMS: { href: string; label: string; name: Route['name'] }[] = [
  { href: '#/contacts', label: 'Contacts', name: 'contacts' },
  { href: '#/campaign', label: 'Campaigns', name: 'campaign' },
  { href: '#/connect', label: 'API', name: 'connect' },
  { href: '#/settings', label: 'Settings', name: 'settings' },
]

export function SideNav({ route }: { route: Route }) {
  useStore()
  const d = getDashboard()
  const campaigns = getCampaigns()
  const scopeId = route.name === 'contacts' ? route.scopeId : null
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

              {/*
                A campaign is a group, running or paused, and every one of them
                shows. Its agents sit under it: the name opens the campaign, an
                agent opens the leads it brought.
              */}
              {item.name === 'campaign' && campaigns.length > 0 && (
                <ul className="sub">
                  {campaigns.map((c) => {
                    const here = route.name === 'campaign' && route.campaignId === c.id
                    return (
                      <li key={c.id}>
                        <a href={`#/campaign/${c.id}`} className={here ? 'on' : undefined} aria-current={here ? 'page' : undefined}>
                          <span className="sub-name">{c.name || 'Untitled'}</span>
                          {!c.active && <span className="sub-state">Paused</span>}
                        </a>
                        <ul className="sub-agents">
                          {c.agents.map((a) => {
                            const open = scopeId === a.id
                            return (
                              <li key={a.id}>
                                <a
                                  href={`#/contacts/${a.id}`}
                                  className={open ? 'on' : undefined}
                                  aria-current={open ? 'page' : undefined}
                                  title={`Leads ${a.name} brought in`}
                                >
                                  <i className={`agent-dot${a.active ? ' on' : ''}`} aria-hidden="true" />
                                  <span className="sub-name">{a.name}</span>
                                  <span className="count num">{agentTally(c.id, a.id)}</span>
                                </a>
                              </li>
                            )
                          })}
                        </ul>
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
