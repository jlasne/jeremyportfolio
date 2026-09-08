const DAY = 86_400_000

export function compact(n: number): string {
  if (n >= 1_000_000) return trim(n / 1_000_000) + 'M'
  if (n >= 1_000) return trim(n / 1_000) + 'k'
  return String(n)
}

function trim(x: number): string {
  return x >= 100 ? String(Math.round(x)) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(1).replace(/\.0$/, '')
}

export function percent(rate: number): string {
  const v = rate * 100
  return (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + '%'
}

export function daysSince(iso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY)
}

export function relative(iso: string, now = new Date()): string {
  const d = daysSince(iso, now)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  if (d < 60) return '1 month ago'
  if (d < 365) return `${Math.floor(d / 30)} months ago`
  return `${Math.floor(d / 365)} years ago`
}

export function absolute(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function withinDays(iso: string, days: number, now = new Date()): boolean {
  return daysSince(iso, now) <= days
}

export function isNewToday(iso: string, now = new Date()): boolean {
  return now.getTime() - new Date(iso).getTime() < DAY
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  UK: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  FR: 'France',
  DE: 'Germany',
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  de: 'German',
}

export function nextBatchLabel(timezone: string, now = new Date()): string {
  // The daily batch lands before 7:00 in the brand's timezone.
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', hour12: false })
  const hour = Number(fmt.format(now))
  const day = hour < 7 ? 'today' : 'tomorrow'
  return `${day} at 7:00 (${timezone.replace('_', ' ')})`
}
