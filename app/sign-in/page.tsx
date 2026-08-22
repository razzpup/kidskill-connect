import { redirect } from 'next/navigation'
import { currentViewer, homeFor } from '@/lib/db/session'
import { devSignInEnabled } from '@/lib/db/dev-auth'
import { SignInFlow } from './SignInFlow'
import './carnival.css'

/**
 * Two doors. A parent is here to find someone; a trainer is here to be listed. They are
 * different products and the entry point says so.
 *
 * This page renders for logged-out visitors, so it cannot query `categories` — grants
 * migration 0003 deliberately gives `anon` nothing, on the rule that every real screen
 * requires a signed-in user. The category showcase below is static marketing content for
 * exactly that reason, not a live read of the table.
 */
export default async function SignInPage() {
  const viewer = await currentViewer()
  if (viewer) redirect(homeFor(viewer.profile.role))

  return <SignInFlow devEnabled={await devSignInEnabled()} />
}
