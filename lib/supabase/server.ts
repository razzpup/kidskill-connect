import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import { AUTH_COOKIE, SERVER_SUPABASE_URL } from './config'

const url = SERVER_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * The request-scoped client. Everything a page reads goes through this, so RLS is
 * evaluated as the signed-in user — the same policies that protect the API protect
 * the server render.
 */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(url, anonKey, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // Called from a server component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to swallow.
        }
      },
    },
  })
}

/**
 * Bypasses RLS. Only the notification provider uses it, because `notifications` has no
 * client insert policy and the provider has to be able to record what it sent. Never
 * import this into a page.
 */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, { auth: { persistSession: false } })
}
