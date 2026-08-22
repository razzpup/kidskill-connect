'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/db/actions'

/** Shared chrome for the two dark surfaces. Horizontal, dense, always visible. */
export function DashboardNav({
  title,
  name,
  items,
}: {
  title: string
  name: string
  items: { href: string; label: string }[]
}) {
  const pathname = usePathname()
  const root = items[0].href
  const [signingOut, setSigningOut] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[64rem] items-center gap-5 px-5">
        <Link href={root} className="display shrink-0 py-3.5 text-[0.9375rem] font-extrabold">
          {title}
        </Link>

        <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active =
              item.href === root ? pathname === root : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="shrink-0 border-b-2 px-3 py-3.5 text-[0.8125rem] font-semibold transition"
                style={{
                  borderColor: active ? 'var(--grass)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            await signOut()
            window.location.href = '/sign-in'
          }}
          className="shrink-0 text-[0.75rem] text-muted transition hover:text-ink disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : `${name.split(' ')[0]} · Sign out`}
        </button>
      </div>
    </header>
  )
}
