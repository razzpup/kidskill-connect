'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { markNotificationsRead } from '@/lib/db/actions'
import { renderTemplate } from '@/lib/notify/templates'
import { useLiveRefresh } from '@/lib/realtime'
import { EmptyState, formatTime, relativeDay } from '@/components/ui'
import type { NotificationRow } from '@/lib/db/types'

/**
 * The in-app thread, styled as the WhatsApp conversation these messages become when
 * NOTIFY_PROVIDER=twilio. Every row is written by the database transaction that caused
 * it, so this thread is complete whether or not a message ever left the building — which
 * is what makes it safe to demo on venue wifi.
 */
export function NotificationThread({
  notifications,
  provider,
}: {
  notifications: NotificationRow[]
  provider: string
}) {
  useLiveRefresh(['notifications'])

  useEffect(() => {
    if (notifications.some((n) => !n.readAt)) void markNotificationsRead()
  }, [notifications])

  const ordered = [...notifications].reverse()

  return (
    <>
      <header className="mb-5 flex items-baseline justify-between gap-3">
        <h1 className="display text-[1.75rem] font-extrabold leading-none">Messages</h1>
        <span className="text-[0.75rem] text-muted">
          {provider === 'twilio' ? 'Sent over WhatsApp' : 'In-app only'}
        </span>
      </header>

      {ordered.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="Enquiry replies, payment confirmations and every completed class land here — and on WhatsApp once the number is connected."
        />
      ) : (
        <ol className="space-y-2.5">
          {ordered.map((n, i) => {
            const { title, body, href } = renderTemplate(n.template, n.payload)
            const prev = ordered[i - 1]
            const newDay =
              !prev || relativeDay(prev.createdAt) !== relativeDay(n.createdAt)

            const bubble = (
              <div
                className={`relative max-w-[85%] rounded-2xl rounded-tl-md px-3.5 py-2.5 ${
                  n.status === 'failed'
                    ? 'bg-alert-wash'
                    : 'bg-[var(--card)]'
                }`}
                style={{ boxShadow: 'var(--shadow)' }}
              >
                <p className="text-[0.8125rem] font-bold text-grass">{title}</p>
                <p className="mt-1 whitespace-pre-line text-[0.9375rem] leading-[1.5]">{body}</p>
                <p className="num mt-1.5 text-right text-[0.6875rem] text-muted">
                  {formatTime(n.createdAt)}
                  {n.status === 'sent' && n.channel === 'whatsapp' && ' · delivered'}
                  {n.status === 'failed' && ' · not delivered'}
                  {n.status === 'queued' && ' · queued'}
                </p>
                {n.status === 'failed' && typeof n.payload.error === 'string' && (
                  <p className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-[0.6875rem] leading-relaxed text-alert">
                    {n.payload.error}
                  </p>
                )}
              </div>
            )

            return (
              <li key={n.id}>
                {newDay && (
                  <p className="my-4 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                    {relativeDay(n.createdAt)}
                  </p>
                )}
                {href ? (
                  <Link href={href} className="block transition hover:brightness-[0.99]">
                    {bubble}
                  </Link>
                ) : (
                  bubble
                )}
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
