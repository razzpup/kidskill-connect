'use client'

import { useState } from 'react'
import { signOut } from '@/lib/db/actions'

/**
 * Deliberately available on the onboarding screens too. Those are the easiest place to
 * get stuck — you signed in as the wrong person, or came through the wrong door — and
 * without a way out the only fix is clearing cookies by hand.
 */
export function SignOutButton({
  label = 'Sign out',
  className = '',
}: {
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await signOut()
        // A full navigation, not router.push — this clears any client-side RSC cache
        // that might otherwise still think the old session is live.
        window.location.href = '/sign-in'
      }}
      className={
        className ||
        'text-[0.75rem] font-medium text-muted transition hover:text-ink disabled:opacity-50'
      }
    >
      {busy ? 'Signing out…' : label}
    </button>
  )
}
