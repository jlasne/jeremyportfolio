// Where the multiplayer backend lives. Vite env vars win (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// e.g. in app/.env.local); otherwise the constants below. Both are empty until a Supabase project
// exists, which keeps multiplayer offline (isOnline() is false and the title screen says so).
// The anon / publishable key is public by design: every table write goes through the edge function.

const SUPABASE_URL = ''
const SUPABASE_ANON_KEY = ''

/** The edge function's name, as deployed (supabase/functions/grid-tycoon). */
export const FUNCTION_NAME = 'grid-tycoon'

function env(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[name]
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

export const netConfig = {
  url: (env('VITE_SUPABASE_URL') || SUPABASE_URL).replace(/\/+$/, ''),
  anonKey: env('VITE_SUPABASE_ANON_KEY') || SUPABASE_ANON_KEY,
}

export function isConfigured(): boolean {
  return netConfig.url.length > 0 && netConfig.anonKey.length > 0
}
