import { requireRole } from '@/lib/db/session'
import { activeServices } from '@/lib/db/admin'
import { EnrollmentHistory } from './EnrollmentHistory'

export default async function AdminEnrollmentsPage() {
  await requireRole('admin')

  // Passing null returns every status, not just the running ones.
  const all = await activeServices(null)
  return <EnrollmentHistory services={all} />
}
