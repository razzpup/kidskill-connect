'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { flushNotifications } from '@/lib/notify'
import { toPaise } from '@/lib/money'
import { createOrder, verifySignature, publicKeyId } from '@/lib/razorpay'
import { searchTrainers } from './search'
import type { SearchResult } from './types'

export interface ActionResult {
  ok: boolean
  error?: string
  data?: Record<string, unknown>
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error)
  // Postgres exception messages in this schema are written to be shown to a person —
  // "An assessment note of at least 10 characters is required…" — so they are surfaced
  // rather than swallowed behind a generic failure.
  return { ok: false, error: message.replace(/^.*?:\s*/, '').trim() || message }
}

/* ------------------------------------------------------------------ profile */

export async function completeParentSignup(formData: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const areaLabel = String(formData.get('area_label') ?? '').trim() || null
  const lat = formData.get('lat') ? Number(formData.get('lat')) : null
  const lng = formData.get('lng') ? Number(formData.get('lng')) : null

  if (fullName.length < 2) return { ok: false, error: 'Enter your name' }

  const { error } = await supabase.from('profiles').upsert({
    id: auth.user.id,
    role: 'parent',
    full_name: fullName,
    phone: auth.user.phone ? `+${auth.user.phone}` : null,
    area_label: areaLabel,
    // Location is captured once here and reused everywhere. Never ask again.
    location: lat != null && lng != null ? `SRID=4326;POINT(${lng} ${lat})` : null,
  })
  if (error) return fail(error)

  revalidatePath('/parent')
  return { ok: true }
}

export async function addChild(formData: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 1) return { ok: false, error: "Enter your child's name" }

  const dob = String(formData.get('dob') ?? '').trim() || null
  const interests = String(formData.get('interests') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)

  const mode = String(formData.get('preferred_mode') ?? 'either')

  const { data, error } = await supabase
    .from('children')
    .insert({
      parent_id: auth.user.id,
      name,
      dob,
      interests,
      preferred_mode: ['online', 'in_person', 'either'].includes(mode) ? mode : 'either',
    })
    .select('id').maybeSingle()
  if (error) return fail(error)

  revalidatePath('/parent')
  return { ok: true, data: { id: data?.id } }
}

export async function saveParentLocation(lat: number, lng: number, areaLabel: string | null) {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase
    .from('profiles')
    .update({ location: `SRID=4326;POINT(${lng} ${lat})`, area_label: areaLabel })
    .eq('id', auth.user.id)
  if (error) return fail(error)

  revalidatePath('/parent/search')
  return { ok: true }
}

/* ------------------------------------------------------------------ search */

/**
 * Search runs as an action rather than from the browser client so that the RPC and its
 * paise conversion stay in `lib/db`. The screen calls it on every chip tap and every
 * slider move — there is no submit button — so it is deliberately cheap.
 */
export async function runSearch(params: {
  lat: number
  lng: number
  categoryId?: string | null
  radiusKm?: number
  maxRatePaise?: number | null
  mode?: 'either' | 'online' | 'in_person'
}): Promise<SearchResult[]> {
  return searchTrainers(params)
}

/* ------------------------------------------------------------------ enquiry */

export async function sendEnquiry(formData: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('send_enquiry', {
    p_child_id: String(formData.get('child_id')),
    p_trainer_id: String(formData.get('trainer_id')),
    p_category_id: String(formData.get('category_id')),
    p_message: String(formData.get('message') ?? '').trim() || null,
  })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/parent/enquiries')
  revalidatePath('/trainer/enquiries')
  return { ok: true, data: { id: data as string } }
}

export async function withdrawEnquiry(enquiryId: string): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('withdraw_enquiry', { p_enquiry_id: enquiryId })
  if (error) return fail(error)
  revalidatePath('/parent/enquiries')
  revalidatePath('/trainer/enquiries')
  return { ok: true }
}

export async function acceptEnquiry(
  enquiryId: string,
  classesPerMonth: number,
  /** 0 = Sunday, matching Postgres extract(dow). */
  weekday?: number,
  /** 24h "HH:MM". The month is laid out on this slot. */
  time?: string,
): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('accept_enquiry', {
    p_enquiry_id: enquiryId,
    p_classes_per_month: classesPerMonth,
    p_weekday: weekday ?? null,
    p_time: time ?? null,
  })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/trainer/enquiries')
  revalidatePath('/parent/enquiries')
  revalidatePath('/admin')
  return { ok: true, data: { enrollmentId: data as string } }
}

export async function declineEnquiry(enquiryId: string, reason?: string): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('decline_enquiry', {
    p_enquiry_id: enquiryId,
    p_reason: reason ?? null,
  })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/trainer/enquiries')
  revalidatePath('/parent/enquiries')
  return { ok: true }
}

/* ------------------------------------------------------------------ money */

/**
 * Step one of Razorpay Checkout: an order has to exist on Razorpay's side before the
 * widget can open. amount is derived server-side from the enrollment row, never taken
 * from the client — otherwise a tampered request could open a checkout for one rupee
 * and still fund the full escrow hold.
 */
export async function createRazorpayOrder(enrollmentId: string): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select('parent_id, status, rate_per_class, classes_per_month')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (error) return fail(error)
  if (!enrollment) return { ok: false, error: 'Enrollment not found' }
  if (enrollment.parent_id !== auth.user.id) {
    return { ok: false, error: 'Only the parent on this enrollment may pay for it' }
  }
  if (enrollment.status !== 'pending_payment') {
    return { ok: false, error: 'This enrollment is not awaiting payment' }
  }

  const keyId = publicKeyId()
  if (!keyId) return { ok: false, error: 'Razorpay test keys are not configured' }

  const amountPaise = toPaise(enrollment.rate_per_class) * enrollment.classes_per_month
  try {
    const order = await createOrder(amountPaise, enrollmentId)
    return { ok: true, data: { orderId: order.id, amount: order.amount, keyId } }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Step two: verify what Checkout's success handler sent us before trusting it. Only
 * once the signature checks out does this touch `fund_enrollment` — same RPC the old
 * mock gateway called, now gated behind a real (test-mode) payment instead of a bare
 * button press.
 */
export async function verifyAndFundEnrollment(
  enrollmentId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): Promise<ActionResult> {
  const valid = verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  if (!valid) return { ok: false, error: 'Payment could not be verified' }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('fund_enrollment', { p_enrollment_id: enrollmentId })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/parent')
  revalidatePath('/trainer')
  revalidatePath('/admin')
  return { ok: true, data: { total: data } }
}

/**
 * One atomic update. Status and assessment note go together — there is no "mark
 * attended now, write the note later" path, and the trigger rejects the attempt if
 * anyone tries. The money release happens inside this same statement.
 */
export async function markAttended(formData: FormData): Promise<ActionResult> {
  const sessionId = String(formData.get('session_id'))
  const note = String(formData.get('assessment_note') ?? '').trim()
  const rating = Number(formData.get('skill_rating'))
  const focusAreas = String(formData.get('focus_areas') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)

  if (note.length < 10) {
    return { ok: false, error: 'The assessment needs at least 10 characters — this is what the parent reads.' }
  }
  if (!rating || rating < 1 || rating > 5) {
    return { ok: false, error: 'Pick a skill rating from 1 to 5.' }
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'attended',
      assessment_note: note,
      skill_rating: rating,
      focus_areas: focusAreas,
    })
    .eq('id', sessionId)
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/trainer')
  revalidatePath('/trainer/earnings')
  revalidatePath('/parent')
  revalidatePath('/admin')
  return { ok: true }
}

export async function markNoShow(sessionId: string, note: string): Promise<ActionResult> {
  if (note.trim().length < 10) {
    return { ok: false, error: 'Write at least 10 characters describing what happened.' }
  }
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'no_show', assessment_note: note.trim(), attendance_marked_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) return fail(error)

  revalidatePath('/trainer')
  revalidatePath('/admin')
  return { ok: true }
}

/* ------------------------------------------------------------------ feedback */

export async function leaveFeedback(formData: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', auth.user.id).maybeSingle()

  const { error } = await supabase.from('feedback').upsert({
    session_id: String(formData.get('session_id')),
    author_id: auth.user.id,
    audience: profile?.role === 'parent' ? 'trainer' : 'parent',
    rating: Number(formData.get('rating')),
    comment: String(formData.get('comment') ?? '').trim() || null,
  }, { onConflict: 'session_id,author_id' })
  if (error) return fail(error)

  revalidatePath('/parent')
  revalidatePath('/trainer')
  return { ok: true }
}

/* ------------------------------------------------------------------ trainer */

export async function saveTrainerProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const headline = String(formData.get('headline') ?? '').trim()
  const bio = String(formData.get('bio') ?? '').trim() || null
  const years = Number(formData.get('years_experience') ?? 0)
  const radius = Number(formData.get('service_radius_km') ?? 10)
  const lat = Number(formData.get('lat'))
  const lng = Number(formData.get('lng'))
  const areaLabel = String(formData.get('area_label') ?? '').trim() || null

  if (fullName.length < 2) return { ok: false, error: 'Enter your name' }
  if (headline.length < 8) return { ok: false, error: 'Write a headline parents will read first' }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'Set your base location — parents are matched to it' }
  }

  const { error: pErr } = await supabase.from('profiles').upsert({
    id: auth.user.id,
    role: 'trainer',
    full_name: fullName,
    phone: auth.user.phone ? `+${auth.user.phone}` : null,
    area_label: areaLabel,
  })
  if (pErr) return fail(pErr)

  const teachesOnline = formData.get('teaches_online') === 'on'
  const teachesInPerson = formData.get('teaches_in_person') === 'on'

  if (!teachesOnline && !teachesInPerson) {
    return { ok: false, error: 'Pick at least one — online, in person, or both.' }
  }

  const { error } = await supabase.from('trainer_profiles').upsert({
    user_id: auth.user.id,
    headline,
    bio,
    years_experience: Number.isFinite(years) ? years : 0,
    service_radius_km: Math.min(50, Math.max(1, radius)),
    base_location: `SRID=4326;POINT(${lng} ${lat})`,
    teaches_online: teachesOnline,
    teaches_in_person: teachesInPerson,
  })
  if (error) return fail(error)

  revalidatePath('/trainer')
  return { ok: true }
}

export async function applyToCategory(formData: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'Not signed in' }

  const rate = Number(formData.get('rate_per_class'))
  if (!rate || rate <= 0) return { ok: false, error: 'Set your per-class rate for this category' }

  const note = String(formData.get('credential_note') ?? '').trim()
  if (note.length < 10) {
    return { ok: false, error: 'Describe your credential — this is what the reviewer reads.' }
  }

  // The upload writes to Storage under `{auth.uid()}/...` and hands back that path; a
  // path outside the caller's own folder would mean someone edited the form to point at
  // another trainer's file, which storage RLS would refuse to serve anyway, but this
  // stops the bad row from being written in the first place.
  const credentialUrl = String(formData.get('credential_url') ?? '').trim() || null
  if (credentialUrl && !credentialUrl.startsWith(`${auth.user.id}/`)) {
    return { ok: false, error: 'That attachment does not belong to your account.' }
  }

  const { error } = await supabase.from('trainer_categories').insert({
    trainer_id: auth.user.id,
    category_id: String(formData.get('category_id')),
    rate_per_class: rate.toFixed(2),
    credential_url: credentialUrl,
    credential_note: note,
  })
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'You have already applied to this category.' }
    }
    return fail(error)
  }

  revalidatePath('/trainer/categories')
  revalidatePath('/admin/approvals')
  return { ok: true }
}

export async function setCategoryRate(id: string, rate: number): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('set_category_rate', {
    p_trainer_category_id: id,
    p_rate: rate.toFixed(2),
  })
  if (error) return fail(error)
  revalidatePath('/trainer/categories')
  return { ok: true }
}

/* ------------------------------------------------------------------ identity */

/**
 * Takes the last four digits and a document link — never the full number. The browser
 * validates the whole thing (lib/identity.ts) and throws the rest away before calling
 * this, which is what keeps a national ID out of the database entirely.
 */
export async function submitIdentity(formData: FormData): Promise<ActionResult> {
  const last4 = String(formData.get('id_last4') ?? '')
  if (!/^[0-9]{4}$/.test(last4)) {
    return { ok: false, error: 'Something went wrong reading the document number. Try again.' }
  }
  const nameOnId = String(formData.get('id_name') ?? '').trim()
  if (nameOnId.length < 2) {
    return { ok: false, error: 'Enter the name exactly as printed on the document.' }
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('submit_identity', {
    p_type: String(formData.get('id_type') ?? 'aadhaar'),
    p_last4: last4,
    p_name_on_id: nameOnId,
    p_document_url: String(formData.get('id_document_url') ?? '').trim() || null,
  })
  if (error) return fail(error)

  revalidatePath('/trainer')
  revalidatePath('/admin/approvals')
  return { ok: true }
}

export async function reviewIdentity(
  trainerId: string,
  approve: boolean,
  reason?: string,
): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('review_identity', {
    p_trainer_id: trainerId,
    p_approve: approve,
    p_reason: reason ?? null,
  })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/admin/approvals')
  revalidatePath('/trainer')
  return { ok: true }
}

/* ------------------------------------------------------------------ admin */

export async function reviewApplication(
  id: string,
  approve: boolean,
  reason?: string,
): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('review_trainer_category', {
    p_id: id,
    p_approve: approve,
    p_reason: reason ?? null,
  })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/admin/approvals')
  revalidatePath('/trainer/categories')
  return { ok: true }
}

export async function refundEnrollment(
  enrollmentId: string,
  reason?: string,
): Promise<ActionResult> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('admin_refund_enrollment', {
    p_enrollment_id: enrollmentId,
    p_reason: reason ?? null,
  })
  if (error) return fail(error)

  await flushNotifications()
  revalidatePath('/admin')
  revalidatePath('/admin/enrollments')
  revalidatePath('/parent')
  return { ok: true, data: { refunded: data } }
}

/* ------------------------------------------------------------------ session */

export async function markNotificationsRead(): Promise<void> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', auth.user.id)
    .is('read_at', null)
}

/**
 * Clears the session and returns — it deliberately does not call `redirect()` itself.
 * A Server Action's redirect only reaches the browser reliably when the action is the
 * form's direct `action` prop; both call sites here invoke it from inside a client
 * wrapper (to flip a `busy` flag first), so the caller does a real `window.location`
 * navigation once this resolves instead of depending on that to propagate.
 */
export async function signOut(): Promise<void> {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
}
