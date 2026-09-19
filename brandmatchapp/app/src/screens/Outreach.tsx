import { useState } from 'react'
import { getAccount } from '../data'
import { api, isLive } from '../lib/api'

// What comes after the list. Not built, and said so.
//
// Writing to people from inside the tool is out of this version on purpose:
// a message sent from our servers is a message Instagram can tie to us, and
// to every client at once. The extension runs in the client's own browser, on
// their own account, one person at a time. That is the only way it stays
// their outreach and not ours.

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
      <p className="subhead">Coming soon. Write to your leads without leaving the list.</p>

      <div className="card">
        <h2>A browser extension, on your own Instagram account</h2>
        <p className="gate-lede">
          You open a lead, you click write, the message goes out from your account, in your name, in your inbox.
          We never touch your login and nothing is sent from our side.
        </p>
        <ul className="facts">
          <li className="yes">One click from the lead, the way a status change works today.</li>
          <li className="yes">Your message, your account, your inbox. Replies land where they always did.</li>
          <li className="yes">The status moves to contacted on its own, so the list stays true.</li>
        </ul>
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
