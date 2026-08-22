'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export type WatchTable = 'sessions' | 'ledger_entries' | 'enrollments' | 'enquiries' | 'notifications'

/**
 * Realtime is not an enhancement here — it is the demo's central moment. A trainer
 * marking attendance on one device must move the parent's dashboard and the admin's
 * monitor on two others, with no refresh.
 *
 * The mechanism is deliberately simple: subscribe, then `router.refresh()`. The server
 * component re-renders against the database and every derived number — escrow, credits,
 * the spine, the ledger — moves together and stays consistent, which is not true of a
 * client-side patch that has to guess what the trigger did.
 */
export function useLiveRefresh(
  tables: WatchTable[],
  options: { onEvent?: (table: WatchTable, payload: unknown) => void; channel?: string } = {},
) {
  const router = useRouter()
  const pathname = usePathname()
  const onEvent = useRef(options.onEvent)
  onEvent.current = options.onEvent

  const key = tables.join(',')

  // The /preview routes render the same dashboards from fixtures, with no backend
  // behind them. Subscribing there would open a socket to a Supabase that may not be
  // running and refresh a page that has nothing to re-read.
  const live = !pathname?.startsWith('/preview') && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

  useEffect(() => {
    if (!live) return
    const supabase = supabaseBrowser()
    const name = options.channel ?? `live:${key}`
    const channel = supabase.channel(name)
    let pending: ReturnType<typeof setTimeout> | null = null

    for (const table of key.split(',') as WatchTable[]) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        onEvent.current?.(table, payload)
        // One release writes two ledger rows and updates a session in the same
        // transaction. Coalesce so that lands as one re-render, not three.
        if (pending) clearTimeout(pending)
        pending = setTimeout(() => router.refresh(), 120)
      })
    }

    channel.subscribe()
    return () => {
      if (pending) clearTimeout(pending)
      void supabase.removeChannel(channel)
    }
  }, [key, options.channel, router, live])
}
