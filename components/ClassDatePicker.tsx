'use client'

import { useMemo, useState } from 'react'
import { TIMES } from './SlotPicker'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** yyyy-mm-dd for a given year/month/day, no timezone involved — this is a calendar date, not an instant. */
function dateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

/** The UTC instant for a wall-clock date+time in Bangalore. */
function toInstant(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00+05:30`)
}

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7 // Monday = 0
  const days: (string | null)[] = Array(lead).fill(null)
  const count = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= count; d++) days.push(dateKey(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

/**
 * Real calendar dates, current month plus the next two — not a weekly-recurring
 * template. Every class the parent picks here is one specific date and time; nothing
 * is inferred or multiplied from it.
 */
export function ClassDatePicker({
  unavailableInstants,
  blockedWeekly,
  selected,
  onToggle,
}: {
  /** ISO timestamps already taken — a real class, someone else's. */
  unavailableInstants: string[]
  /** The coach's declared weekly-busy pattern, projected onto every date it applies to. */
  blockedWeekly: { weekday: number; time: string }[]
  /** ISO timestamps the parent has picked so far. */
  selected: string[]
  onToggle: (iso: string) => void
}) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [expanded, setExpanded] = useState<string | null>(null)

  const monthIndex = viewYear * 12 + viewMonth
  const minIndex = now.getFullYear() * 12 + now.getMonth()
  const maxIndex = minIndex + 2

  const days = useMemo(() => buildMonth(viewYear, viewMonth), [viewYear, viewMonth])
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate())

  const busySet = useMemo(() => new Set(unavailableInstants), [unavailableInstants])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const pickedDates = useMemo(
    () => new Set(selected.map((iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))),
    [selected],
  )

  function go(delta: number) {
    const next = monthIndex + delta
    if (next < minIndex || next > maxIndex) return
    setViewYear(Math.floor(next / 12))
    setViewMonth(((next % 12) + 12) % 12)
  }

  function isTimeTaken(dateStr: string, time: string) {
    const iso = toInstant(dateStr, time).toISOString()
    if (busySet.has(iso)) return true
    const weekday = new Date(`${dateStr}T00:00:00+05:30`).getDay() // Bangalore-local weekday
    return blockedWeekly.some((b) => b.weekday === weekday && b.time === time)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={monthIndex <= minIndex}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:text-ink disabled:opacity-30"
        >
          ‹
        </button>
        <span className="display text-[0.9375rem] font-bold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={monthIndex >= maxIndex}
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:text-ink disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-[var(--card)]">
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} className="eyebrow px-1 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day || day < todayKey) {
              return <div key={i} className="h-10 border-b border-r border-line last:border-r-0" />
            }
            const num = Number(day.slice(-2))
            const isToday = day === todayKey
            const isOpen = day === expanded
            const hasPicks = pickedDates.has(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => setExpanded(isOpen ? null : day)}
                className="relative h-10 border-b border-r border-line text-[0.8125rem] font-medium transition last:border-r-0 hover:bg-[var(--paper)]"
                style={isOpen ? { background: 'var(--grass-wash)' } : undefined}
              >
                <span
                  className="num inline-grid h-6 w-6 place-items-center rounded-full"
                  style={isToday ? { background: 'var(--grass)', color: '#fff' } : undefined}
                >
                  {num}
                </span>
                {hasPicks && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                    style={{ background: 'var(--grass)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-2xl border border-line bg-[var(--card)] p-3.5">
          <p className="eyebrow mb-2">
            {new Date(`${expanded}T12:00:00+05:30`).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TIMES.map((t) => {
              if (expanded === todayKey) {
                const [h] = t.split(':').map(Number)
                if (h <= now.getHours()) return null
              }
              const taken = isTimeTaken(expanded, t)
              const iso = toInstant(expanded, t).toISOString()
              const picked = selectedSet.has(iso)
              const [hh] = t.split(':').map(Number)
              const label = `${hh % 12 === 0 ? 12 : hh % 12}${hh >= 12 ? 'pm' : 'am'}`
              if (taken) {
                return (
                  <span
                    key={t}
                    className="rounded-full border border-line px-2.5 py-1 text-[0.75rem] text-muted opacity-40"
                  >
                    {label}
                  </span>
                )
              }
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggle(iso)}
                  aria-pressed={picked}
                  className="num rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold transition"
                  style={
                    picked
                      ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                      : { color: 'var(--muted)', borderColor: 'var(--line)' }
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
