'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { refundEnrollment } from '@/lib/db/actions'
import { buttonClass, Chip, EmptyState, Money, formatDay } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import type { ActiveService, EnrollmentStatus } from '@/lib/db/types'

const FILTERS: { value: EnrollmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'active', label: 'Active' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function EnrollmentHistory({ services }: { services: ActiveService[] }) {
  const [filter, setFilter] = useState<EnrollmentStatus | 'all'>('all')
  const [refunding, setRefunding] = useState<ActiveService | null>(null)

  const rows = filter === 'all' ? services : services.filter((s) => s.status === filter)

  return (
    <>
      <header>
        <h1 className="display text-[2rem] font-extrabold leading-none">Enrollments</h1>
        <p className="mt-2 max-w-[64ch] text-[0.9375rem] leading-relaxed text-muted">
          Full history. A refund returns whatever is still in escrow to the parent&apos;s wallet
          — money already released against a verified class is never clawed back.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className="rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition"
            style={
              filter === f.value
                ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                : { color: 'var(--muted)', borderColor: 'var(--line)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" body="No enrollments match this filter." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-[var(--card)]">
            <table className="w-full min-w-[62rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <Th>Child · Parent</Th>
                  <Th>Trainer</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Started</Th>
                  <Th align="right">Delivered</Th>
                  <Th align="right">In escrow</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.enrollmentId} className="border-b border-line last:border-0">
                    <Td>
                      <span className="font-semibold">{s.childName}</span>
                      <span className="block text-[0.75rem] text-muted">{s.parentName}</span>
                    </Td>
                    <Td>{s.trainerName}</Td>
                    <Td>
                      <span className="text-grass">{s.categoryName}</span>
                    </Td>
                    <Td>
                      <Chip
                        tone={
                          s.status === 'active'
                            ? 'grass'
                            : s.status === 'cancelled'
                              ? 'alert'
                              : 'outline'
                        }
                      >
                        {s.status.replace('_', ' ')}
                      </Chip>
                    </Td>
                    <Td>
                      <span className="num text-[0.8125rem] text-muted">
                        {s.startDate
                          ? `${formatDay(s.startDate).day} ${formatDay(s.startDate).month}`
                          : '—'}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="num">
                        {s.classesDelivered}
                        <span className="text-muted">/{s.classesPerMonth}</span>
                      </span>
                    </Td>
                    <Td align="right">
                      <Money paise={s.stillInEscrow} size="sm" />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <Link
                          href={`/admin/ledger?enrollment=${s.enrollmentId}`}
                          className="text-[0.8125rem] font-semibold text-muted underline underline-offset-2 hover:text-ink"
                        >
                          Ledger
                        </Link>
                        {s.status === 'active' && s.stillInEscrow > 0 && (
                          <button
                            onClick={() => setRefunding(s)}
                            className="text-[0.8125rem] font-semibold underline underline-offset-2"
                            style={{ color: 'var(--alert)' }}
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {refunding && <RefundDialog service={refunding} onClose={() => setRefunding(null)} />}
    </>
  )
}

function RefundDialog({ service, onClose }: { service: ActiveService; onClose: () => void }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await refundEnrollment(service.enrollmentId, reason.trim() || undefined)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not refund')
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-5" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[26rem] rounded-2xl border border-line bg-[var(--card)] p-5"
      >
        <h2 className="display text-[1.25rem] font-bold">
          Refund {formatRupees(service.stillInEscrow)}?
        </h2>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
          Returns the escrow remainder to {service.parentName}&apos;s wallet, cancels the
          remaining classes, and closes the service.{' '}
          <span className="text-ink">
            {formatRupees(service.releasedToTrainer)} already paid to {service.trainerName} is
            not affected.
          </span>
        </p>

        <label htmlFor="reason" className="eyebrow mb-2 mt-5 block">
          Reason — the parent sees this
        </label>
        <input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
          placeholder="Trainer unavailable for the rest of the month."
        />

        <div className="mt-5 flex gap-2">
          <button onClick={() => void confirm()} disabled={busy} className={buttonClass('danger', 'md', 'flex-1')}>
            {busy ? 'Refunding…' : 'Refund and close'}
          </button>
          <button onClick={onClose} className={buttonClass('ghost', 'md')}>
            Cancel
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th scope="col" className="eyebrow whitespace-nowrap px-3.5 py-3" style={{ textAlign: align }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className="px-3.5 py-3 align-top text-[0.875rem]" style={{ textAlign: align }}>
      {children}
    </td>
  )
}
