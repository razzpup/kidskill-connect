import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import type { Profile, Role } from './types'

export interface Viewer {
  userId: string
  profile: Profile
}

/** The signed-in profile, or null. Used by layouts to decide what shell to render. */
export async function currentViewer(): Promise<Viewer | null> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone, avatar_url, area_label')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!data) return null
  return { userId: auth.user.id, profile: data as Profile }
}

/** Where a signed-in user belongs. One place, so every redirect agrees. */
export function homeFor(role: Role): string {
  return role === 'parent' ? '/parent' : role === 'trainer' ? '/trainer' : '/admin'
}

export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await currentViewer()
  if (!viewer) redirect('/sign-in')
  if (viewer.profile.role !== role) redirect(homeFor(viewer.profile.role))
  return viewer
}
