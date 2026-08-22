import { supabaseServer } from '@/lib/supabase/server'
import { toPaise, type Paise } from '@/lib/money'
import { OWN_PROFILE, TRAINER_IDENTITY, TRAINER_NAME, TRAINER_NAME_AREA, trainerPerson } from './embeds'
import type {
  Child,
  Category,
  EnquiryRow,
  EnrollmentSummary,
  NotificationRow,
  SpineEntry,
  TrainerDetail,
  WalletStrip,
} from './types'

export async function listChildren(parentId: string): Promise<Child[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('children')
    .select('id, name, dob, interests, notes')
    .eq('parent_id', parentId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Child[]
}

export interface StoredLocation {
  lat: number
  lng: number
  areaLabel: string | null
}

/**
 * Captured once at onboarding, read back everywhere. PostGIS serialises geography as
 * WKB hex over PostgREST, so `my_location()` decodes it in the database rather than
 * shipping a WKB parser to the browser for two numbers.
 */
export async function myLocation(): Promise<StoredLocation | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('my_location')
  if (error) throw error
  const row = (data as { lat: number; lng: number; area_label: string | null }[] | null)?.[0]
  if (!row) return null
  return { lat: Number(row.lat), lng: Number(row.lng), areaLabel: row.area_label }
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, group_name')
    .order('group_name')
    .order('name')
  if (error) throw error
  return (data ?? []) as Category[]
}

/**
 * The spine. Every attended session this child has ever had, across every trainer,
 * newest first — the documented skill history the product exists to create.
 */
export async function childSpine(childId: string): Promise<SpineEntry[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('child_progress_spine', { p_child_id: childId })
  if (error) throw error
  return (data ?? []).map((r: Record<string, never>) => ({
    sessionId: r.session_id as unknown as string,
    scheduledAt: r.scheduled_at as unknown as string,
    markedAt: r.marked_at as unknown as string | null,
    note: (r.assessment_note as unknown as string) ?? '',
    skillRating: (r.skill_rating as unknown as number) ?? 0,
    focusAreas: (r.focus_areas as unknown as string[]) ?? [],
    categoryName: r.category_name as unknown as string,
    categorySlug: r.category_slug as unknown as string,
    trainerId: r.trainer_id as unknown as string,
    trainerName: r.trainer_name as unknown as string,
    trainerAvatar: r.trainer_avatar as unknown as string | null,
  }))
}


/**
 * The quiet strip above the spine, derived from enrollments the caller already has —
 * so a screen showing both the strip and the enrollment list queries the ledger once,
 * not twice.
 *
 * Escrow is summed per enrollment rather than read off the escrow account, because one
 * parent's escrow account backs every enrollment they hold at once.
 */
export function walletStrip(
  enrollments: EnrollmentSummary[],
  childId?: string,
): WalletStrip {
  const scoped = childId ? enrollments.filter((e) => e.childId === childId) : enrollments
  const active = scoped.filter((e) => e.status === 'active')

  return {
    heldInEscrow: active.reduce((sum, e) => sum + e.stillInEscrow, 0),
    classesRemaining: active.reduce((sum, e) => sum + e.classesRemaining, 0),
    activeEnrollments: active.length,
  }
}

/** Every enrollment for a parent, with its money state derived from the ledger. */
export async function parentEnrollments(parentId: string): Promise<EnrollmentSummary[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, status, start_date, rate_per_class, classes_per_month, commission_pct,
      child_id, parent_id, trainer_id, category_id,
      children:child_id ( name ),
      parent:parent_id ( full_name ),
      ${TRAINER_NAME},
      categories:category_id ( name )
    `)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return hydrateEnrollments(data ?? [])
}

export async function enrollmentById(id: string): Promise<EnrollmentSummary | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, status, start_date, rate_per_class, classes_per_month, commission_pct,
      child_id, parent_id, trainer_id, category_id,
      children:child_id ( name ),
      parent:parent_id ( full_name ),
      ${TRAINER_NAME},
      categories:category_id ( name )
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [hydrated] = await hydrateEnrollments([data])
  return hydrated ?? null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function hydrateEnrollments(rows: any[]): Promise<EnrollmentSummary[]> {
  if (rows.length === 0) return []
  const supabase = await supabaseServer()
  const ids = rows.map((r) => r.id)

  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('enrollment_id, type, amount, session_id')
    .in('enrollment_id', ids)

  const totals = new Map<string, { hold: number; release: number; commission: number; refund: number; sessions: Set<string> }>()
  for (const id of ids) {
    totals.set(id, { hold: 0, release: 0, commission: 0, refund: 0, sessions: new Set() })
  }
  for (const e of entries ?? []) {
    const t = totals.get(e.enrollment_id as string)
    if (!t) continue
    const amount = toPaise(e.amount as string)
    if (e.type === 'hold') t.hold += amount
    else if (e.type === 'release') {
      t.release += amount
      if (e.session_id) t.sessions.add(e.session_id as string)
    } else if (e.type === 'commission') t.commission += amount
    else if (e.type === 'refund') t.refund += amount
  }

  return rows.map((r) => {
    const t = totals.get(r.id)!
    const rate = toPaise(r.rate_per_class)
    const delivered = t.sessions.size
    return {
      id: r.id,
      status: r.status,
      startDate: r.start_date,
      ratePerClass: rate,
      classesPerMonth: r.classes_per_month,
      commissionPct: String(r.commission_pct),
      childId: r.child_id,
      childName: r.children?.name ?? '—',
      parentId: r.parent_id,
      parentName: r.parent?.full_name ?? '—',
      trainerId: r.trainer_id,
      trainerName: trainerPerson(r).full_name,
      categoryId: r.category_id,
      categoryName: r.categories?.name ?? '—',
      classesDelivered: delivered,
      classesRemaining: r.classes_per_month - delivered,
      committed: rate * r.classes_per_month,
      stillInEscrow: t.hold - t.release - t.commission - t.refund,
      releasedToTrainer: t.release,
      platformEarned: t.commission,
    }
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function parentEnquiries(parentId: string): Promise<EnquiryRow[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('enquiries')
    .select(`
      id, status, message, created_at, responded_at,
      child_id, category_id, parent_id, trainer_id,
      children:child_id ( name, dob ),
      categories:category_id ( name ),
      parent:parent_id ( full_name, area_label ),
      ${TRAINER_NAME_AREA}
    `)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const enquiryIds = (data ?? []).map((r) => r.id)
  const { data: enr } = enquiryIds.length
    ? await supabase.from('enrollments').select('id, enquiry_id, status').in('enquiry_id', enquiryIds)
    : { data: [] }
  const byEnquiry = new Map((enr ?? []).map((e) => [e.enquiry_id as string, e]))

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => {
    const e = byEnquiry.get(r.id)
    return {
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
      ratePerClass: null,
      enrollmentId: (e?.id as string) ?? null,
      enrollmentStatus: (e?.status as EnquiryRow['enrollmentStatus']) ?? null,
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  const born = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - born.getFullYear()
  const m = now.getMonth() - born.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1
  return age
}

export async function trainerDetail(trainerId: string): Promise<TrainerDetail | null> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select(`
      user_id, headline, bio, years_experience, service_radius_km, id_verified,
      ${OWN_PROFILE}
    `)
    .eq('user_id', trainerId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { data: cats } = await supabase
    .from('trainer_categories')
    .select(`
      id, category_id, rate_per_class, credential_url, credential_note, status,
      reject_reason, created_at,
      categories:category_id ( name, slug, group_name )
    `)
    .eq('trainer_id', trainerId)
    .eq('status', 'approved')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const p = (data as any).profiles
  return {
    id: trainerId,
    fullName: p?.full_name ?? '—',
    avatarUrl: p?.avatar_url ?? null,
    areaLabel: p?.area_label ?? null,
    headline: (data as any).headline,
    bio: (data as any).bio,
    yearsExperience: (data as any).years_experience,
    serviceRadiusKm: (data as any).service_radius_km,
    idVerified: (data as any).id_verified,
    distanceKm: null,
    categories: (cats ?? []).map((c: any) => ({
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
    })),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function sessionDetail(sessionId: string) {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id, enrollment_id, scheduled_at, status, attendance_marked_at,
      assessment_note, skill_rating, focus_areas,
      enrollments:enrollment_id (
        rate_per_class, commission_pct, child_id, parent_id, trainer_id,
        children:child_id ( name ),
        categories:category_id ( name ),
        ${TRAINER_IDENTITY}
      )
    `)
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function notificationsFor(userId: string): Promise<NotificationRow[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, template, channel, status, payload, created_at, sent_at, read_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) throw error
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    id: r.id,
    template: r.template,
    channel: r.channel,
    status: r.status,
    payload: r.payload ?? {},
    createdAt: r.created_at,
    sentAt: r.sent_at,
    readAt: r.read_at,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
