import { useState } from 'react'
import { campaignLeadsPerDay, countDone, getCampaigns, getDashboard, getSettings } from '../data'
import { useStore } from '../data/hooks'
import { nextBatchLabel } from '../lib/format'

export function Settings() {
  useStore()
  const settings = getSettings()
  const campaigns = getCampaigns()
  const d = getDashboard()
  const perDay = campaigns.filter((c) => c.active).reduce((sum, c) => sum + campaignLeadsPerDay(c), 0)
  const [feedback, setFeedback] = useState('')
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('jeremy@strongher.co')

  return (
    <div className="page editor">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <section className="ask">
        <h2>Billing</h2>
        <div className="bill">
          <div className="bill-row">
            <span className="bill-label">Plan</span>
            <span className="bill-value">Brand, monthly</span>
            <span className="tag">Active</span>
          </div>
          <div className="bill-row">
            <span className="bill-label">Volume</span>
            <span className="bill-value num">{perDay.toLocaleString('en-US')} leads a day across {campaigns.filter((c) => c.active).length} running campaign{campaigns.filter((c) => c.active).length === 1 ? '' : 's'}</span>
          </div>
          <div className="bill-row">
            <span className="bill-label">Next invoice</span>
            <span className="bill-value">1 October 2026</span>
          </div>
          <div className="bill-row">
            <span className="bill-label">Billing email</span>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Billing email" style={{ maxWidth: 300 }} />
          </div>
        </div>
        <div className="actions-bar" style={{ marginTop: 14 }}>
          <button type="button" className="btn">Change plan</button>
          <button type="button" className="btn">Update card</button>
          <button type="button" className="btn quiet">Download invoices</button>
        </div>
        <p className="hint">Billing runs through Stripe once the product ships. These buttons are placeholders in the prototype.</p>
      </section>

      <section className="ask">
        <h2>Feedback</h2>
        <p className="muted">A lead that made no sense, a filter you miss, a niche we get wrong. Tell us and we read every one.</p>
        {sent ? (
          <div className="reading" style={{ borderStyle: 'solid' }}>Thanks. It landed with the team, and you will hear back within a day.</div>
        ) : (
          <>
            <textarea
              className="textarea"
              value={feedback}
              placeholder="What should be better?"
              aria-label="Feedback"
              onChange={(e) => setFeedback(e.target.value)}
              style={{ minHeight: 110 }}
            />
            <div className="actions-bar" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" disabled={!feedback.trim()} onClick={() => setSent(true)}>Send</button>
            </div>
          </>
        )}
      </section>

      <section className="ask">
        <h2>Your account</h2>
        <dl className="pairs">
          <dt>Campaigns</dt>
          <dd className="num">{campaigns.length}, {campaigns.filter((c) => c.active).length} running</dd>
          <dt>Contacts in your list</dt>
          <dd className="num">{d.total}</dd>
          <dt>Marked done</dt>
          <dd className="num">{countDone()}</dd>
          <dt>Next batch</dt>
          <dd>{nextBatchLabel(settings.timezone)}</dd>
        </dl>
      </section>
    </div>
  )
}
