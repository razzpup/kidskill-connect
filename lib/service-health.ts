import type { ActiveService } from '@/lib/db/types'

/**
 * A pure derivation over a service row, kept out of `lib/db/` because the admin
 * monitor is a client component and everything in `lib/db/` reaches for
 * `next/headers`. Importing one function from there would pull the whole server
 * client into the browser bundle.
 *
 * A service is stalled when it is holding a parent's money and nothing is happening
 * against it: the next class is in the past, or nothing has been marked for ten days.
 * That is precisely the thing an admin exists to catch, so it is computed rather than
 * left for someone to spot in a table.
 */
export function stallReason(s: ActiveService): string | null {
  if (s.status !== 'active') return null
  const now = Date.now()

  if (s.nextClassAt && new Date(s.nextClassAt).getTime() < now) {
    return 'Next class is in the past'
  }
  if (!s.nextClassAt && s.classesRemaining > 0) {
    return `${s.classesRemaining} classes unscheduled`
  }
  if (s.lastClassAt) {
    const days = Math.floor((now - new Date(s.lastClassAt).getTime()) / 86_400_000)
    if (days > 10) return `No class marked for ${days} days`
  } else if (s.startDate) {
    const days = Math.floor((now - new Date(s.startDate).getTime()) / 86_400_000)
    if (days > 10) return `Nothing delivered in ${days} days`
  }
  return null
}
