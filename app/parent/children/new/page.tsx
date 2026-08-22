import { requireRole } from '@/lib/db/session'
import { AddChildForm } from './AddChildForm'

/**
 * Onboarding only ever asks for one child (CLAUDE.md: "then one child"), so a parent
 * with a second kid needs a real way back into `addChild` afterwards — `/onboarding`
 * redirects an already-onboarded parent straight to `/parent` and never gets here.
 */
export default async function AddChildPage() {
  await requireRole('parent')
  return (
    <div className="mx-auto w-full max-w-[26rem]">
      <AddChildForm />
    </div>
  )
}
