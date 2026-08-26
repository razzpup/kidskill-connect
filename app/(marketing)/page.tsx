import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentViewer, homeFor } from '@/lib/db/session'
import { GROUP_ORDER, GROUP_META } from '@/lib/categories'

const WHY = [
  { emoji: '🗂️', title: 'One dashboard, not a WhatsApp group', body: 'Schedule, calendar and every assessment live in one place, not scattered across chats.' },
  { emoji: '🔒', title: 'Milestone-based escrow', body: 'Payment sits in escrow and releases to the coach only once a class is marked attended with a written assessment.' },
  { emoji: '📍', title: 'Hyper-local matching', body: 'Search by skill and distance — results sort by how close a coach actually is, live as you move the slider.' },
  { emoji: '✔️', title: 'Vetted category by category', body: 'A coach is searchable in a category only after an admin approves their credentials for it specifically.' },
  { emoji: '📊', title: 'Objective skill assessments', body: "Every class adds a dated, rated entry to your child's progress spine — a record that just keeps growing." },
  { emoji: '💳', title: 'Pay only once accepted', body: 'Nothing is charged until the coach accepts the enquiry. Payment then holds in escrow, not with them.' },
]

const DIFFERENTIATORS = [
  { name: 'Neighbourhood skill selection', deliverable: 'Music, dance, sports, arts and life skills, filtered by distance.', parent: 'Convenient access to nearby coaches.', trainer: 'Direct visibility to local demand.' },
  { name: 'Category-by-category vetting', deliverable: 'Admin reviews identity and credentials before a coach is searchable in a category.', parent: 'Complete peace of mind.', trainer: 'A verified badge that earns trust instantly.' },
  { name: 'The progress spine', deliverable: 'A dated, written entry for every class taught.', parent: "Clear visibility into what their child is actually learning.", trainer: 'An easy way to show teaching value.' },
  { name: 'Escrow payout system', deliverable: 'Payment held until a class is taught and assessed.', parent: 'Financial security for booked classes.', trainer: 'Guaranteed payout the moment the work is verified.' },
  { name: 'Pay only once accepted', deliverable: 'Nothing is charged until the coach accepts the enquiry.', parent: 'No wasted spend on requests that go nowhere.', trainer: "No pressure to accept enquiries they don't want." },
  { name: 'Live dashboard updates', deliverable: 'Realtime sync across parent, coach and admin screens.', parent: 'Sees a session move from booked to taught in real time.', trainer: 'No manual status updates to keep everyone in sync.' },
]

export default async function MarketingHome() {
  const viewer = await currentViewer()
  if (viewer) redirect(homeFor(viewer.profile.role))

  return (
    <>
      <div className="km-hero">
        <div className="km-hero-inner">
          <div>
            <div className="km-eyebrow" style={{ color: 'var(--km-yellow)' }}>
              NEIGHBOURHOOD SKILL PLATFORM
            </div>
            <h1 style={{ marginTop: 10 }}>
              Vetted local coaches for kids, <span className="km-hl">paid only per verified class</span>
            </h1>
            <p className="km-lead">
              Search coaches by skill and distance, send an enquiry, and pay into escrow —
              released one class at a time, only once it&apos;s taught and assessed.
            </p>
            <div className="km-cta-row">
              <Link href="/sign-in" className="km-btn km-btn-primary">👨‍👩‍👧 Parent — find a coach</Link>
              <Link href="/sign-in" className="km-btn km-btn-outline-onnavy">🧑‍🏫 Coach — apply to teach</Link>
            </div>
          </div>
          <div className="km-hero-stickers">
            <div className="km-float-badge" style={{ top: 0, left: 10, transform: 'rotate(-6deg)' }}>
              <span className="km-emoji">🎤</span>
              <div><div className="km-lbl">Carnatic vocal</div><div className="km-sub">Music</div></div>
            </div>
            <div className="km-float-badge" style={{ top: 90, right: 0, transform: 'rotate(5deg)' }}>
              <span className="km-emoji">⚽</span>
              <div><div className="km-lbl">Football</div><div className="km-sub">Sports</div></div>
            </div>
            <div className="km-float-badge" style={{ top: 190, left: 40, transform: 'rotate(-3deg)' }}>
              <span className="km-emoji">💃</span>
              <div><div className="km-lbl">Bharatanatyam</div><div className="km-sub">Dance</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Who we are */}
      <div className="km-section">
        <div className="km-eyebrow">Who we are</div>
        <h2 className="km-section-title" style={{ marginTop: 6 }}>
          A neighbourhood-centric marketplace for childhood development
        </h2>
        <p className="km-section-sub" style={{ maxWidth: 760 }}>
          KidsConnect is built to simplify extracurricular learning. We bring parents and
          vetted local coaches together on one platform — search by skill and distance,
          pay only once a coach accepts, and watch a real skill history build up one
          assessed class at a time.
        </p>

        <div className="km-vm-section">
          <div className="km-vm-grid">
            <div className="km-vm-block">
              <div className="km-eyebrow">Our vision</div>
              <h3>Every child free to explore. Every coach free to thrive.</h3>
              <p>
                To become the most trusted neighbourhood ecosystem for childhood
                development — where a child can freely explore their passions, and a
                local independent coach can build a thriving business teaching them.
              </p>
            </div>
            <div className="km-vm-block">
              <div className="km-eyebrow">Our mission</div>
              <h3>Simplifying extracurricular learning, one neighbourhood at a time.</h3>
              <p>
                To connect parents with vetted, local coaches through a flexible,
                transparent, progress-driven platform — where money moves only when a
                class is actually taught and assessed.
              </p>
            </div>
          </div>
          <div className="km-pillars">
            <div className="km-pillar-card">
              <div className="km-pillar-tag">For parents</div>
              <p>Peace of mind through vetted coaches, a documented progress spine, and payment held until a class is taught.</p>
            </div>
            <div className="km-pillar-card">
              <div className="km-pillar-tag">For kids</div>
              <p>A documented skill history that otherwise wouldn&apos;t exist — continuous opportunities to learn and excel.</p>
            </div>
            <div className="km-pillar-card">
              <div className="km-pillar-tag">For coaches</div>
              <p>Local visibility, a verified badge, and a guaranteed payout the moment a class is taught and assessed.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Why choose KidsConnect */}
      <div className="km-section" style={{ paddingTop: 0 }}>
        <h2 className="km-section-title">Why choose KidsConnect</h2>
        <p className="km-section-sub">Every rupee is a row in a ledger, not a promise — here&apos;s what that buys you.</p>
        <div className="km-why-grid">
          {WHY.map((w) => (
            <div key={w.title} className="km-why-card">
              <div className="km-emoji">{w.emoji}</div>
              <h4>{w.title}</h4>
              <p>{w.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Explore by category */}
      <div className="km-section" style={{ paddingTop: 0 }}>
        <h2 className="km-section-title">Explore by category</h2>
        <p className="km-section-sub">Every coach on the platform is vetted, category by category, before going live.</p>
        <div className="km-category-grid">
          {GROUP_ORDER.map((g) => (
            <Link key={g} href="/sign-in" className="km-category-card">
              <div className="km-category-emoji">{GROUP_META[g].emoji}</div>
              <div className="km-category-name">{GROUP_META[g].label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Key differentiators */}
      <div className="km-section" style={{ paddingTop: 0 }}>
        <div className="km-eyebrow">Key differentiators</div>
        <h2 className="km-section-title" style={{ marginTop: 6 }}>
          What each feature delivers, for parents and coaches
        </h2>
        <div className="km-feature-table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Core deliverable</th>
                <th>Parent benefit</th>
                <th>Coach benefit</th>
              </tr>
            </thead>
            <tbody>
              {DIFFERENTIATORS.map((d) => (
                <tr key={d.name}>
                  <td className="km-fname">{d.name}</td>
                  <td>{d.deliverable}</td>
                  <td>{d.parent}</td>
                  <td>{d.trainer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="km-section" style={{ paddingTop: 0 }}>
        <div className="km-gold-banner">
          <div className="km-eyebrow">Gold Tier — coming to parents</div>
          <h2 className="km-section-title" style={{ marginTop: 6 }}>
            Stay enrolled, unlock more
          </h2>
          <p className="km-section-sub" style={{ marginBottom: 0 }}>
            Parents who keep a class running month after month move into Gold — priority
            slots, lower fees, and a few perks worth sticking around for.
          </p>
          <div className="km-gold-perks">
            <div className="km-gold-perk">
              <div className="km-emoji">🥇</div>
              <h4>Priority slots</h4>
              <p>First pick of high-demand coaches and limited-seat workshops.</p>
            </div>
            <div className="km-gold-perk">
              <div className="km-emoji">💸</div>
              <h4>Lower commission</h4>
              <p>A reduced platform fee on every class you fund, for as long as you stay Gold.</p>
            </div>
            <div className="km-gold-perk">
              <div className="km-emoji">🎟️</div>
              <h4>Member perks</h4>
              <p>Occasional passes and offers for families active on the platform.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="km-section" style={{ paddingTop: 0 }}>
        <div
          className="km-form-card"
          style={{
            margin: 0, maxWidth: 'none', background: 'var(--km-navy)', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 16,
          }}
        >
          <div>
            <h3 style={{ color: '#fff' }}>Are you a coach?</h3>
            <p style={{ color: '#CBCDF0', margin: '6px 0 0' }}>
              Apply per category, get an admin-verified badge, and get paid per class — released the moment it&apos;s taught.
            </p>
          </div>
          <Link href="/sign-in" className="km-btn km-btn-primary">Apply to teach</Link>
        </div>
      </div>
    </>
  )
}
