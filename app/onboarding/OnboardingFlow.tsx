'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addChild, completeParentSignup } from '@/lib/db/actions'
import { buttonClass, PinIcon } from '@/components/ui'
import { LocationCapture } from '@/components/LocationCapture'
import { SignOutButton } from '@/components/SignOutButton'
import { dobFromAge } from '@/lib/dob'

/**
 * Two screens after the phone step, and that is the whole of parent onboarding.
 * Location is captured here once and never asked for again — search reuses it.
 */
/**
 * Interests double as a shortcut: whatever is picked here is what the search screen
 * opens on, so a parent who says "music, chess" lands on those chips already selected
 * rather than an undifferentiated list of everything.
 */
const INTERESTS = [
  'music', 'singing', 'drawing', 'painting', 'dance',
  'swimming', 'football', 'cricket', 'chess', 'coding', 'public speaking',
]

export function OnboardingFlow({ phone }: { phone: string }) {
  const [interests, setInterests] = useState<string[]>([])
  const [mode, setMode] = useState<'either' | 'online' | 'in_person'>('either')
  const [age, setAge] = useState('')
  const router = useRouter()
  const [step, setStep] = useState<'you' | 'child'>('you')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [place, setPlace] = useState<{ lat: number; lng: number; label: string } | null>(null)

  async function submitYou(form: FormData) {
    setBusy(true)
    setError(null)
    if (place) {
      form.set('lat', String(place.lat))
      form.set('lng', String(place.lng))
      form.set('area_label', place.label)
    }
    const res = await completeParentSignup(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not save')
    setStep('child')
  }

  async function submitChild(form: FormData) {
    setBusy(true)
    setError(null)
    if (age.trim()) form.set('dob', dobFromAge(Number(age)))
    form.set('interests', interests.join(','))
    form.set('preferred_mode', mode)
    const res = await addChild(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not save')
    router.replace('/parent')
    router.refresh()
  }

  return (
    <>
      <div className="flex justify-end pb-3 pt-2">
        <SignOutButton label="Not you? Sign out" />
      </div>

      <div className="flex items-center gap-1.5">
        {['phone', 'you', 'child'].map((s) => (
          <span
            key={s}
            className="h-[3px] flex-1 rounded-full transition-colors"
            style={{
              background:
                s === 'phone' || (s === 'you' && step !== 'you') || s === step
                  ? 'var(--grass)'
                  : 'var(--line)',
            }}
          />
        ))}
      </div>

      {step === 'you' ? (
        <form action={submitYou} className="mt-8">
          <h1 className="display text-[1.75rem] font-extrabold leading-tight">What should we call you?</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
            Trainers see your name and your area when you send an enquiry. They never see your
            address until you share it.
          </p>

          <label htmlFor="full_name" className="eyebrow mb-2 mt-7 block">
            Your name
          </label>
          <input
            id="full_name"
            name="full_name"
            autoFocus
            autoComplete="name"
            className="h-13 w-full rounded-xl border border-line bg-[var(--card)] px-4 py-3.5 text-base outline-none focus:border-grass"
            placeholder="Anitha Rao"
          />

          <div className="mt-6">
            <p className="eyebrow mb-2">Where you are</p>
            <LocationCapture value={place} onChange={setPlace} />
          </div>

          <input type="hidden" name="phone" value={phone} />
          <button disabled={busy} className={buttonClass('primary', 'lg', 'mt-7 w-full')}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
      ) : (
        <form action={submitChild} className="mt-8">
          <h1 className="display text-[1.75rem] font-extrabold leading-tight">Add your first child</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
            You can add more later. Everything a trainer records goes onto this child&apos;s
            progress spine.
          </p>

          <label htmlFor="name" className="eyebrow mb-2 mt-7 block">
            Child&apos;s name
          </label>
          <input
            id="name"
            name="name"
            autoFocus
            className="w-full rounded-xl border border-line bg-[var(--card)] px-4 py-3.5 text-base outline-none focus:border-grass"
            placeholder="Aarav"
          />

          <label htmlFor="age" className="eyebrow mb-2 mt-5 block">
            Age <span className="normal-case tracking-normal">— optional</span>
          </label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={0}
            max={18}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="num w-full rounded-xl border border-line bg-[var(--card)] px-4 py-3.5 text-base outline-none focus:border-grass"
            placeholder="6"
          />

          <p className="eyebrow mb-2 mt-6">What are they into?</p>
          <div className="flex flex-wrap gap-1.5">
            {INTERESTS.map((i) => {
              const on = interests.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setInterests(on ? interests.filter((x) => x !== i) : [...interests, i])
                  }
                  aria-pressed={on}
                  className="rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium capitalize transition"
                  style={
                    on
                      ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                      : { color: 'var(--muted)', borderColor: 'var(--line)' }
                  }
                >
                  {i}
                </button>
              )
            })}
          </div>

          <p className="eyebrow mb-2 mt-6">Classes should be</p>
          <div className="flex gap-1.5">
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
                className="h-11 flex-1 rounded-xl border text-[0.875rem] font-semibold transition"
                style={
                  mode === value
                    ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                    : { color: 'var(--muted)', borderColor: 'var(--line)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted">
            {mode === 'online'
              ? 'Distance stops mattering — you will see the best trainers, not the nearest.'
              : mode === 'in_person'
                ? 'Only trainers willing to travel to you.'
                : 'Both, sorted by how close they are.'}
          </p>

          <button disabled={busy} className={buttonClass('primary', 'lg', 'mt-7 w-full')}>
            {busy ? 'Saving…' : 'Done'}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}

      {step === 'you' && (
        <p className="mt-6 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
          <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Asked once. Search, distances and trainer matching all reuse this.
        </p>
      )}
    </>
  )
}
