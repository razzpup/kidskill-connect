'use client'

import { useState, useTransition } from 'react'
import { toggleBlockedSlot } from '@/lib/db/actions'
import { DAYS, TIMES, formatSlot } from './SlotPicker'

/**
 * The coach's own weekly grid — tap a free cell to mark it busy, tap it again to free
 * it. Cells already booked from a real enrollment can't be toggled here; that
 * commitment is real, not a preference. What's left after both layers is exactly what a
 * parent sees as selectable when they enquire.
 */
export function AvailabilityEditor({
  booked,
  initialBlocked,
}: {
  booked: { weekday: number; time: string }[]
  initialBlocked: { weekday: number; time: string }[]
}) {
  const [blocked, setBlocked] = useState(initialBlocked)
  const [pending, startTransition] = useTransition()

  const isBooked = (weekday: number, time: string) => booked.some((b) => b.weekday === weekday && b.time === time)
  const isBlocked = (weekday: number, time: string) => blocked.some((b) => b.weekday === weekday && b.time === time)

  function toggle(weekday: number, time: string) {
    const currentlyBlocked = isBlocked(weekday, time)
    setBlocked((prev) =>
      currentlyBlocked
        ? prev.filter((b) => !(b.weekday === weekday && b.time === time))
        : [...prev, { weekday, time }],
    )
    startTransition(async () => {
      const res = await toggleBlockedSlot(weekday, time)
      if (!res.ok) {
        // Roll back on failure — the optimistic flip didn't actually happen.
        setBlocked((prev) =>
          currentlyBlocked
            ? [...prev, { weekday, time }]
            : prev.filter((b) => !(b.weekday === weekday && b.time === time)),
        )
      }
    })
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th className="w-10" />
              {DAYS.map((d) => (
                <th key={d} className="eyebrow pb-1 text-center font-semibold">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIMES.map((t) => {
              const [h] = t.split(':').map(Number)
              const label = `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`
              return (
                <tr key={t}>
                  <td className="num pr-1 text-right text-[0.6875rem] text-muted">{label}</td>
                  {DAYS.map((_, weekday) => {
                    const taken = isBooked(weekday, t)
                    const off = isBlocked(weekday, t)
                    if (taken) {
                      return (
                        <td key={weekday}>
                          <div
                            title={`Booked — ${formatSlot(weekday, t)}`}
                            className="h-6 rounded-md"
                            style={{ background: 'var(--muted)', opacity: 0.5 }}
                          />
                        </td>
                      )
                    }
                    return (
                      <td key={weekday}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggle(weekday, t)}
                          title={`${off ? 'Busy' : 'Free'} — ${formatSlot(weekday, t)} — tap to toggle`}
                          aria-pressed={off}
                          className="h-6 w-full rounded-md transition hover:brightness-95 disabled:cursor-wait"
                          style={{ background: off ? 'var(--alert)' : 'var(--grass-wash)' }}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-4 text-[0.75rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--grass-wash)' }} />
          Free — tap to mark busy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--alert)' }} />
          Marked busy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--muted)', opacity: 0.5 }} />
          Already teaching
        </span>
      </div>
    </div>
  )
}
