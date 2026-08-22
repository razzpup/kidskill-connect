import { supabaseServer } from '@/lib/supabase/server'
import { toPaise } from '@/lib/money'
import type { SessionStatus } from './types'

/**
 * Classes laid out by day, for the month grids on both dashboards.
 *
 * Days are keyed by their Bangalore calendar date rather than by UTC. A class at 9pm IST
 * is 15:30 UTC the same day, but one at 7am IST is the previous evening in UTC — key on
 * the wrong one and a class silently lands in the wrong square. Everyone in this product
 * is in one city, so the grid is built in that city's time.
 */

export const ZONE = 'Asia/Kolkata'

/** yyyy-mm-dd for an instant, in Bangalore time. */
export function dayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  // en-CA formats as yyyy-mm-dd, which sorts and compares as a string.
  return d.toLocaleDateString('en-CA', { timeZone: ZONE })
}

export interface CalendarClass {
  id: string
  enrollmentId: string
  scheduledAt: string
  /** yyyy-mm-dd in Bangalore time — the square this belongs in. */
  day: string
  status: SessionStatus
  childName: string
  categoryName: string
  trainerName: string
  parentName: string
  parentArea: string | null
  assessmentNote: string | null
  skillRating: number | null
  focusAreas: string[]
  ratePerClass: number
  /** True when it is in the past and still unmarked — money held, nothing recorded. */
  missed: boolean
}

interface Range {
  /** Inclusive, yyyy-mm-dd. */
  from: string
  /** Exclusive, yyyy-mm-dd. */
  to: string
}

/** The month a grid is showing, as a range that covers the whole visible span. */
export function monthRange(year: number, month: number): Range {
  const first = new Date(Date.UTC(year, month, 1))
  const next = new Date(Date.UTC(year, month + 1, 1))
  return { from: first.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function hydrate(rows: any[]): CalendarClass[] {
  const now = Date.now()
  return rows.map((r: any) => {
    const e = r.enrollments
    const scheduledAt = r.scheduled_at
    return {
      id: r.id,
      enrollmentId: r.enrollment_id,
      scheduledAt,
      day: dayKey(scheduledAt),
      status: r.status,
      childName: e?.children?.name ?? '—',
      categoryName: e?.categories?.name ?? '—',
      trainerName: e?.trainer?.profiles?.full_name ?? '—',
      parentName: e?.parent?.full_name ?? '—',
      parentArea: e?.parent?.area_label ?? null,
      assessmentNote: r.assessment_note,
      skillRating: r.skill_rating,
      focusAreas: r.focus_areas ?? [],
      ratePerClass: toPaise(e?.rate_per_class ?? '0'),
      missed: r.status === 'scheduled' && new Date(scheduledAt).getTime() < now,
    }
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SELECT = `
  id, enrollment_id, scheduled_at, status, assessment_note, skill_rating, focus_areas,
  enrollments:enrollment_id!inner (
    parent_id, trainer_id, rate_per_class,
    children:child_id ( name ),
    categories:category_id ( name ),
    parent:parent_id ( full_name, area_label ),
    trainer:trainer_id ( profiles!trainer_profiles_user_id_fkey ( full_name ) )
  )
`

/**
 * Every class across all of a parent's children. RLS already scopes sessions to the
 * parties on the enrollment, so the filter here is about the window, not about access.
 */
export async function parentCalendar(parentId: string, range: Range): Promise<CalendarClass[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('sessions')
    .select(SELECT)
    .eq('enrollments.parent_id', parentId)
    .gte('scheduled_at', range.from)
    .lt('scheduled_at', range.to)
    .order('scheduled_at')
  if (error) throw error
  return hydrate(data ?? [])
}

export async function trainerCalendar(trainerId: string, range: Range): Promise<CalendarClass[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('sessions')
    .select(SELECT)
    .eq('enrollments.trainer_id', trainerId)
    .gte('scheduled_at', range.from)
    .lt('scheduled_at', range.to)
    .order('scheduled_at')
  if (error) throw error
  return hydrate(data ?? [])
}
