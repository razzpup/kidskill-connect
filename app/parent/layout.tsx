import Link from 'next/link'
import { requireRole } from '@/lib/db/session'
import { notificationsFor } from '@/lib/db/parent'
import { ChatIcon } from '@/components/ui'
import { SignOutButton } from '@/components/SignOutButton'
import { Logo } from '@/components/Logo'
import { ParentNav } from './ParentNav'

/**
 * The parent surface is light. It is opened occasionally, on a phone, in daylight, by
 * someone deciding whether to trust a stranger with their child — so calm and legible
 * wins over dense and clever.
 */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await requireRole('parent')
  const notifications = await notificationsFor(userId)
  const unread = notifications.filter((n) => !n.readAt).length

  return (
    <div className="theme-light min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[76rem] items-center gap-6 px-6">
          <Link href="/parent" className="shrink-0 py-4">
            <Logo height={26} />
          </Link>

          <ParentNav
            items={[
              { href: '/parent', label: 'Dashboard', icon: 'spine' },
              { href: '/parent/calendar', label: 'Classes', icon: 'calendar' },
              { href: '/parent/search', label: 'Find a coach', icon: 'search' },
              { href: '/parent/enquiries', label: 'Enquiries', icon: 'chat' },
              { href: '/parent/wallet', label: 'Wallet', icon: 'wallet' },
            ]}
          />

          <span className="ml-auto flex shrink-0 items-baseline gap-2.5">
            <span className="hidden text-[0.8125rem] text-muted sm:inline">{profile.full_name}</span>
            <SignOutButton />
          </span>
          <Link
            href="/parent/notifications"
            className="relative -ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:bg-[var(--card)]"
            aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
          >
            <ChatIcon className="h-[1.05rem] w-[1.05rem]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-grass ring-2 ring-[var(--paper)]" />
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[76rem] px-6 pb-16 pt-8">{children}</main>
    </div>
  )
}
