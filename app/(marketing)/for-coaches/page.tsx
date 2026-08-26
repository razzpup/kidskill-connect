import Link from 'next/link'

const STEPS = [
  { n: 1, title: 'Apply per category', body: 'Upload your credentials and set your rate for each skill you teach — verification happens category by category.' },
  { n: 2, title: 'Accept enquiries', body: 'Parents find you once an admin approves your application. You accept the ones you want to teach.' },
  { n: 3, title: 'Get paid per class, automatically', body: 'Mark a class attended with an assessment note and the payout releases from escrow — no invoicing.' },
]

const FEATURES = [
  { emoji: '💰', title: 'Guaranteed, automatic payouts', body: 'The moment a class is marked attended and assessed, your share leaves escrow. No chasing anyone for it.' },
  { emoji: '📈', title: 'Set your own rate', body: 'You price each category you teach. The platform commission is taken at payout, never added on top of your rate.' },
  { emoji: '✔️', title: 'A verified badge parents can see', body: 'Approval per category is the trust signal parents are looking for before they book a stranger.' },
]

export default function ForCoachesPage() {
  return (
    <>
      <div className="km-subhero">
        <div className="km-subhero-inner">
          <div className="km-eyebrow">For Coaches</div>
          <h1 style={{ marginTop: 8 }}>Set your rate, teach, get paid the moment a class is verified</h1>
          <p className="km-lead">
            Apply per category with your credentials. Once approved, parents in your area can find
            and book you — payment sits in escrow until you mark the class attended and assessed.
          </p>
          <div className="km-cta-row" style={{ marginTop: 20 }}>
            <Link href="/sign-in" className="km-btn km-btn-primary">Apply to teach</Link>
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
