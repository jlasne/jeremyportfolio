import { useRoute } from './lib/router'
import { Backdrop } from './components/Backdrop'
import { SideNav } from './components/SideNav'
import { isPreview, setPreview } from './lib/api'
import { useEffect } from 'react'
import { Account } from './screens/Account'
import { Admin } from './screens/Admin'
import { CampaignZone } from './screens/CampaignZone'
import { Campaigns } from './screens/Campaigns'
import { Dashboard } from './screens/Dashboard'
import { Landing } from './screens/Landing'
import { Leads } from './screens/Leads'
import { NewCampaign } from './screens/NewCampaign'
import { Outreach } from './screens/Outreach'

// Five product zones, plus the account and the internal admin. The landing is
// its own page with its own ground.

export function App() {
  const route = useRoute()

  if (route.name === 'home') return <Landing />
  if (route.name === 'demo') return <Demo />

  return (
    <div className="shell">
      <Backdrop />
      <SideNav route={route} />
      <main className="main">
        {isPreview() && (
          <div className="preview-bar" role="status">
            <span>Sample data, so you can see every screen filled. Nothing here is yours.</span>
            <button
              type="button"
              className="btn small"
              onClick={() => { setPreview(false); window.location.reload() }}
            >
              Back to your account
            </button>
          </div>
        )}
        {route.name === 'dashboard' && <Dashboard />}
        {route.name === 'leads' && <Leads leadId={route.leadId} query={route.query} />}
        {route.name === 'campaigns' && <Campaigns />}
        {route.name === 'newCampaign' && <NewCampaign />}
        {route.name === 'campaign' && <CampaignZone campaignId={route.campaignId} tab={route.tab} />}
        {route.name === 'account' && <Account />}
        {route.name === 'outreach' && <Outreach />}
        {route.name === 'admin' && <Admin />}
      </main>
    </div>
  )
}

/** #/demo: the sample, filled. One address to send anyone who wants to see it. */
function Demo() {
  useEffect(() => {
    setPreview(true)
    window.location.replace('#/dashboard')
    window.location.reload()
  }, [])
  return null
}
