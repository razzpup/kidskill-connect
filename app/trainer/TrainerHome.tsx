'use client'

import { useState } from 'react'
import { EmptyState, Money, ClockIcon, PinIcon, formatTime, relativeDay } from '@/components/ui'
import { CalendarGrid, MonthNav } from '@/components/CalendarGrid'
import { useLiveRefresh } from '@/lib/realtime'
import { commissionOf, type Paise } from '@/lib/money'
import { VideoCall } from '@/components/VideoCall'
import type { EnquiryRow, SessionRow } from '@/lib/db/types'
import type { CalendarClass } from '@/lib/db/calendar'
import { MarkAttendedSheet } from './MarkAttendedSheet'
import { IncomingRequest } from './IncomingRequest'

/**
 * One page for the trainer: what needs acting on right now (overdue, then today), the
 * month to browse or jump into any other day from, and a plain-text rundown of what's
 * coming next so a class three weeks out doesn't require paging the calendar forward to
 * notice. Marking a class attended is the only action in the product that moves a
 * rupee, so every entry point into it — a card here, a calendar square, the coming-up
 * list — opens the same sheet.
 */
export function TrainerHome({
  firstName,
  today,
  overdue,
  upcoming,
  balance,
  openEnquiries,
  calendarClasses,
  calendarYear,
  calendarMonth,
}: {
  firstName: string
  today: SessionRow[]
  overdue: SessionRow[]
  upcoming: SessionRow[]
  balance: Paise
  openEnquiries: EnquiryRow[]
  calendarClasses: CalendarClass[]
  calendarYear: number
  calendarMonth: number
}) {
  const [marking, setMarking] = useState<SessionRow | null>(null)
  useLiveRefresh(['sessions', 'ledger_entries', 'enrollments', 'enquiries'])

  const unmarkedThisMonth = calendarClasses.filter((c) => c.missed).length

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="display mt-2 text-[2rem] font-extrabold leading-none">
            {today.length === 0 ? `Nothing today, ${firstName}` : `${today.length} ${today.length === 1 ? 'class' : 'classes'} today`}
          </h1>
        </div>
        <div className="text-right">
          <p className="eyebrow mb-1">Earned so far</p>
          <Money paise={balance} size="lg" />
        </div>
      </header>

      {overdue.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline gap-2.5">
            <p className="eyebrow" style={{ color: 'var(--alert)' }}>
              Not marked
            </p>
            <p className="text-[0.75rem] text-muted">
              Unmarked classes hold a parent&apos;s money and pay you nothing.
            </p>
          </div>
          <ul className="space-y-2.5">
            {overdue.map((s) => (
              <ClassCard key={s.id} session={s} onMark={() => setMarking(s)} overdue />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        {today.length === 0 && overdue.length === 0 ? (
          <EmptyState
            title="No classes scheduled today"
            body="When a parent funds a month, its classes appear here on the days they fall. Marking one attended is what releases your fee."
          />
        ) : (
          <ul className="space-y-2.5">
            {today.map((s) => (
              <ClassCard key={s.id} session={s} onMark={() => setMarking(s)} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <MonthNav year={calendarYear} month={calendarMonth} basePath="/trainer" />

        {unmarkedThisMonth > 0 && (
          <p
            className="mb-4 rounded-xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed"
            style={{ background: 'var(--alert-wash)', color: 'var(--alert)' }}
          >
            <span className="num font-semibold">{unmarkedThisMonth}</span>{' '}
            {unmarkedThisMonth === 1 ? 'class is' : 'classes are'} still unmarked this month.
          </p>
        )}

        <CalendarGrid
          classes={calendarClasses}
          year={calendarYear}
          month={calendarMonth}
          onPick={(c) => setMarking(toSession(c))}
          emptyHint="No classes this month. They appear here as parents fund their months."
        />
      </section>

      {upcoming.length > 0 && (
        <section className="mt-9">
          <p className="eyebrow mb-3">Coming up</p>
          <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-line bg-[var(--card)]">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="num w-24 shrink-0 text-[0.8125rem] text-muted">
                  {relativeDay(s.scheduledAt)}
                </span>
                <span className="num w-16 shrink-0 text-[0.8125rem] text-muted">
                  {formatTime(s.scheduledAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium">
                  {s.childName}
                </span>
                <span className="shrink-0 text-[0.8125rem] text-muted">{s.categoryName}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {marking && (
        <MarkAttendedSheet session={marking} onClose={() => setMarking(null)} />
      )}

      {!marking && <IncomingRequest enquiries={openEnquiries} />}
    </>
  )
}

function ClassCard({
  session,
  onMark,
  overdue = false,
}: {
  session: SessionRow
  onMark: () => void
  overdue?: boolean
}) {
  const commission = commissionOf(session.ratePerClass, session.commissionPct)
  const net = session.ratePerClass - commission

  return (
    <li
      className="overflow-hidden rounded-2xl border bg-[var(--card)]"
      style={{ borderColor: overdue ? 'var(--alert)' : 'var(--line)' }}
    >
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="display text-[1.375rem] font-bold leading-none">{session.childName}</p>
          <p className="mt-2 text-[0.875rem] text-grass">{session.categoryName}</p>
          <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5" />
              <span className="num">
                {overdue ? relativeDay(session.scheduledAt) + ', ' : ''}
                {formatTime(session.scheduledAt)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PinIcon className="h-3.5 w-3.5" />
              {session.parentArea ?? '—'}
            </span>
            <span>{session.parentName}</span>
          </div>
          <div className="mt-3">
            <VideoCall sessionId={session.id} />
          </div>
        </div>

        <div className="text-right">
          <Money paise={net} size="lg" />
          <p className="eyebrow mt-1">yours, net</p>
        </div>
      </div>

      {/* A large tap target, because this is used standing up, one-handed, between
          classes — and it is the only button on this screen that matters. */}
      <button
        type="button"
        onClick={onMark}
        className="w-full bg-grass py-4 text-[0.9375rem] font-bold text-white transition hover:brightness-110 active:brightness-95"
      >
        Mark attended
      </button>
    </li>
  )
}
