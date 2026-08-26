'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { EmptyState, Money, formatDay, relativeDay } from '@/components/ui'
import { stallReason } from '@/lib/service-health'
import { useLiveRefresh } from '@/lib/realtime'
import type { ActiveService } from '@/lib/db/types'

/**
 * Two things make this worth looking at rather than merely correct.
 *
 * It is subscribed to `ledger_entries`, so when a trainer marks attendance on another
 * device the row moves here in the same second — and the row that moved is briefly
 * marked, because a table that changes silently is a table nobody trusts.
 *
 * And it flags stalled services: money held with nothing happening against it. That is
 * exactly the thing an admin exists to catch, so it is computed and sorted to the top
 * rather than left for someone to spot.
 */
export function ActiveServicesMonitor({
  services,
  totals,
  pendingCount,
}: {
  services: ActiveService[]
  totals: { platformRevenue: number; totalHeld: number; totalReleased: number }
  pendingCount: number
}) {
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const previous = useRef(new Map(services.map((s) => [s.enrollmentId, s.releasedToTrainer])))

  useLiveRefresh(['ledger_entries', 'sessions', 'enrollments'])

  useEffect(() => {
    const changed = new Set<string>()
    for (const s of services) {
      const before = previous.current.get(s.enrollmentId)
      if (before !== undefined && before !== s.releasedToTrainer) changed.add(s.enrollmentId)
      previous.current.set(s.enrollmentId, s.releasedToTrainer)
    }
    if (changed.size === 0) return
    setMoved(changed)
    const t = setTimeout(() => setMoved(new Set()), 2400)
    return () => clearTimeout(t)
  }, [services])

  const flagged = services.filter((s) => stallReason(s) !== null)
  const ordered = [...flagged, ...services.filter((s) => stallReason(s) === null)]

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-none">Active services</h1>
          <p className="mt-2 text-[0.9375rem] text-muted">
            <span className="num font-semibold text-ink">{services.length}</span> running
            {flagged.length > 0 && (
              <>
                {' · '}
                <span className="num font-semibold" style={{ color: 'var(--alert)' }}>
                  {flagged.length}
                </span>{' '}
                stalled
              </>
            )}
            {pendingCount > 0 && (
              <>
                {' · '}
                <Link
                  href="/admin/approvals"
                  className="font-semibold text-grass underline underline-offset-2"
                >
                  {pendingCount} awaiting approval
                </Link>
              </>
            )}
          </p>
        </div>

        <dl className="flex flex-wrap gap-7 text-right">
          <Stat label="Held in escrow" value={totals.totalHeld} />
          <Stat label="Released" value={totals.totalReleased} />
          <Stat label="Platform revenue" value={totals.platformRevenue} />
        </dl>
      </header>

      {services.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing running"
            body="A service appears here the moment a parent funds a month. Until then there is no money in the system to watch."
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-[var(--card)]">
          <table className="w-full min-w-[68rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <Th>Child · Parent</Th>
                <Th>Coach</Th>
                <Th>Category</Th>
                <Th>Area</Th>
                <Th align="right">Delivered</Th>
                <Th align="right">In escrow</Th>
                <Th align="right">To coach</Th>
                <Th align="right">Platform</Th>
                <Th>Last marked</Th>
                <Th>Next class</Th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => {
                const stall = stallReason(s)
                const justMoved = moved.has(s.enrollmentId)
                return (
                  <tr
                    key={s.enrollmentId}
                    className={`border-b border-line last:border-0 ${justMoved ? 'money-tick' : ''}`}
                    style={
                      stall
                        ? { boxShadow: 'inset 3px 0 0 0 var(--alert)' }
                        : undefined
                    }
                  >
                    <Td>
                      <span className="font-semibold">{s.childName}</span>
                      <span className="block text-[0.75rem] text-muted">{s.parentName}</span>
                      {stall && (
                        <span
                          className="mt-1 inline-block text-[0.6875rem] font-semibold"
                          style={{ color: 'var(--alert)' }}
                        >
                          {stall}
                        </span>
                      )}
                    </Td>
                    <Td>{s.trainerName}</Td>
                    <Td>
                      <span className="text-grass">{s.categoryName}</span>
                    </Td>
                    <Td>
                      <span className="text-muted">{s.areaLabel ?? '—'}</span>
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
                      <Money paise={s.releasedToTrainer} size="sm" />
                    </Td>
                    <Td align="right">
                      <Money paise={s.platformEarned} size="sm" />
                    </Td>
                    <Td>
                      <span className="num text-[0.8125rem] text-muted">
                        {s.lastClassAt ? relativeDay(s.lastClassAt) : 'never'}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="num text-[0.8125rem]"
                        style={{
                          color:
                            s.nextClassAt && new Date(s.nextClassAt) < new Date()
                              ? 'var(--alert)'
                              : 'var(--muted)',
                        }}
                      >
                        {s.nextClassAt
                          ? `${formatDay(s.nextClassAt).day} ${formatDay(s.nextClassAt).month}`
                          : 'none'}
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted">
        The three money columns always sum to the committed amount for a service. They are
        derived per enrollment from <code className="text-[0.75rem]">ledger_entries</code>, not
        read off an account balance — one parent&apos;s escrow account backs every enrollment
        they hold at once.
      </p>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="eyebrow mb-1.5">{label}</dt>
      <dd>
        <Money paise={value} size="lg" />
      </dd>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
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
