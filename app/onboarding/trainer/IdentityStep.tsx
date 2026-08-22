'use client'

import { useState } from 'react'
import { submitIdentity } from '@/lib/db/actions'
import { buttonClass, ShieldIcon } from '@/components/ui'
import { checkIdentity, ID_HINTS, ID_LABELS, type IdKind } from '@/lib/identity'

const KINDS: IdKind[] = ['aadhaar', 'pan', 'passport', 'driving_licence', 'voter_id']

/**
 * The step that makes a trainer a known person rather than a phone number.
 *
 * The full document number is typed here, validated here, and discarded here. Only the
 * last four digits and a link to the document are submitted — the same masked form
 * printed on an Aadhaar letter. Storing the whole number would be a liability with no
 * corresponding benefit, since an admin verifies against the document image anyway.
 */
export function IdentityStep({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<IdKind>('aadhaar')
  const [number, setNumber] = useState('')
  const [nameOnId, setNameOnId] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = number ? checkIdentity(kind, number) : null

  async function submit() {
    setError(null)
    const result = checkIdentity(kind, number)
    if (!result.ok) return setError(result.error ?? 'Check that number.')

    setBusy(true)
    const form = new FormData()
    form.set('id_type', kind)
    // Only this leaves the browser.
    form.set('id_last4', result.last4!)
    form.set('id_name', nameOnId)
    form.set('id_document_url', docUrl)
    const res = await submitIdentity(form)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Could not submit')
    onDone()
  }

  return (
    <div className="mt-8">
      <p className="eyebrow">Step two of three</p>
      <h1 className="display mt-2 text-[1.875rem] font-extrabold leading-tight">
        Prove who you are
      </h1>
      <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
        You will be alone with someone&apos;s child. Every trainer on KidSkill has had a
        government ID checked by a person, and parents can see that badge before they
        enquire.
      </p>

      <div className="mt-6">
        <p className="eyebrow mb-2">Document</p>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k)
                setNumber('')
                setError(null)
              }}
              aria-pressed={kind === k}
              className="rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition"
              style={
                kind === k
                  ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                  : { color: 'var(--muted)', borderColor: 'var(--line)' }
              }
            >
              {ID_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <label htmlFor="idnum" className="eyebrow mb-2 mt-6 block">
        {ID_LABELS[kind]} number
      </label>
      <input
        id="idnum"
        value={number}
        onChange={(e) => {
          setNumber(e.target.value)
          setError(null)
        }}
        inputMode={kind === 'aadhaar' ? 'numeric' : 'text'}
        autoComplete="off"
        className="num w-full rounded-xl border border-line bg-[var(--card)] px-3.5 py-3 text-[1.0625rem] tracking-wide outline-none focus:border-grass"
        placeholder={kind === 'aadhaar' ? '1234 5678 9012' : ID_HINTS[kind]}
      />
      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted">
        {check && !check.ok && number.length > 4 ? (
          <span style={{ color: 'var(--alert)' }}>{check.error}</span>
        ) : check?.ok ? (
          <span className="text-grass">
            Checks out. We will store only the last four digits — ••••&nbsp;{check.last4}
          </span>
        ) : (
          `${ID_HINTS[kind]}. We keep only the last four digits, never the whole number.`
        )}
      </p>

      <label htmlFor="idname" className="eyebrow mb-2 mt-6 block">
        Name as printed on it
      </label>
      <input
        id="idname"
        value={nameOnId}
        onChange={(e) => setNameOnId(e.target.value)}
        className="w-full rounded-xl border border-line bg-[var(--card)] px-3.5 py-3 text-[0.9375rem] outline-none focus:border-grass"
        placeholder="Lakshmi Narayanan"
      />

      <label htmlFor="iddoc" className="eyebrow mb-2 mt-6 block">
        Link to a photo of it
      </label>
      <input
        id="iddoc"
        value={docUrl}
        onChange={(e) => setDocUrl(e.target.value)}
        className="w-full rounded-xl border border-line bg-[var(--card)] px-3.5 py-3 text-[0.9375rem] outline-none focus:border-grass"
        placeholder="/identity/my-aadhaar.jpg"
      />
      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted">
        This is what the reviewer actually looks at. Without it your application waits.
      </p>

      <button
        onClick={() => void submit()}
        disabled={busy || !check?.ok || nameOnId.trim().length < 2}
        className={buttonClass('primary', 'lg', 'mt-7 w-full')}
      >
        {busy ? 'Submitting…' : 'Submit for verification'}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-alert">
          {error}
        </p>
      )}

      <p className="mt-5 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
        <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Your number is checked in this browser and then discarded. Only the last four
        digits are sent, which is the same masked form printed on an Aadhaar letter.
      </p>
    </div>
  )
}
