'use client'

import { useState } from 'react'
import { leaveFeedback } from '@/lib/db/actions'
import { buttonClass, CheckIcon } from '@/components/ui'

/**
 * Private feedback to the platform, not a public review. The brief rules out public
 * star ratings on trainers, and this stays on the right side of that line: it is a
 * signal to the admin, and it never appears on a trainer's profile.
 */
export function FeedbackBox({
  sessionId,
  trainerName,
  existing,
}: {
  sessionId: string
  trainerName: string
  existing: { rating: number; comment: string } | null
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [saved, setSaved] = useState(Boolean(existing))
  const [busy, setBusy] = useState(false)

  async function submit(form: FormData) {
    setBusy(true)
    form.set('rating', String(rating))
    const res = await leaveFeedback(form)
    setBusy(false)
    if (res.ok) setSaved(true)
  }

  if (saved) {
    return (
      <div className="mt-8 flex items-center gap-2.5 rounded-2xl bg-grass-wash px-4 py-3.5 text-[0.875rem] text-grass">
        <CheckIcon className="h-4 w-4 shrink-0" />
        Thanks — that goes to the team, not to {trainerName.split(' ')[0]}&apos;s profile.
      </div>
    )
  }

  return (
    <form action={submit} className="mt-8 rounded-2xl border border-line bg-[var(--card)] p-4">
      <p className="text-[0.9375rem] font-semibold">How did this class go?</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
        Seen only by the KidSkill team. It is never shown on a trainer&apos;s profile.
      </p>

      <div className="mt-4 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-pressed={rating === n}
            aria-label={`${n} out of 5`}
            className="num h-10 flex-1 rounded-xl border text-[0.9375rem] font-semibold transition"
            style={
              rating >= n
                ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                : { background: 'var(--paper)', color: 'var(--muted)', borderColor: 'var(--line)' }
            }
          >
            {n}
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        rows={2}
        className="mt-3 w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-3 text-[0.9375rem] outline-none focus:border-grass"
        placeholder="Anything you'd want us to know."
      />

      <input type="hidden" name="session_id" value={sessionId} />
      <button
        disabled={busy || rating === 0}
        className={buttonClass('primary', 'md', 'mt-3 w-full')}
      >
        {busy ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}
