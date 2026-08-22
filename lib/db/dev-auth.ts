'use server'

import { supabaseService } from '@/lib/supabase/server'

/**
 * Local sign-in for numbers nobody seeded.
 *
 * Phone OTP is real Supabase phone auth, and locally there is no SMS provider — so
 * `[auth.sms.test_otp]` in config.toml short-circuits the code, but only for the exact
 * numbers listed there. Anything else falls through to Twilio and fails with
 * "20003 invalid username". That is fine for a scripted demo and useless the moment a
 * parent or trainer is meant to sign themselves up on someone else's phone.
 *
 * So: the service role finds or creates the user for whatever number was typed, sets a
 * known development password, and the browser then signs in with it normally. No SMS,
 * any number, and the resulting session is an ordinary Supabase session with ordinary
 * RLS — nothing downstream can tell it apart, which is the point.
 *
 * This is gated on ALLOW_DEV_SIGNIN and refuses to run in production. It is a demo
 * affordance, not an auth strategy: anyone who can reach it can become any user.
 */

/** Not a secret. It only matters in combination with ALLOW_DEV_SIGNIN. */
export async function devPassword(): Promise<string> {
  return 'kidskill-dev-password'
}

export interface DevSignInResult {
  ok: boolean
  error?: string
  /** True when this number had never been seen before. */
  created?: boolean
  password?: string
}

export async function devSignIn(rawPhone: string): Promise<DevSignInResult> {
  if (process.env.ALLOW_DEV_SIGNIN !== 'true' || process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Developer sign-in is switched off.' }
  }

  // GoTrue stores E.164 without the leading plus and looks users up by that form.
  const phone = rawPhone.replace(/[^\d]/g, '')
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: 'Enter a phone number with country code, like +91 98765 43210' }
  }

  const password = await devPassword()
  const supabase = supabaseService()

  try {
    // There is no getUserByPhone, so page through until the number turns up. Fine at
    // demo scale, and it keeps this out of the auth schema.
    let existing: { id: string } | undefined
    for (let page = 1; page <= 10 && !existing; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (error) return { ok: false, error: error.message }
      existing = data.users.find((u) => u.phone === phone)
      if (data.users.length < 200) break
    }

    if (existing) {
      // Seeded users have no password; give them one so the same path works for them.
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        phone_confirm: true,
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true, created: false, password }
    }

    const { error } = await supabase.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, created: true, password }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Lets the sign-in screen show the right affordance without leaking config. */
export async function devSignInEnabled(): Promise<boolean> {
  return process.env.ALLOW_DEV_SIGNIN === 'true' && process.env.NODE_ENV !== 'production'
}
