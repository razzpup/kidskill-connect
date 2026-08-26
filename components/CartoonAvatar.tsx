/**
 * The fallback for a coach who hasn't uploaded a photo yet — deliberately a cartoon,
 * not initials-in-a-circle, and not a photo of a specific person. Deterministic per
 * name, so the same coach always gets the same face rather than a new one on every
 * render.
 */

const SKINS = ['#F0B429', '#FF6F59', '#4E9B72', '#2B2E86', '#E85A45', '#6B6E9B']
const HAIR = ['#252654', '#3A2A1D', '#1A2420', '#6B4226', '#2A312C']

function hashOf(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

export function CartoonAvatar({ seed, size = 44 }: { seed: string; size?: number }) {
  const h = hashOf(seed || 'coach')
  const bg = SKINS[h % SKINS.length]
  const hair = HAIR[(h >> 3) % HAIR.length]
  const style = (h >> 6) % 3 // 0 = cap, 1 = middle part, 2 = curly

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ background: bg }}
    >
      {/* face */}
      <circle cx="24" cy="27" r="12" fill="#FFE8E3" />
      {/* eyes */}
      <circle cx="19.5" cy="26" r="1.6" fill="#252654" />
      <circle cx="28.5" cy="26" r="1.6" fill="#252654" />
      {/* smile */}
      <path d="M19 31.5c1.6 2 8.4 2 10 0" stroke="#252654" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* hair, three simple styles for a little variety */}
      {style === 0 && <path d="M11 22a13 13 0 0 1 26 0c-4-2.5-9-3.5-13-3.5s-9 1-13 3.5Z" fill={hair} />}
      {style === 1 && (
        <path
          d="M24 13c-7 0-13 5-13 11 2-1 4-6 13-6s11 5 13 6c0-6-6-11-13-11Z"
          fill={hair}
        />
      )}
      {style === 2 && (
        <>
          <circle cx="14" cy="20" r="4.5" fill={hair} />
          <circle cx="20" cy="15.5" r="5" fill={hair} />
          <circle cx="28" cy="15.5" r="5" fill={hair} />
          <circle cx="34" cy="20" r="4.5" fill={hair} />
        </>
      )}
    </svg>
  )
}
