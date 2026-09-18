import { deliveredToday, getDelivery, getFunnel, getLost, getQuota, getSigned, getCampaigns } from '../data'
import { useStore } from '../data/hooks'
import { STATUS_LABEL } from '../data/status'
import { money } from '../lib/format'

// Zone 1. It answers one question: how many landed today, and where is the
// pipeline. Nothing about what a lead cost to produce appears here, because
// nothing on this page can reach it.

function Bars() {
  const rows = getDelivery()
  const top = Math.max(1, ...rows.map((r) => Math.max(r.delivered, r.target)))
  return (
    <div className="daybars" role="img" aria-label="Leads delivered each day this month">
      {rows.map((row) => (
        <span key={row.date} className="daybar" title={`${row.date}: ${row.delivered} delivered`}>
          <i style={{ height: `${Math.round((row.delivered / top) * 100)}%` }} />
        </span>
      ))}
    </div>
  )
}

export function Dashboard() {
  useStore()
  const quota = getQuota()
  const today = deliveredToday()
  const funnel = getFunnel()
  const signed = getSigned()
  const lost = getLost()
  const campaigns = getCampaigns()

  return (
    <div className="page">
      <div className="page-head">
        <h1>Today</h1>
        <span className="spacer" />
        <a className="btn primary" href="#/leads">Work the list</a>
      </div>

      <div className="tiles">
        <div className="tile">
          <b className="num">{today}</b>
          <span>delivered today</span>
        </div>
        <div className="tile">
          <b className="num">{quota.remaining}</b>
          <span>leads left this month</span>
        </div>
        <div className="tile">
          <b className="num">{funnel.find((f) => f.status === 'replied')?.count ?? 0}</b>
          <span>replied so far</span>
        </div>
        <div className="tile">
          <b className="num">{money(signed.amountCents)}</b>
          <span>signed, {signed.count} deals</span>
        </div>
      </div>

      <div className="card">
        <h2>Delivered, day by day</h2>
        <Bars />
        <p className="hint">
          {quota.delivered} of {quota.entitled} delivered this month. Unused leads stay in the balance until the month
          ends.
        </p>
      </div>

      <div className="card">
        <h2>Pipeline</h2>
        <ul className="funnel">
          {funnel.map((step) => (
            <li key={step.status}>
              <b className="num">{step.count}</b>
              <span>{STATUS_LABEL[step.status]}</span>
            </li>
          ))}
          <li className="out">
            <b className="num">{lost}</b>
            <span>Lost</span>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Campaigns</h2>
        <ul className="zone-list">
          {campaigns.map((c) => (
            <li key={c.id}>
              <a href={`#/campaign/${c.id}/brief`}>
                <b>{c.name}</b>
                <span className="muted">
                  {deliveredToday(c.id)} today, cap {c.dailyCap ?? 'none'} a day
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
