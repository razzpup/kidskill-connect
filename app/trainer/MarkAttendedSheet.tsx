'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { markAttended, markNoShow } from '@/lib/db/actions'
import { buttonClass, formatTime, Money } from '@/components/ui'
import { commissionOf } from '@/lib/money'
import type { SessionRow } from '@/lib/db/types'

const MIN_NOTE = 10

/**
 * One submit. Status, assessment and rating go in a single UPDATE, because the trigger
 * that releases the money reads all three in the same statement — there is no
 * "mark attended now, write the note later" path, by design and by constraint.
 *
 * The note length is enforced here so a trainer sees it as they type, and again in the
 * database so it is true regardless of what the client does.
 */
export function MarkAttendedSheet({
  session,
  onClose,
}: {
  session: SessionRow
  onClose: () => void
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [rating, setRating] = useState(0)
  const [focus, setFocus] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'attended' | 'no_show'>('attended')

  const commission = commissionOf(session.ratePerClass, session.commissionPct)
  const net = session.ratePerClass - commission
  const short = Math.max(0, MIN_NOTE - note.trim().length)
  const ready = short === 0 && rating > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(form: FormData) {
    setBusy(true)
    setError(null)

    if (mode === 'no_show') {
      const res = await markNoShow(session.id, note)
      setBusy(false)
      if (!res.ok) return setError(res.error ?? 'Could not save')
      onClose()
      router.refresh()
      return
    }

    form.set('session_id', session.id)
    form.set('assessment_note', note)
    form.set('skill_rating', String(rating))
    form.set('focus_areas', focus.join(','))

    const res = await markAttended(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not save')
    onClose()
    router.refresh()
  }

  const suggestions = FOCUS_SUGGESTIONS[session.categoryName] ?? FOCUS_SUGGESTIONS.default

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-[34rem] overflow-y-auto rounded-t-3xl border border-line bg-[var(--card)] px-5 pb-7 pt-5 sm:rounded-3xl"
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--line)] sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="display text-[1.375rem] font-bold leading-none">{session.childName}</h2>
            <p className="mt-1.5 text-[0.8125rem] text-muted">
              {session.categoryName} · <span className="num">{formatTime(session.scheduledAt)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[0.8125rem] text-muted transition hover:text-ink"
          >
            Cancel
          </button>
        </div>

        <div className="mt-5 flex gap-1 rounded-xl border border-line p-1">
          {(
            [
              ['attended', 'Attended'],
              ['no_show', 'Child did not come'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className="flex-1 rounded-lg py-2 text-[0.8125rem] font-semibold transition"
              style={
                mode === value
                  ? { background: 'var(--grass)', color: '#fff' }
                  : { color: 'var(--muted)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <label htmlFor="note" className="eyebrow mb-2 mt-6 block">
          {mode === 'attended' ? 'What did they work on?' : 'What happened?'}
        </label>
        <textarea
          id="note"
          rows={4}
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-3 text-[0.9375rem] leading-relaxed outline-none focus:border-grass"
          placeholder={
            mode === 'attended'
              ? 'Sarali Varisai one to four at two speeds. Second speed is rushed and he loses the tala.'
              : 'Waited twenty minutes at the gate, nobody came down.'
          }
        />
        <p className="mt-1.5 text-[0.75rem] text-muted">
          {short > 0
            ? `${short} more ${short === 1 ? 'character' : 'characters'} — the parent reads this on the progress spine.`
            : mode === 'attended'
              ? 'This becomes a permanent entry on the child’s record.'
              : 'The parent is notified, and no money is released.'}
        </p>

        {mode === 'attended' && (
          <>
            <p className="eyebrow mb-2 mt-6">Where they are now</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-pressed={rating === n}
                  aria-label={`Skill ${n} out of 5`}
                  className="num h-12 flex-1 rounded-xl border text-[1.0625rem] font-bold transition"
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

            <p className="eyebrow mb-2 mt-6">
              Focus areas <span className="normal-case tracking-normal">— optional</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => {
                const on = focus.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFocus(on ? focus.filter((f) => f !== s) : [...focus, s])}
                    aria-pressed={on}
                    className="rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition"
                    style={
                      on
                        ? { background: 'var(--grass-wash)', color: 'var(--grass)', borderColor: 'var(--grass)' }
                        : { color: 'var(--muted)', borderColor: 'var(--line)' }
                    }
                  >
                    {s}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex items-baseline justify-between border-t border-line pt-4 text-[0.8125rem] text-muted">
              <span>Releases on submit</span>
              <span>
                <Money paise={net} /> <span className="text-muted">to you</span>
                <span className="num ml-2 text-[0.75rem] opacity-70">
                  (after {session.commissionPct.replace(/\.00$/, '')}% commission)
                </span>
              </span>
            </div>
          </>
        )}

        <button
          disabled={busy || (mode === 'attended' ? !ready : short > 0)}
          className={buttonClass('primary', 'lg', 'mt-5 w-full')}
        >
          {busy
            ? 'Saving…'
            : mode === 'attended'
              ? 'Submit and release payment'
              : 'Log no-show'}
        </button>

        {error && (
          <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}

/** Category-specific, because generic tags produce generic records. */
const FOCUS_SUGGESTIONS: Record<string, string[]> = {
  'Carnatic vocal': ['shruti', 'tala', 'sarali varisai', 'janta varisai', 'breath control', 'kriti'],
  'Western guitar': ['chord changes', 'strumming', 'reading', 'finger strength', 'timing'],
  Swimming: ['water confidence', 'breathing', 'freestyle', 'kick technique', 'endurance'],
  Football: ['first touch', 'passing', 'positioning', 'dribbling', 'fitness'],
  Chess: ['openings', 'endgames', 'tactics', 'time management', 'notation'],
  Sketching: ['observation', 'proportion', 'tonal value', 'negative space', 'line confidence'],
  default: ['technique', 'confidence', 'consistency', 'focus'],
}
