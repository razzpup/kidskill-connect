'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSession } from '@/lib/db/actions'

/**
 * Pulls one future, unattended class off the calendar. The refund isn't instant — it's
 * a promise dated 24 hours out (see cancel_session) — so the copy says so rather than
 * implying money moves the moment this is clicked.
 */
export function CancelClassButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await cancelSession(sessionId)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not cancel that class')
      return
    }
    setConfirming(false)
    router.refresh()
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[0.75rem] text-muted">Cancel this class?</span>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-full bg-alert px-3 py-1 text-[0.75rem] font-semibold text-white transition hover:brightness-110"
        >
          {busy ? '…' : 'Yes, cancel'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setConfirming(false)
          }}
          disabled={busy}
          className="text-[0.75rem] font-semibold text-muted"
        >
          Never mind
        </button>
        {error && <span className="text-[0.75rem] text-alert">{error}</span>}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setConfirming(true)
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[0.75rem] font-semibold text-muted transition hover:border-alert hover:text-alert"
    >
      Cancel class
    </button>
  )
}
