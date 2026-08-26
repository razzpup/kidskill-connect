'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>,
    ) => { dispose: () => void }
  }
}

const JITSI_DOMAIN = 'meet.jit.si'
let scriptPromise: Promise<void> | null = null

/** Loads the Jitsi embed script once, however many calls open on the page. */
function loadJitsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.JitsiMeetExternalAPI) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://${JITSI_DOMAIN}/external_api.js`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load the video call.'))
      document.body.appendChild(script)
    })
  }
  return scriptPromise
}

/**
 * A class's video call, embedded — not a link out to Zoom or Meet. The room is Jitsi's
 * free public server, named deterministically from the session id, so a parent and
 * trainer opening the same class land in the same room without any signaling of our
 * own. There is no recording, no waiting room and no account: whoever has the session
 * id can join, which is the same trust model as a meeting link, just embedded here
 * instead of handed to another app.
 */
export function VideoCall({
  sessionId,
  displayName,
  label = 'Join class',
}: {
  sessionId: string
  displayName?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{ dispose: () => void } | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)

    loadJitsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return
        apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: `kidskill-connect-${sessionId}`,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: displayName ? { displayName } : undefined,
          configOverwrite: { prejoinPageEnabled: false, disableDeepLinking: true },
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the video call.')
      })

    return () => {
      cancelled = true
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [open, sessionId, displayName])

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen(true)
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-grass px-3.5 py-1.5 text-[0.75rem] font-semibold text-white transition hover:brightness-110"
      >
        📹 {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5">
              <span className="text-[0.875rem] font-semibold text-white">Class call</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white hover:bg-white/20"
              >
                Leave
              </button>
            </div>
            {error ? (
              <p className="rounded-2xl bg-white p-5 text-[0.875rem] text-alert">{error}</p>
            ) : (
              <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-black" />
            )}
          </div>
        </div>
      )}
    </>
  )
}
