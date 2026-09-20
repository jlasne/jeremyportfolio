import type {
  Account, Campaign, Creator, Deal, Evaluation, GateSet, Lead, LeadEvent,
  Member, QuotaPeriod, Subscription, DailyDelivery, FeasibilityRun, LeadStatus,
} from '../types'
import { api } from '../lib/api'

// The one place epoch numbers become ISO strings.
//
// Convex stores every date as milliseconds. The screens read ISO strings. This
// adapter is the whole difference between the sample data and a real account,
// which is what makes swapping one for the other a change to this file alone.

const iso = (ms: number | null | undefined): string => (ms ? new Date(ms).toISOString() : '')

export interface Loaded {
  account: Account
  members: Member[]
  subscription: Subscription
  quotaPeriod: QuotaPeriod
  campaigns: Campaign[]
  gateSets: GateSet[]
  creators: Creator[]
  evaluations: Evaluation[]
  leads: Lead[]
  leadEvents: LeadEvent[]
  deals: Deal[]
  dailyDeliveries: DailyDelivery[]
  feasibilityRuns: FeasibilityRun[]
  /** Every tag the account's leads carry, so the drawer can list them. */
  tags: string[]
  /** What was scored day by day. The server counts it; this browser cannot. */
  activity: { date: string; scored: number; qualified: number }[]
  /** Status changes the client made in the window. */
  crmUpdates: number | null
}

/** Reads a whole account: the plan, the campaigns, their gates, the leads. */
export async function fetchAll(): Promise<Loaded> {
  const me = (await api.me()) as any
  const accountId = me.account.id as string
  // One extra read, and a failure costs the dashboard its chart and nothing
  // else: the leads are what the client came for.
  const overview = await api.overview(30).catch(() => null)

  const account: Account = {
    id: accountId,
    name: me.account.name,
    kind: me.account.kind,
    email: me.account.email,
    timezone: me.account.timezone,
    createdAt: iso(me.account.createdAt),
  }

  const subscription: Subscription = {
    id: `sub_${accountId}`,
    accountId,
    tier: me.subscription?.tier ?? 15,
    priceCents: me.subscription?.priceCents ?? 0,
    currency: me.subscription?.currency ?? 'EUR',
    status: me.subscription?.status ?? 'active',
    period: me.subscription?.period ?? '',
    periodStart: iso(me.subscription?.periodStart),
    periodEnd: iso(me.subscription?.periodEnd),
  }

  const { campaigns: raw } = (await api.campaigns()) as any
  const campaigns: Campaign[] = []
  const gateSets: GateSet[] = []
  const feasibilityRuns: FeasibilityRun[] = []

  for (const c of raw as any[]) {
    campaigns.push({
      id: c.id,
      accountId,
      name: c.name,
      status: c.status,
      dailyCap: c.dailyCap,
      brief: {
        audience: c.brief?.audience ?? '',
        offer: c.brief?.offer ?? '',
        seeds: c.brief?.seeds ?? undefined,
        writtenAt: iso(c.brief?.writtenAt ?? c.createdAt),
      },
      extracted: {
        countries: c.extracted?.countries ?? [],
        languages: c.extracted?.languages ?? [],
        templateId: c.extracted?.templateId ?? 'sell_to_creators',
        niches: c.extracted?.niches ?? [],
        extractedAt: iso(c.extracted?.extractedAt),
      },
      gateSetId: c.gateSetId ?? '',
      widened: c.widened
        ? {
            fromGateSetId: c.widened.fromGateSetId,
            fromNiches: c.widened.fromNiches ?? [],
            doors: (c.widened.doors ?? []).map((d: any) => ({
              id: d.id,
              label: d.label,
              openedAt: iso(d.openedAt),
            })),
          }
        : undefined,
      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
    })

    const detail = (await api.campaign(c.id)) as any
    for (const g of (detail.versions ?? []) as any[]) {
      gateSets.push({
        id: g.id,
        campaignId: g.campaignId,
        accountId,
        version: g.version,
        origin: g.origin,
        templateId: g.templateId ?? 'sell_to_creators',
        hard: g.hard,
        knockouts: g.knockouts,
        criteria: g.criteria,
        passScore: g.passScore,
        preset: g.preset ?? 'custom',
        by: g.by ?? 'system',
        changes: g.changes ?? [],
        createdAt: iso(g.createdAt),
      })
    }
  }

  const { leads: rows } = (await api.leads('?limit=500')) as any
  const creators: Creator[] = []
  const evaluations: Evaluation[] = []
  const leads: Lead[] = []

  for (const row of rows as any[]) {
    const c = row.creator
    creators.push({
      id: c.id,
      platform: 'instagram',
      handle: c.handle,
      name: c.name,
      bio: c.bio,
      avatar: c.avatar ?? undefined,
      email: c.email,
      followers: c.followers,
      medianViews: c.medianViews,
      medianComments: c.medianComments,
      postsPerMonth: c.postsPerMonth,
      lastPostAt: c.lastPostAt ? iso(c.lastPostAt) : null,
      country: c.country,
      language: c.language,
      links: c.links ?? [],
      measuredAt: iso(c.measuredAt),
      firstSeenAt: iso(c.measuredAt),
      foundVia: c.foundVia ?? undefined,
    })
    const evaluationId = `evl_${row.id}`
    evaluations.push({
      id: evaluationId,
      creatorId: c.id,
      campaignId: row.campaignId,
      accountId,
      gateSetId: '',
      gateSetVersion: row.evaluation.gateSetVersion,
      verdict: row.evaluation.verdict,
      niche: row.evaluation.niche ?? null,
      blockedBy: row.evaluation.blockedBy,
      hardChecks: row.evaluation.hardChecks,
      knockoutAnswers: row.evaluation.knockoutAnswers,
      criteriaScores: row.evaluation.criteriaScores,
      score: row.evaluation.score,
      reason: row.evaluation.reason,
      evaluatedAt: iso(row.evaluation.evaluatedAt),
    })
    leads.push({
      id: row.id,
      accountId,
      campaignId: row.campaignId,
      creatorId: c.id,
      evaluationId,
      score: row.score,
      status: row.status as LeadStatus,
      reach: row.reach === 'wider' ? 'wider' : 'core',
      beyond: row.beyond ?? undefined,
      lostReason: row.lostReason ?? undefined,
      ownerId: null,
      saved: Boolean(row.saved),
      note: row.note ?? '',
      tags: Array.isArray(row.tags) ? row.tags : undefined,
      refreshedAt: row.refreshedAt ? iso(row.refreshedAt) : undefined,
      deliveredAt: iso(row.deliveredAt),
      statusAt: iso(row.statusAt),
    })
  }

  return {
    account,
    members: (me.members ?? []).map((m: any) => ({ ...m, accountId })),
    subscription,
    quotaPeriod: { accountId, ...me.quota },
    campaigns,
    gateSets,
    creators,
    evaluations,
    leads,
    leadEvents: [],
    deals: [],
    dailyDeliveries: [],
    feasibilityRuns,
    // Every tag the account has, whether or not a lead carries it today.
    tags: [...new Set(leads.flatMap((l) => l.tags ?? []))].sort(),
    // The work behind the leads. Only the server has ever seen most of it, so
    // a browser cannot count it, and a dashboard that guessed would be wrong.
    activity: overview?.activity ?? [],
    crmUpdates: typeof overview?.crmUpdates === 'number' ? overview.crmUpdates : null,
  }
}
