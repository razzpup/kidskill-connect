import { supabaseServer } from '@/lib/supabase/server'
import { toPaise } from '@/lib/money'
import type { SearchResult } from './types'

export type ClassMode = 'either' | 'online' | 'in_person'

export interface SearchParams {
  lat: number
  lng: number
  categoryId?: string | null
  radiusKm?: number
  maxRatePaise?: number | null
  mode?: ClassMode
}

/**
 * The only way trainers are found. The RPC hard-filters on
 * `trainer_categories.status = 'approved'` and intersects the parent's radius with the
 * trainer's own `service_radius_km`, so a trainer who will travel 5 km never surfaces
 * to a parent 12 km away no matter how wide the slider is pushed.
 */
export async function searchTrainers(params: SearchParams): Promise<SearchResult[]> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc('search_trainers', {
    p_lat: params.lat,
    p_lng: params.lng,
    p_category_id: params.categoryId ?? null,
    p_radius_km: params.radiusKm ?? 10,
    p_max_rate: params.maxRatePaise != null ? params.maxRatePaise / 100 : null,
    p_mode: params.mode ?? 'either',
  })
  if (error) throw error

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    trainerId: r.trainer_id,
    fullName: r.full_name,
    headline: r.headline,
    avatarUrl: r.avatar_url,
    areaLabel: r.area_label,
    categoryId: r.category_id,
    categoryName: r.category_name,
    ratePerClass: toPaise(r.rate_per_class),
    yearsExperience: r.years_experience,
    idVerified: r.id_verified,
    teachesOnline: r.teaches_online,
    teachesInPerson: r.teaches_in_person,
    distanceKm: Number(r.distance_km),
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Distance from one point to a trainer's base, for the profile page. Reuses the search
 * RPC at a deliberately wide radius rather than duplicating the PostGIS expression, so
 * there is only ever one distance formula in the product.
 */
export async function distanceToTrainer(
  lat: number,
  lng: number,
  trainerId: string,
): Promise<number | null> {
  const rows = await searchTrainers({ lat, lng, radiusKm: 50 })
  const hit = rows.find((r) => r.trainerId === trainerId)
  return hit?.distanceKm ?? null
}
