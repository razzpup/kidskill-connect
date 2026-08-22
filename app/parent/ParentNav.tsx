'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarIcon, ChatIcon, SearchIcon, SpineIcon, WalletIcon } from '@/components/ui'

const ICONS = {
  spine: SpineIcon,
  search: SearchIcon,
  chat: ChatIcon,
  wallet: WalletIcon,
  calendar: CalendarIcon,
}

/**
 * Horizontal, in the header — a returning parent on a desktop reaches for a tab the
 * same way they would on the trainer or admin dashboards, not a thumb-height row
 * fixed to the bottom of a phone screen.
 */
export function ParentNav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS }[]
}) {
  const pathname = usePathname()

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        const active =
          item.href === '/parent' ? pathname === '/parent' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border-b-2 px-2.5 py-4 text-[0.8125rem] font-semibold transition"
            style={{
              borderColor: active ? 'var(--grass)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--muted)',
            }}
          >
            <Icon className="h-[1.05rem] w-[1.05rem]" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
