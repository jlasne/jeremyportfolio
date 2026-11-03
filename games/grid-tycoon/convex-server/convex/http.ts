// The HTTP door: POST /grid-tycoon with { action, ... }, same contract as the Supabase function.
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const MAX_BODY_BYTES = 64 * 1024
const ALLOWED_ORIGINS = new Set(['https://www.jeremylasne.com', 'https://jeremylasne.com'])
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && (ALLOWED_ORIGINS.has(origin) || DEV_ORIGIN.test(origin))) h['Access-Control-Allow-Origin'] = origin
  return h
}

function json(status: number, body: string, origin: string | null): Response {
  return new Response(body, { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

const fail = (message: string) => JSON.stringify({ ok: false, error: 'bad_request', message, now: Date.now() })

const http = httpRouter()

http.route({
  path: '/grid-tycoon',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, req) => new Response(null, { status: 204, headers: cors(req.headers.get('origin')) })),
})

http.route({
  path: '/grid-tycoon',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const origin = req.headers.get('origin')
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json(413, fail('Request too large.'), origin)
    const bytes = crypto.getRandomValues(new Uint8Array(96))
    const entropy = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    try {
      const out = JSON.parse(await ctx.runMutation(internal.game.handle, { body: text, entropy })) as { status: number; body: unknown }
      return json(out.status, JSON.stringify(out.body), origin)
    } catch (err) {
      console.error(err)
      return json(500, JSON.stringify({ ok: false, error: 'server_error', message: 'The game server failed. Try again.', now: Date.now() }), origin)
    }
  }),
})

export default http
