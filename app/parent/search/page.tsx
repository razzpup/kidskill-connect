import { requireRole } from '@/lib/db/session'
import { listCategories, listChildren, myLocation } from '@/lib/db/parent'
import { SearchScreen } from './SearchScreen'

/**
 * One screen. Category chips and a distance slider, results updating live — no submit
 * button, no filter page, no results page to navigate to.
 */
export default async function SearchPage() {
  const { userId, profile } = await requireRole('parent')

  // Location was captured once at onboarding; this reads it back rather than asking.
  const [loc, categories, children] = await Promise.all([
    myLocation(),
    listCategories(),
    listChildren(userId),
  ])

  return (
    <SearchScreen
      categories={categories}
      childrenList={children}
      initialPoint={loc ? { lat: loc.lat, lng: loc.lng } : null}
      areaLabel={loc?.areaLabel ?? profile.area_label ?? null}
    />
  )
}
