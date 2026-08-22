'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { reviewApplication } from '@/lib/db/actions'
import { buttonClass, EmptyState, Money, PinIcon, ShieldIcon, relativeDay } from '@/components/ui'
import type { TrainerCategory } from '@/lib/db/types'
import { IdentityPanel } from './IdentityPanel'

type Application = TrainerCategory & {
  trainerId: string
  trainerName: string
  trainerHeadline: string
  trainerArea: string | null
  yearsExperience: number
  idVerified: boolean
  idType: string | null
  idLast4: string | null
  idName: string | null
  idDocumentUrl: string | null
  idSubmittedAt: string | null
  idRejectReason: string | null
  credentialSignedUrl: string | null
}

/**
 * The barrier to entry, staffed. Approving here is the single act that makes a trainer
 * visible to parents — so the credential is shown in full, not summarised into a badge.
 */
export function ApprovalsQueue({ applications }: { applications: Application[] }) {
  return (
    <>
      <header>
        <h1 className="display text-[2rem] font-extrabold leading-none">Approvals</h1>
        <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted">
          Nobody appears in a parent&apos;s search results until one of these is approved.
          Two questions, in order: who are they, and what can they teach. A category
          cannot be approved until the identity is verified.
        </p>
      </header>

      <div className="mt-8">
        {applications.length === 0 ? (
          <EmptyState
            title="Queue is clear"
            body="Every category application has been reviewed. New ones land here the moment a trainer submits."
          />
        ) : (
          <ul className="space-y-3">
            {applications.map((a) => (
              <ApplicationCard key={a.id} application={a} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ApplicationCard({ application: a }: { application: Application }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function review(approve: boolean) {
    setBusy(approve ? 'approve' : 'reject')
    setError(null)
    const res = await reviewApplication(a.id, approve, approve ? undefined : reason.trim())
    setBusy(null)
    if (!res.ok) return setError(res.error ?? 'Could not save')
    router.refresh()
  }

  return (
    <li className="rounded-2xl border border-line bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="display text-[1.25rem] font-bold leading-none">{a.trainerName}</p>
            {a.idVerified && <ShieldIcon className="h-4 w-4 text-grass" />}
          </div>
          <p className="mt-2 text-[0.875rem] text-muted">{a.trainerHeadline}</p>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon className="h-3.5 w-3.5" />
              {a.trainerArea ?? '—'}
            </span>
            <span className="num">{a.yearsExperience} years</span>
            <span>applied {relativeDay(a.createdAt)}</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[0.9375rem] font-semibold text-grass">{a.categoryName}</p>
          <p className="mt-1.5">
            <Money paise={a.ratePerClass} />
          </p>
          <p className="eyebrow mt-0.5">per class</p>
        </div>
      </div>

      <IdentityPanel application={a} />

      <div className="mt-4 rounded-xl border border-line bg-[var(--paper)] p-4">
        <p className="eyebrow mb-2">Credential submitted</p>
        <p className="text-[0.9375rem] leading-relaxed">
          {a.credentialNote ?? 'Nothing written.'}
        </p>
        {a.credentialUrl && (
          <p className="mt-2.5 text-[0.8125rem] text-muted">
            Attachment:{' '}
            {a.credentialSignedUrl ? (
              <a
                href={a.credentialSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-grass underline underline-offset-2"
              >
                Open file
              </a>
            ) : (
              <span className="text-grass">{a.credentialUrl}</span>
            )}
          </p>
        )}
      </div>

      {rejecting ? (
        <div className="mt-4">
          <label htmlFor={`why-${a.id}`} className="eyebrow mb-2 block">
            Why — the trainer sees this
          </label>
          <input
            id={`why-${a.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
            placeholder="No certificate or teaching record attached for this category."
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void review(false)}
              disabled={busy !== null || reason.trim().length < 5}
              className={buttonClass('danger', 'md')}
            >
              {busy === 'reject' ? 'Sending…' : 'Reject with this reason'}
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
        <div className="mt-4">
          {!a.idVerified && (
            <p className="mb-2.5 text-[0.8125rem] text-muted">
              Verify the identity above before approving them to teach.
            </p>
          )}
          <div className="flex gap-2">
          <button
            onClick={() => void review(true)}
            disabled={busy !== null || !a.idVerified}
            className={buttonClass('primary', 'md')}
          >
            {busy === 'approve' ? 'Approving…' : `Approve for ${a.categoryName}`}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className={buttonClass('outline', 'md')}
          >
            Reject
          </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}
    </li>
  )
}
