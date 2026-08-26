import Link from 'next/link'
import { GROUP_ORDER, GROUP_META, ALL_CATEGORIES } from '@/lib/categories'

export default function BrowsePage() {
  return (
    <div className="km-section" style={{ paddingTop: 28 }}>
      <h1 className="km-section-title">Browse by category</h1>
      <p className="km-section-sub">
        Sign in to see real coaches, distances and rates near you — search runs against
        your own location, so results only mean something once you&apos;re in.
      </p>

      {GROUP_ORDER.map((g) => (
        <div key={g} className="km-group">
          <div className="km-group-title">
            <span className="km-group-emoji">{GROUP_META[g].emoji}</span> {GROUP_META[g].label}
          </div>
          <div className="km-sticker-grid">
            {ALL_CATEGORIES.filter((c) => c.group === g).map((c) => (
              <Link key={c.slug} href="/sign-in" className="km-sticker">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="km-cta-row" style={{ marginTop: 10 }}>
        <Link href="/sign-in" className="km-btn km-btn-primary">Sign in to search</Link>
      </div>
    </div>
  )
}
