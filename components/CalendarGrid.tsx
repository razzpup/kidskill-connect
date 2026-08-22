'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Money, SkillMeter, formatTime } from '@/components/ui'
import type { CalendarClass } from '@/lib/db/calendar'

/**
 * A month of classes, one square per day.
 *
 * The same grid serves both sides because both are asking the same question — what is
 * happening, and what did I miss — and only the answer to "so what do I do about it"
 * differs. The parent reads; the trainer acts, so `onPick` is what separates them.
 *
 * Four states, and the one that matters most is `missed`: a class in the past that was
 * never marked. That is a parent's money sitting in escrow with no record against it,
 * and it is the only state drawn in the alert colour.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export type ClassState = 'attended' | 'missed' | 'scheduled' | 'no_show' | 'cancelled'

export function classState(c: CalendarClass): ClassState {
  if (c.status === 'attended') return 'attended'
  if (c.status === 'no_show') return 'no_show'
  if (c.status === 'cancelled') return 'cancelled'
  return c.missed ? 'missed' : 'scheduled'
}

const DOT: Record<ClassState, string> = {
  attended: 'var(--grass)',
  scheduled: 'var(--muted)',
  missed: 'var(--alert)',
  no_show: 'var(--marigold)',
  cancelled: 'var(--line)',
}

const LABEL: Record<ClassState, string> = {
  attended: 'Taught',
  scheduled: 'Scheduled',
  missed: 'Not marked',
  no_show: 'No-show',
  cancelled: 'Cancelled',
}

/** Monday-first grid, padded to whole weeks. */
function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7 // Monday = 0
  const days: (string | null)[] = Array(lead).fill(null)
  const count = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= count; d++) {
    days.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    )
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

export function CalendarGrid({
  classes,
  year,
  month,
  onPick,
  emptyHint,
}: {
  classes: CalendarClass[]
  year: number
  month: number
  /** Trainer side passes this; without it the grid is read-only. */
  onPick?: (c: CalendarClass) => void
  emptyHint?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarClass[]>()
    for (const c of classes) {
      const list = m.get(c.day) ?? []
      list.push(c)
      m.set(c.day, list)
    }
    return m
  }, [classes])

  const days = useMemo(() => buildMonth(year, month), [year, month])
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const chosen = selected ? (byDay.get(selected) ?? []) : []

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-line bg-[var(--card)]">
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} className="eyebrow px-2 py-2.5 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[5rem] border-b border-r border-line last:border-r-0" />
            }
            const items = byDay.get(day) ?? []
            const isToday = day === today
            const isSelected = day === selected
            const num = Number(day.slice(-2))

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelected(isSelected ? null : day)}
                disabled={items.length === 0}
                className="min-h-[5rem] border-b border-r border-line p-1.5 text-left align-top transition last:border-r-0 disabled:cursor-default enabled:hover:bg-[var(--paper)]"
                style={isSelected ? { background: 'var(--grass-wash)' } : undefined}
              >
                <span
                  className="num inline-grid h-6 w-6 place-items-center rounded-full text-[0.75rem] font-semibold"
                  style={
                    isToday
                      ? { background: 'var(--grass)', color: '#fff' }
                      : { color: items.length ? 'var(--ink)' : 'var(--muted)' }
                  }
                >
                  {num}
                </span>

                <span className="mt-1 flex flex-col gap-1">
                  {items.slice(0, 2).map((c) => {
                    const s = classState(c)
                    return (
                      <span
                        key={c.id}
                        className="flex items-center gap-1 truncate text-[0.6875rem] leading-tight"
                        title={`${c.childName} · ${c.categoryName} · ${LABEL[s]}`}
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: DOT[s] }}
                        />
                        <span className="truncate text-muted">{c.childName}</span>
                      </span>
                    )
                  })}
                  {items.length > 2 && (
                    <span className="num text-[0.625rem] text-muted">+{items.length - 2}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <Legend />

      {selected && chosen.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow mb-3">
            {new Date(selected + 'T12:00:00').toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          <ul className="space-y-2">
            {chosen.map((c) => (
              <DayEntry key={c.id} klass={c} onPick={onPick} />
            ))}
          </ul>
        </div>
      )}

      {classes.length === 0 && emptyHint && (
        <p className="mt-5 text-center text-[0.875rem] leading-relaxed text-muted">{emptyHint}</p>
      )}
    </>
  )
}

function DayEntry({
  klass,
  onPick,
}: {
  klass: CalendarClass
  onPick?: (c: CalendarClass) => void
}) {
  const s = classState(klass)
  const actionable = onPick && (s === 'scheduled' || s === 'missed')

  const body = (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-line bg-[var(--card)] p-4">
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: DOT[s] }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold">
          {klass.childName}
          <span className="ml-2 font-normal text-muted">{klass.categoryName}</span>
        </p>
        <p className="num mt-0.5 text-[0.8125rem] text-muted">
          {formatTime(klass.scheduledAt)} · {LABEL[s]}
        </p>
        {klass.assessmentNote && (
          <p className="mt-2.5 text-[0.875rem] leading-relaxed">{klass.assessmentNote}</p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {klass.skillRating ? (
          <SkillMeter value={klass.skillRating} />
        ) : (
          <Money paise={klass.ratePerClass} size="sm" tone={s === 'missed' ? 'marigold' : 'muted'} />
        )}
        {actionable && (
          <p className="mt-1.5 text-[0.75rem] font-semibold text-grass">Mark →</p>
        )}
      </div>
    </div>
  )

  if (actionable) {
    return (
      <li>
        <button type="button" onClick={() => onPick(klass)} className="w-full text-left">
          {body}
        </button>
      </li>
    )
  }
  if (klass.status === 'attended') {
    return (
      <li>
        <Link href={`/parent/session/${klass.id}`} className="block">
          {body}
        </Link>
      </li>
    )
  }
  return <li>{body}</li>
}

function Legend() {
  const states: ClassState[] = ['attended', 'scheduled', 'missed', 'no_show']
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {states.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOT[s] }} />
          {LABEL[s]}
        </span>
      ))}
    </div>
  )
}

export function MonthNav({
  year,
  month,
  basePath,
}: {
  year: number
  month: number
  basePath: string
}) {
  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 }
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 }
  const label = new Date(year, month, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  })

  return (
    <div className="mb-5 flex items-center gap-3">
      <h1 className="display text-[1.75rem] font-extrabold leading-none">{label}</h1>
      <span className="ml-auto flex gap-1">
        <Link
          href={`${basePath}?y=${prev.y}&m=${prev.m}`}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
          aria-label="Previous month"
        >
          ‹
        </Link>
        <Link
          href={`${basePath}?y=${next.y}&m=${next.m}`}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
          aria-label="Next month"
        >
          ›
        </Link>
      </span>
    </div>
  )
}
