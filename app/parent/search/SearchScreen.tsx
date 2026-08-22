'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { runSearch, saveParentLocation } from '@/lib/db/actions'
import { LocationCapture, type Place } from '@/components/LocationCapture'
import { Money, PinIcon, ShieldIcon } from '@/components/ui'
import type { Category, Child, SearchResult } from '@/lib/db/types'

export function SearchScreen({
  categories,
  childrenList,
  initialPoint,
  areaLabel,
}: {
  categories: Category[]
  childrenList: Child[]
  initialPoint: { lat: number; lng: number } | null
  areaLabel: string | null
}) {
  const [point, setPoint] = useState(initialPoint)
  const [area, setArea] = useState(areaLabel)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [radius, setRadius] = useState(5)
  const [mode, setMode] = useState<'either' | 'online' | 'in_person'>('either')
  const [results, setResults] = useState<SearchResult[]>([])
  const [pending, start] = useTransition()
  const [loaded, setLoaded] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    (lat: number, lng: number, cat: string | null, km: number, m: typeof mode) => {
      start(async () => {
        const rows = await runSearch({ lat, lng, categoryId: cat, radiusKm: km, mode: m })
        setResults(rows)
        setLoaded(true)
      })
    },
    [],
  )

  // No submit button. Every chip tap and every slider move re-runs the query, debounced
  // just enough that dragging the slider does not fire twenty round trips.
  useEffect(() => {
    if (!point) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(point.lat, point.lng, categoryId, radius, mode), 140)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [point, categoryId, radius, mode, search])

  async function pickPlace(p: Place) {
    setPoint({ lat: p.lat, lng: p.lng })
    setArea(p.label)
    await saveParentLocation(p.lat, p.lng, p.label)
  }

  if (!point) {
    return (
      <div>
        <h1 className="display text-[1.75rem] font-extrabold">Where are you?</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Trainers are matched by distance, both ways — you only see people who are willing to
          travel to you.
        </p>
        <div className="mt-6">
          <LocationCapture value={null} onChange={(p) => void pickPlace(p)} />
        </div>
      </div>
    )
  }

  const groups = [...new Set(categories.map((c) => c.group_name))]

  return (
    <>
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="display text-[1.75rem] font-extrabold leading-none">Find a trainer</h1>
        <button
          type="button"
          onClick={() => setPoint(null)}
          className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition hover:text-ink"
        >
          <PinIcon className="h-3.5 w-3.5" />
          {area ?? 'Set area'}
        </button>
      </header>

      {/* Filters live on the results screen, not behind one. */}
      <div className="sticky top-14 z-10 -mx-5 mt-4 bg-[color-mix(in_oklab,var(--paper)_92%,transparent)] px-5 pb-4 pt-1 backdrop-blur">
        <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-1.5">
            <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>
              Everything
            </Chip>
            {groups.map((g) => (
              <span key={g} className="contents">
                {categories
                  .filter((c) => c.group_name === g)
                  .map((c) => (
                    <Chip
                      key={c.id}
                      active={categoryId === c.id}
                      onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                    >
                      {c.name}
                    </Chip>
                  ))}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex gap-1">
          {([
            ['either', 'Either'],
            ['in_person', 'In person'],
            ['online', 'Online'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className="h-9 flex-1 rounded-lg border text-[0.8125rem] font-semibold transition"
              style={
                mode === value
                  ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                  : { background: 'var(--card)', color: 'var(--muted)', borderColor: 'var(--line)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'online' ? (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
            Distance doesn&apos;t apply to an online class — showing the most experienced
            trainers instead of the nearest.
          </p>
        ) : (
        <div className="mt-3 flex items-center gap-3">
          <span className="eyebrow shrink-0">Within</span>
          <input
            type="range"
            min={1}
            max={25}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label={`Search radius, ${radius} kilometres`}
          />
          <span className="num w-12 shrink-0 text-right text-[0.875rem] font-semibold">
            {radius} km
          </span>
        </div>
        )}
      </div>

      <div
        className="transition-opacity duration-150"
        style={{ opacity: pending && loaded ? 0.55 : 1 }}
      >
        {results.length === 0 && loaded ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <p className="display text-[1.0625rem] font-bold">Nobody within {radius} km yet</p>
            <p className="mx-auto mt-2 max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted">
              Widen the distance, or clear the category. Trainers also set their own travel
              limit, so some nearby ones won&apos;t come this far.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[0.8125rem] text-muted">
              <span className="num font-semibold text-ink">{results.length}</span>{' '}
              {results.length === 1 ? 'trainer' : 'trainers'} · nearest first
            </p>
            <ul className="space-y-2.5">
              {results.map((r) => (
                <li key={`${r.trainerId}-${r.categoryId}`}>
                  <ResultCard result={r} childId={childrenList[0]?.id} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition"
      style={
        active
          ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
          : { background: 'var(--card)', color: 'var(--muted)', borderColor: 'var(--line)' }
      }
    >
      {children}
    </button>
  )
}

function ResultCard({ result, childId }: { result: SearchResult; childId?: string }) {
  const href = `/parent/trainer/${result.trainerId}?category=${result.categoryId}${
    childId ? `&child=${childId}` : ''
  }`

  return (
    <Link
      href={href}
      className="flex gap-3.5 rounded-2xl border border-line bg-[var(--card)] p-3.5 transition hover:border-[var(--muted)]"
    >
      <Avatar name={result.fullName} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[0.9375rem] font-semibold">{result.fullName}</p>
          {result.idVerified && <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-grass" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-muted">
          {result.headline}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-muted">
          <span className="font-semibold text-grass">{result.categoryName}</span>
          <span aria-hidden className="opacity-50">·</span>
          <span className="num">{result.yearsExperience} yrs</span>
          <span aria-hidden className="opacity-50">·</span>
          <span>{result.areaLabel}</span>
          {result.teachesOnline && result.teachesInPerson && (
            <>
              <span aria-hidden className="opacity-50">·</span>
              <span className="text-grass">online too</span>
            </>
          )}
        </div>
      </div>

      {/* Distance is the single most decision-relevant number for a parent, so it gets
          the position and the weight, ahead of price. */}
      <div className="shrink-0 text-right">
        {result.teachesInPerson ? (
          <p className="num text-[1.0625rem] font-bold leading-none">
            {result.distanceKm.toFixed(1)}
            <span className="ml-0.5 text-[0.6875rem] font-semibold text-muted">km</span>
          </p>
        ) : (
          <p className="text-[0.8125rem] font-bold leading-none text-grass">Online</p>
        )}
        <p className="mt-2">
          <Money paise={result.ratePerClass} size="sm" />
        </p>
        <p className="eyebrow mt-0.5">per class</p>
      </div>
    </Link>
  )
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-grass-wash font-semibold text-grass"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  )
}
