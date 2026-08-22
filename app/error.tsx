'use client'

import { useEffect } from 'react'

/**
 * Errors say what happened and what to do about it. They do not apologise and they are
 * never vague — a parent who cannot see their child's record needs a next step, not a
 * sad face.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="theme-light grid min-h-dvh place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-[26rem]">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="display mt-3 text-[1.75rem] font-extrabold leading-tight">
          That screen didn&apos;t load
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          Nothing was changed and no money moved. Try again — if it keeps happening, the
          database may not be running.
        </p>

        {error.message && (
          <p className="mt-4 rounded-xl border border-line bg-[var(--card)] px-3.5 py-3 text-[0.8125rem] leading-relaxed text-muted">
            {error.message}
          </p>
        )}

        <button
          onClick={reset}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-grass px-6 font-semibold text-white transition hover:brightness-110"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
