'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Baloo_2, Inter, IBM_Plex_Mono } from 'next/font/google'
import { supabaseBrowser } from '@/lib/supabase/client'
import { devSignIn } from '@/lib/db/dev-auth'

const baloo = Baloo_2({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--km-font-display' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--km-font-body' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--km-font-mono' })

type Door = 'parent' | 'trainer'

/** Section order for the category groups — the three named in the brief, then the rest. */
const GROUP_ORDER = ['music', 'dance', 'sports', 'arts', 'life_skills'] as const

const GROUP_META: Record<string, { label: string; emoji: string }> = {
  music: { label: 'Music', emoji: '🎵' },
  dance: { label: 'Dance', emoji: '💃' },
  sports: { label: 'Sports', emoji: '⚽' },
  arts: { label: 'Arts', emoji: '🎨' },
  life_skills: { label: 'Life skills', emoji: '♟️' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  'carnatic-vocal': '🎤',
  'hindustani-vocal': '🎶',
  'western-guitar': '🎸',
  'keyboard-piano': '🎹',
  bharatanatyam: '💃',
  'hip-hop-dance': '🕺',
  swimming: '🏊',
  football: '⚽',
  cricket: '🏏',
  badminton: '🏸',
  chess: '♟️',
  sketching: '🎨',
}

/**
 * Static marketing content, not a live read of the `categories` table — this page
 * renders for logged-out visitors, and grants migration 0003 deliberately gives `anon`
 * nothing. Mirrors the seeded categories in supabase/migrations/0001_init.sql.
 */
const ALL_CATEGORIES: { slug: string; name: string; group: string }[] = [
  { slug: 'carnatic-vocal', name: 'Carnatic vocal', group: 'music' },
  { slug: 'hindustani-vocal', name: 'Hindustani vocal', group: 'music' },
  { slug: 'western-guitar', name: 'Western guitar', group: 'music' },
  { slug: 'keyboard-piano', name: 'Keyboard & piano', group: 'music' },
  { slug: 'bharatanatyam', name: 'Bharatanatyam', group: 'dance' },
  { slug: 'hip-hop-dance', name: 'Hip-hop dance', group: 'dance' },
  { slug: 'swimming', name: 'Swimming', group: 'sports' },
  { slug: 'football', name: 'Football', group: 'sports' },
  { slug: 'cricket', name: 'Cricket', group: 'sports' },
  { slug: 'badminton', name: 'Badminton', group: 'sports' },
  { slug: 'chess', name: 'Chess', group: 'life_skills' },
  { slug: 'sketching', name: 'Sketching', group: 'arts' },
]

/**
 * Two doors, because the two sides of this marketplace are not the same product.
 *
 * A parent is deciding whether to trust a stranger with their child and wants to be
 * looking at trainers within a minute. A trainer is applying to be listed and has to be
 * vetted before anyone can see them. Sending both through one undifferentiated "sign in"
 * and inferring the difference afterwards makes the trainer's path invisible — there was
 * previously no way for one to create an account at all.
 *
 * Styling on this page is a deliberate, page-scoped departure from CLAUDE.md's design
 * system — literal styling lifted from KidSkill_Connect_Website_Mockup.html, confirmed
 * with the user. It is namespaced under `.km-*` classes (carnival.css) so none of it
 * reaches the parent/trainer/admin surfaces, which keep the real design system.
 */
export function SignInFlow({
  devEnabled,
}: {
  devEnabled: boolean
}) {
  const router = useRouter()
  const [door, setDoor] = useState<Door | null>(null)
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [method, setMethod] = useState<'phone' | 'email'>('phone')
  const [phone, setPhone] = useState('+91')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  /** Where a signed-in user belongs, given the door they came through. */
  async function land(userId: string) {
    const supabase = supabaseBrowser()
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', userId).maybeSingle()

    if (!profile) {
      router.replace(door === 'trainer' ? '/onboarding/trainer' : '/onboarding')
    } else {
      router.replace(
        profile.role === 'trainer' ? '/trainer'
          : profile.role === 'admin' ? '/admin'
          : '/parent',
      )
    }
    router.refresh()
  }

  async function requestCode(target?: string) {
    if (method === 'email') return requestEmailCode()

    const to = (target ?? phone).replace(/\s/g, '')
    if (!/^\+\d{10,15}$/.test(to)) {
      setError('Enter a phone number with country code, like +91 98765 43210')
      return
    }
    setBusy(true)
    setError(null)
    setPhone(to)

    const supabase = supabaseBrowser()

    // Locally there is no SMS provider, so numbers outside [auth.sms.test_otp] cannot
    // receive a code. The dev path signs them in directly instead of failing.
    if (devEnabled) {
      const prepared = await devSignIn(to)
      if (!prepared.ok) {
        setBusy(false)
        setError(prepared.error ?? 'Could not prepare that number')
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: to.replace('+', ''),
        password: prepared.password!,
      })
      setBusy(false)
      if (error || !data.user) {
        setError(error?.message ?? 'Could not sign in')
        return
      }
      await land(data.user.id)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({ phone: to })
    setBusy(false)
    if (error) return setError(error.message)
    setStep('code')
  }

  /**
   * A real email OTP, always — never the dev bypass. The bypass exists because there is
   * no SMS provider locally; email always has one once SMTP is configured
   * ([auth.email.smtp] in config.toml), which is the whole point of offering it as a
   * free stand-in for a demo audience who need to receive a real code on their own
   * device, not just phone numbers already known to the seed data.
   */
  async function requestEmailCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithOtp({ email })
    setBusy(false)
    if (error) return setError(error.message)
    setStep('code')
  }

  async function verify(value: string) {
    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { data, error } =
      method === 'email'
        ? await supabase.auth.verifyOtp({ email, token: value, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: phone.replace(/\s/g, ''), token: value, type: 'sms' })
    if (error || !data.user) {
      setBusy(false)
      setError(error?.message ?? 'That code did not work')
      return
    }
    await land(data.user.id)
  }

  function openDoor(d: Door) {
    setDoor(d)
    setStep('phone')
    setError(null)
  }

  const groups = GROUP_ORDER.map((key) => ({
    key,
    meta: GROUP_META[key] ?? { label: key, emoji: '✨' },
    items: ALL_CATEGORIES.filter((c) => c.group === key),
  })).filter((g) => g.items.length > 0)

  return (
    <div className={`km-page flex min-h-dvh flex-col ${baloo.variable} ${inter.variable} ${plexMono.variable}`}>
      <header className="km-header">
        <div className="km-header-inner">
          <span className="km-logo">
            <span className="km-balloon" aria-hidden>🎈</span>
            KidSkill<span className="km-dot">Connect</span>
          </span>
          <div className="km-login-row">
            <button type="button" className="km-btn km-btn-outline-onnavy km-btn-sm" onClick={() => openDoor('parent')}>
              Parent Login
            </button>
            <button type="button" className="km-btn km-btn-secondary km-btn-sm" onClick={() => openDoor('trainer')}>
              Trainer Login
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {!door ? (
          <>
            <section className="km-hero">
              <div className="km-hero-inner">
                <div>
                  <div className="km-eyebrow" style={{ color: 'var(--km-yellow)' }}>
                    Bangalore&apos;s kids&apos; skill marketplace
                  </div>
                  <h1 style={{ marginTop: 10 }}>
                    Find a trusted <span className="km-hl">skill trainer</span> for your kid,
                    right in your neighbourhood.
                  </h1>
                  <p className="km-lead">
                    Vetted local trainers for music, dance, sports and more. Pay by the month,
                    held in escrow — released one class at a time, only when a class is
                    actually taught.
                  </p>
                </div>
                <div className="km-hero-stickers">
                  <div className="km-float-badge" style={{ top: 0, left: 10, transform: 'rotate(-6deg)' }}>
                    <span className="km-emoji" aria-hidden>🎤</span>
                    <div>
                      <div className="km-lbl">Carnatic vocal</div>
                      <div className="km-sub">Verified trainers</div>
                    </div>
                  </div>
                  <div className="km-float-badge" style={{ top: 92, right: 0, transform: 'rotate(5deg)' }}>
                    <span className="km-emoji" aria-hidden>⚽</span>
                    <div>
                      <div className="km-lbl">Football</div>
                      <div className="km-sub">Verified trainers</div>
                    </div>
                  </div>
                  <div className="km-float-badge" style={{ top: 192, left: 44, transform: 'rotate(-3deg)' }}>
                    <span className="km-emoji" aria-hidden>💃</span>
                    <div>
                      <div className="km-lbl">Bharatanatyam</div>
                      <div className="km-sub">Verified trainers</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="km-section">
              <div className="km-choice-section">
                <h2 className="km-section-title">Get started</h2>
                <p className="km-section-sub">Choose how you&apos;d like to sign in.</p>
                <div className="km-choice-grid">
                  <button type="button" className="km-choice-card" onClick={() => openDoor('parent')}>
                    <div className="km-choice-emoji" aria-hidden>👨‍👩‍👧</div>
                    <h3>For parents</h3>
                    <p>
                      Search vetted trainers by skill and distance, and pay by the month — held
                      in escrow, released one class at a time.
                    </p>
                    <span className="km-btn km-btn-primary km-btn-sm">Parent login</span>
                  </button>
                  <button type="button" className="km-choice-card" onClick={() => openDoor('trainer')}>
                    <div className="km-choice-emoji" aria-hidden>🧑‍🏫</div>
                    <h3>For trainers</h3>
                    <p>
                      Set your own rate per skill and get paid per verified class, once your
                      category is reviewed and approved.
                    </p>
                    <span className="km-btn km-btn-secondary km-btn-sm">Trainer login</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="km-section" style={{ paddingTop: 0 }}>
              <h2 className="km-section-title">Explore by category</h2>
              <p className="km-section-sub">
                Every trainer is vetted in a category before a parent can see them.
              </p>
              {groups.map((g) => (
                <div key={g.key} className="km-group">
                  <div className="km-group-title">
                    <span className="km-group-emoji" aria-hidden>{g.meta.emoji}</span>
                    {g.meta.label}
                  </div>
                  <div className="km-sticker-grid">
                    {g.items.map((c) => (
                      <span key={c.slug} className="km-sticker">
                        <span className="km-emoji" aria-hidden>{CATEGORY_EMOJI[c.slug] ?? '✨'}</span>
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : (
          <section className="km-section">
            <div className="km-form-card">
              <button
                type="button"
                className="km-back"
                onClick={() => {
                  setDoor(null)
                  setStep('phone')
                  setMethod('phone')
                  setError(null)
                }}
              >
                ← Back
              </button>

              <p className="km-eyebrow">{door === 'parent' ? 'For parents' : 'For trainers'}</p>
              <h2 style={{ marginTop: 8, fontSize: '1.625rem' }}>
                {door === 'parent' ? 'Find a trainer' : 'Teach on KidSkill'}
              </h2>
              <p style={{ color: 'var(--km-muted)', fontSize: 14, marginTop: 8, marginBottom: 22, lineHeight: 1.55 }}>
                {door === 'parent'
                  ? 'Your number is how trainers reach you about a class. Nothing else is asked yet.'
                  : 'Your number is how parents reach you. Next you set your area, your rate, and the credential for your first category.'}
              </p>

              {step === 'phone' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void requestCode()
                  }}
                >
                  <div className="km-form-group">
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <label htmlFor={method === 'phone' ? 'phone' : 'email'} style={{ marginBottom: 0 }}>
                        {method === 'phone' ? 'Phone number' : 'Email'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMethod(method === 'phone' ? 'email' : 'phone')
                          setError(null)
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--km-coral)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {method === 'phone' ? 'Use email instead' : 'Use phone instead'}
                      </button>
                    </div>
                    {method === 'phone' ? (
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="km-input"
                        style={{ marginTop: 8 }}
                        placeholder="+91 98765 43210"
                      />
                    ) : (
                      <input
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="km-input"
                        style={{ marginTop: 8 }}
                        placeholder="you@example.com"
                      />
                    )}
                  </div>
                  <button disabled={busy} className="km-btn km-btn-primary km-btn-block">
                    {busy ? 'One moment…' : method === 'phone' && devEnabled ? 'Continue' : 'Send code'}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void verify(code)
                  }}
                >
                  <div className="km-form-group" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <label htmlFor="code" style={{ marginBottom: 0 }}>
                      Code sent to {method === 'phone' ? phone : email}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone')
                        setCode('')
                        setError(null)
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--km-coral)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Change
                    </button>
                  </div>
                  <input
                    ref={codeRef}
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setCode(next)
                      if (next.length === 6) void verify(next)
                    }}
                    className="km-input"
                    style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.4em' }}
                    placeholder="——————"
                  />
                  <button
                    disabled={busy || code.length < 6}
                    className="km-btn km-btn-primary km-btn-block"
                    style={{ marginTop: 14 }}
                  >
                    {busy ? 'Checking…' : 'Verify'}
                  </button>
                </form>
              )}

              {error && <p className="km-error">{error}</p>}
            </div>
          </section>
        )}
      </main>

      <footer className="km-footer">
        <div className="km-footer-inner">
          <div>
            <strong>KidSkill Connect</strong> — vetted local trainers for kids in Bangalore.
          </div>
        </div>
      </footer>
    </div>
  )
}
