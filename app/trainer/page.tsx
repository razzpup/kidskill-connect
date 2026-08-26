import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/db/session'
import { hasTrainerProfile, trainerDaySessions, trainerEarnings, trainerEnquiries } from '@/lib/db/trainer'
import { monthRange, trainerCalendar } from '@/lib/db/calendar'
import { TrainerHome } from './TrainerHome'

/**
 * The money screen. It is the default landing page because marking a class attended is
 * the only action in the product that moves a rupee, and it should never be more than
 * one tap away — the calendar for browsing any other day lives on the same page rather
 * than behind a separate tab.
 */
export default async function TrainerPage(props: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { userId, profile } = await requireRole('trainer')

  if (!(await hasTrainerProfile(userId))) redirect('/onboarding/trainer')

  const sp = await props.searchParams
  const now = new Date()
  const year = sp.y ? Number(sp.y) : now.getFullYear()
  const month = sp.m ? Number(sp.m) : now.getMonth()

  const [{ today, overdue, upcoming }, earnings, enquiries, calendarClasses] = await Promise.all([
    trainerDaySessions(userId),
    trainerEarnings(userId),
    trainerEnquiries(userId),
    trainerCalendar(userId, monthRange(year, month)),
  ])

  return (
    <TrainerHome
      firstName={profile.full_name.split(' ')[0]}
      today={today}
      overdue={overdue}
      upcoming={upcoming}
      balance={earnings.balance}
      openEnquiries={enquiries.filter((e) => e.status === 'open')}
      calendarClasses={calendarClasses}
      calendarYear={year}
      calendarMonth={month}
    />
  )
}
