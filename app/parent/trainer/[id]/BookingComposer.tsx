'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { bookSlot } from '@/lib/db/actions'
import { buttonClass, Money } from '@/components/ui'
import { ClassDatePicker } from '@/components/ClassDatePicker'
import type { Child, TrainerCategory } from '@/lib/db/types'

/**
 * Every date-and-time tapped is one real class — not a weekly template multiplied out.
 * Pick three Tuesdays and a Friday and that's exactly four classes, at exactly those
 * times, nothing inferred.
 */
export function BookingComposer({
  trainerId,
  trainerName,
  categories,
  initialCategoryId,
  childrenList,
  initialChildId,
  unavailableInstants,
  blockedWeekly,
}: {
  trainerId: string
  trainerName: string
  categories: TrainerCategory[]
  initialCategoryId: string
  childrenList: Child[]
  initialChildId: string
  unavailableInstants: string[]
  blockedWeekly: { weekday: number; time: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [childId, setChildId] = useState(initialChildId)
  const [picks, setPicks] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const category = categories.find((c) => c.categoryId === categoryId)
  const total = (category?.ratePerClass ?? 0) * picks.length

  function toggle(iso: string) {
    setPicks((prev) => (prev.includes(iso) ? prev.filter((p) => p !== iso) : [...prev, iso].sort()))
  }

  async function submit(form: FormData) {
    setBusy(true)
    setError(null)
    const res = await bookSlot(form)
    setBusy(false)
    if (!res.ok || !res.data) return setError(res.error ?? 'Could not book those classes')
    const { enrollmentId } = res.data as { enrollmentId: string }
    router.push(`/parent/pay/${enrollmentId}`)
  }

  return (
    <>
      <div className="h-24" />
      <div className="fixed inset-x-0 bottom-[4.25rem] z-20 border-t border-line bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-[42rem]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonClass('primary', 'lg', 'w-full')}
          >
            Book classes
            {category && <span className="font-medium opacity-80"> · {category.categoryName}</span>}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/25"
          onClick={() => setOpen(false)}
        >
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-[30rem] overflow-y-auto rounded-t-3xl bg-[var(--card)] px-5 pb-8 pt-5"
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--line)]" />
            <h2 className="display text-[1.25rem] font-bold">Book with {trainerName}</h2>

            {childrenList.length > 1 && (
              <>
                <p className="eyebrow mb-2 mt-5">For</p>
                <div className="flex flex-wrap gap-1.5">
                  {childrenList.map((c) => (
                    <Pick key={c.id} active={c.id === childId} onClick={() => setChildId(c.id)}>
                      {c.name}
                    </Pick>
                  ))}
                </div>
              </>
            )}

            {categories.length > 1 && (
              <>
                <p className="eyebrow mb-2 mt-5">Category</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <Pick
                      key={c.id}
                      active={c.categoryId === categoryId}
                      onClick={() => setCategoryId(c.categoryId)}
                    >
                      {c.categoryName}
                    </Pick>
                  ))}
                </div>
              </>
            )}

            <p className="eyebrow mb-2 mt-5">
              Tap a day, then a free time <span className="normal-case tracking-normal">— pick as many classes as you want</span>
            </p>
            <ClassDatePicker
              unavailableInstants={unavailableInstants}
              blockedWeekly={blockedWeekly}
              selected={picks}
              onToggle={toggle}
            />
            {picks.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {picks.map((iso) => (
                  <li
                    key={iso}
                    className="rounded-full bg-grass-wash px-2.5 py-1 text-[0.75rem] font-semibold text-grass"
                  >
                    {new Date(iso).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </li>
                ))}
              </ul>
            )}

            {category && (
              <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4 text-[0.8125rem] text-muted">
                <span>
                  {picks.length === 0
                    ? 'Pick classes to see the total'
                    : `${picks.length} ${picks.length === 1 ? 'class' : 'classes'}, held in escrow`}
                </span>
                {picks.length > 0 && <Money paise={total} />}
              </p>
            )}

            <input type="hidden" name="trainer_id" value={trainerId} />
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="child_id" value={childId} />
            <input type="hidden" name="instants" value={JSON.stringify(picks)} />

            <button disabled={busy || picks.length === 0} className={buttonClass('primary', 'lg', 'mt-4 w-full')}>
              {busy ? 'Booking…' : picks.length > 0 ? 'Book & pay' : 'Pick at least one class'}
            </button>
            {error && (
              <p className="mt-2.5 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
                {error}
              </p>
            )}
            <p className="mt-3 text-center text-[0.75rem] leading-relaxed text-muted">
              Held in escrow, released to {trainerName.split(' ')[0]} one class at a time as
              they&apos;re taught.
            </p>
          </form>
        </div>
      )}
    </>
  )
}

function Pick({
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
      className="rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition"
      style={
        active
          ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
          : { background: 'var(--paper)', color: 'var(--muted)', borderColor: 'var(--line)' }
      }
    >
      {children}
    </button>
  )
}
