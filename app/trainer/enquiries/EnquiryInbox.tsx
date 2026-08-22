'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { acceptEnquiry, declineEnquiry } from '@/lib/db/actions'
import { buttonClass, Chip, EmptyState, Money, PinIcon, relativeDay } from '@/components/ui'
import { formatSlot, SlotPicker, todayWeekday } from '@/components/SlotPicker'
import { useLiveRefresh } from '@/lib/realtime'
import type { EnquiryRow } from '@/lib/db/types'

/**
 * Incoming only. There is no feed of children here and no way to approach a parent —
 * parents choose, trainers consent, and the direction is enforced in the RPC as well
 * as absent from the UI.
 */
export function EnquiryInbox({ enquiries }: { enquiries: EnquiryRow[] }) {
  useLiveRefresh(['enquiries'])

  const open = enquiries.filter((e) => e.status === 'open')
  const closed = enquiries.filter((e) => e.status !== 'open')

  return (
    <>
      <header>
        <h1 className="display text-[2rem] font-extrabold leading-none">Enquiries</h1>
        <p className="mt-2 text-[0.9375rem] text-muted">
          {open.length === 0
            ? 'Nothing waiting on you.'
            : `${open.length} waiting on you.`}
        </p>
      </header>

      <section className="mt-7">
        {open.length === 0 ? (
          <EmptyState
            title="No open enquiries"
            body="Parents find you by searching their area for a category you are approved in. Approved categories with a clear credential get more enquiries than ones without."
          />
        ) : (
          <ul className="space-y-3">
            {open.map((e) => (
              <OpenEnquiry key={e.id} enquiry={e} />
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section className="mt-9">
          <p className="eyebrow mb-3">Answered</p>
          <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-line bg-[var(--card)]">
            {closed.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium">
                  {e.childName}
                  {e.childAge != null && <span className="num text-muted"> · {e.childAge}</span>}
                </span>
                <span className="text-[0.8125rem] text-muted">{e.categoryName}</span>
                <Chip tone={e.status === 'accepted' ? 'grass' : 'quiet'}>{e.status}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function OpenEnquiry({ enquiry }: { enquiry: EnquiryRow }) {
  const router = useRouter()
  const [classes, setClasses] = useState(8)
  const [weekday, setWeekday] = useState(todayWeekday())
  const [time, setTime] = useState('17:00')
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  const total = (enquiry.ratePerClass ?? 0) * classes

  async function accept() {
    setBusy('accept')
    setError(null)
    const res = await acceptEnquiry(enquiry.id, classes, weekday, time)
    setBusy(null)
    if (!res.ok) return setError(res.error ?? 'Could not accept')
    router.refresh()
  }

  async function decline() {
    setBusy('decline')
    setError(null)
    const res = await declineEnquiry(enquiry.id, reason.trim() || undefined)
    setBusy(null)
    if (!res.ok) return setError(res.error ?? 'Could not decline')
    router.refresh()
  }

  return (
    <li className="rounded-2xl border border-line bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="display text-[1.25rem] font-bold leading-none">
            {enquiry.childName}
            {enquiry.childAge != null && (
              <span className="num ml-2 text-[0.9375rem] font-medium text-muted">
                {enquiry.childAge} yrs
              </span>
            )}
          </p>
          <p className="mt-2 text-[0.875rem] text-grass">{enquiry.categoryName}</p>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon className="h-3.5 w-3.5" />
              {enquiry.parentArea ?? '—'}
            </span>
            <span>{enquiry.parentName}</span>
            <span>{relativeDay(enquiry.createdAt)}</span>
          </div>
        </div>

        {enquiry.ratePerClass != null && (
          <div className="text-right">
            <Money paise={enquiry.ratePerClass} />
            <p className="eyebrow mt-0.5">your rate</p>
          </div>
        )}
      </div>

      {enquiry.message && (
        <p className="mt-4 border-l-2 border-[var(--line)] pl-3.5 text-[0.9375rem] leading-relaxed">
          {enquiry.message}
        </p>
      )}

      {declining ? (
        <div className="mt-5 border-t border-line pt-4">
          <label htmlFor={`r-${enquiry.id}`} className="eyebrow mb-2 block">
            Reason <span className="normal-case tracking-normal">— the parent sees this</span>
          </label>
          <input
            id={`r-${enquiry.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
            placeholder="No weekend slots left this month."
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void decline()}
              disabled={busy !== null}
              className={buttonClass('danger', 'md', 'flex-1')}
            >
              {busy === 'decline' ? 'Sending…' : 'Send decline'}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className={buttonClass('ghost', 'md')}
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Classes this month</span>
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
                Parent commits <Money paise={total} size="sm" />
              </span>
            )}
          </div>

          <div className="mt-4">
            <SlotPicker weekday={weekday} time={time} onWeekday={setWeekday} onTime={setTime} />
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => void accept()}
              disabled={busy !== null}
              className={buttonClass('primary', 'md', 'flex-1')}
            >
              {busy === 'accept' ? 'Accepting…' : `Accept · ${formatSlot(weekday, time)}`}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(true)}
              className={buttonClass('outline', 'md')}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}
    </li>
  )
}
