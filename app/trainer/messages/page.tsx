import { requireRole } from '@/lib/db/session'
import { notificationsFor } from '@/lib/db/parent'
import { NotificationThread } from '@/components/NotificationThread'

export default async function TrainerMessagesPage() {
  const { userId } = await requireRole('trainer')
  const notifications = await notificationsFor(userId)
  return (
    <NotificationThread
      notifications={notifications}
      provider={process.env.NOTIFY_PROVIDER ?? 'inapp'}
    />
  )
}
