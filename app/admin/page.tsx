import { requireRole } from '@/lib/db/session'
import { activeServices, pendingApplications, platformTotals } from '@/lib/db/admin'
import { ActiveServicesMonitor } from './ActiveServicesMonitor'

/**
 * The default landing screen, and the one the stakeholder asked for. Every currently
 * running service, one row each, with money state derived from the ledger — and
 * subscribed to `ledger_entries`, so rows move while the admin is watching.
 */
export default async function AdminHomePage() {
  await requireRole('admin')

  const [services, totals, pending] = await Promise.all([
    activeServices('active'),
    platformTotals(),
    pendingApplications(),
  ])

  return (
    <ActiveServicesMonitor
      services={services}
      totals={totals}
      pendingCount={pending.length}
    />
  )
}
