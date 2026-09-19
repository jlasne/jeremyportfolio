import { useState } from 'react'
import { getAccount } from '../data'
import { api, isLive } from '../lib/api'

// What comes after the list. Being built, and said so.
//
// Two halves, one for each way a creator is reachable.
//
//   Instagram  a browser extension, running in your own browser, on your own
//              account, while you work. Nothing is sent from our servers: a
//              message from us is a message Instagram can tie to us and to
//              every client at once, and one blocked account would take the
//              whole product down with it.
//   Email      a draft in your Gmail, unsent. You read it, you change it, you
//              press send. A tool that sends mail in your name without you
//              reading it is a tool that writes something you would not.
//
// The tips are the part that is finished. They cost nothing to give and they
// are what actually moves a reply rate.

const TIPS: { title: string; body: string }[] = [
  {
    title: 'Name the post, not the person',
    body: 'Open with the thing they made this week. "Your post about training through an injury" beats "love your content", because only one of them proves you looked.',
  },
  {
    title: 'One ask, and make it small',
    body: 'A call is a big ask from a stranger. A yes or no question is a small one, and a reply to a small ask is how a call gets booked anyway.',
  },
  {
    title: 'Say what is in it for them in one line',
    body: 'They read on their phone between two posts. If the offer takes a paragraph to explain, it takes a paragraph too long.',
  },
  {
    title: 'Write to the ones who answer their comments',
    body: 'Someone who answers their own comments answers their own messages. It is the single best sign in the whole profile, and it is on the lead row.',
  },
  {
    title: 'Follow up once, a week later, with something new',
    body: 'A second message that only says "just bumping this" is a second message that gets ignored. Bring a new post or a new number.',
  },
  {
    title: 'Drop people honestly',
    body: 'Mark the ones who never answered as lost, with the reason. It costs one click and it is what tells you which rules are bringing the wrong people.',
  },
]

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
      <p className="subhead">Being built. Write to your leads without leaving the list.</p>

      <div className="two-up">
        <div className="card">
          <h2>On Instagram, from your own browser</h2>
          <p className="gate-lede">
            An extension that works your list while you work. It opens each lead in your own browser, on your own
            account, and sends the message you approved, spaced out like a person types.
          </p>
          <ul className="facts">
            <li className="yes">Your account, your login. We never hold either.</li>
            <li className="yes">Runs in the background while you do something else.</li>
            <li className="yes">Replies land in your inbox, where they always did.</li>
            <li className="yes">The lead moves to contacted on its own, so the list stays true.</li>
          </ul>
        </div>

        <div className="card">
          <h2>By email, as a Gmail draft</h2>
          <p className="gate-lede">
            For every lead with an email, a draft waiting in your Gmail. Written from their last posts and your offer,
            and never sent until you press send.
          </p>
          <ul className="facts">
            <li className="yes">Drafts, not sends. You read every one.</li>
            <li className="yes">From your address, so replies come back to you.</li>
            <li className="yes">One draft a lead, built from what they actually post about.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="verdict-actions">
          {state === 'sent' ? (
            <span className="hint">Noted. You will hear from us the day it opens.</span>
          ) : (
            <button type="button" className="btn primary" onClick={notify}>Tell me when it is ready</button>
          )}
          {state === 'failed' && <span className="warn">That did not go through. Try again in a minute.</span>}
        </div>
      </div>

      <div className="card">
        <h2>Until then, what works</h2>
        <p className="gate-lede">
          Six things that move a reply rate more than any tool does. They are what the extension will do for you.
        </p>
        <ul className="tips">
          {TIPS.map((t) => (
            <li key={t.title}>
              <b>{t.title}</b>
              <small className="muted">{t.body}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
