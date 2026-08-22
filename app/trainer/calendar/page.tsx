import { requireRole } from '@/lib/db/session'
import { monthRange, trainerCalendar } from '@/lib/db/calendar'
import { TrainerCalendar } from './TrainerCalendar'

export default async function TrainerCalendarPage(props: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { userId } = await requireRole('trainer')
  const sp = await props.searchParams
  const now = new Date()
  const year = sp.y ? Number(sp.y) : now.getFullYear()
  const month = sp.m ? Number(sp.m) : now.getMonth()

  const classes = await trainerCalendar(userId, monthRange(year, month))
  return <TrainerCalendar classes={classes} year={year} month={month} />
}
