import Link from 'next/link'
import { requireRole } from '@/lib/db/session'
import { parentEnquiries } from '@/lib/db/parent'
import { Chip, EmptyState, LinkButton, relativeDay } from '@/components/ui'
import { LiveSection } from '@/components/LiveSection'

const TONE: Record<string, { tone: 'quiet' | 'grass' | 'outline' | 'alert'; label: string }> = {
  open: { tone: 'outline', label: 'Waiting on the coach' },
  accepted: { tone: 'grass', label: 'Accepted' },
  declined: { tone: 'alert', label: 'Declined' },
  withdrawn: { tone: 'quiet', label: 'Withdrawn' },
}

export default async function ParentEnquiriesPage() {
  const { userId } = await requireRole('parent')
  const enquiries = await parentEnquiries(userId)

  return (
    <LiveSection tables={['enquiries', 'enrollments']}>
      <h1 className="display text-[1.75rem] font-extrabold leading-none">Enquiries</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">
        You send these. Coaches never approach you.
      </p>

      <div className="mt-6">
        {enquiries.length === 0 ? (
          <EmptyState
            title="No enquiries yet"
            body="Search for a skill your child wants to learn, open a coach, and send one. Nothing is charged until a coach accepts and you choose to pay."
            action={<LinkButton href="/parent/search">Find a coach</LinkButton>}
          />
        ) : (
          <ul className="space-y-2.5">
            {enquiries.map((e) => {
              const tone = TONE[e.status] ?? TONE.open
              const needsPayment = e.enrollmentStatus === 'pending_payment'
              return (
                <li
                  key={e.id}
                  className="rounded-2xl border border-line bg-[var(--card)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-semibold">
                        {e.categoryName} for {e.childName}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">
                        {e.trainerName} · {e.trainerArea}
                      </p>
                    </div>
                    <Chip tone={tone.tone}>{tone.label}</Chip>
                  </div>

                  {e.message && (
                    <p className="mt-3 border-l-2 border-line pl-3 text-[0.875rem] leading-relaxed text-muted">
                      {e.message}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[0.75rem] text-muted">
                      Sent {relativeDay(e.createdAt)}
                    </span>
                    {needsPayment && (
                      <Link
                        href={`/parent/pay/${e.enrollmentId}`}
                        className="text-[0.8125rem] font-semibold text-grass underline underline-offset-2"
                      >
                        Pay to start →
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </LiveSection>
  )
}
