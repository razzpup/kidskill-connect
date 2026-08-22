'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ProgressSpine, SpineSummary } from '@/components/ProgressSpine'
import { CalendarGrid } from '@/components/CalendarGrid'
import {
  Money, ArrowIcon, LinkButton, relativeDay, DanceIcon, MusicIcon, SportsIcon,
} from '@/components/ui'
import { useLiveRefresh } from '@/lib/realtime'
import type { Child, EnrollmentSummary, SpineEntry, WalletStrip } from '@/lib/db/types'
import type { CalendarClass } from '@/lib/db/calendar'

const DISCOVER = [
  {
    group: 'sports',
    label: 'Sports',
    body: 'Football, swimming, cricket, badminton.',
    icon: SportsIcon,
  },
  {
    group: 'music',
    label: 'Music',
    body: 'Carnatic and Hindustani vocal, guitar, piano.',
    icon: MusicIcon,
  },
  {
    group: 'dance',
    label: 'Dance',
    body: 'Bharatanatyam, hip-hop.',
    icon: DanceIcon,
  },
] as const

export function ParentHome({
  parentId,
  childrenList,
  selectedId,
  entries,
  strip,
  enrollments,
  calendarClasses,
  calendarYear,
  calendarMonth,
}: {
  parentId: string
  childrenList: Child[]
  selectedId: string
  entries: SpineEntry[]
  strip: WalletStrip
  enrollments: EnrollmentSummary[]
  calendarClasses: CalendarClass[]
  calendarYear: number
  calendarMonth: number
}) {
  const selected = childrenList.find((c) => c.id === selectedId) ?? childrenList[0]

  // When a new entry arrives over realtime we want it to land, not blink in — and we
  // want the money strip to acknowledge that it changed.
  const previousTop = useRef(entries[0]?.sessionId ?? null)
  const [arrived, setArrived] = useState<string | null>(null)
  const [moneyMoved, setMoneyMoved] = useState(false)
  const previousEscrow = useRef(strip.heldInEscrow)

  useLiveRefresh(['sessions', 'ledger_entries', 'enrollments'])

  useEffect(() => {
    const top = entries[0]?.sessionId ?? null
    if (top && previousTop.current && top !== previousTop.current) {
      setArrived(top)
      const t = setTimeout(() => setArrived(null), 2600)
      previousTop.current = top
      return () => clearTimeout(t)
    }
    previousTop.current = top
  }, [entries])

  useEffect(() => {
    if (previousEscrow.current !== strip.heldInEscrow) {
      previousEscrow.current = strip.heldInEscrow
      setMoneyMoved(true)
      const t = setTimeout(() => setMoneyMoved(false), 1600)
      return () => clearTimeout(t)
    }
  }, [strip.heldInEscrow])

  const pendingPayment = enrollments.filter((e) => e.status === 'pending_payment')
  const active = enrollments.filter((e) => e.status === 'active')
  const monthLabel = new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  })

  return (
    <>
      {pendingPayment.length > 0 && (
        <div className="mb-8 space-y-2">
          {pendingPayment.map((e) => (
            <Link
              key={e.id}
              href={`/parent/pay/${e.id}`}
              className="flex items-center gap-3 rounded-2xl border border-grass bg-grass-wash px-5 py-4 transition hover:brightness-[0.98]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-grass">
                  {e.trainerName} accepted {e.categoryName}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-muted">
                  Pay to lock {e.classesPerMonth} classes this month
                </p>
              </div>
              <Money paise={e.committed} />
              <ArrowIcon className="h-4 w-4 shrink-0 text-grass" />
            </Link>
          ))}
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 className="display mt-1.5 text-[2rem] font-extrabold leading-none">
            {selected.name}&apos;s dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-[var(--card)] p-1">
            {childrenList.map((c) => (
              <Link
                key={c.id}
                href={`/parent?child=${c.id}`}
                scroll={false}
                className="rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition"
                style={
                  c.id === selected.id
                    ? { background: 'var(--grass)', color: '#fff' }
                    : { color: 'var(--muted)' }
                }
              >
                {c.name}
              </Link>
            ))}
          </div>

          <Link
            href="/parent/wallet"
            className={`flex items-center gap-2.5 rounded-full border border-line bg-[var(--card)] py-1.5 pl-3.5 pr-1.5 transition hover:border-[var(--muted)] ${
              moneyMoved ? 'money-tick' : ''
            }`}
          >
            <span className="eyebrow">Escrow</span>
            <Money paise={strip.heldInEscrow} size="sm" />
            <span className="grid h-6 w-6 place-items-center rounded-full text-muted">
              <ArrowIcon className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </header>

      {/* This month, at a glance — the practical question a returning parent asks first. */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">This month</p>
            <h2 className="display text-[1.5rem] font-bold leading-none">{monthLabel}</h2>
          </div>
          <Link
            href="/parent/calendar"
            className="text-[0.8125rem] font-semibold text-grass underline underline-offset-2"
          >
            Full calendar
          </Link>
        </div>
        <CalendarGrid
          classes={calendarClasses}
          year={calendarYear}
          month={calendarMonth}
          emptyHint="No classes this month. Once you fund a month, every class appears here on the day it falls."
        />
      </section>

      {/* The signature element — a comfortable reading width even on a wide screen,
          because it is a timeline of written notes, not a grid. */}
      <section className="mt-12 max-w-[46rem]">
        <p className="eyebrow mb-1.5">Progress spine</p>
        <SpineSummary entries={entries} />
        <div className="mt-6">
          <ProgressSpine entries={entries} childName={selected.name} newestId={arrived} />
        </div>
      </section>

      {/* Discover new trainers — three main skill groups, not the whole category list;
          this is a nudge toward search, not a replacement for it. */}
      <section className="mt-14">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Something new</p>
            <h2 className="display text-[1.5rem] font-bold leading-none">Discover trainers</h2>
          </div>
          <Link
            href="/parent/search"
            className="text-[0.8125rem] font-semibold text-grass underline underline-offset-2"
          >
            Browse all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {DISCOVER.map((d) => (
            <Link
              key={d.group}
              href="/parent/search"
              className="group rounded-2xl border border-line bg-[var(--card)] p-5 transition hover:border-grass"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-grass-wash text-grass">
                <d.icon className="h-[1.15rem] w-[1.15rem]" />
              </span>
              <p className="display mt-3.5 text-[1.125rem] font-bold leading-none">{d.label}</p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{d.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Add a child — deliberately modest. This is upkeep, not a headline task. */}
      <section className="mt-10 max-w-md">
        <Link
          href="/parent/children/new"
          className="flex items-center gap-3.5 rounded-2xl border border-dashed border-line bg-[var(--card)] px-5 py-4 transition hover:border-[var(--muted)]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[1.25rem] leading-none text-muted">
            +
          </span>
          <span>
            <span className="block text-[0.9375rem] font-semibold">Add a child</span>
            <span className="block text-[0.8125rem] text-muted">Each kid gets their own spine.</span>
          </span>
        </Link>
      </section>

      {active.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow mb-3">Running now</p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {active.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-[var(--card)] px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-semibold">{e.categoryName}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted">
                    {e.trainerName} · started {e.startDate ? relativeDay(e.startDate) : 'recently'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-[0.9375rem] font-semibold">
                    {e.classesDelivered}
                    <span className="text-muted">/{e.classesPerMonth}</span>
                  </p>
                  <p className="eyebrow mt-0.5">done</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entries.length > 0 && (
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-line pt-8 text-center">
          <p className="max-w-[36ch] text-[0.8125rem] leading-relaxed text-muted">
            {selected.name} keeps this record. It is written by the people who taught them,
            one class at a time.
          </p>
          <LinkButton href="/parent/search" tone="outline" size="sm">
            Add another skill
          </LinkButton>
        </div>
      )}
    </>
  )
}
