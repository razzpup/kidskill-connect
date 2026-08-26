import Link from 'next/link'
import { requireRole } from '@/lib/db/session'
import { adminLedger, platformTotals } from '@/lib/db/admin'
import { Chip, EmptyState, Money, formatDay, formatTime } from '@/components/ui'
import { LiveSection } from '@/components/LiveSection'

const TYPE_LABEL: Record<string, string> = {
  topup: 'Gateway → wallet',
  hold: 'Wallet → escrow',
  release: 'Escrow → coach',
  commission: 'Escrow → platform',
  refund: 'Escrow → wallet',
  payout: 'Coach → bank',
}

/**
 * Every row in `ledger_entries`, in the order they were written. This is the whole of
 * the financial truth — there is no balance column anywhere in the schema to compare it
 * against, because there is no balance stored anywhere.
 */
export default async function AdminLedgerPage(props: {
  searchParams: Promise<{ enrollment?: string }>
}) {
  await requireRole('admin')
  const { enrollment } = await props.searchParams

  const [rows, totals] = await Promise.all([adminLedger(enrollment), platformTotals()])

  return (
    <LiveSection tables={['ledger_entries']}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-none">Ledger</h1>
          <p className="mt-2 text-[0.9375rem] text-muted">
            {enrollment ? (
              <>
                Filtered to one enrollment ·{' '}
                <Link href="/admin/ledger" className="text-grass underline underline-offset-2">
                  show everything
                </Link>
              </>
            ) : (
              <>
                <span className="num font-semibold text-ink">{rows.length}</span> entries, newest
                first. Append only.
              </>
            )}
          </p>
        </div>

        <dl className="flex flex-wrap gap-7 text-right">
          <div>
            <dt className="eyebrow mb-1.5">Held</dt>
            <dd>
              <Money paise={totals.totalHeld} size="lg" />
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-1.5">Released</dt>
            <dd>
              <Money paise={totals.totalReleased} size="lg" />
            </dd>
          </div>
          <div>
            <dt className="eyebrow mb-1.5">Platform</dt>
            <dd>
              <Money paise={totals.platformRevenue} size="lg" />
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-8">
        {rows.length === 0 ? (
          <EmptyState
            title="No entries"
            body="The first rows are written when a parent funds a month: a topup and a hold, in one transaction."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-[var(--card)]">
            <table className="w-full min-w-[60rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>Movement</Th>
                  <Th>Service</Th>
                  <Th>Memo</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = formatDay(r.createdAt)
                  return (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <Td>
                        <span className="num whitespace-nowrap text-[0.8125rem] text-muted">
                          {d.day} {d.month} · {formatTime(r.createdAt)}
                        </span>
                      </Td>
                      <Td>
                        <Chip
                          tone={
                            r.type === 'release' ? 'grass' : r.type === 'refund' ? 'alert' : 'outline'
                          }
                        >
                          {r.type}
                        </Chip>
                      </Td>
                      <Td>
                        <span className="whitespace-nowrap text-[0.8125rem] text-muted">
                          {TYPE_LABEL[r.type] ?? `${r.fromType} → ${r.toType}`}
                        </span>
                      </Td>
                      <Td>
                        {r.childName ? (
                          <Link
                            href={`/admin/ledger?enrollment=${r.enrollmentId}`}
                            className="hover:text-grass"
                          >
                            {r.childName}
                            <span className="block text-[0.75rem] text-muted">
                              {r.categoryName} · {r.trainerName}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[0.8125rem] text-muted">{r.memo ?? '—'}</span>
                      </Td>
                      <Td align="right">
                        <Money paise={r.amount} size="sm" />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LiveSection>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th scope="col" className="eyebrow whitespace-nowrap px-3.5 py-3" style={{ textAlign: align }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className="px-3.5 py-3 align-top text-[0.875rem]" style={{ textAlign: align }}>
      {children}
    </td>
  )
}
