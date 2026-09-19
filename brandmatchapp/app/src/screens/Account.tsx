import { useState } from 'react'
import { getAccount, getCampaigns, getMembers, getQuota, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { getState } from '../data/store'
import { TIERS } from '../mock/account'
import { absolute, money, monthOf } from '../lib/format'

// Outside the five zones: the plan, the month's balance, the team.
//
// What is on this page is what the client bought: leads delivered per day, and
// what is left of the month. There is no analysed volume here and no cost,
// because there is none anywhere a client can reach.

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
          Send them this link. It signs them in as a member of {'your account'}.{' '}
          <button type="button" className="undo" onClick={() => { void navigator.clipboard?.writeText(link) }}>Copy it</button>
          <br /><code className="invite-link">{link}</code>
        </p>
      )}
    </div>
  )
}

export function Account() {
  useStore()
  const account = getAccount()
  const sub = getSubscription()
  const quota = getQuota()
  const members = getMembers()
  const campaigns = getCampaigns()
  const topups = getState().topups
  const journal = getState()
    .quotaEntries.filter((e) => e.kind !== 'delivery')
    .sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="page">
      <div className="page-head"><h1>Account</h1></div>
      <p className="subhead">{account.name}, {account.kind === 'agency' ? 'agency' : 'brand'}. {account.timezone}.</p>

      <div className="card">
        <h2>Billing</h2>
        <ul className="rules">
          {TIERS.map((t) => (
            <li key={t.tier} className={t.tier === sub.tier ? 'on' : undefined}>
              <span>{t.tier} qualified leads a day</span>
              <b>{money(t.priceCents)} a month{t.tier === sub.tier ? ', your plan' : ''}</b>
            </li>
          ))}
        </ul>
        <p className="hint">You pay for the leads we hand you. Nothing else is counted.</p>
      </div>

      <div className="card">
        <h2>This month</h2>
        <div className="month-gauge">
          <i style={{ width: `${quota.entitled ? Math.min(100, Math.round((quota.delivered / quota.entitled) * 100)) : 0}%` }} />
        </div>
        <ul className="room-key month-key">
          <li className="done"><b className="num">{quota.delivered}</b> sent to you</li>
          <li className="ahead"><b className="num">{quota.remaining}</b> still to come by the end of {monthOf(sub.period)}</li>
          <li><b className="num">{quota.entitled}</b> in total{quota.carried > 0 ? `, ${quota.carried} of them carried over from last month` : ''}</li>
        </ul>
        <p className="hint">
          A quiet day is not lost. Whatever is left runs to the end of the month, and your campaigns share it.
        </p>
      </div>

      <div className="card">
        <h2>Daily limit per campaign</h2>
        <ul className="rules">
          {campaigns.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <b className="num">{c.dailyCap ?? 'no limit'}</b>
            </li>
          ))}
        </ul>
        <p className="hint">This stops one campaign taking the whole day. Leave it empty and they share.</p>
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

      <div className="card">
        <h2>Team</h2>
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

      <div className="card">
        <h2>What went in and out</h2>
        <ul className="rules">
          {journal.map((e) => (
            <li key={e.id}>
              <span>{e.note ?? e.kind}</span>
              <b className="num">{e.delta > 0 ? `+${e.delta}` : e.delta}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
