import { requireRole } from '@/lib/db/session'
import { monthRange, parentCalendar } from '@/lib/db/calendar'
import { CalendarGrid, MonthNav } from '@/components/CalendarGrid'
import { LiveSection } from '@/components/LiveSection'

/**
 * Read-only for attendance, on purpose — a parent never marks a class, because the
 * whole guarantee of this product is that only the person who taught it can say it
 * happened. Cancelling a class they haven't taken yet is the one thing they can still
 * do here.
 */
export default async function ParentCalendarPage(props: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { userId } = await requireRole('parent')
  const sp = await props.searchParams
  const now = new Date()
  const year = sp.y ? Number(sp.y) : now.getFullYear()
  const month = sp.m ? Number(sp.m) : now.getMonth()

  const classes = await parentCalendar(userId, monthRange(year, month))

  return (
    <LiveSection tables={['sessions', 'ledger_entries']}>
      <MonthNav year={year} month={month} basePath="/parent/calendar" />
      <CalendarGrid
        classes={classes}
        year={year}
        month={month}
        allowCancel
        emptyHint="No classes this month. Once you fund a month, every class appears here on the day it falls."
      />
    </LiveSection>
  )
}
