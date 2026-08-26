import { supabaseServer } from '@/lib/supabase/server'
import { toPaise, type Paise } from '@/lib/money'
import { ageFromDob } from './parent'
import { TRAINER_NAME_AREA, trainerPerson } from './embeds'
import type { EnquiryRow, LedgerRow, SessionRow, TrainerCategory } from './types'

/**
 * The Today screen. Everything scheduled today, plus anything still scheduled from an
 * earlier day — a class that was never marked is money sitting in escrow, so it stays
 * on screen rather than scrolling silently into the past.
 */
export async function trainerDaySessions(trainerId: string): Promise<{
  today: SessionRow[]
  overdue: SessionRow[]
  upcoming: SessionRow[]
}> {
  const rows = await trainerSessions(trainerId)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000)

  const scheduled = rows.filter((r) => r.status === 'scheduled')
  return {
    overdue: scheduled.filter((r) => new Date(r.scheduledAt) < startOfToday),
    today: scheduled.filter((r) => {
      const at = new Date(r.scheduledAt)
      return at >= startOfToday && at < endOfToday
    }),
    upcoming: scheduled
      .filter((r) => new Date(r.scheduledAt) >= endOfToday)
      .slice(0, 6),
  }
}

export async function trainerSessions(trainerId: string): Promise<SessionRow[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, enrollment_id, scheduled_at, status, attendance_marked_at,
      assessment_note, skill_rating, focus_areas,
      enrollments:enrollment_id!inner (
        trainer_id, rate_per_class, commission_pct, status,
        children:child_id ( name ),
        categories:category_id ( name ),
        parent:parent_id ( full_name, area_label )
      )
    `)
    .eq('enrollments.trainer_id', trainerId)
    .order('scheduled_at')
  if (error) throw error

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    id: r.id,
    enrollmentId: r.enrollment_id,
    scheduledAt: r.scheduled_at,
    status: r.status,
    markedAt: r.attendance_marked_at,
    assessmentNote: r.assessment_note,
    skillRating: r.skill_rating,
    focusAreas: r.focus_areas ?? [],
    childName: r.enrollments?.children?.name ?? '—',
    categoryName: r.enrollments?.categories?.name ?? '—',
    parentName: r.enrollments?.parent?.full_name ?? '—',
    parentArea: r.enrollments?.parent?.area_label ?? null,
    ratePerClass: toPaise(r.enrollments?.rate_per_class ?? '0'),
    commissionPct: String(r.enrollments?.commission_pct ?? '15.00'),
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function trainerSessionById(sessionId: string): Promise<SessionRow | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, enrollment_id, scheduled_at, status, attendance_marked_at,
      assessment_note, skill_rating, focus_areas,
      enrollments:enrollment_id (
        rate_per_class, commission_pct,
        children:child_id ( name ),
        categories:category_id ( name ),
        parent:parent_id ( full_name, area_label )
      )
    `)
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const r = data as any
  return {
    id: r.id,
    enrollmentId: r.enrollment_id,
    scheduledAt: r.scheduled_at,
    status: r.status,
    markedAt: r.attendance_marked_at,
    assessmentNote: r.assessment_note,
    skillRating: r.skill_rating,
    focusAreas: r.focus_areas ?? [],
    childName: r.enrollments?.children?.name ?? '—',
    categoryName: r.enrollments?.categories?.name ?? '—',
    parentName: r.enrollments?.parent?.full_name ?? '—',
    parentArea: r.enrollments?.parent?.area_label ?? null,
    ratePerClass: toPaise(r.enrollments?.rate_per_class ?? '0'),
    commissionPct: String(r.enrollments?.commission_pct ?? '15.00'),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function trainerEnquiries(trainerId: string): Promise<EnquiryRow[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('enquiries')
    .select(`
      id, status, message, created_at, responded_at,
      child_id, category_id, parent_id, trainer_id,
      preferred_weekday, preferred_time,
      children:child_id ( name, dob ),
      categories:category_id ( name ),
      parent:parent_id ( full_name, area_label ),
      ${TRAINER_NAME_AREA}
    `)
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const { data: rates } = await supabase
    .from('trainer_categories')
    .select('category_id, rate_per_class')
    .eq('trainer_id', trainerId)
    .eq('status', 'approved')
  const rateByCategory = new Map(
    (rates ?? []).map((r) => [r.category_id as string, toPaise(r.rate_per_class as string)]),
  )

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
    childId: r.child_id,
    childName: r.children?.name ?? '—',
    childAge: ageFromDob(r.children?.dob),
    categoryId: r.category_id,
    categoryName: r.categories?.name ?? '—',
    parentId: r.parent_id,
    parentName: r.parent?.full_name ?? '—',
    parentArea: r.parent?.area_label ?? null,
    trainerId: r.trainer_id,
    trainerName: trainerPerson(r).full_name,
    trainerArea: trainerPerson(r).area_label,
    ratePerClass: rateByCategory.get(r.category_id) ?? null,
    enrollmentId: null,
    enrollmentStatus: null,
    preferredWeekday: r.preferred_weekday,
    preferredTime: r.preferred_time ? (r.preferred_time as string).slice(0, 5) : null,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export interface TrainerEarnings {
  balance: Paise
  releasedTotal: Paise
  commissionTotal: Paise
  entries: (LedgerRow & {
    childName: string
    categoryName: string
    sessionAt: string | null
    commission: Paise
  })[]
}

/**
 * Earnings are net of commission, and every line names the class it came from — the
 * point of the screen is that a trainer can trace each rupee to the lesson that
 * produced it, not just see a total.
 */
export async function trainerEarnings(trainerId: string): Promise<TrainerEarnings> {
  const supabase = await supabaseServer()

  const { data: account } = await supabase
    .from('account_balances')
    .select('account_id, balance')
    .eq('owner_id', trainerId)
    .eq('type', 'trainer_earnings')
    .maybeSingle()

  const { data: entries, error } = await supabase
    .from('ledger_entries')
    .select(`
      id, created_at, type, amount, memo, enrollment_id, session_id,
      enrollments:enrollment_id (
        commission_pct,
        children:child_id ( name ),
        categories:category_id ( name )
      ),
      sessions:session_id ( scheduled_at, attendance_marked_at )
    `)
    .eq('to_account', account?.account_id ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false })
  if (error) throw error

  // The commission that accompanied each release is a row in the ledger, written by the
  // same trigger in the same transaction. Read it rather than reconstructing it from the
  // net — a division by (1 - pct) is a float operation and can land a paise out.
  const sessionIds = (entries ?? [])
    .map((r) => r.session_id as string | null)
    .filter((id): id is string => Boolean(id))

  const { data: commissions } = sessionIds.length
    ? await supabase
        .from('ledger_entries')
        .select('session_id, amount')
        .eq('type', 'commission')
        .in('session_id', sessionIds)
    : { data: [] }

  const commissionBySession = new Map(
    (commissions ?? []).map((c) => [c.session_id as string, toPaise(c.amount as string)]),
  )

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows = (entries ?? []).map((r: any) => {
    const net = toPaise(r.amount)
    const commission = commissionBySession.get(r.session_id) ?? 0
    return {
      id: r.id,
      createdAt: r.created_at,
      type: r.type as LedgerRow['type'],
      amount: net,
      memo: r.memo,
      enrollmentId: r.enrollment_id,
      sessionId: r.session_id,
      fromType: 'escrow' as const,
      toType: 'trainer_earnings' as const,
      fromOwner: null,
      toOwner: trainerId,
      childName: r.enrollments?.children?.name ?? '—',
      categoryName: r.enrollments?.categories?.name ?? '—',
      sessionAt: r.sessions?.attendance_marked_at ?? r.sessions?.scheduled_at ?? null,
      commission,
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return {
    balance: toPaise(account?.balance ?? '0'),
    releasedTotal: rows.reduce((s, r) => s + r.amount, 0),
    commissionTotal: rows.reduce((s, r) => s + r.commission, 0),
    entries: rows,
  }
}

export async function trainerCategories(trainerId: string): Promise<TrainerCategory[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('trainer_categories')
    .select(`
      id, category_id, rate_per_class, credential_url, credential_note,
      status, reject_reason, created_at,
      categories:category_id ( name, slug, group_name )
    `)
    .eq('trainer_id', trainerId)
    .order('created_at')
  if (error) throw error

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((c: any) => ({
    id: c.id,
    categoryId: c.category_id,
    categoryName: c.categories?.name ?? '—',
    categorySlug: c.categories?.slug ?? '',
    groupName: c.categories?.group_name ?? '',
    ratePerClass: toPaise(c.rate_per_class),
    credentialUrl: c.credential_url,
    credentialNote: c.credential_note,
    status: c.status,
    rejectReason: c.reject_reason,
    createdAt: c.created_at,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** The weekly slots this coach has explicitly marked as unavailable — see the toggle in AvailabilityEditor. */
export async function trainerBlockedSlots(trainerId: string): Promise<{ weekday: number; time: string }[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('trainer_blocked_slots')
    .select('weekday, time')
    .eq('trainer_id', trainerId)
  if (error) throw error
  return (data ?? []).map((d) => ({ weekday: d.weekday as number, time: (d.time as string).slice(0, 5) }))
}

export async function hasTrainerProfile(trainerId: string): Promise<boolean> {
  const supabase = await supabaseServer()
  const { count } = await supabase
    .from('trainer_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', trainerId)
  return (count ?? 0) > 0
}

export type TrainerOnboardingStep = 'profile' | 'identity' | 'category' | 'done'

/**
 * Which onboarding screen a trainer belongs on. `trainer_profiles` is written at the
 * end of step one, so its mere existence used to be treated as "onboarding finished" —
 * that was wrong, and it is what let a trainer get bounced to the dashboard mid-flow
 * before ever applying to a category. "Done" means an actual category application
 * exists, which is the only thing that makes a trainer searchable at all.
 */
export async function trainerOnboardingStep(trainerId: string): Promise<TrainerOnboardingStep> {
  const supabase = await supabaseServer()

  const { data: tp } = await supabase
    .from('trainer_profiles')
    .select('id_submitted_at')
    .eq('user_id', trainerId)
    .maybeSingle()
  if (!tp) return 'profile'
  if (!tp.id_submitted_at) return 'identity'

  const { count } = await supabase
    .from('trainer_categories')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
  return (count ?? 0) > 0 ? 'done' : 'category'
}
