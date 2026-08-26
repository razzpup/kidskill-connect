'use client'

import Link from 'next/link'
import { Chip, EmptyState, LinkButton, SkillMeter, formatDay } from '@/components/ui'
import type { SpineEntry } from '@/lib/db/types'

/**
 * The product's whole argument, drawn.
 *
 * A spine, not a timeline: the rail running down the left is continuous, and its
 * thickness at any point is the skill rating recorded at that point. Read top to
 * bottom — newest first — the thread visibly thickens toward the present, so six
 * months of a child's work is legible as a shape before a single word is read.
 *
 * The alternative was a stats row. A stats row would say the same numbers and argue
 * nothing.
 */

const RAIL_MIN = 2
const RAIL_MAX = 7

function railWidth(rating: number) {
  const clamped = Math.min(5, Math.max(1, rating || 1))
  return RAIL_MIN + ((clamped - 1) / 4) * (RAIL_MAX - RAIL_MIN)
}

export function ProgressSpine({
  entries,
  childName,
  newestId,
}: {
  entries: SpineEntry[]
  childName: string
  /** Highlights an entry that arrived over realtime while the parent was watching. */
  newestId?: string | null
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="The spine starts with the first class"
        body={`Nothing has been recorded for ${childName} yet. The moment a coach marks a class attended and writes what happened, it appears here — and stays here.`}
        action={<LinkButton href="/parent/search">Find a coach</LinkButton>}
      />
    )
  }

  return (
    <ol className="relative">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        const date = formatDay(entry.markedAt ?? entry.scheduledAt)
        const prevYear =
          i > 0 ? formatDay(entries[i - 1].markedAt ?? entries[i - 1].scheduledAt).year : null
        const showYear = i === 0 || prevYear !== date.year

        return (
          <li
            key={entry.sessionId}
            className={`relative grid grid-cols-[3.25rem_1.75rem_1fr] ${
              entry.sessionId === newestId ? 'spine-entry-new' : ''
            }`}
          >
            {/* date gutter */}
            <div className="pt-[0.6875rem] text-right">
              <div className="num text-[0.9375rem] font-semibold leading-none">{date.day}</div>
              <div className="num mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted">
                {date.month}
              </div>
              {showYear && (
                <div className="num mt-1 text-[0.625rem] font-medium text-muted opacity-70">
                  {date.year}
                </div>
              )}
            </div>

            {/* the rail */}
            <div className="relative flex justify-center">
              <span
                aria-hidden
                className="spine-rail absolute top-0"
                style={{
                  width: railWidth(entry.skillRating),
                  bottom: isLast ? 'calc(100% - 1.35rem)' : 0,
                }}
              />
              <span
                aria-hidden
                className="spine-node absolute top-[0.85rem] h-[9px] w-[9px] rounded-full"
                style={{ background: 'var(--grass)' }}
              />
            </div>

            {/* the entry */}
            <div className={isLast ? 'pb-2' : 'pb-7'}>
              <Link
                href={`/parent/session/${entry.sessionId}`}
                className="group block rounded-2xl border border-line bg-[var(--card)] p-4 transition hover:border-[var(--muted)]"
              >
                <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="text-[0.8125rem] font-semibold text-grass">
                    {entry.categoryName}
                  </span>
                  <span aria-hidden className="text-muted opacity-50">
                    ·
                  </span>
                  <span className="text-[0.8125rem] text-muted">{entry.trainerName}</span>
                  <span className="ml-auto">
                    <SkillMeter value={entry.skillRating} />
                  </span>
                </div>

                <p className="text-[0.9375rem] leading-[1.6] text-ink">{entry.note}</p>

                {entry.focusAreas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.focusAreas.map((f) => (
                      <Chip key={f} tone="outline">
                        {f}
                      </Chip>
                    ))}
                  </div>
                )}
              </Link>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * A one-line reading of the whole spine, shown above it. It is the pitch in a sentence
 * and it is generated, not written: whatever the data says is what it claims.
 */
export function SpineSummary({ entries }: { entries: SpineEntry[] }) {
  if (entries.length === 0) return null

  const oldest = entries[entries.length - 1]
  const first = formatDay(oldest.markedAt ?? oldest.scheduledAt)
  const categories = [...new Set(entries.map((e) => e.categoryName))]
  const latest = entries[0].skillRating
  const earliest = oldest.skillRating
  const moved = latest - earliest

  return (
    <p className="text-[0.9375rem] leading-relaxed text-muted">
      <span className="num font-semibold text-ink">{entries.length}</span>{' '}
      {entries.length === 1 ? 'class' : 'classes'} documented since{' '}
      <span className="num">
        {first.day} {first.month} {first.year}
      </span>
      , across {categories.length === 1 ? categories[0].toLowerCase() : `${categories.length} skills`}
      {moved > 0 && (
        <>
          {' '}— skill has moved from{' '}
          <span className="num font-semibold text-ink">{earliest}</span> to{' '}
          <span className="num font-semibold text-ink">{latest}</span>.
        </>
      )}
      {moved <= 0 && '.'}
    </p>
  )
}
