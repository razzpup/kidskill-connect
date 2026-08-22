import Link from 'next/link'

/**
 * A thin band across the top of every preview screen, so nobody mistakes fixture data
 * for live data — and so there is always a way back to the other two dashboards.
 */
export function PreviewChrome({
  surface,
  children,
}: {
  surface: 'light' | 'dark'
  children: React.ReactNode
}) {
  const tabs = [
    { href: '/preview/parent', label: 'Parent' },
    { href: '/preview/trainer', label: 'Trainer' },
    { href: '/preview/admin', label: 'Admin' },
  ]

  return (
    <div className={surface === 'light' ? 'theme-light' : 'theme-dark'}>
      <div className="border-b border-line bg-[var(--card)]">
        <div className="mx-auto flex w-full max-w-[84rem] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
          <Link href="/preview" className="eyebrow shrink-0 hover:text-ink">
            ← Preview
          </Link>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-full px-3 py-1 text-[0.8125rem] font-semibold text-muted transition hover:bg-[var(--paper)] hover:text-ink"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto text-[0.75rem] text-muted">
            Fixture data · no backend
          </span>
        </div>
      </div>
      {children}
    </div>
  )
}
