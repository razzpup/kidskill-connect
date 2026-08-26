'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptEnquiry, declineEnquiry } from '@/lib/db/actions'
import { buttonClass, Money, PinIcon, relativeDay } from '@/components/ui'
import { formatSlot, SlotPicker, todayWeekday } from '@/components/SlotPicker'
import type { EnquiryRow } from '@/lib/db/types'

/**
 * A parent reaching out is the one thing that should interrupt a trainer.
 *
 * Everything else on this surface waits to be visited; this arrives. It lands over the
 * Today screen because the alternative — a number on a nav item — is something a trainer
 * discovers an hour later, and a parent who has just chosen you is deciding right now
 * whether this platform is responsive enough to trust with their child.
 *
 * It answers in place. Accepting from here creates the enrollment and tells both sides,
 * so the whole exchange is two taps on the screen the trainer was already looking at.
 */
export function IncomingRequest({ enquiries }: { enquiries: EnquiryRow[] }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [classes, setClasses] = useState(8)
  const [weekday, setWeekday] = useState(todayWeekday())
  const [time, setTime] = useState('17:00')
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrived, setArrived] = useState(false)

  const pending = enquiries.filter((e) => !dismissed.has(e.id))
  const current = pending[0]

  // A parent who picked a slot when they enquired gets that slot proposed back, instead
  // of the trainer guessing today-at-5pm and having to remember to change it.
  useEffect(() => {
    if (!current) return
    if (current.preferredWeekday != null) setWeekday(current.preferredWeekday)
    if (current.preferredTime) setTime(current.preferredTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  // Mark anything that shows up after first paint as newly arrived, so a request that
  // lands while the trainer is watching animates in rather than appearing to have been
  // there all along.
  const seen = useRef(new Set(enquiries.map((e) => e.id)))
  useEffect(() => {
    const fresh = enquiries.some((e) => !seen.current.has(e.id))
    enquiries.forEach((e) => seen.current.add(e.id))
    if (fresh) {
      setArrived(true)
      const t = setTimeout(() => setArrived(false), 2000)
      return () => clearTimeout(t)
    }
  }, [enquiries])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && current && dismiss(current.id)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!current) return null

  function dismiss(id: string) {
    setDismissed((d) => new Set(d).add(id))
    setError(null)
  }

  async function accept() {
    setBusy('accept')
    setError(null)
    const res = await acceptEnquiry(current.id, classes, weekday, time)
    setBusy(null)
    if (!res.ok) return setError(res.error ?? 'Could not accept')
    dismiss(current.id)
    router.refresh()
  }

  async function decline() {
    setBusy('decline')
    setError(null)
    const res = await declineEnquiry(current.id)
    setBusy(null)
    if (!res.ok) return setError(res.error ?? 'Could not decline')
    dismiss(current.id)
    router.refresh()
  }

  const total = (current.ratePerClass ?? 0) * classes

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
      <div
        className={`w-full max-w-[30rem] rounded-t-3xl border border-line bg-[var(--card)] p-6 sm:rounded-3xl ${
          arrived ? 'spine-entry-new' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grass opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-grass" />
          </span>
          <p className="eyebrow">New request</p>
          {pending.length > 1 && (
            <span className="num ml-auto text-[0.75rem] text-muted">
              1 of {pending.length}
            </span>
          )}
        </div>

        <h2 className="display mt-4 text-[1.75rem] font-extrabold leading-none">
          {current.childName}
          {current.childAge != null && (
            <span className="num ml-2.5 text-[1.125rem] font-medium text-muted">
              {current.childAge}
            </span>
          )}
        </h2>
        <p className="mt-2 text-[0.9375rem] font-semibold text-grass">{current.categoryName}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <PinIcon className="h-3.5 w-3.5" />
            {current.parentArea ?? '—'}
          </span>
          <span>{current.parentName}</span>
          <span>{relativeDay(current.createdAt)}</span>
        </div>

        {current.message && (
          <p className="mt-4 border-l-2 border-line pl-3.5 text-[0.9375rem] leading-relaxed">
            {current.message}
          </p>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Classes a month</span>
            <div className="flex gap-1">
              {[4, 8, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setClasses(n)}
                  aria-pressed={classes === n}
                  className="num h-9 w-11 rounded-lg border text-[0.875rem] font-semibold transition"
                  style={
                    classes === n
                      ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                      : { color: 'var(--muted)', borderColor: 'var(--line)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            {total > 0 && (
              <span className="ml-auto text-[0.8125rem] text-muted">
                They commit <Money paise={total} size="sm" />
              </span>
            )}
          </div>

          <div className="mt-4">
            {current.preferredWeekday != null && current.preferredTime && (
              <p className="mb-2 text-[0.75rem] text-muted">
                Asked for <span className="font-semibold text-ink">{formatSlot(current.preferredWeekday, current.preferredTime)}</span>
              </p>
            )}
            <SlotPicker weekday={weekday} time={time} onWeekday={setWeekday} onTime={setTime} />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => void accept()}
              disabled={busy !== null}
              className={buttonClass('primary', 'lg', 'flex-1')}
            >
              {busy === 'accept' ? 'Accepting…' : `Accept · ${formatSlot(weekday, time)}`}
            </button>
            <button
              onClick={() => void decline()}
              disabled={busy !== null}
              className={buttonClass('outline', 'lg')}
            >
              {busy === 'decline' ? '…' : 'Decline'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => dismiss(current.id)}
            className="mt-3 w-full text-center text-[0.8125rem] text-muted transition hover:text-ink"
          >
            Decide later
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-muted">
          Accepting books {formatSlot(weekday, time).toLowerCase()} and notifies you both.
          Nothing is paid out until you mark a class taught.
        </p>
      </div>
    </div>
  )
}
