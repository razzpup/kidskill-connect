/**
 * Static data for the front-end preview.
 *
 * The three dashboards are ordinary prop-driven components, so they can be rendered
 * from fixtures with no database, no auth and no Docker behind them. That is the whole
 * point of this file: the structure and the screens should be reviewable on their own,
 * without a backend that can be down.
 *
 * Shapes are the real ones from `lib/db/types`, so anything that renders here renders
 * the same way against live data. Money is integer paise, as everywhere else.
 */

import type {
  ActiveService,
  Child,
  EnquiryRow,
  EnrollmentSummary,
  SessionRow,
  SpineEntry,
  WalletStrip,
} from '@/lib/db/types'
import type { CalendarClass } from '@/lib/db/calendar'

/** Dates relative to now, so the preview never looks stale. */
const daysAgo = (n: number, hour = 18) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const daysAhead = (n: number, hour = 17) => daysAgo(-n, hour)

/* ------------------------------------------------------------------ parent */

export const previewChildren: Child[] = [
  {
    id: 'child-aarav',
    name: 'Aarav',
    dob: '2016-04-12',
    interests: ['music', 'drawing'],
    notes: 'Shy for the first ten minutes, then fine.',
  },
  { id: 'child-diya', name: 'Diya', dob: '2019-09-03', interests: ['swimming'], notes: null },
]

export const previewSpine: SpineEntry[] = [
  {
    sessionId: 's-6',
    scheduledAt: daysAgo(2),
    markedAt: daysAgo(2),
    note: 'Best session yet. Drew his own hand holding a spoon — foreshortening, which is genuinely hard — and did not once ask if it was good. Proportions are landing without correction now.',
    skillRating: 4,
    focusAreas: ['foreshortening', 'observation', 'confidence'],
    categoryName: 'Sketching',
    categorySlug: 'sketching',
    trainerId: 't-priya',
    trainerName: 'Priya Menon',
    trainerAvatar: null,
  },
  {
    sessionId: 's-5',
    scheduledAt: daysAgo(9),
    markedAt: daysAgo(9),
    note: 'Value study, three tones only, using the side of the pencil. Struggled to keep his hand loose and kept reverting to the tip. Grip is the thing to work on next week.',
    skillRating: 3,
    focusAreas: ['tonal value', 'pencil grip'],
    categoryName: 'Sketching',
    categorySlug: 'sketching',
    trainerId: 't-priya',
    trainerName: 'Priya Menon',
    trainerAvatar: null,
  },
  {
    sessionId: 's-4',
    scheduledAt: daysAgo(16),
    markedAt: daysAgo(16),
    note: 'Introduced negative space. Drew the gaps between the chair legs instead of the legs. Result was the most accurate thing he has made so far and he could see it. Asked to take the drawing home.',
    skillRating: 3,
    focusAreas: ['negative space', 'proportion'],
    categoryName: 'Sketching',
    categorySlug: 'sketching',
    trainerId: 't-priya',
    trainerName: 'Priya Menon',
    trainerAvatar: null,
  },
  {
    sessionId: 's-3',
    scheduledAt: daysAgo(23),
    markedAt: daysAgo(23),
    note: 'Contour drawing of a potted money plant. Still drawing what he thinks a leaf looks like rather than what is in front of him, but he caught himself twice and corrected without being told. That is the whole skill.',
    skillRating: 2,
    focusAreas: ['observation', 'proportion'],
    categoryName: 'Sketching',
    categorySlug: 'sketching',
    trainerId: 't-priya',
    trainerName: 'Priya Menon',
    trainerAvatar: null,
  },
  {
    sessionId: 's-2',
    scheduledAt: daysAgo(30),
    markedAt: daysAgo(30),
    note: 'First session. Aarav can already draw a convincing cartoon but freezes in front of a real object. We spent the hour on a single shoe — no erasing allowed. He hated it for twenty minutes and then got absorbed.',
    skillRating: 2,
    focusAreas: ['observation', 'line confidence'],
    categoryName: 'Sketching',
    categorySlug: 'sketching',
    trainerId: 't-priya',
    trainerName: 'Priya Menon',
    trainerAvatar: null,
  },
]

export const previewEnrollments: EnrollmentSummary[] = [
  {
    id: 'enr-sketching',
    status: 'active',
    startDate: daysAgo(30).slice(0, 10),
    ratePerClass: 50_000,
    classesPerMonth: 8,
    commissionPct: '15.00',
    childId: 'child-aarav',
    childName: 'Aarav',
    parentId: 'p-anitha',
    parentName: 'Anitha Rao',
    trainerId: 't-priya',
    trainerName: 'Priya Menon',
    categoryId: 'cat-sketching',
    categoryName: 'Sketching',
    classesDelivered: 5,
    classesRemaining: 3,
    committed: 400_000,
    stillInEscrow: 150_000,
    releasedToTrainer: 212_500,
    platformEarned: 37_500,
  },
  {
    id: 'enr-vocal',
    status: 'pending_payment',
    startDate: null,
    ratePerClass: 80_000,
    classesPerMonth: 8,
    commissionPct: '15.00',
    childId: 'child-aarav',
    childName: 'Aarav',
    parentId: 'p-anitha',
    parentName: 'Anitha Rao',
    trainerId: 't-lakshmi',
    trainerName: 'Lakshmi Narayanan',
    categoryId: 'cat-vocal',
    categoryName: 'Carnatic vocal',
    classesDelivered: 0,
    classesRemaining: 8,
    committed: 640_000,
    stillInEscrow: 0,
    releasedToTrainer: 0,
    platformEarned: 0,
  },
]

export const previewStrip: WalletStrip = {
  heldInEscrow: 150_000,
  classesRemaining: 3,
  activeEnrollments: 1,
}

const dayKey = (n: number) => daysAgo(n).slice(0, 10)

export const previewCalendarClasses: CalendarClass[] = [
  {
    id: 'cal-1', enrollmentId: 'enr-sketching', scheduledAt: daysAgo(2), day: dayKey(2),
    status: 'attended', childName: 'Aarav', categoryName: 'Sketching', trainerName: 'Priya Menon',
    parentName: 'Anitha Rao', parentArea: 'Kammanahalli',
    assessmentNote: 'Best session yet.', skillRating: 4, focusAreas: ['foreshortening'],
    ratePerClass: 50_000, missed: false,
  },
  {
    id: 'cal-2', enrollmentId: 'enr-sketching', scheduledAt: daysAhead(5), day: dayKey(-5),
    status: 'scheduled', childName: 'Aarav', categoryName: 'Sketching', trainerName: 'Priya Menon',
    parentName: 'Anitha Rao', parentArea: 'Kammanahalli',
    assessmentNote: null, skillRating: null, focusAreas: [],
    ratePerClass: 50_000, missed: false,
  },
]

/* ------------------------------------------------------------------ trainer */

const session = (
  id: string,
  childName: string,
  scheduledAt: string,
  categoryName = 'Carnatic vocal',
): SessionRow => ({
  id,
  enrollmentId: 'enr-vocal-ishaan',
  scheduledAt,
  status: 'scheduled',
  markedAt: null,
  assessmentNote: null,
  skillRating: null,
  focusAreas: [],
  childName,
  categoryName,
  parentName: 'Vikram Shetty',
  parentArea: 'Indiranagar',
  ratePerClass: 80_000,
  commissionPct: '15.00',
})

export const previewToday: SessionRow[] = [
  session('t-1', 'Ishaan', daysAhead(0)),
  session('t-2', 'Meher', daysAhead(0, 19), 'Carnatic vocal'),
]

export const previewOverdue: SessionRow[] = [session('o-1', 'Rehan', daysAgo(2, 17))]

export const previewUpcoming: SessionRow[] = [
  session('u-1', 'Ishaan', daysAhead(7)),
  session('u-2', 'Meher', daysAhead(7, 19)),
  session('u-3', 'Ishaan', daysAhead(14)),
]

export const previewOpenEnquiries: EnquiryRow[] = [
  {
    id: 'enq-1',
    status: 'open',
    message: 'Aarav has been sketching all term and now wants to sing. Weekends work best for us.',
    createdAt: daysAgo(0, 9),
    respondedAt: null,
    childId: 'child-aarav',
    childName: 'Aarav',
    childAge: 9,
    categoryId: 'cat-vocal',
    categoryName: 'Carnatic vocal',
    parentId: 'p-anitha',
    parentName: 'Anitha Rao',
    parentArea: 'Kammanahalli',
    trainerId: 't-lakshmi',
    trainerName: 'Lakshmi Narayanan',
    trainerArea: 'Kalyan Nagar',
    ratePerClass: 80_000,
    enrollmentId: null,
    enrollmentStatus: null,
  },
]

export const previewTrainerBalance = 204_000

/* ------------------------------------------------------------------ admin */

export const previewServices: ActiveService[] = [
  {
    enrollmentId: 'enr-sketching',
    childName: 'Aarav',
    parentName: 'Anitha Rao',
    parentPhone: '+919876500001',
    trainerName: 'Priya Menon',
    trainerPhone: '+919876510005',
    categoryName: 'Sketching',
    areaLabel: 'HRBR Layout',
    status: 'active',
    startDate: daysAgo(30).slice(0, 10),
    ratePerClass: 50_000,
    classesPerMonth: 8,
    classesDelivered: 5,
    classesRemaining: 3,
    committed: 400_000,
    stillInEscrow: 150_000,
    releasedToTrainer: 212_500,
    platformEarned: 37_500,
    lastClassAt: daysAgo(2),
    nextClassAt: daysAhead(5),
  },
  {
    enrollmentId: 'enr-vocal-ishaan',
    childName: 'Ishaan',
    parentName: 'Vikram Shetty',
    parentPhone: '+919876500002',
    trainerName: 'Lakshmi Narayanan',
    trainerPhone: '+919876510001',
    categoryName: 'Carnatic vocal',
    areaLabel: 'Kalyan Nagar',
    status: 'active',
    startDate: daysAgo(21).slice(0, 10),
    ratePerClass: 80_000,
    classesPerMonth: 8,
    classesDelivered: 3,
    classesRemaining: 5,
    committed: 640_000,
    stillInEscrow: 400_000,
    releasedToTrainer: 204_000,
    platformEarned: 36_000,
    lastClassAt: daysAgo(7),
    nextClassAt: daysAhead(0),
  },
  {
    // Stalled on purpose: money held, nothing happening against it. This is the row the
    // monitor exists to surface, so the preview has to contain one.
    enrollmentId: 'enr-football',
    childName: 'Rehan',
    parentName: 'Farah Qureshi',
    parentPhone: '+919876500003',
    trainerName: 'Suresh Gowda',
    trainerPhone: '+919876510006',
    categoryName: 'Football',
    areaLabel: 'CV Raman Nagar',
    status: 'active',
    startDate: daysAgo(40).slice(0, 10),
    ratePerClass: 60_000,
    classesPerMonth: 8,
    classesDelivered: 2,
    classesRemaining: 6,
    committed: 480_000,
    stillInEscrow: 360_000,
    releasedToTrainer: 102_000,
    platformEarned: 18_000,
    lastClassAt: daysAgo(18),
    nextClassAt: daysAgo(4),
  },
]

export const previewTotals = {
  platformRevenue: 91_500,
  totalHeld: 910_000,
  totalReleased: 518_500,
}

export const previewPendingCount = 2
