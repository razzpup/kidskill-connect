import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { currentViewer, homeFor } from '@/lib/db/session'
import { OnboardingFlow } from './OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/sign-in')

  const viewer = await currentViewer()
  if (viewer) redirect(homeFor(viewer.profile.role))

  return (
    <main className="theme-light min-h-dvh bg-paper text-ink">
      <div className="mx-auto w-full max-w-[26rem] px-6 py-10">
        <OnboardingFlow phone={auth.user.phone ? `+${auth.user.phone}` : ''} />
      </div>
    </main>
  )
}
