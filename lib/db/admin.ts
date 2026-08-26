import { supabaseServer } from '@/lib/supabase/server'
import { toPaise } from '@/lib/money'
import { OWN_PROFILE_NAME_AREA, TRAINER_NAME, trainerPerson } from './embeds'
import type { ActiveService, EnrollmentStatus, LedgerRow, TrainerCategory } from './types'

/**
 * The oversight screen. `admin_active_services()` derives escrow per enrollment rather
 * than reading an account balance, because one parent's escrow account backs every
 * enrollment they hold at once.
 */
export async function activeServices(
  status: EnrollmentStatus | null = 'active',
): Promise<ActiveService[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('admin_active_services', { p_status: status })
  if (error) throw error

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    enrollmentId: r.enrollment_id,
    childName: r.child_name,
    parentName: r.parent_name,
    parentPhone: r.parent_phone,
    trainerName: r.trainer_name,
    trainerPhone: r.trainer_phone,
    categoryName: r.category_name,
    areaLabel: r.area_label,
    status: r.status,
    startDate: r.start_date,
    ratePerClass: toPaise(r.rate_per_class),
    classesPerMonth: r.classes_per_month,
    classesDelivered: Number(r.classes_delivered),
    classesRemaining: Number(r.classes_remaining),
    committed: toPaise(r.committed_amount),
    stillInEscrow: toPaise(r.still_in_escrow),
    releasedToTrainer: toPaise(r.released_to_trainer),
    platformEarned: toPaise(r.platform_earned),
    lastClassAt: r.last_class_at,
    nextClassAt: r.next_class_at,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function pendingApplications(): Promise<
  (TrainerCategory & {
    trainerId: string
    trainerName: string
    trainerHeadline: string
    trainerArea: string | null
    yearsExperience: number
    idVerified: boolean
    idType: string | null
    idLast4: string | null
    idName: string | null
    idDocumentUrl: string | null
    /** A short-lived link to open the uploaded ID photo, or null if nothing was attached. */
    idDocumentSignedUrl: string | null
    idSubmittedAt: string | null
    idRejectReason: string | null
    /** A short-lived link to open the uploaded file, or null if nothing was attached. */
    credentialSignedUrl: string | null
  })[]
> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('trainer_categories')
    .select(`
      id, trainer_id, category_id, rate_per_class, credential_url, credential_note,
      status, reject_reason, created_at,
      categories:category_id ( name, slug, group_name ),
      trainer:trainer_id (
        headline, years_experience, id_verified,
        id_type, id_last4, id_name, id_document_url, id_submitted_at, id_reject_reason,
        ${OWN_PROFILE_NAME_AREA}
      )
    `)
    .eq('status', 'pending')
    .order('created_at')
  if (error) throw error

  // credential_url and id_document_url are both storage object paths (`{trainer_id}/...`)
  // in the same private `credentials` bucket (migrations 0008 and 0010) — the only way to
  // open either is a signed URL generated with the admin's own session, which is what
  // storage RLS actually checks.
  const paths = new Set<string>()
  for (const c of (data ?? []) as { credential_url: string | null; trainer?: { id_document_url?: string | null } }[]) {
    if (c.credential_url) paths.add(c.credential_url)
    if (c.trainer?.id_document_url) paths.add(c.trainer.id_document_url)
  }
  const signedByPath = new Map<string, string>()
  if (paths.size > 0) {
    const { data: signed } = await supabase.storage
      .from('credentials')
      .createSignedUrls([...paths], 60 * 10)
    for (const s of signed ?? []) {
      if (s.signedUrl && !s.error) signedByPath.set(s.path ?? '', s.signedUrl)
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((c: any) => ({
    id: c.id,
    categoryId: c.category_id,
    categoryName: c.categories?.name ?? '—',
    categorySlug: c.categories?.slug ?? '',
    groupName: c.categories?.group_name ?? '',
    ratePerClass: toPaise(c.rate_per_class),
    credentialUrl: c.credential_url,
    credentialSignedUrl: c.credential_url ? (signedByPath.get(c.credential_url) ?? null) : null,
    credentialNote: c.credential_note,
    status: c.status,
    rejectReason: c.reject_reason,
    createdAt: c.created_at,
    trainerId: c.trainer_id,
    trainerName: c.trainer?.profiles?.full_name ?? '—',
    trainerHeadline: c.trainer?.headline ?? '',
    trainerArea: c.trainer?.profiles?.area_label ?? null,
    yearsExperience: c.trainer?.years_experience ?? 0,
    idVerified: c.trainer?.id_verified ?? false,
    idType: c.trainer?.id_type ?? null,
    idLast4: c.trainer?.id_last4 ?? null,
    idName: c.trainer?.id_name ?? null,
    idDocumentUrl: c.trainer?.id_document_url ?? null,
    idDocumentSignedUrl: c.trainer?.id_document_url
      ? (signedByPath.get(c.trainer.id_document_url) ?? null)
      : null,
    idSubmittedAt: c.trainer?.id_submitted_at ?? null,
    idRejectReason: c.trainer?.id_reject_reason ?? null,
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export interface AdminLedgerRow extends LedgerRow {
  childName: string | null
  categoryName: string | null
  parentName: string | null
  trainerName: string | null
}

/** Every ledger row in the system, newest first, optionally scoped to one enrollment. */
export async function adminLedger(enrollmentId?: string): Promise<AdminLedgerRow[]> {
  const supabase = await supabaseServer()

  const { data: accounts } = await supabase.from('accounts').select('id, type, owner_id')
  const accountById = new Map((accounts ?? []).map((a) => [a.id as string, a]))

  let query = supabase
    .from('ledger_entries')
    .select(`
      id, created_at, type, amount, memo, enrollment_id, session_id,
      from_account, to_account,
      enrollments:enrollment_id (
        children:child_id ( name ),
        categories:category_id ( name ),
        parent:parent_id ( full_name ),
        ${TRAINER_NAME}
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)
  if (enrollmentId) query = query.eq('enrollment_id', enrollmentId)

  const { data, error } = await query
  if (error) throw error

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => {
    const from = r.from_account ? accountById.get(r.from_account) : null
    const to = r.to_account ? accountById.get(r.to_account) : null
    return {
      id: r.id,
      createdAt: r.created_at,
      type: r.type,
      amount: toPaise(r.amount),
      memo: r.memo,
      enrollmentId: r.enrollment_id,
      sessionId: r.session_id,
      fromType: (from?.type as LedgerRow['fromType']) ?? 'external',
      toType: (to?.type as LedgerRow['toType']) ?? 'external',
      fromOwner: (from?.owner_id as string) ?? null,
      toOwner: (to?.owner_id as string) ?? null,
      childName: r.enrollments?.children?.name ?? null,
      categoryName: r.enrollments?.categories?.name ?? null,
      parentName: r.enrollments?.parent?.full_name ?? null,
      trainerName: r.enrollments?.trainer?.profiles?.full_name ?? null,
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function platformTotals() {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('account_balances')
    .select('type, balance, owner_id')
    .is('owner_id', null)
    .eq('type', 'platform_revenue')
    .maybeSingle()

  const { data: sums } = await supabase.from('ledger_entries').select('type, amount')
  const by = (t: string) =>
    (sums ?? []).filter((s) => s.type === t).reduce((n, s) => n + toPaise(s.amount as string), 0)

  return {
    platformRevenue: toPaise(data?.balance ?? '0'),
    totalHeld: by('hold') - by('release') - by('commission') - by('refund'),
    totalReleased: by('release'),
    totalRefunded: by('refund'),
  }
}
