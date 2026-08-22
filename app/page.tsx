import { redirect } from 'next/navigation'
import { currentViewer, homeFor } from '@/lib/db/session'

export default async function Root() {
  const viewer = await currentViewer()
  redirect(viewer ? homeFor(viewer.profile.role) : '/sign-in')
}
