import { useState } from 'react'
import { getAccount, getMembers, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { getState } from '../data/store'
import { TIERS } from '../mock/account'
import { API, getKey, hasKey, setKey } from '../lib/api'
import { absolute, money } from '../lib/format'

// Outside the zones: everything about the account rather than the work.
//
// Four sections, one tab each, because they are read on different days: who
// is on the account, what it costs, how a machine gets in, and how you get in.
// A single scrolling page would put the password under the invoices.
//
// There is no analysed volume here and no cost of production, because a plan
// is bought by the month and that is the only money a client has with us.

type Tab = 'members' | 'billing' | 'api' | 'access'

const TABS: { id: Tab; label: string }[] = [
  { id: 'members', label: 'Members' },
  { id: 'billing', label: 'Billing' },
  { id: 'api', label: 'API' },
  { id: 'access', label: 'Sign in' },
]

/** A plan is bought by the month. The daily rate is how it arrives. */
const MONTH_DAYS = 30

/**
 * One link, copied by hand. Nothing is emailed, because nothing here sends
 * email yet and a half built invite is worse than a link you paste yourself.
 */
function Invite() {
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const make = () => {
    const clean = email.trim().toLowerCase()
    if (!clean.includes('@')) return
    const token = Math.random().toString(36).slice(2, 10)
    setLink(`${window.location.origin}/#/join/${token}?email=${encodeURIComponent(clean)}`)
  }
  return (
    <div className="invite">
      <div className="invite-row">
        <input
          className="input"
          type="email"
          placeholder="Their email"
          aria-label="Email of the person to invite"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setLink(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') make() }}
        />
        <button type="button" className="btn" onClick={make} disabled={!email.includes('@')}>Invite</button>
      </div>
      {link && (
        <p className="hint">
          Send them this link. It signs them in as a member of your account.{' '}
          <button type="button" className="undo" onClick={() => { void navigator.clipboard?.writeText(link) }}>Copy it</button>
          <br /><code className="invite-link">{link}</code>
        </p>
      )}
    </div>
  )
}

/** Shown masked, copied whole. A key read off a screen is a key typed wrong. */
function Key() {
  const key = getKey()
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!key) {
    return (
      <p className="muted">
        Your key appears here once you are signed in to your own account. The sample has no key.
      </p>
    )
  }
  const masked = `${key.slice(0, 6)}${'•'.repeat(24)}${key.slice(-4)}`
  return (
    <div className="api-key">
      <code>{shown ? key : masked}</code>
      <button type="button" className="btn small quiet" onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'}</button>
      <button
        type="button"
        className="btn small"
        onClick={() => {
          void navigator.clipboard?.writeText(key)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2_000)
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function Account() {
  useStore()
  const account = getAccount()
  const sub = getSubscription()
  const members = getMembers()
  const topups = getState().topups
  const [tab, setTab] = useState<Tab>('members')

  return (
    <div className="page">
      <div className="page-head"><h1>Account</h1></div>
      <p className="subhead">{account.name}, {account.kind === 'agency' ? 'agency' : 'brand'}. {account.timezone}.</p>

      <div className="filter-row">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`chip${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <div className="card">
          <h2>Members</h2>
          <ul className="rules">
            {members.map((m) => (
              <li key={m.id}>
                <span>{m.name}, {m.email}</span>
                <b>{m.role}</b>
              </li>
            ))}
          </ul>
          <Invite />
        </div>
      )}

      {tab === 'billing' && (
        <>
          <div className="card">
            <h2>Your plan</h2>
            <ul className="plan-list">
              {TIERS.map((t) => (
                <li key={t.tier} className={t.tier === sub.tier ? 'on' : undefined}>
                  <span className="plan-size">
                    <b className="num">{t.tier * MONTH_DAYS}</b>
                    <span>qualified leads a month</span>
                    <small className="muted">{t.tier} a day</small>
                  </span>
                  <span className="plan-price">
                    <b>{money(t.priceCents)}</b>
                    <small className="muted">a month{t.tier === sub.tier ? ', your plan' : ''}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="hint">
              You pay for the leads we hand you. A quiet day is not lost: whatever is left runs to the end of the month.
            </p>
          </div>

          <div className="card">
            <h2>Extra leads bought</h2>
            <ul className="rules">
              {topups.map((t) => (
                <li key={t.id}>
                  <span>{t.leads} leads, bought {absolute(t.purchasedAt)}</span>
                  <b className="num">{t.remaining} left</b>
                </li>
              ))}
              {topups.length === 0 && <li><span>None bought</span><b>—</b></li>}
            </ul>
            <button type="button" className="btn">Buy extra leads</button>
          </div>
        </>
      )}

      {tab === 'api' && (
        <div className="card">
          <h2>Your key</h2>
          <p className="gate-lede">
            One key for {account.name}. It carries your account and nothing else, so anything it reads or writes is
            yours. Send it as a bearer token to <code>{API}</code>.
          </p>
          <Key />
          <p className="hint">
            Treat it like a password. Every call it can make is listed on <a href="#/ai">AI Connect</a>, with a
            config to paste into any model client.
          </p>
        </div>
      )}

      {tab === 'access' && (
        <div className="card">
          <h2>How you sign in</h2>
          <p className="gate-lede">
            This browser is signed in with your key, kept on this device and nowhere else. There is no password yet:
            email and password are being built, and until then the key is the sign in.
          </p>
          <ul className="rules">
            <li><span>Signed in as</span><b>{account.email}</b></li>
            <li><span>On this browser</span><b>{hasKey() ? 'Yes' : 'No, you are on the sample'}</b></li>
          </ul>
          <div className="verdict-actions">
            {hasKey() && (
              <button
                type="button"
                className="btn"
                onClick={() => { setKey(''); window.location.hash = '#/app'; window.location.reload() }}
              >
                Sign out of this browser
              </button>
            )}
            <a className="btn quiet" href="#/ai">Where the key is used</a>
          </div>
        </div>
      )}
    </div>
  )
}
