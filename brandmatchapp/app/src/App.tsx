import { useRoute } from './lib/router'
import { Backdrop } from './components/Backdrop'
import { SideNav } from './components/SideNav'
import { Account } from './screens/Account'
import { Admin } from './screens/Admin'
import { CampaignZone } from './screens/CampaignZone'
import { Campaigns } from './screens/Campaigns'
import { Dashboard } from './screens/Dashboard'
import { Landing } from './screens/Landing'
import { Leads } from './screens/Leads'

// Five product zones, plus the account and the internal admin. The landing is
// its own page with its own ground.

export function App() {
  const route = useRoute()

  if (route.name === 'home') return <Landing />

  return (
    <div className="shell">
      <Backdrop />
      <SideNav route={route} />
      <main className="main">
        {route.name === 'dashboard' && <Dashboard />}
        {route.name === 'leads' && <Leads leadId={route.leadId} />}
        {route.name === 'campaigns' && <Campaigns />}
        {route.name === 'campaign' && <CampaignZone campaignId={route.campaignId} tab={route.tab} />}
        {route.name === 'account' && <Account />}
        {route.name === 'admin' && <Admin />}
      </main>
    </div>
  )
}
