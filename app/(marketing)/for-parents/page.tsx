import Link from 'next/link'

const STEPS = [
  { n: 1, title: 'Search by skill and distance', body: 'Category chips and a distance slider, results updating as you move them — no filter form to submit.' },
  { n: 2, title: 'Send an enquiry, pay once accepted', body: "Nothing is charged until the coach accepts your child's enquiry. Payment then holds in escrow." },
  { n: 3, title: 'Watch the progress spine grow', body: 'Every class the coach marks attended adds a dated, written entry — a skill history your child keeps.' },
]

const FEATURES = [
  { emoji: '🔒', title: 'Escrow, not a wallet top-up', body: 'A rupee only leaves escrow when a class is marked attended and assessed. Never before.' },
  { emoji: '✔️', title: 'Category-by-category vetting', body: "A coach is searchable in a category only once an admin has approved them for it specifically." },
  { emoji: '📍', title: 'Location captured once', body: "Set once via your browser or a manual pin, then reused everywhere distance matters." },
]

export default function ForParentsPage() {
  return (
    <>
      <div className="km-subhero">
        <div className="km-subhero-inner">
          <div className="km-eyebrow">For Parents</div>
          <h1 style={{ marginTop: 8 }}>A vetted coach, a documented skill history, nothing charged until they say yes</h1>
          <p className="km-lead">
            Search local coaches by skill, send an enquiry, and pay only once it&apos;s accepted —
            held in escrow until a class is actually taught.
          </p>
          <div className="km-cta-row" style={{ marginTop: 20 }}>
            <Link href="/sign-in" className="km-btn km-btn-primary">Find a coach</Link>
          </div>
        </div>
      </div>

      <div className="km-section">
        <h2 className="km-section-title">How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {STEPS.map((s) => (
            <div key={s.n} className="km-form-card" style={{ margin: 0, maxWidth: 'none' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', background: 'var(--km-coral)',
                color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: 'var(--font-display)', marginBottom: 14,
              }}>{s.n}</div>
              <h4 style={{ fontSize: 16, marginBottom: 6 }}>{s.title}</h4>
              <p style={{ fontSize: 13.5, color: 'var(--km-muted)', lineHeight: 1.5, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="km-section" style={{ paddingTop: 0 }}>
        <h2 className="km-section-title">What you get</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="km-form-card" style={{ margin: 0, maxWidth: 'none', padding: 20 }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{f.emoji}</div>
              <h4 style={{ fontSize: 15, marginBottom: 6 }}>{f.title}</h4>
              <p style={{ fontSize: 13, color: 'var(--km-muted)', lineHeight: 1.5, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
