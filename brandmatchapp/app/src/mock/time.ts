// One clock for the whole mock folder, so "11 days ago" stays true whenever the app runs.
export const NOW = new Date()

export function daysAgo(days: number, hours = 9): string {
  const d = new Date(NOW.getTime() - days * 86_400_000)
  d.setHours(hours, 0, 0, 0)
  return d.toISOString()
}

export function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString()
}
