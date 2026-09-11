// One clock for the whole mock folder, so "11 days ago" stays true whenever the
// app runs. Both helpers are memoised: a full account asks for the same handful
// of offsets a hundred thousand times, and building an ISO string is not free.

export const NOW = new Date()

const days = new Map<string, string>()
const hours = new Map<number, string>()

export function daysAgo(daysBack: number, hour = 9): string {
  const key = `${daysBack}:${hour}`
  const at = days.get(key)
  if (at) return at
  const d = new Date(NOW.getTime() - daysBack * 86_400_000)
  d.setHours(hour, 0, 0, 0)
  const iso = d.toISOString()
  days.set(key, iso)
  return iso
}

export function hoursAgo(hoursBack: number): string {
  const at = hours.get(hoursBack)
  if (at) return at
  const iso = new Date(NOW.getTime() - hoursBack * 3_600_000).toISOString()
  hours.set(hoursBack, iso)
  return iso
}
