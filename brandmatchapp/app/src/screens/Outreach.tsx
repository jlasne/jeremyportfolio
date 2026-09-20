import { useState } from 'react'
import { getAccount } from '../data'
import { api, isLive } from '../lib/api'

// What comes after the list. Not built, and the page says so in one line.
//
// Nothing else is on it on purpose. A coming-soon page that lists features in
// detail reads as a promise, and the only promise worth making here is that we
// will say when it opens.
//
// What it will be: an extension running in the client's own browser, on their
// own account, and a draft in their own Gmail. Never a message sent from our
// servers, because a message from us is a message Instagram can tie to us and
// to every client at once.

export function Outreach() {
  const account = getAccount()
  const [state, setState] = useState<'idle' | 'sent' | 'failed'>('idle')

  const notify = async () => {
    // The sample account has nowhere to send this. A real one joins the list.
    if (!isLive()) { setState('sent'); return }
    try {
      await api.waitlist(account.email, 'outreach')
      setState('sent')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="page">
      <div className="page-head"><h1>Outreach</h1></div>

      <div className="card soon-card">
        <h2>Let brandmatch do your outreach for you</h2>
        <p className="gate-lede">Coming soon.</p>
        <div className="verdict-actions">
          {state === 'sent' ? (
            <span className="hint">Noted. You will hear from us the day it opens.</span>
          ) : (
            <button type="button" className="btn primary" onClick={notify}>Tell me when it is ready</button>
          )}
          {state === 'failed' && <span className="warn">That did not go through. Try again in a minute.</span>}
        </div>
      </div>
    </div>
  )
}
