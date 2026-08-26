import Link from 'next/link'
import { Logo } from '@/components/Logo'
import '../km.css'

/**
 * Chrome for the public, logged-out site — home, for-parents, for-coaches, browse.
 * Everything past "Parent Login" / "Coach Login" is the real app at /sign-in; nothing
 * here is a separate account system.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="km-page flex min-h-dvh flex-col">
      <header className="km-header">
        <div className="km-header-inner">
          <Link href="/" className="shrink-0">
            <Logo height={28} />
          </Link>
          <nav className="km-nav">
            <Link href="/browse" className="km-navlink">Browse coaches</Link>
            <Link href="/for-parents" className="km-navlink">For Parents</Link>
            <Link href="/for-coaches" className="km-navlink">For Coaches</Link>
          </nav>
          <div className="km-login-row">
            <Link href="/sign-in" className="km-btn km-btn-outline-onnavy km-btn-sm">Parent Login</Link>
            <Link href="/sign-in" className="km-btn km-btn-secondary km-btn-sm">Coach Login</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="km-footer">
        <div className="km-footer-inner">
          <div><strong>KidsConnect</strong> — vetted local coaches for kids, paid per verified class.</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/for-parents" style={{ color: '#9092C4', fontSize: 12 }}>For Parents</Link>
            <Link href="/for-coaches" style={{ color: '#9092C4', fontSize: 12 }}>For Coaches</Link>
            <Link href="/browse" style={{ color: '#9092C4', fontSize: 12 }}>Browse coaches</Link>
            <Link href="/sign-in" style={{ color: '#9092C4', fontSize: 12 }}>Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
