'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { devSignIn } from '@/lib/db/dev-auth'
import { Logo } from '@/components/Logo'
import { ALL_CATEGORIES, GROUP_ORDER, GROUP_META, CATEGORY_EMOJI } from '@/lib/categories'

type Door = 'parent' | 'trainer'

/** Local demo only — see requestCode/verify. Never reachable when devEnabled is false. */
const DUMMY_OTP = '123456'

/** The standard four-colour "G" mark. Decorative only — see the note under the button. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  )
}

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
  const [googleNote, setGoogleNote] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)
  /** Set once devSignIn prepares a phone number; consumed by verify() on the dummy code. */
  const devPasswordRef = useRef<string | null>(null)

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
    // receive a real code. The dev path still shows the same OTP prompt — a demo should
    // feel like a real sign-in — but any phone number gets in on the fixed dummy code
    // (see DUMMY_OTP) instead of Supabase's own SMS-verified one.
    if (devEnabled) {
      const prepared = await devSignIn(to)
      setBusy(false)
      if (!prepared.ok) {
        setError(prepared.error ?? 'Could not prepare that number')
        return
      }
      devPasswordRef.current = prepared.password!
      setStep('code')
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

    if (devEnabled && method === 'phone' && devPasswordRef.current) {
      if (value !== DUMMY_OTP) {
        setBusy(false)
        setError('Incorrect code')
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: phone.replace(/\s/g, '').replace('+', ''),
        password: devPasswordRef.current,
      })
      setBusy(false)
      if (error || !data.user) {
        setError(error?.message ?? 'Could not sign in')
        return
      }
      await land(data.user.id)
      return
    }

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
    setGoogleNote(false)
  }

  const groups = GROUP_ORDER.map((key) => ({
    key,
    meta: GROUP_META[key] ?? { label: key, emoji: '✨' },
    items: ALL_CATEGORIES.filter((c) => c.group === key),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="km-page flex min-h-dvh flex-col">
      <header className="km-header">
        <div className="km-header-inner">
          <Logo height={28} />
          <div className="km-login-row">
            <button type="button" className="km-btn km-btn-outline-onnavy km-btn-sm" onClick={() => openDoor('parent')}>
              Parent Login
            </button>
            <button type="button" className="km-btn km-btn-secondary km-btn-sm" onClick={() => openDoor('trainer')}>
              Coach Login
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
                    Find a trusted <span className="km-hl">skill coach</span> for your kid,
                    right in your neighbourhood.
                  </h1>
                  <p className="km-lead">
                    Vetted local coaches for music, dance, sports and more. Pay by the month,
                    held in escrow — released one class at a time, only when a class is
                    actually taught.
                  </p>
                </div>
                <div className="km-hero-stickers">
                  <div className="km-float-badge" style={{ top: 0, left: 10, transform: 'rotate(-6deg)' }}>
                    <span className="km-emoji" aria-hidden>🎤</span>
                    <div>
                      <div className="km-lbl">Carnatic vocal</div>
                      <div className="km-sub">Verified coaches</div>
                    </div>
                  </div>
                  <div className="km-float-badge" style={{ top: 92, right: 0, transform: 'rotate(5deg)' }}>
                    <span className="km-emoji" aria-hidden>⚽</span>
                    <div>
                      <div className="km-lbl">Football</div>
                      <div className="km-sub">Verified coaches</div>
                    </div>
                  </div>
                  <div className="km-float-badge" style={{ top: 192, left: 44, transform: 'rotate(-3deg)' }}>
                    <span className="km-emoji" aria-hidden>💃</span>
                    <div>
                      <div className="km-lbl">Bharatanatyam</div>
                      <div className="km-sub">Verified coaches</div>
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
                      Search vetted coaches by skill and distance, and pay by the month — held
                      in escrow, released one class at a time.
                    </p>
                    <span className="km-btn km-btn-primary km-btn-sm">Parent login</span>
                  </button>
                  <button type="button" className="km-choice-card" onClick={() => openDoor('trainer')}>
                    <div className="km-choice-emoji" aria-hidden>🧑‍🏫</div>
                    <h3>For coaches</h3>
                    <p>
                      Set your own rate per skill and get paid per verified class, once your
                      category is reviewed and approved.
                    </p>
                    <span className="km-btn km-btn-secondary km-btn-sm">Coach login</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="km-section" style={{ paddingTop: 0 }}>
              <h2 className="km-section-title">Explore by category</h2>
              <p className="km-section-sub">
                Every coach is vetted in a category before a parent can see them.
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
                  setGoogleNote(false)
                }}
              >
                ← Back
              </button>

              <p className="km-eyebrow">{door === 'parent' ? 'For parents' : 'For coaches'}</p>
              <h2 style={{ marginTop: 8, fontSize: '1.625rem' }}>
                {door === 'parent' ? 'Find a coach' : 'Teach on KidsConnect'}
              </h2>
              <p style={{ color: 'var(--km-muted)', fontSize: 14, marginTop: 8, marginBottom: 22, lineHeight: 1.55 }}>
                {door === 'parent'
                  ? 'Your number is how coaches reach you about a class. Nothing else is asked yet.'
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
                    {busy ? 'One moment…' : 'Send code'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                    <span style={{ flex: 1, height: 1, background: 'var(--km-line)' }} />
                    <span style={{ fontSize: 12, color: 'var(--km-muted)' }}>or</span>
                    <span style={{ flex: 1, height: 1, background: 'var(--km-line)' }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => setGoogleNote(true)}
                    className="km-btn km-btn-block"
                    style={{ background: '#fff', color: 'var(--km-ink)', border: '1.5px solid var(--km-line)' }}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  {googleNote && (
                    <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--km-muted)', lineHeight: 1.5 }}>
                      Google sign-in isn&apos;t connected for this demo — continue with phone or email above.
                    </p>
                  )}
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
            <strong>KidsConnect</strong> — vetted local coaches for kids in Bangalore.
          </div>
        </div>
      </footer>
    </div>
  )
}
