import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="theme-light grid min-h-dvh place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-[26rem]">
        <p className="eyebrow">Not found</p>
        <h1 className="display mt-3 text-[1.75rem] font-extrabold leading-tight">
          There&apos;s nothing at this address
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          The link may be out of date, or it may belong to someone else&apos;s account.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-grass px-6 font-semibold text-white transition hover:brightness-110"
        >
          Back to your home screen
        </Link>
      </div>
    </div>
  )
}
