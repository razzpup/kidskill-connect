import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { listCategories } from '@/lib/db/parent'
import { hasTrainerProfile } from '@/lib/db/trainer'
import { TrainerOnboarding } from './TrainerOnboarding'

/**
 * Trainer onboarding is allowed to be longer than the parent's. Vetting justifies
 * friction, and the friction is itself the trust signal parents are paying for — so it
 * sits on the side that benefits from it.
 */
export default async function TrainerOnboardingPage() {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/sign-in')

  if (await hasTrainerProfile(auth.user.id)) redirect('/trainer')

  const categories = await listCategories()

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle()

  return (
    <TrainerOnboarding
      categories={categories}
      initialName={(profile?.full_name as string) ?? ''}
    />
  )
}
