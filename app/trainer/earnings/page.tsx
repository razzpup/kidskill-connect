import { requireRole } from '@/lib/db/session'
import { trainerEarnings } from '@/lib/db/trainer'
import { EmptyState, Money, formatDay } from '@/components/ui'
import { LiveSection } from '@/components/LiveSection'

export default async function EarningsPage() {
  const { userId } = await requireRole('trainer')
  const earnings = await trainerEarnings(userId)

  return (
    <LiveSection tables={['ledger_entries']}>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Balance</p>
          <p className="mt-2">
            <Money paise={earnings.balance} size="xl" />
          </p>
        </div>
        <dl className="flex gap-8 text-right">
          <div>
            <dt className="eyebrow mb-1.5">Classes paid</dt>
            <dd className="num text-lg font-semibold">{earnings.entries.length}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1.5">Commission</dt>
            <dd className="num text-lg font-semibold text-muted">
              −₹{new Intl.NumberFormat('en-IN').format(Math.round(earnings.commissionTotal / 100))}
            </dd>
          </div>
        </dl>
      </header>

      <p className="mt-4 max-w-[60ch] text-[0.875rem] leading-relaxed text-muted">
        Each line is one class you taught and assessed. Nothing here was paid on a schedule
        or an invoice — every rupee was released by a note you wrote.
      </p>

      <section className="mt-8">
        {earnings.entries.length === 0 ? (
          <EmptyState
            title="No earnings yet"
            body="Your first payment lands the moment you mark a class attended and write the assessment. Both, in one submit — that is what releases it."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-[var(--card)]">
            <table className="w-full min-w-[38rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <Th>Date</Th>
                  <Th>Child</Th>
                  <Th>Category</Th>
                  <Th align="right">Commission</Th>
                  <Th align="right">Net to you</Th>
                </tr>
              </thead>
              <tbody>
                {earnings.entries.map((e) => {
                  const d = formatDay(e.sessionAt ?? e.createdAt)
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <Td>
                        <span className="num text-muted">
                          {d.day} {d.month} {d.year}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-medium">{e.childName}</span>
                      </Td>
                      <Td>
                        <span className="text-muted">{e.categoryName}</span>
                      </Td>
                      <Td align="right">
                        <span className="num text-[0.875rem] text-muted">
                          −₹{new Intl.NumberFormat('en-IN').format(Math.round(e.commission / 100))}
                        </span>
                      </Td>
                      <Td align="right">
                        <Money paise={e.amount} size="sm" />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line">
                  <Td colSpan={3}>
                    <span className="eyebrow">Total released</span>
                  </Td>
                  <Td align="right">
                    <span className="num text-[0.875rem] text-muted">
                      −₹
                      {new Intl.NumberFormat('en-IN').format(
                        Math.round(earnings.commissionTotal / 100),
                      )}
                    </span>
                  </Td>
                  <Td align="right">
                    <Money paise={earnings.releasedTotal} />
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </LiveSection>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      scope="col"
      className="eyebrow px-4 py-3 font-semibold"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  colSpan,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className="px-4 py-3 text-[0.9375rem]" style={{ textAlign: align }}>
      {children}
    </td>
  )
}
