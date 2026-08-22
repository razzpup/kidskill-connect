/**
 * PostgREST embed fragments for the one join in this schema that is not obvious.
 *
 * `enrollments.trainer_id`, `enquiries.trainer_id` and `trainer_categories.trainer_id`
 * all reference `trainer_profiles(user_id)` — not `profiles(id)`. That is correct: a
 * trainer must have a trainer profile before any of those rows can exist. But it means
 * a trainer's *name* is two hops away, and the second hop has to name its foreign key
 * explicitly, because `trainer_profiles.user_id` takes part in four relationships and
 * PostgREST refuses to guess between them.
 *
 * Writing `trainer:trainer_id ( full_name )` looks right and fails at runtime with
 * "column trainer_profiles_1.full_name does not exist". Keeping the fragments here
 * means that mistake is made once and fixed once.
 */

/** Trainer's public identity, embedded from a table whose trainer_id points at trainer_profiles. */
export const TRAINER_NAME = 'trainer:trainer_id ( profiles!trainer_profiles_user_id_fkey ( full_name ) )'

/** As above, plus the area a trainer works out of. */
export const TRAINER_NAME_AREA =
  'trainer:trainer_id ( profiles!trainer_profiles_user_id_fkey ( full_name, area_label ) )'

/** As above, plus the avatar, for screens that show the trainer as a person. */
export const TRAINER_IDENTITY =
  'trainer:trainer_id ( profiles!trainer_profiles_user_id_fkey ( full_name, avatar_url, area_label ) )'

/** Embedded from `trainer_profiles` itself, where the same ambiguity applies. */
export const OWN_PROFILE = 'profiles!trainer_profiles_user_id_fkey ( full_name, avatar_url, area_label )'

/** As above, for screens that need the name and area but not a picture. */
export const OWN_PROFILE_NAME_AREA = 'profiles!trainer_profiles_user_id_fkey ( full_name, area_label )'

/**
 * Unwraps whichever of the above produced a row. Every fragment nests the person one
 * level deeper than it reads, so this keeps that shape in one place too.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function trainerPerson(row: any): {
  full_name: string
  area_label: string | null
  avatar_url: string | null
} {
  const p = row?.trainer?.profiles ?? row?.profiles ?? {}
  return {
    full_name: p.full_name ?? '—',
    area_label: p.area_label ?? null,
    avatar_url: p.avatar_url ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
