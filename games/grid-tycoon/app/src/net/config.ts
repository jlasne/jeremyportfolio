// Where the multiplayer backend lives. Convex first (the live server, convex-server/), then the older
// Supabase function. Vite env vars win (VITE_CONVEX_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// e.g. in app/.env.local); otherwise the constants below. A Convex deployment URL is public by design:
// clients can only call the functions the server defines.

const CONVEX_URL = 'https://fabulous-rooster-542.eu-west-1.convex.cloud'
const SUPABASE_URL = ''
const SUPABASE_ANON_KEY = ''

/** The edge function's name, as deployed (supabase/functions/grid-tycoon). */
export const FUNCTION_NAME = 'grid-tycoon'

function env(name: 'VITE_CONVEX_URL' | 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[name]
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

export const netConfig = {
  convexUrl: (env('VITE_CONVEX_URL') || CONVEX_URL).replace(/\/+$/, ''),
  url: (env('VITE_SUPABASE_URL') || SUPABASE_URL).replace(/\/+$/, ''),
  anonKey: env('VITE_SUPABASE_ANON_KEY') || SUPABASE_ANON_KEY,
}

export function convexConfigured(): boolean {
  return netConfig.convexUrl.length > 0
}

export function isConfigured(): boolean {
  return convexConfigured() || (netConfig.url.length > 0 && netConfig.anonKey.length > 0)
}
