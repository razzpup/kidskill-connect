import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/db/session'
import { hasTrainerProfile, trainerDaySessions, trainerEarnings, trainerEnquiries } from '@/lib/db/trainer'
import { TodayScreen } from './TodayScreen'

/**
 * The money screen. It is the default landing page because marking a class attended is
 * the only action in the product that moves a rupee, and it should never be more than
 * one tap away.
 */
export default async function TrainerTodayPage() {
  const { userId, profile } = await requireRole('trainer')

  if (!(await hasTrainerProfile(userId))) redirect('/onboarding/trainer')

  const [{ today, overdue, upcoming }, earnings, enquiries] = await Promise.all([
    trainerDaySessions(userId),
    trainerEarnings(userId),
    trainerEnquiries(userId),
  ])

  return (
    <TodayScreen
      firstName={profile.full_name.split(' ')[0]}
      today={today}
      overdue={overdue}
      upcoming={upcoming}
      balance={earnings.balance}
      openEnquiries={enquiries.filter((e) => e.status === 'open')}
    />
  )
}
