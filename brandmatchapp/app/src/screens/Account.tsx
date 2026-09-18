import { getAccount, getCampaigns, getMembers, getQuota, getSubscription } from '../data'
import { useStore } from '../data/hooks'
import { getState } from '../data/store'
import { TIERS } from '../mock/account'
import { absolute, money } from '../lib/format'

// Outside the five zones: the plan, the month's balance, the team.
//
// What is on this page is what the client bought: leads delivered per day, and
// what is left of the month. There is no analysed volume here and no cost,
// because there is none anywhere a client can reach.

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
        <h2>Plan</h2>
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
        <ul className="rules">
          <li><span>Your allowance</span><b className="num">{quota.entitled}</b></li>
          <li><span>Used so far</span><b className="num">{quota.delivered}</b></li>
          <li><span>Carried over from last month</span><b className="num">{quota.carried}</b></li>
          <li><span>Left</span><b className="num">{quota.remaining}</b></li>
        </ul>
        <p className="hint">
          A quiet day is not lost. Whatever is left runs to the end of {sub.period}, and your campaigns share it.
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
