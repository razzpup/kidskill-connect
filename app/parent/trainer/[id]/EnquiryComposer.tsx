'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sendEnquiry } from '@/lib/db/actions'
import { buttonClass, CheckIcon, Money } from '@/components/ui'
import type { Child, TrainerCategory } from '@/lib/db/types'

/**
 * One primary action on this page, and it stays pinned to the bottom of the viewport
 * where a thumb is. Choosing which child and which category is the whole form —
 * everything else is already known.
 */
export function EnquiryComposer({
  trainerId,
  trainerName,
  categories,
  initialCategoryId,
  childrenList,
  initialChildId,
  existing,
}: {
  trainerId: string
  trainerName: string
  categories: TrainerCategory[]
  initialCategoryId: string
  childrenList: Child[]
  initialChildId: string
  existing: { categoryId: string; childId: string; status: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [childId, setChildId] = useState(initialChildId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const category = categories.find((c) => c.categoryId === categoryId)
  const already = existing.find((e) => e.categoryId === categoryId && e.childId === childId)

  async function submit(form: FormData) {
    setBusy(true)
    setError(null)
    const res = await sendEnquiry(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not send')
    setSent(true)
    setOpen(false)
    router.refresh()
  }

  if (sent) {
    return (
      <div className="fixed inset-x-0 bottom-[4.75rem] z-20 px-5">
        <div className="mx-auto flex max-w-[42rem] items-center gap-3 rounded-2xl bg-grass px-4 py-3.5 text-white shadow-lg">
          <CheckIcon className="h-5 w-5 shrink-0" />
          <p className="text-[0.875rem] font-semibold leading-snug">
            Sent to {trainerName}. You&apos;ll hear back in the app.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-24" />
      <div className="fixed inset-x-0 bottom-[4.25rem] z-20 border-t border-line bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-[42rem]">
          {already ? (
            <p className="rounded-xl border border-line bg-[var(--card)] px-4 py-3 text-center text-[0.875rem] text-muted">
              You already have an {already.status} enquiry for this.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={buttonClass('primary', 'lg', 'w-full')}
            >
              Send enquiry
              {category && (
                <span className="font-medium opacity-80">
                  · {category.categoryName}
                </span>
              )}
            </button>
          )}
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
            className="w-full max-w-[30rem] rounded-t-3xl bg-[var(--card)] px-5 pb-8 pt-5"
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--line)]" />
            <h2 className="display text-[1.25rem] font-bold">Enquire with {trainerName}</h2>

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

            <label htmlFor="message" className="eyebrow mb-2 mt-5 block">
              Anything they should know <span className="normal-case tracking-normal">— optional</span>
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-3 text-[0.9375rem] leading-relaxed outline-none focus:border-grass"
              placeholder="Weekends work best for us, and he's never had a lesson before."
            />

            {category && (
              <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4 text-[0.8125rem] text-muted">
                <span>If accepted, a month is</span>
                <span>
                  <Money paise={category.ratePerClass * 8} /> · 8 classes
                </span>
              </p>
            )}

            <input type="hidden" name="trainer_id" value={trainerId} />
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="child_id" value={childId} />

            <button disabled={busy} className={buttonClass('primary', 'lg', 'mt-4 w-full')}>
              {busy ? 'Sending…' : 'Send enquiry'}
            </button>
            {error && (
              <p className="mt-2.5 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
                {error}
              </p>
            )}
            <p className="mt-3 text-center text-[0.75rem] leading-relaxed text-muted">
              Nothing is charged now. You pay only if they accept.
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
