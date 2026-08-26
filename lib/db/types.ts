/**
 * Shapes returned by the helpers in this directory. These are the app's view of the
 * schema, not a generated mirror of it: money has already been converted to paise and
 * nothing here carries a raw numeric string onward into a component.
 */

import type { Paise } from '@/lib/money'

export type Role = 'parent' | 'trainer' | 'admin'
export type VerificationStatus = 'pending' | 'approved' | 'rejected'
export type EnquiryStatus = 'open' | 'accepted' | 'declined' | 'withdrawn'
export type EnrollmentStatus = 'pending_payment' | 'active' | 'completed' | 'cancelled'
export type SessionStatus = 'scheduled' | 'attended' | 'no_show' | 'cancelled'
export type LedgerType = 'topup' | 'hold' | 'release' | 'commission' | 'refund' | 'payout'
export type AccountType = 'parent_wallet' | 'escrow' | 'trainer_earnings' | 'platform_revenue'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  avatar_url: string | null
  area_label: string | null
}

export interface Child {
  id: string
  name: string
  dob: string | null
  interests: string[]
  notes: string | null
}

export interface Category {
  id: string
  slug: string
  name: string
  group_name: string
}

/** One entry on the progress spine. */
export interface SpineEntry {
  sessionId: string
  scheduledAt: string
  markedAt: string | null
  note: string
  skillRating: number
  focusAreas: string[]
  categoryName: string
  categorySlug: string
  trainerId: string
  trainerName: string
  trainerAvatar: string | null
}

/** The quiet money strip above the progress spine. */
export interface WalletStrip {
  heldInEscrow: Paise
  classesRemaining: number
  activeEnrollments: number
}

export interface SearchResult {
  trainerId: string
  fullName: string
  headline: string
  avatarUrl: string | null
  areaLabel: string | null
  categoryId: string
  categoryName: string
  ratePerClass: Paise
  yearsExperience: number
  idVerified: boolean
  teachesOnline: boolean
  teachesInPerson: boolean
  distanceKm: number
  categoryStatus: VerificationStatus
}

export interface TrainerCategory {
  id: string
  categoryId: string
  categoryName: string
  categorySlug: string
  groupName: string
  ratePerClass: Paise
  credentialUrl: string | null
  credentialNote: string | null
  status: VerificationStatus
  rejectReason: string | null
  createdAt: string
}

export interface TrainerDetail {
  id: string
  fullName: string
  avatarUrl: string | null
  areaLabel: string | null
  headline: string
  bio: string | null
  yearsExperience: number
  serviceRadiusKm: number
  idVerified: boolean
  categories: TrainerCategory[]
  distanceKm: number | null
}

export interface EnquiryRow {
  id: string
  status: EnquiryStatus
  message: string | null
  createdAt: string
  respondedAt: string | null
  childId: string
  childName: string
  childAge: number | null
  categoryId: string
  categoryName: string
  parentId: string
  parentName: string
  parentArea: string | null
  trainerId: string
  trainerName: string
  trainerArea: string | null
  ratePerClass: Paise | null
  enrollmentId: string | null
  enrollmentStatus: EnrollmentStatus | null
  preferredWeekday: number | null
  preferredTime: string | null
}

export interface EnrollmentSummary {
  id: string
  status: EnrollmentStatus
  startDate: string | null
  ratePerClass: Paise
  classesPerMonth: number
  commissionPct: string
  childId: string
  childName: string
  parentId: string
  parentName: string
  trainerId: string
  trainerName: string
  categoryId: string
  categoryName: string
  classesDelivered: number
  classesRemaining: number
  committed: Paise
  stillInEscrow: Paise
  releasedToTrainer: Paise
  platformEarned: Paise
}

export interface SessionRow {
  id: string
  enrollmentId: string
  scheduledAt: string
  status: SessionStatus
  markedAt: string | null
  assessmentNote: string | null
  skillRating: number | null
  focusAreas: string[]
  childName: string
  categoryName: string
  parentName: string
  parentArea: string | null
  ratePerClass: Paise
  commissionPct: string
}

export interface LedgerRow {
  id: string
  createdAt: string
  type: LedgerType
  amount: Paise
  memo: string | null
  enrollmentId: string | null
  sessionId: string | null
  fromType: AccountType | 'external'
  toType: AccountType | 'external'
  fromOwner: string | null
  toOwner: string | null
}

export interface NotificationRow {
  id: string
  template: string
  channel: 'whatsapp' | 'sms' | 'in_app'
  status: 'queued' | 'sent' | 'failed'
  payload: Record<string, unknown>
  createdAt: string
  sentAt: string | null
  readAt: string | null
}

export interface ActiveService {
  enrollmentId: string
  childName: string
  parentName: string
  parentPhone: string | null
  trainerName: string
  trainerPhone: string | null
  categoryName: string
  areaLabel: string | null
  status: EnrollmentStatus
  startDate: string | null
  ratePerClass: Paise
  classesPerMonth: number
  classesDelivered: number
  classesRemaining: number
  committed: Paise
  stillInEscrow: Paise
  releasedToTrainer: Paise
  platformEarned: Paise
  lastClassAt: string | null
  nextClassAt: string | null
}
