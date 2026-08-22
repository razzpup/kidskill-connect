/**
 * Parents think in age, not birthdate, so every "add a child" form collects age and
 * converts it here. `children.dob` stays the column of record — `ageFromDob` (lib/db/parent.ts)
 * derives age back from it for display, and this is its inverse: same month/day as today
 * keeps that round trip exact.
 */
export function dobFromAge(age: number): string {
  const now = new Date()
  const dob = new Date(now.getFullYear() - age, now.getMonth(), now.getDate())
  return dob.toISOString().slice(0, 10)
}
