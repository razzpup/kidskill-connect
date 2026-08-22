'use client'

import { useState } from 'react'
import { CalendarGrid, MonthNav } from '@/components/CalendarGrid'
import { useLiveRefresh } from '@/lib/realtime'
import { MarkAttendedSheet } from '../MarkAttendedSheet'
import type { CalendarClass } from '@/lib/db/calendar'
import type { SessionRow } from '@/lib/db/types'

/**
 * The month, with attendance reachable from any square.
 *
 * Today's screen handles the common case — the class you are teaching right now. This is
 * for the other one: the Tuesday three weeks ago you forgot to mark, which is still
 * holding a parent's money and paying you nothing. Those squares are drawn in the alert
 * colour and are the only ones that open.
 */
export function TrainerCalendar({
  classes,
  year,
  month,
}: {
  classes: CalendarClass[]
  year: number
  month: number
}) {
  const [marking, setMarking] = useState<SessionRow | null>(null)
  useLiveRefresh(['sessions', 'ledger_entries'])

  const unmarked = classes.filter((c) => c.missed).length

  /** The sheet wants a SessionRow; a calendar entry already carries everything it needs. */
  function toSession(c: CalendarClass): SessionRow {
    return {
      id: c.id,
      enrollmentId: c.enrollmentId,
      scheduledAt: c.scheduledAt,
      status: c.status,
      markedAt: null,
      assessmentNote: c.assessmentNote,
      skillRating: c.skillRating,
      focusAreas: c.focusAreas,
      childName: c.childName,
      categoryName: c.categoryName,
      parentName: c.parentName,
      parentArea: c.parentArea,
      ratePerClass: c.ratePerClass,
      commissionPct: '15.00',
    }
  }

  return (
    <>
      <MonthNav year={year} month={month} basePath="/trainer/calendar" />

      {unmarked > 0 && (
        <p
          className="mb-4 rounded-xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed"
          style={{ background: 'var(--alert-wash)', color: 'var(--alert)' }}
        >
          <span className="num font-semibold">{unmarked}</span>{' '}
          {unmarked === 1 ? 'class is' : 'classes are'} still unmarked. Each one is a
          parent&apos;s money held in escrow and nothing paid to you.
        </p>
      )}

      <CalendarGrid
        classes={classes}
        year={year}
        month={month}
        onPick={(c) => setMarking(toSession(c))}
        emptyHint="No classes this month. They appear here as parents fund their months."
      />

      {marking && <MarkAttendedSheet session={marking} onClose={() => setMarking(null)} />}
    </>
  )
}
