import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { AUTH_COOKIE, SERVER_SUPABASE_URL } from '@/lib/supabase/config'

/**
 * Refreshes the auth cookie on every request so server components never render
 * against an expired session. It does not gate routes — each layout checks the role
 * it needs, because a parent hitting /admin should be told what happened, not
 * silently bounced to a login screen they are already past.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    SERVER_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: AUTH_COOKIE },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|fonts|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
}
