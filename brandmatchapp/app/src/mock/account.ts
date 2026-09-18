import type { Account, Member, Subscription, Topup } from '../types'
import { daysAgo } from './time'

// One agency, on the middle tier. Everything else in the sample folder hangs
// off this account id.

export const account: Account = {
  id: 'acc_northbound',
  name: 'Northbound Studio',
  kind: 'agency',
  email: 'hey@northbound.studio',
  timezone: 'Europe/Paris',
  createdAt: daysAgo(118),
}

export const members: Member[] = [
  { id: 'mem_1', accountId: account.id, email: 'hey@northbound.studio', name: 'Jeremy Lasne', role: 'owner' },
  { id: 'mem_2', accountId: account.id, email: 'sacha@northbound.studio', name: 'Sacha Meunier', role: 'member' },
]

/** Placeholder prices until checkout exists: 250, 450, 700 euros a month. */
export const TIERS: { tier: 15 | 30 | 50; priceCents: number }[] = [
  { tier: 15, priceCents: 25000 },
  { tier: 30, priceCents: 45000 },
  { tier: 50, priceCents: 70000 },
]

const start = new Date(daysAgo(0))
const period = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
const periodStart = new Date(start.getFullYear(), start.getMonth(), 1)
const periodEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1)

export const currentPeriod = period
export const daysInPeriod = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000)
export const dayOfPeriod = start.getDate()

export const subscription: Subscription = {
  id: 'sub_1',
  accountId: account.id,
  tier: 15,
  priceCents: 25000,
  currency: 'EUR',
  status: 'active',
  period,
  periodStart: periodStart.toISOString(),
  periodEnd: periodEnd.toISOString(),
}

/** One occasional top up, half spent. Proves the journal handles both sources. */
export const topups: Topup[] = [
  {
    id: 'top_1',
    accountId: account.id,
    leads: 100,
    priceCents: 19000,
    currency: 'EUR',
    remaining: 43,
    purchasedAt: daysAgo(12),
  },
]
