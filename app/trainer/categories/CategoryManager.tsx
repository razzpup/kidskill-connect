'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { applyToCategory, setCategoryRate } from '@/lib/db/actions'
import { buttonClass, Chip, Money } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import type { Category, TrainerCategory } from '@/lib/db/types'

const STATUS: Record<string, { tone: 'grass' | 'outline' | 'alert'; label: string }> = {
  approved: { tone: 'grass', label: 'Approved — visible in search' },
  pending: { tone: 'outline', label: 'Waiting on review' },
  rejected: { tone: 'alert', label: 'Not approved' },
}

/**
 * A trainer account by itself grants nothing. This screen is where visibility is earned,
 * one category at a time — and it says so, because the friction here is the trust signal
 * a parent is paying for.
 */
export function CategoryManager({ mine, all }: { mine: TrainerCategory[]; all: Category[] }) {
  const router = useRouter()
  const [applying, setApplying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const taken = new Set(mine.map((m) => m.categoryId))
  const available = all.filter((c) => !taken.has(c.id))

  async function submit(form: FormData) {
    setBusy(true)
    setError(null)
    const res = await applyToCategory(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not apply')
    setApplying(false)
    router.refresh()
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-none">Categories</h1>
          <p className="mt-2 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted">
            You appear in search only where you are approved, and you set a different rate in
            each. A stronger credential is reviewed faster.
          </p>
        </div>
        {available.length > 0 && !applying && (
          <button onClick={() => setApplying(true)} className={buttonClass('primary', 'md')}>
            Apply to a category
          </button>
        )}
      </header>

      {applying && (
        <form
          action={submit}
          className="mt-7 rounded-2xl border border-line bg-[var(--card)] p-5"
        >
          <p className="display text-[1.125rem] font-bold">New application</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category_id" className="eyebrow mb-2 block">
                Category
              </label>
              <select
                id="category_id"
                name="category_id"
                required
                className="w-full appearance-none rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
              >
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rate_per_class" className="eyebrow mb-2 block">
                Your rate per class (₹)
              </label>
              <input
                id="rate_per_class"
                name="rate_per_class"
                type="number"
                min={0}
                step={50}
                defaultValue={600}
                required
                className="num w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
              />
            </div>
          </div>

          <label htmlFor="credential_note" className="eyebrow mb-2 mt-4 block">
            Your credential
          </label>
          <textarea
            id="credential_note"
            name="credential_note"
            rows={3}
            required
            className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-3 text-[0.9375rem] leading-relaxed outline-none focus:border-grass"
            placeholder="Trinity College London Grade 8 Guitar, distinction, 2013. Three years teaching at a Hennur music school."
          />

          <label htmlFor="credential_url" className="eyebrow mb-2 mt-4 block">
            Link to a certificate or letter{' '}
            <span className="normal-case tracking-normal">— optional but faster</span>
          </label>
          <input
            id="credential_url"
            name="credential_url"
            className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
            placeholder="/credentials/grade-8.pdf"
          />

          <div className="mt-5 flex gap-2">
            <button disabled={busy} className={buttonClass('primary', 'md')}>
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
            <button
              type="button"
              onClick={() => setApplying(false)}
              className={buttonClass('ghost', 'md')}
            >
              Cancel
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
              {error}
            </p>
          )}
        </form>
      )}

      <ul className="mt-7 space-y-2.5">
        {mine.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </ul>

      {mine.length === 0 && !applying && (
        <div className="mt-7 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <p className="display text-[1.0625rem] font-bold">You are not visible yet</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted">
            Apply to the first category you can evidence. Until one is approved, no parent
            searching your area can see you.
          </p>
        </div>
      )}
    </>
  )
}

function CategoryRow({ category }: { category: TrainerCategory }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [rate, setRate] = useState(Math.round(category.ratePerClass / 100))
  const [busy, setBusy] = useState(false)
  const status = STATUS[category.status] ?? STATUS.pending

  async function save() {
    setBusy(true)
    await setCategoryRate(category.id, rate)
    setBusy(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <li className="rounded-2xl border border-line bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="display text-[1.125rem] font-bold leading-none">{category.categoryName}</p>
          <div className="mt-2.5">
            <Chip tone={status.tone}>{status.label}</Chip>
          </div>
        </div>

        <div className="text-right">
          {editing ? (
            <div className="flex items-center gap-2">
              <span className="text-muted">₹</span>
              <input
                type="number"
                min={0}
                step={50}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="num w-24 rounded-lg border border-line bg-[var(--paper)] px-2.5 py-1.5 text-right text-[0.9375rem] outline-none focus:border-grass"
              />
              <button onClick={() => void save()} disabled={busy} className={buttonClass('primary', 'sm')}>
                {busy ? '…' : 'Save'}
              </button>
            </div>
          ) : (
            <>
              <Money paise={category.ratePerClass} />
              <p className="eyebrow mt-0.5">per class</p>
              {category.status === 'approved' && (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-1.5 text-[0.75rem] font-semibold text-grass underline underline-offset-2"
                >
                  Change rate
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {category.credentialNote && (
        <p className="mt-4 border-t border-line pt-3.5 text-[0.8125rem] leading-relaxed text-muted">
          {category.credentialNote}
        </p>
      )}

      {category.status === 'rejected' && category.rejectReason && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-alert">
          {category.rejectReason}
        </p>
      )}

      {category.status === 'pending' && (
        <p className="mt-3 text-[0.75rem] text-muted">
          Parents cannot see you here yet. Once approved you appear at{' '}
          <span className="num">{formatRupees(category.ratePerClass)}</span> per class.
        </p>
      )}
    </li>
  )
}
