import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { currentViewer, homeFor } from '@/lib/db/session'
import { OnboardingFlow } from './OnboardingFlow'

/**
 * A `profiles` row is written at the end of the "you" step, before the child step ever
 * runs — so treating "a profile exists" as "onboarding is finished" bounced a parent
 * straight to the dashboard the moment they finished step one, and the child step never
 * rendered. Finished now means what it says: at least one child on file.
 */
export default async function OnboardingPage() {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/sign-in')

  const viewer = await currentViewer()
  if (viewer && viewer.profile.role !== 'parent') redirect(homeFor(viewer.profile.role))

  let hasChild = false
  if (viewer) {
    const { count } = await supabase
      .from('children')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', auth.user.id)
    hasChild = (count ?? 0) > 0
  }
  if (hasChild) redirect('/parent')

  return (
    <main className="theme-light min-h-dvh bg-paper text-ink">
      <div className="mx-auto w-full max-w-[26rem] px-6 py-10">
        <OnboardingFlow
          phone={auth.user.phone ? `+${auth.user.phone}` : ''}
          initialStep={viewer ? 'child' : 'you'}
        />
      </div>
    </main>
  )
}
