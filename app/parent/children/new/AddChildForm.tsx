'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addChild } from '@/lib/db/actions'
import { buttonClass } from '@/components/ui'
import { dobFromAge } from '@/lib/dob'

const INTERESTS = [
  'music', 'singing', 'drawing', 'painting', 'dance',
  'swimming', 'football', 'cricket', 'chess', 'coding', 'public speaking',
]

export function AddChildForm() {
  const router = useRouter()
  const [age, setAge] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [mode, setMode] = useState<'either' | 'online' | 'in_person'>('either')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(form: FormData) {
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
    <form action={submit}>
      <p className="eyebrow">Add a child</p>
      <h1 className="display mt-2 text-[1.75rem] font-extrabold leading-tight">
        Who else are we tracking?
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        Each child gets their own progress spine — trainers, classes and assessments stay
        separate per kid.
      </p>

      <label htmlFor="name" className="eyebrow mb-2 mt-7 block">
        Child&apos;s name
      </label>
      <input
        id="name"
        name="name"
        autoFocus
        required
        className="w-full rounded-xl border border-line bg-[var(--card)] px-4 py-3.5 text-base outline-none focus:border-grass"
        placeholder="Diya"
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
              onClick={() => setInterests(on ? interests.filter((x) => x !== i) : [...interests, i])}
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

      <button disabled={busy} className={buttonClass('primary', 'lg', 'mt-7 w-full')}>
        {busy ? 'Saving…' : 'Add child'}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}
    </form>
  )
}
