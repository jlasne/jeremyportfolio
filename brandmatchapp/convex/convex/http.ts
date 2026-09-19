import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { clientApi } from './clientApi'
import { opsApi } from './opsApi'
import { CORS, fail, json } from './httpUtil'

// Three things speak HTTP, and the first two never meet.
//
//   /api   the client surface. Leads, gates, quota, deals.
//   /ops   the internal surface. Cost, analysed volume, fair use. Owner only.
//   /apify the crawl callback.
//
// They are separate handlers in separate files so a production figure has no
// path into a client response.

const http = httpRouter()

// The preflight is answered by one handler and the methods by another. A route
// is claimed once per path and method, so OPTIONS is left out of the list
// below: registering it in both loops is a push the deployment refuses.
const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }))

for (const path of ['/api', '/ops'] as const) {
  http.route({ path, method: 'OPTIONS', handler: preflight })
  http.route({ pathPrefix: `${path}/`, method: 'OPTIONS', handler: preflight })
}

for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
  http.route({ path: '/api', method, handler: clientApi })
  http.route({ pathPrefix: '/api/', method, handler: clientApi })
  http.route({ path: '/ops', method, handler: opsApi })
  http.route({ pathPrefix: '/ops/', method, handler: opsApi })
}

/**
 * Apify calls here when a run ends.
 *
 * The run arrives whole, under `resource`, because only top level variables are
 * substituted in the payload template. Reading `resource.status` from a dotted
 * template gives the literal characters instead, which once made two finished
 * and paid runs look like they never happened.
 */
http.route({
  path: '/apify',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.CRAWL_SECRET
    if (secret && req.headers.get('x-crawl-secret') !== secret) return fail('Not yours', 403)

    const body = (await req.json().catch(() => ({}))) as Record<string, any>
    const run = (body.resource ?? {}) as Record<string, unknown>
    const runId = String(run.id ?? body.runId ?? '')
    const status = String(run.status ?? body.status ?? '')
    const datasetId = String(run.defaultDatasetId ?? body.datasetId ?? '')
    if (!runId) return fail('No run id on the callback', 400)
    if (!/^[A-Z_-]+$/.test(status)) return fail(`Unreadable run status for ${runId}`, 400)

    // Apify says what the run cost. That figure, and not an estimate, is
    // what the cockpit shows: the estimate was off by a factor of two and a
    // half on the first real run.
    const usd = Number(run.usageTotalUsd)
    await ctx.scheduler.runAfter(0, internal.ingest.fromApify, {
      runId,
      status,
      datasetId: datasetId || undefined,
      phase: String(body.phase ?? 'detail'),
      campaignId: body.campaignId as Id<'campaigns'>,
      costUsd: Number.isFinite(usd) ? usd : undefined,
      channel: body.channel ? String(body.channel) : undefined,
    })
    return json({ ok: true })
  }),
})

export default http
