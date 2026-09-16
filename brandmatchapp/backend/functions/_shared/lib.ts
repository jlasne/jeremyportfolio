// Shared by every brandmatch function: database handle, auth, replies, scoring.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const SCHEMA = 'brandmatch'

export function db(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: SCHEMA }, auth: { persistSession: false } },
  )
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export interface Brand {
  id: string
  email: string
  credits: number
  timezone: string
}

/** Reads the brand behind `Authorization: Bearer <api key>`. */
export async function brandFrom(req: Request, sb: SupabaseClient): Promise<Brand | null> {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!key) return null
  const { data } = await sb.from('brands').select('id, email, credits, timezone').eq('api_key', key).maybeSingle()
  return data as Brand | null
}

// Scoring ------------------------------------------------------------------
// The same rule as the front end, kept here so the feed can sort in the
// database. Three criteria, one star each, half a star for a half fit.

export const SIGNAL_STRONG_DAYS = 4
export const SIGNAL_SOFT_DAYS = 10

export type Level = 0 | 0.5 | 1
export interface Signal { type: string; label: string; strength: string; date: string }

export function daysSince(iso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
}

/** An own product means business today. A download or a past collab is half. */
export function sellingLevel(sells: string, signals: Signal[]): Level {
  if (/program|coaching|app|membership|shop/i.test(sells)) return 1
  if (/ebook|merch|affiliate|link hub|own site/i.test(sells) || signals.length > 0) return 0.5
  return 0
}

/** How hot the intent is, by how recently a signal fired. */
export function signalLevel(signals: Signal[], now = new Date()): Level {
  let best: Level = 0
  for (const s of signals) {
    const age = daysSince(s.date, now)
    const level: Level = age <= SIGNAL_STRONG_DAYS ? 1 : age <= SIGNAL_SOFT_DAYS ? 0.5 : 0
    if (level > best) best = level
  }
  return best
}

/** Niche comes from the model, the other two are read off the pool. */
export function starsFor(niche: number, sells: string, signals: Signal[], now = new Date()): number {
  return niche + sellingLevel(sells, signals) + signalLevel(signals, now)
}
