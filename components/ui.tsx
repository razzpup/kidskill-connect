import Link from 'next/link'
import { formatRupees, type Paise } from '@/lib/money'

/* ------------------------------------------------------------------ money */

/**
 * Every rupee figure in the product renders through here. Marigold is reserved for
 * money and this is the only component that reaches for it, which is what keeps that
 * rule true as the app grows rather than merely intended.
 */
export function Money({
  paise,
  size = 'md',
  tone = 'marigold',
  sign = false,
  className = '',
}: {
  paise: Paise
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: 'marigold' | 'ink' | 'muted'
  sign?: boolean
  className?: string
}) {
  const sizes = {
    sm: 'text-[0.8125rem]',
    md: 'text-[0.9375rem]',
    lg: 'text-xl',
    xl: 'text-[2rem] leading-none',
  }
  const tones = {
    marigold: 'text-marigold',
    ink: 'text-ink',
    muted: 'text-muted',
  }
  return (
    <span className={`num font-semibold ${sizes[size]} ${tones[tone]} ${className}`}>
      {formatRupees(paise, { sign })}
    </span>
  )
}

/* ------------------------------------------------------------------ skill */

/**
 * Skill 1–5 as a rising level, not stars. Stars are a verdict on a person; this is a
 * reading of where a child currently is, which is a different thing and should not
 * borrow the same shape.
 */
export function SkillMeter({ value, label = true }: { value: number; label?: boolean }) {
  const heights = [7, 10, 13, 16, 19]
  return (
    <span className="inline-flex items-end gap-[3px]" title={`Skill ${value} of 5`}>
      {heights.map((h, i) => (
        <span
          key={i}
          aria-hidden
          className="w-[3px] rounded-full transition-colors"
          style={{
            height: h,
            background: i < value ? 'var(--grass)' : 'var(--line)',
          }}
        />
      ))}
      {label && (
        <span className="num ml-1.5 text-[0.75rem] font-semibold text-muted">{value}/5</span>
      )}
      <span className="sr-only">Skill {value} out of 5</span>
    </span>
  )
}

/* ------------------------------------------------------------------ chips */

export function Chip({
  children,
  tone = 'quiet',
  className = '',
}: {
  children: React.ReactNode
  tone?: 'quiet' | 'grass' | 'outline' | 'alert'
  className?: string
}) {
  const tones = {
    quiet: 'bg-[var(--paper)] text-muted border-transparent',
    grass: 'bg-grass-wash text-grass border-transparent',
    outline: 'bg-transparent text-muted border-line',
    alert: 'bg-alert-wash text-alert border-transparent',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[0.75rem] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** The approved-category badge. It is the barrier to entry made visible. */
export function ApprovedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-grass-wash px-2.5 py-1 text-[0.75rem] font-semibold text-grass">
      <CheckIcon className="h-3 w-3" />
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ buttons */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.985]'

const BUTTON_SIZES = {
  sm: 'h-9 px-3.5 text-[0.8125rem]',
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-14 px-6 text-base',
}

const BUTTON_TONES = {
  primary: 'bg-grass text-white hover:brightness-110',
  ghost: 'bg-transparent text-ink hover:bg-[var(--paper)]',
  outline: 'border border-line bg-[var(--card)] text-ink hover:border-[var(--muted)]',
  danger: 'border border-alert bg-transparent text-alert hover:bg-alert-wash',
}

export function buttonClass(
  tone: keyof typeof BUTTON_TONES = 'primary',
  size: keyof typeof BUTTON_SIZES = 'md',
  extra = '',
) {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_TONES[tone]} ${extra}`
}

export function LinkButton({
  href,
  children,
  tone = 'primary',
  size = 'md',
  className = '',
}: {
  href: string
  children: React.ReactNode
  tone?: keyof typeof BUTTON_TONES
  size?: keyof typeof BUTTON_SIZES
  className?: string
}) {
  return (
    <Link href={href} className={buttonClass(tone, size, className)}>
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------------ layout */

export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <As className={`rounded-2xl border border-line bg-[var(--card)] ${className}`}>{children}</As>
  )
}

/** Empty screens are an invitation to act, never an apology. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="display text-[1.0625rem] font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-[38ch] text-[0.9375rem] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: string
  title: string
  aside?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="display text-[1.375rem] font-bold">{title}</h2>
      </div>
      {aside}
    </div>
  )
}

/* ------------------------------------------------------------------ dates */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDay(iso: string): { day: string; month: string; year: string } {
  const d = new Date(iso)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: MONTHS[d.getMonth()],
    year: String(d.getFullYear()),
  }
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}.${m}${suffix}`
}

export function relativeDay(iso: string): string {
  const then = new Date(iso)
  const now = new Date()
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86_400_000,
  )
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days === -1) return 'Tomorrow'
  if (days > 0 && days < 7) return `${days} days ago`
  if (days < 0 && days > -7) return `In ${-days} days`
  const { day, month } = formatDay(iso)
  return `${day} ${month}`
}

/* ------------------------------------------------------------------ icons
   Hand-drawn, inline, sized in em so they scale with their label. Nothing here
   needs an icon library and a library would ship 40kb to draw nine shapes. */

type IconProps = { className?: string }

export function CheckIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M3 8.5 6.2 11.5 13 4.5" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PinIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M8 14.5S13 10.2 13 6.6A5 5 0 0 0 3 6.6C3 10.2 8 14.5 8 14.5Z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function ClockIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.6V8l2.4 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ArrowIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M3.5 8h9m0 0L9 4.5M12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SearchIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="7.2" cy="7.2" r="4.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.8 10.8 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SpineIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M8 2v12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4" r="1.6" fill="currentColor" />
      <circle cx="8" cy="8.4" r="1.6" fill="currentColor" />
      <circle cx="8" cy="12.6" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function ChatIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M2.6 7.4c0-2.5 2.4-4.4 5.4-4.4s5.4 1.9 5.4 4.4-2.4 4.4-5.4 4.4c-.6 0-1.2-.07-1.7-.2L3.2 13l.7-2.1a4.1 4.1 0 0 1-1.3-3.5Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function WalletIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="2" y="4" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="10" r="1" fill="currentColor" />
    </svg>
  )
}

export function ShieldIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M8 1.8 13 3.6v4.1c0 3.1-2.1 5.6-5 6.5-2.9-.9-5-3.4-5-6.5V3.6L8 1.8Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.8 8 7.3 9.5 10.4 6.4" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GridIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function CalendarIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="2" y="3.2" width="12" height="10.8" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.6h12M5.4 1.9v2.6M10.6 1.9v2.6" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" />
      <circle cx="5.6" cy="9.4" r="0.9" fill="currentColor" />
      <circle cx="8" cy="9.4" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function LedgerIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="2" width="11" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.4 5.6h5.2M5.4 8h5.2M5.4 10.4h3" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" />
    </svg>
  )
}

export function MusicIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M6.2 11.4V3.6l6.2-1.2v7.4" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4.6" cy="11.4" r="1.9" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10.8" cy="9.8" r="1.9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function DanceIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6v4.2M8 8.8 4.4 6.2M8 8.8l4-1.4M8 8.8 5.2 14M8 8.8l3.4 4.6"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SportsIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 2v12M2.6 5.6h10.8M2.6 10.4h10.8" stroke="currentColor" strokeWidth="1.2"
            strokeLinecap="round" />
    </svg>
  )
}
