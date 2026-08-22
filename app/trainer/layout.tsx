import { redirect } from 'next/navigation'
import { currentViewer, homeFor } from '@/lib/db/session'
import { DashboardNav } from '@/components/DashboardNav'

/**
 * The trainer surface is dark. It is lived in daily, it is dense, and it is mostly
 * numbers — the opposite of the parent app's job, so deliberately the opposite surface.
 */
export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await currentViewer()
  if (!viewer) redirect('/sign-in')
  if (viewer.profile.role !== 'trainer') redirect(homeFor(viewer.profile.role))

  return (
    <div className="theme-dark min-h-dvh bg-paper text-ink">
      <DashboardNav
        title="KidSkill"
        name={viewer.profile.full_name}
        items={[
          { href: '/trainer', label: 'Today' },
          { href: '/trainer/calendar', label: 'Calendar' },
          { href: '/trainer/enquiries', label: 'Enquiries' },
          { href: '/trainer/earnings', label: 'Earnings' },
          { href: '/trainer/categories', label: 'Categories' },
          { href: '/trainer/messages', label: 'Messages' },
        ]}
      />
      <main className="mx-auto w-full max-w-[64rem] px-5 pb-20 pt-7">{children}</main>
    </div>
  )
}
