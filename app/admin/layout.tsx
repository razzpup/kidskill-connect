import { redirect } from 'next/navigation'
import { currentViewer, homeFor } from '@/lib/db/session'
import { DashboardNav } from '@/components/DashboardNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await currentViewer()
  if (!viewer) redirect('/sign-in')
  if (viewer.profile.role !== 'admin') redirect(homeFor(viewer.profile.role))

  return (
    <div className="theme-dark min-h-dvh bg-paper text-ink">
      <DashboardNav
        roleLabel="Admin"
        name={viewer.profile.full_name}
        items={[
          { href: '/admin', label: 'Active services' },
          { href: '/admin/approvals', label: 'Approvals' },
          { href: '/admin/ledger', label: 'Ledger' },
          { href: '/admin/enrollments', label: 'Enrollments' },
        ]}
      />
      <main className="mx-auto w-full max-w-[84rem] px-5 pb-20 pt-7">{children}</main>
    </div>
  )
}
