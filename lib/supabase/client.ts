'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTH_COOKIE, BROWSER_SUPABASE_URL } from './config'

let cached: SupabaseClient | null = null

/**
 * One browser client per tab. Realtime channels are multiplexed over its single
 * socket, so several subscribed components cost one connection, not several.
 */
export function supabaseBrowser(): SupabaseClient {
  if (!cached) {
    cached = createBrowserClient(
      BROWSER_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: { name: AUTH_COOKIE },
        global: {
          headers: {
            // When the demo is served through an ngrok free tunnel, ngrok answers the
            // first request from a new browser with an HTML interstitial. A fetch that
            // expects JSON gets a page of markup instead and the sign-in fails with a
            // parse error that says nothing useful. This header opts out of it, and is
            // inert when there is no tunnel in front.
            'ngrok-skip-browser-warning': 'true',
          },
        },
      },
    )
  }
  return cached
}
