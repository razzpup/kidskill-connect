'use client'

/**
 * The day and time a weekly class actually happens.
 *
 * The trainer sets this at the moment they accept, because they are the one with a
 * timetable to protect. It defaults to today's weekday — a trainer accepting on a
 * Saturday most likely teaches on Saturdays, and it means a class funded the same day
 * lands the same day rather than up to six days later.
 */

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The full day, hour by hour — a coach may teach any time they've made themselves available for. */
export const TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

export function todayWeekday(): number {
  return new Date().getDay()
}

export function formatSlot(weekday: number, time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  const at = m === 0 ? `${hour}${suffix}` : `${hour}.${String(m).padStart(2, '0')}${suffix}`
  return `${DAYS[weekday]}s at ${at}`
}

export function SlotPicker({
  weekday,
  time,
  onWeekday,
  onTime,
}: {
  weekday: number
  time: string
  onWeekday: (d: number) => void
  onTime: (t: string) => void
}) {
  return (
    <div>
      <p className="eyebrow mb-2">Which day</p>
      <div className="flex flex-wrap gap-1">
        {DAYS.map((d, i) => {
          const on = weekday === i
          return (
            <button
              key={d}
              type="button"
              onClick={() => onWeekday(i)}
              aria-pressed={on}
              className="h-9 flex-1 min-w-[2.75rem] rounded-lg border text-[0.8125rem] font-semibold transition"
              style={
                on
                  ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                  : { color: 'var(--muted)', borderColor: 'var(--line)' }
              }
            >
              {d}
            </button>
          )
        })}
      </div>

      <p className="eyebrow mb-2 mt-4">What time</p>
      <div className="flex flex-wrap gap-1">
        {TIMES.map((t) => {
          const on = time === t
          const [h] = t.split(':').map(Number)
          const label = `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`
          return (
            <button
              key={t}
              type="button"
              onClick={() => onTime(t)}
              aria-pressed={on}
              className="num h-9 flex-1 min-w-[3.25rem] rounded-lg border text-[0.8125rem] font-semibold transition"
              style={
                on
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
  )
}
