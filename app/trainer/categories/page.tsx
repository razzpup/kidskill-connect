import { requireRole } from '@/lib/db/session'
import { listCategories, trainerBookedSlots } from '@/lib/db/parent'
import { trainerBlockedSlots, trainerCategories } from '@/lib/db/trainer'
import { AvailabilityEditor } from '@/components/AvailabilityEditor'
import { CategoryManager } from './CategoryManager'

export default async function TrainerCategoriesPage() {
  const { userId } = await requireRole('trainer')
  const [mine, all, booked, blocked] = await Promise.all([
    trainerCategories(userId),
    listCategories(),
    trainerBookedSlots(userId),
    trainerBlockedSlots(userId),
  ])

  return (
    <>
      <CategoryManager mine={mine} all={all} />

      <section className="mt-12">
        <p className="eyebrow mb-1">Weekly availability</p>
        <h2 className="display text-[1.375rem] font-bold leading-none">When you're free</h2>
        <p className="mt-2 max-w-[52ch] text-[0.8125rem] leading-relaxed text-muted">
          A parent sees this grid before they send an enquiry, so they only ever ask for
          a slot you're actually free for.
        </p>
        <div className="mt-4">
          <AvailabilityEditor booked={booked} initialBlocked={blocked} />
        </div>
      </section>
    </>
  )
}
