import { useRoute } from './lib/router'
import { Backdrop } from './components/Backdrop'
import { SideNav } from './components/SideNav'
import { StarClip } from './components/Stars'
import { CampaignEditor, Campaigns } from './screens/Campaign'
import { Connect } from './screens/Connect'
import { Settings } from './screens/Settings'
import { Contacts } from './screens/Contacts'
import { Landing } from './screens/Landing'
import { FirstRun, OnboardingCampaign, OnboardingStart } from './screens/Onboarding'

export function App() {
  const route = useRoute()

  if (route.name === 'home') {
    return (
      <>
        <StarClip />
        <Landing />
      </>
    )
  }

  if (route.name === 'onboarding') {
    return (
      <>
        <Backdrop />
        <StarClip />
        {!route.campaignId && <OnboardingStart />}
        {route.campaignId && !route.running && <OnboardingCampaign campaignId={route.campaignId} />}
        {route.campaignId && route.running && <FirstRun campaignId={route.campaignId} />}
      </>
    )
  }

  // Same ground as the landing: one grid, one warm glow, under every screen.
  return (
    <div className="shell">
      <Backdrop />
      <StarClip />
      <SideNav route={route} />
      <main className="main">
        {route.name === 'contacts' && <Contacts scopeId={route.scopeId} />}
        {route.name === 'campaign' && (route.campaignId ? <CampaignEditor campaignId={route.campaignId} /> : <Campaigns />)}
        {route.name === 'connect' && <Connect />}
        {route.name === 'settings' && <Settings />}
      </main>
    </div>
  )
}
