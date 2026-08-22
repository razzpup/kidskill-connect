import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/db/session'
import { sessionDetail } from '@/lib/db/parent'
import { supabaseServer } from '@/lib/supabase/server'
import { toPaise } from '@/lib/money'
import { Chip, Money, SkillMeter, formatDay, formatTime } from '@/components/ui'
import { Avatar } from '../../search/SearchScreen'
import { FeedbackBox } from './FeedbackBox'

export default async function SessionPage(props: { params: Promise<{ id: string }> }) {
  const { userId } = await requireRole('parent')
  const { id } = await props.params

  const session = await sessionDetail(id)
  if (!session) notFound()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const e = (session as any).enrollments
  const date = formatDay((session as any).attendance_marked_at ?? (session as any).scheduled_at)

  const supabase = await supabaseServer()
  const { data: existing } = await supabase
    .from('feedback')
    .select('rating, comment')
    .eq('session_id', id)
    .eq('author_id', userId)
    .maybeSingle()

  const { data: ledger } = await supabase
    .from('ledger_entries')
    .select('type, amount')
    .eq('session_id', id)

  const released = (ledger ?? [])
    .filter((l) => l.type === 'release')
    .reduce((s, l) => s + toPaise(l.amount as string), 0)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <>
      <Link
        href="/parent"
        className="mb-5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition hover:text-ink"
      >
        ← Back to the spine
      </Link>

      <header>
        <p className="eyebrow">{e?.categories?.name}</p>
        <h1 className="display mt-2 text-[1.75rem] font-extrabold leading-none">
          <span className="num">
            {date.day} {date.month}
          </span>
          <span className="ml-2 text-muted">{date.year}</span>
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted">
          {formatTime((session as { scheduled_at: string }).scheduled_at)} · {e?.children?.name}
        </p>
      </header>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-[var(--card)] p-3.5">
        <Avatar name={e?.trainer?.full_name ?? '—'} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold">{e?.trainer?.full_name}</p>
          <p className="text-[0.8125rem] text-muted">{e?.trainer?.area_label}</p>
        </div>
        <SkillMeter value={(session as { skill_rating: number | null }).skill_rating ?? 0} />
      </div>

      <section className="mt-6">
        <p className="eyebrow mb-2.5">What they worked on</p>
        <p className="text-[1.0625rem] leading-[1.7]">
          {(session as { assessment_note: string | null }).assessment_note ??
            'No assessment recorded.'}
        </p>

        {((session as { focus_areas: string[] }).focus_areas ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(session as { focus_areas: string[] }).focus_areas.map((f) => (
              <Chip key={f} tone="outline">
                {f}
              </Chip>
            ))}
          </div>
        )}
      </section>

      {released > 0 && (
        <p className="mt-6 flex items-baseline justify-between border-t border-line pt-4 text-[0.8125rem] text-muted">
          <span>Released from escrow for this class</span>
          <Money paise={released} size="sm" />
        </p>
      )}

      <FeedbackBox
        sessionId={id}
        trainerName={e?.trainer?.full_name ?? 'your trainer'}
        existing={existing ? { rating: existing.rating as number, comment: (existing.comment as string) ?? '' } : null}
      />
    </>
  )
}
