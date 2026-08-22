import Link from 'next/link'
import { ArrowIcon, GridIcon, ShieldIcon, SpineIcon } from '@/components/ui'

/**
 * The front end, openable on its own.
 *
 * Every screen below renders from `lib/fixtures.ts` — no database, no auth, no Docker.
 * The components are the real ones, so what you see here is what renders against live
 * data; only the source of the props differs. This exists so the structure can be
 * reviewed without a backend that can be down.
 */
export default function PreviewIndex() {
  return (
    <main className="theme-light min-h-dvh bg-paper text-ink">
      <div className="mx-auto w-full max-w-[46rem] px-6 py-14">
        <p className="eyebrow">KidSkill Connect</p>
        <h1 className="display mt-3 text-[2.25rem] font-extrabold leading-[1.05]">
          Every screen, no backend
        </h1>
        <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted">
          The three dashboards rendered from fixtures. Same components as the live app —
          you can open these with Docker off and nothing signed in.
        </p>

        <div className="mt-9 space-y-3">
          <Card
            href="/preview/parent"
            eyebrow="Parent · light surface"
            title="Progress spine"
            body="The child's documented skill history, newest first, with the money strip above it. The rail thickens as the skill rating rises."
            icon={<SpineIcon className="h-[1.15rem] w-[1.15rem]" />}
          />
          <Card
            href="/preview/trainer"
            eyebrow="Trainer · dark surface"
            title="Today"
            body="The money screen. Today's classes as large tap targets, unmarked classes flagged, and an incoming request from a parent waiting to be answered."
            icon={<GridIcon className="h-[1.15rem] w-[1.15rem]" />}
          />
          <Card
            href="/preview/admin"
            eyebrow="Admin · dark surface"
            title="Active services"
            body="Every running service, one row each, with three money columns that always sum to the committed amount — and a stalled service flagged at the top."
            icon={<ShieldIcon className="h-[1.15rem] w-[1.15rem]" />}
          />
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-[var(--card)] p-5">
          <p className="text-[0.875rem] font-semibold">Want the real thing?</p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">
            <Link href="/sign-in" className="text-grass underline underline-offset-2">
              Sign in
            </Link>{' '}
            runs the full app against Supabase — live search, real escrow, and the release
            trigger firing across devices. It needs Docker and{' '}
            <code className="text-[0.8125rem]">npx supabase start</code>.
          </p>
        </div>
      </div>
    </main>
  )
}

function Card({
  href,
  eyebrow,
  title,
  body,
  icon,
}: {
  href: string
  eyebrow: string
  title: string
  body: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-line bg-[var(--card)] p-5 transition hover:border-grass"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-grass-wash text-grass">
          {icon}
        </span>
        <span className="eyebrow">{eyebrow}</span>
        <ArrowIcon className="ml-auto h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-grass" />
      </div>
      <p className="display mt-3.5 text-[1.375rem] font-bold leading-none">{title}</p>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">{body}</p>
    </Link>
  )
}
