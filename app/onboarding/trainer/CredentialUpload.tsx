'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { CheckIcon } from '@/components/ui'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

/**
 * Uploads a certificate, competition record or employment letter straight to Storage
 * and hands the resulting object path up to the form. The path is namespaced
 * `{auth.uid()}/...` because storage RLS (migration 0010) only lets a trainer write and
 * read inside their own folder — anyone reusing this component elsewhere has to keep
 * that convention or the upload will be refused server-side, not just client-side.
 */
export function CredentialUpload({
  path,
  onChange,
}: {
  path: string | null
  onChange: (path: string | null) => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('PDF, PNG or JPG only.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Keep it under 10 MB.')
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

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const objectPath = `${auth.user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('credentials')
      .upload(objectPath, file, { contentType: file.type })

    setBusy(false)
    if (uploadError) {
      setError('Could not upload that file — try again.')
      return
    }
    setFileName(file.name)
    onChange(objectPath)
  }

  async function remove() {
    if (path) await supabaseBrowser().storage.from('credentials').remove([path])
    setFileName(null)
    setError(null)
    onChange(null)
  }

  if (path) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-[var(--card)] px-3.5 py-3">
        <CheckIcon className="h-4 w-4 shrink-0 text-grass" />
        <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium">
          {fileName ?? 'Attached'}
        </span>
        <button
          type="button"
          onClick={() => void remove()}
          className="shrink-0 text-[0.75rem] font-semibold text-muted underline underline-offset-2"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div>
      <label className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-[var(--card)] px-3.5 py-5 text-center transition hover:border-[var(--muted)]">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <span className="text-[0.875rem] font-medium text-muted">
          {busy ? 'Uploading…' : 'Tap to attach a PDF, PNG or JPG'}
        </span>
      </label>
      {error && <p className="mt-1.5 text-[0.75rem] leading-relaxed text-alert">{error}</p>}
    </div>
  )
}
