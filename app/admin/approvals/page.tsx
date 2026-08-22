import { requireRole } from '@/lib/db/session'
import { pendingApplications } from '@/lib/db/admin'
import { ApprovalsQueue } from './ApprovalsQueue'

export default async function ApprovalsPage() {
  await requireRole('admin')
  const pending = await pendingApplications()
  return <ApprovalsQueue applications={pending} />
}
