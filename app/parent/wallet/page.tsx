import { requireRole } from '@/lib/db/session'
import { parentEnrollments, walletStrip } from '@/lib/db/parent'
import { Money, EmptyState, LinkButton, relativeDay } from '@/components/ui'
import { LiveSection } from '@/components/LiveSection'

export default async function WalletPage() {
  const { userId } = await requireRole('parent')
  const enrollments = await parentEnrollments(userId)
  const strip = walletStrip(enrollments)

  const active = enrollments.filter((e) => e.status === 'active')
  const closed = enrollments.filter((e) => e.status !== 'active' && e.status !== 'pending_payment')

  return (
    <LiveSection tables={['ledger_entries', 'enrollments']}>
      <h1 className="display text-[1.75rem] font-extrabold leading-none">Wallet</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        Every rupee here is either held for a class that hasn&apos;t happened yet, or already
        released to the person who taught it.
      </p>

      <div className="mt-6 flex divide-x divide-[var(--line)] overflow-hidden rounded-2xl border border-line bg-[var(--card)]">
        <div className="flex-1 px-4 py-4">
          <p className="eyebrow mb-1.5">Held in escrow</p>
          <Money paise={strip.heldInEscrow} size="xl" />
        </div>
        <div className="flex-1 px-4 py-4">
          <p className="eyebrow mb-1.5">Classes left</p>
          <p className="num text-[2rem] font-semibold leading-none">{strip.classesRemaining}</p>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing running yet"
            body="Once you pay for a month, it appears here — and you can watch it move from held to released, one class at a time."
            action={<LinkButton href="/parent/search">Find a trainer</LinkButton>}
          />
        </div>
      ) : (
        <section className="mt-8">
          <p className="eyebrow mb-3">Running</p>
          <ul className="space-y-2.5">
            {active.map((e) => (
              <li key={e.id} className="rounded-2xl border border-line bg-[var(--card)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.9375rem] font-semibold">
                      {e.categoryName} · {e.childName}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] text-muted">
                      {e.trainerName} · started{' '}
                      {e.startDate ? relativeDay(e.startDate) : 'recently'}
                    </p>
                  </div>
                  <p className="num shrink-0 text-[0.9375rem] font-semibold">
                    {e.classesDelivered}
                    <span className="text-muted">/{e.classesPerMonth}</span>
                  </p>
                </div>

                {/* The three columns must always sum to the committed amount. Drawing
                    them as one bar makes that visible rather than merely true. */}
                <MoneyBar
                  escrow={e.stillInEscrow}
                  released={e.releasedToTrainer}
                  platform={e.platformEarned}
                  total={e.committed}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow mb-3">Finished</p>
          <ul className="space-y-2">
            {closed.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-[var(--card)] px-4 py-3.5"
              >
                <div>
                  <p className="text-[0.9375rem] font-semibold">
                    {e.categoryName} · {e.childName}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted capitalize">{e.status}</p>
                </div>
                <Money paise={e.releasedToTrainer} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </LiveSection>
  )
}

function MoneyBar({
  escrow,
  released,
  platform,
  total,
}: {
  escrow: number
  released: number
  platform: number
  total: number
}) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

  return (
    <div className="mt-3.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <span style={{ width: `${pct(released)}%`, background: 'var(--grass)' }} />
        <span style={{ width: `${pct(platform)}%`, background: 'var(--muted)' }} />
        <span style={{ width: `${pct(escrow)}%`, background: 'var(--marigold)' }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
        <Legend color="var(--grass)" label="To trainer" value={released} />
        <Legend color="var(--muted)" label="Platform" value={platform} />
        <Legend color="var(--marigold)" label="Still held" value={escrow} />
      </div>
    </div>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
      <span className="num font-semibold text-ink">
        ₹{new Intl.NumberFormat('en-IN').format(Math.round(value / 100))}
      </span>
    </span>
  )
}
