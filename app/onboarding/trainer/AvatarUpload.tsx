'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { CartoonAvatar } from '@/components/CartoonAvatar'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']

/**
 * A real photo, uploaded straight to the public `avatars` bucket (migration 0015) —
 * unlike a credential, this is meant to be seen by anyone browsing search results, so
 * there's no signed URL, just a stable public path saved to profiles.avatar_url.
 * Leaving it blank is fine: Avatar falls back to a cartoon face rather than a blank
 * circle, so nothing here is required.
 */
export function AvatarUpload({
  url,
  fallbackSeed,
  onChange,
}: {
  url: string | null
  fallbackSeed: string
  onChange: (url: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('PNG or JPG only.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Keep it under 5 MB.')
      return
    }

    setBusy(true)
    const supabase = supabaseBrowser()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      setBusy(false)
      setError('Not signed in.')
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const objectPath = `${auth.user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(objectPath, file, { contentType: file.type })

    setBusy(false)
    if (uploadError) {
      setError('Could not upload that photo — try again.')
      return
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(objectPath)
    onChange(pub.publicUrl)
  }

  async function remove() {
    setError(null)
    onChange(null)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <CartoonAvatar seed={fallbackSeed} size={64} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <label className="inline-flex cursor-pointer items-center rounded-full border border-line bg-[var(--card)] px-3.5 py-2 text-[0.8125rem] font-semibold transition hover:border-[var(--muted)]">
          <input
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="sr-only"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          {busy ? 'Uploading…' : url ? 'Change photo' : 'Add a photo'}
        </label>
        {url && (
          <button
            type="button"
            onClick={() => void remove()}
            className="ml-2 text-[0.8125rem] font-semibold text-muted underline underline-offset-2"
          >
            Remove
          </button>
        )}
        {!url && (
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted">
            Optional — parents see a cartoon face like this one until you add a real photo.
          </p>
        )}
        {error && <p className="mt-1.5 text-[0.75rem] leading-relaxed text-alert">{error}</p>}
      </div>
    </div>
  )
}
