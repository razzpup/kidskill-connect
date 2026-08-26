'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { applyToCategory, saveTrainerProfile } from '@/lib/db/actions'
import { LocationCapture, type Place } from '@/components/LocationCapture'
import { buttonClass } from '@/components/ui'
import { IdentityStep } from './IdentityStep'
import { SignOutButton } from '@/components/SignOutButton'
import { CredentialUpload } from './CredentialUpload'
import { AvatarUpload } from './AvatarUpload'
import type { Category } from '@/lib/db/types'

export function TrainerOnboarding({
  categories,
  initialName,
  initialStep,
}: {
  categories: Category[]
  initialName: string
  initialStep: 'profile' | 'identity' | 'category'
}) {
  const router = useRouter()
  const [step, setStep] = useState<'profile' | 'identity' | 'category'>(initialStep)
  const [place, setPlace] = useState<Place | null>(null)
  const [radius, setRadius] = useState(10)
  const [credentialPath, setCredentialPath] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitProfile(form: FormData) {
    setBusy(true)
    setError(null)
    if (!place) {
      setBusy(false)
      return setError('Set your base location — parents are matched to it, both ways.')
    }
    form.set('lat', String(place.lat))
    form.set('lng', String(place.lng))
    form.set('area_label', place.label)
    form.set('service_radius_km', String(radius))
    if (avatarUrl) form.set('avatar_url', avatarUrl)

    const res = await saveTrainerProfile(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not save')
    setStep('identity')
  }

  async function submitCategory(form: FormData) {
    setBusy(true)
    setError(null)
    if (credentialPath) form.set('credential_url', credentialPath)
    const res = await applyToCategory(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not apply')
    router.replace('/trainer')
    router.refresh()
  }

  return (
    <div className="theme-dark min-h-dvh bg-paper text-ink">
      <div className="mx-auto w-full max-w-[34rem] px-5 py-10">
        <div className="flex justify-end pb-3">
          <SignOutButton label="Not you? Sign out" />
        </div>

        <div className="flex gap-1.5">
          {(['profile', 'identity', 'category'] as const).map((seg, i) => {
            const at = ['profile', 'identity', 'category'].indexOf(step)
            return (
              <span
                key={seg}
                className="h-[3px] flex-1 rounded-full"
                style={{ background: i <= at ? 'var(--grass)' : 'var(--line)' }}
              />
            )
          })}
        </div>

        {step === 'profile' ? (
          <form action={submitProfile} className="mt-8">
            <p className="eyebrow">Step one of three</p>
            <h1 className="display mt-2 text-[1.875rem] font-extrabold leading-tight">
              Tell parents who you are
            </h1>
            <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
              This is longer than the parent side on purpose. What you write here is what a
              parent reads before deciding to let you teach their child.
            </p>

            <Field label="Your name" htmlFor="full_name">
              <input
                id="full_name"
                name="full_name"
                defaultValue={initialName}
                required
                className={INPUT}
                placeholder="Lakshmi Narayanan"
              />
            </Field>

            <Field label="Photo">
              <AvatarUpload url={avatarUrl} fallbackSeed={initialName || 'coach'} onChange={setAvatarUrl} />
            </Field>

            <Field label="Headline" htmlFor="headline" hint="The one line shown in search results.">
              <input
                id="headline"
                name="headline"
                required
                className={INPUT}
                placeholder="Carnatic vocal — 18 years, Vidwan-trained"
              />
            </Field>

            <Field label="How you teach" htmlFor="bio" hint="Specific beats impressive.">
              <textarea id="bio" name="bio" rows={4} className={INPUT} placeholder="Children start with Sarali Varisai and I do not rush it." />
            </Field>

            <Field label="Years teaching" htmlFor="years_experience">
              <input
                id="years_experience"
                name="years_experience"
                type="number"
                min={0}
                defaultValue={5}
                className={`${INPUT} num`}
              />
            </Field>

            <Field label="Base location" hint="Distances to parents are measured from here.">
              <LocationCapture value={place} onChange={setPlace} />
            </Field>

            <Field label="How you teach" hint="Parents filter on this, so only tick what you actually offer.">
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 rounded-xl border border-line bg-[var(--card)] px-3.5 py-3">
                  <input type="checkbox" name="teaches_in_person" defaultChecked className="h-4 w-4 accent-[var(--grass)]" />
                  <span className="text-[0.9375rem]">In person — I travel to the child</span>
                </label>
                <label className="flex items-center gap-2.5 rounded-xl border border-line bg-[var(--card)] px-3.5 py-3">
                  <input type="checkbox" name="teaches_online" className="h-4 w-4 accent-[var(--grass)]" />
                  <span className="text-[0.9375rem]">Online — over a video call</span>
                </label>
              </div>
            </Field>

            <Field
              label={`How far you will travel — ${radius} km`}
              htmlFor="radius"
              hint="A parent further away than this never sees you, however wide they search."
            >
              <input
                id="radius"
                type="range"
                min={1}
                max={50}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </Field>

            <button disabled={busy} className={buttonClass('primary', 'lg', 'mt-6 w-full')}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </form>
        ) : step === 'identity' ? (
          <IdentityStep onDone={() => setStep('category')} />
        ) : (
          <form action={submitCategory} className="mt-8">
            <p className="eyebrow">Step three of three</p>
            <h1 className="display mt-2 text-[1.875rem] font-extrabold leading-tight">
              Apply to your first category
            </h1>
            <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
              An account alone shows you to nobody. You become visible in one category at a
              time, once an admin has read your credential.
            </p>

            <Field label="Category" htmlFor="category_id">
              <select id="category_id" name="category_id" required className={INPUT}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Your rate per class (₹)" htmlFor="rate_per_class" hint="You can price each category differently.">
              <input
                id="rate_per_class"
                name="rate_per_class"
                type="number"
                min={0}
                step={50}
                defaultValue={600}
                required
                className={`${INPUT} num`}
              />
            </Field>

            <Field label="Your credential" htmlFor="credential_note" hint="A certificate, a competition record, an employment letter.">
              <textarea
                id="credential_note"
                name="credential_note"
                rows={3}
                required
                className={INPUT}
                placeholder="Certificate of completion, Vidwan course, Karnataka Secondary Education Board, 2006."
              />
            </Field>

            <Field label="Attach it" hint="Optional, but reviewed faster. PDF, PNG or JPG.">
              <CredentialUpload path={credentialPath} onChange={setCredentialPath} />
            </Field>

            <button disabled={busy} className={buttonClass('primary', 'lg', 'mt-6 w-full')}>
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

const INPUT =
  'w-full rounded-xl border border-line bg-[var(--card)] px-3.5 py-3 text-[0.9375rem] leading-relaxed outline-none focus:border-grass'

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-6">
      <label htmlFor={htmlFor} className="eyebrow mb-2 block">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted">{hint}</p>}
    </div>
  )
}
