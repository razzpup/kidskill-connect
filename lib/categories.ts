/**
 * The searchable category list, static on purpose — anon has zero DB grants (see
 * supabase/migrations/0003_grants.sql), so any page reachable before sign-in has to work
 * from a hardcoded mirror of `categories` rather than a live query. Keep in sync with the
 * seed rows in supabase/migrations/0001_init.sql.
 */
export const ALL_CATEGORIES: { slug: string; name: string; group: string }[] = [
  { slug: 'carnatic-vocal', name: 'Carnatic vocal', group: 'music' },
  { slug: 'hindustani-vocal', name: 'Hindustani vocal', group: 'music' },
  { slug: 'western-guitar', name: 'Western guitar', group: 'music' },
  { slug: 'keyboard-piano', name: 'Keyboard & piano', group: 'music' },
  { slug: 'bharatanatyam', name: 'Bharatanatyam', group: 'dance' },
  { slug: 'hip-hop-dance', name: 'Hip-hop dance', group: 'dance' },
  { slug: 'swimming', name: 'Swimming', group: 'sports' },
  { slug: 'football', name: 'Football', group: 'sports' },
  { slug: 'cricket', name: 'Cricket', group: 'sports' },
  { slug: 'badminton', name: 'Badminton', group: 'sports' },
  { slug: 'chess', name: 'Chess', group: 'life_skills' },
  { slug: 'sketching', name: 'Sketching', group: 'arts' },
]

/** Section order for the category groups — the three named in the brief, then the rest. */
export const GROUP_ORDER = ['music', 'dance', 'sports', 'arts', 'life_skills'] as const

export const GROUP_META: Record<string, { label: string; emoji: string }> = {
  music: { label: 'Music', emoji: '🎵' },
  dance: { label: 'Dance', emoji: '💃' },
  sports: { label: 'Sports', emoji: '⚽' },
  arts: { label: 'Arts', emoji: '🎨' },
  life_skills: { label: 'Life skills', emoji: '♟️' },
}

export const CATEGORY_EMOJI: Record<string, string> = {
  'carnatic-vocal': '🎤',
  'hindustani-vocal': '🎶',
  'western-guitar': '🎸',
  'keyboard-piano': '🎹',
  bharatanatyam: '💃',
  'hip-hop-dance': '🕺',
  swimming: '🏊',
  football: '⚽',
  cricket: '🏏',
  badminton: '🏸',
  chess: '♟️',
  sketching: '🎨',
}
