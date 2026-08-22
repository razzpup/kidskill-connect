/**
 * Where each side of the app finds Supabase, and what the session cookie is called.
 *
 * These differ once the demo is served through a tunnel. The browser has to reach
 * Supabase at a public origin, because sign-in, the search RPC and the realtime
 * websocket all go device → Kong without passing through Next. The server, running on
 * the same machine as the database, should keep talking to it over loopback rather than
 * making a round trip out to the internet and back.
 */

/** Public origin, used by the browser. Rewritten when a tunnel is running. */
export const BROWSER_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * Loopback origin, used by server components, server actions and middleware.
 * Falls back to the public one so a plain local checkout needs no extra variable.
 */
export const SERVER_SUPABASE_URL =
  process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * A fixed session cookie name.
 *
 * By default @supabase/ssr derives the storage key from the Supabase hostname. With the
 * browser on a tunnel domain and the server on 127.0.0.1 those derivations disagree, so
 * the browser writes a cookie the server never reads and every page renders as signed
 * out. Naming it explicitly makes the two agree no matter what the URLs are.
 */
export const AUTH_COOKIE = 'sb-kidskill-auth'
