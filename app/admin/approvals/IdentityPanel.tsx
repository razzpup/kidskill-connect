'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { reviewIdentity } from '@/lib/db/actions'
import { buttonClass, ShieldIcon } from '@/components/ui'

/**
 * Identity, shown above the credential because it is the question that has to be
 * answered first. A teaching certificate belonging to an unidentified person is worth
 * nothing, and `review_trainer_category` refuses to approve until this is done.
 */

const ID_LABEL: Record<string, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  passport: 'Passport',
  driving_licence: 'Driving licence',
  voter_id: 'Voter ID',
}

export interface IdentityFields {
  trainerId: string
  trainerName: string
  idVerified: boolean
  idType: string | null
  idLast4: string | null
  idName: string | null
  idDocumentUrl: string | null
  idSubmittedAt: string | null
}

export function IdentityPanel({ application: a }: { application: IdentityFields }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function act(approve: boolean) {
    setBusy(approve ? 'yes' : 'no')
    setError(null)
    const res = await reviewIdentity(a.trainerId, approve, approve ? undefined : reason.trim())
    setBusy(null)
    if (!res.ok) return setError(res.error ?? 'Could not save')
    setRejecting(false)
    router.refresh()
  }

  if (a.idVerified) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl bg-grass-wash px-4 py-3">
        <ShieldIcon className="h-4 w-4 shrink-0 text-grass" />
        <span className="text-[0.875rem] font-semibold text-grass">Identity verified</span>
        {a.idType && (
          <span className="num text-[0.8125rem] text-muted">
            {ID_LABEL[a.idType] ?? a.idType} ••••{a.idLast4}
          </span>
        )}
      </div>
    )
  }

  if (!a.idSubmittedAt) {
    return (
      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'var(--alert-wash)' }}>
        <p className="text-[0.875rem] font-semibold" style={{ color: 'var(--alert)' }}>
          No identity document submitted
        </p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
          This trainer cannot be approved to teach until they submit one. Nothing to review
          yet.
        </p>
      </div>
    )
  }

  const nameMismatch =
    Boolean(a.idName) &&
    a.idName!.trim().toLowerCase() !== a.trainerName.trim().toLowerCase()

  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--alert)' }}>
      <p className="eyebrow mb-2.5" style={{ color: 'var(--alert)' }}>
        Identity awaiting review
      </p>

      <dl className="grid gap-x-6 gap-y-1.5 text-[0.875rem] sm:grid-cols-2">
        <Row label="Document" value={a.idType ? (ID_LABEL[a.idType] ?? a.idType) : '—'} />
        <Row label="Number" value={`•••• ${a.idLast4 ?? '????'}`} mono />
        <Row label="Name on it" value={a.idName ?? '—'} />
        <Row label="Profile name" value={a.trainerName} />
      </dl>

      {nameMismatch && (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--alert)' }}>
          The name on the document does not match the profile name. Worth asking about
          before you approve.
        </p>
      )}

      <p className="mt-3 text-[0.8125rem] text-muted">
        Document:{' '}
        {a.idDocumentUrl ? (
          <span className="text-grass">{a.idDocumentUrl}</span>
        ) : (
          <span style={{ color: 'var(--alert)' }}>none attached</span>
        )}
      </p>
      <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
        Only the last four digits are stored — check them against the document image
        rather than against anything in this database.
      </p>

      {rejecting ? (
        <div className="mt-4">
          <label htmlFor={`idr-${a.trainerId}`} className="eyebrow mb-2 block">
            Why — the trainer sees this
          </label>
          <input
            id={`idr-${a.trainerId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
            placeholder="The photo is too blurry to read the number."
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void act(false)}
              disabled={busy !== null || reason.trim().length < 5}
              className={buttonClass('danger', 'md')}
            >
              {busy === 'no' ? 'Sending…' : 'Reject identity'}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className={buttonClass('ghost', 'md')}
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void act(true)}
            disabled={busy !== null}
            className={buttonClass('primary', 'md')}
          >
            {busy === 'yes' ? 'Verifying…' : 'Verify identity'}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className={buttonClass('outline', 'md')}
          >
            Reject
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-medium${mono ? ' num' : ''}`}>{value}</dd>
    </div>
  )
}
