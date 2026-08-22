import { requireRole } from '@/lib/db/session'
import { listCategories } from '@/lib/db/parent'
import { trainerCategories } from '@/lib/db/trainer'
import { CategoryManager } from './CategoryManager'

export default async function TrainerCategoriesPage() {
  const { userId } = await requireRole('trainer')
  const [mine, all] = await Promise.all([trainerCategories(userId), listCategories()])
  return <CategoryManager mine={mine} all={all} />
}
