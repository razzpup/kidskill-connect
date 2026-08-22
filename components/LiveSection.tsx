'use client'

import { useLiveRefresh, type WatchTable } from '@/lib/realtime'

/**
 * Wraps a server-rendered screen so it re-renders when the tables it depends on change.
 * The children stay server components; only this shell is client, so subscribing a
 * screen to realtime costs one small boundary and no data fetching moves to the browser.
 */
export function LiveSection({
  tables,
  children,
}: {
  tables: WatchTable[]
  children: React.ReactNode
}) {
  useLiveRefresh(tables)
  return <>{children}</>
}
