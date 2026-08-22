import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/db/session'
import { supabaseServer } from '@/lib/supabase/server'
import { listChildren, myLocation, trainerDetail } from '@/lib/db/parent'
import { distanceToTrainer } from '@/lib/db/search'
import { ApprovedBadge, Money, PinIcon, ShieldIcon } from '@/components/ui'
import { Avatar } from '../../search/SearchScreen'
import { EnquiryComposer } from './EnquiryComposer'

export default async function TrainerProfilePage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ category?: string; child?: string }>
}) {
  const { userId } = await requireRole('parent')
  const { id } = await props.params
  const searchParams = await props.searchParams

  const trainer = await trainerDetail(id)
  if (!trainer) notFound()

  const supabase = await supabaseServer()
  const [loc, children] = await Promise.all([myLocation(), listChildren(userId)])

  const distance = loc ? await distanceToTrainer(loc.lat, loc.lng, id) : null

  const { data: openEnquiries } = await supabase
    .from('enquiries')
    .select('id, category_id, child_id, status')
    .eq('parent_id', userId)
    .eq('trainer_id', id)
    .in('status', ['open', 'accepted'])

  const selectedCategory =
    trainer.categories.find((c) => c.categoryId === searchParams.category) ?? trainer.categories[0]

  return (
    <>
      <Link
        href="/parent/search"
        className="mb-5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition hover:text-ink"
      >
        ← Back to search
      </Link>

      <header className="flex gap-4">
        <Avatar name={trainer.fullName} size={62} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="display truncate text-[1.5rem] font-extrabold leading-tight">
              {trainer.fullName}
            </h1>
            {trainer.idVerified && <ShieldIcon className="h-4 w-4 shrink-0 text-grass" />}
          </div>
          <p className="mt-1 text-[0.9375rem] leading-snug text-muted">{trainer.headline}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
            <span className="inline-flex items-center gap-1">
              <PinIcon className="h-3.5 w-3.5" />
              {trainer.areaLabel}
            </span>
            {distance != null && (
              <span className="num font-semibold text-ink">{distance.toFixed(1)} km away</span>
            )}
            <span className="num">{trainer.yearsExperience} years teaching</span>
          </div>
        </div>
      </header>

      {/* The vetting is the product's trust argument, so it is shown, not summarised. */}
      <section className="mt-7">
        <p className="eyebrow mb-3">Approved to teach</p>
        <ul className="space-y-2">
          {trainer.categories.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-line bg-[var(--card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <ApprovedBadge>{c.categoryName}</ApprovedBadge>
                <div className="text-right">
                  <Money paise={c.ratePerClass} />
                  <p className="eyebrow mt-0.5">per class</p>
                </div>
              </div>
              {c.credentialNote && (
                <p className="mt-3 border-t border-line pt-3 text-[0.8125rem] leading-relaxed text-muted">
                  <span className="font-semibold text-ink">Credential checked · </span>
                  {c.credentialNote}
                </p>
              )}
            </li>
          ))}
        </ul>
        {trainer.categories.length === 0 && (
          <p className="text-[0.9375rem] text-muted">
            This trainer has no approved categories yet, so they cannot take enquiries.
          </p>
        )}
      </section>

      {trainer.bio && (
        <section className="mt-7">
          <p className="eyebrow mb-2">How they teach</p>
          <p className="text-[0.9375rem] leading-[1.65]">{trainer.bio}</p>
        </section>
      )}

      <section className="mt-7">
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          Travels up to{' '}
          <span className="num font-semibold text-ink">{trainer.serviceRadiusKm} km</span> from{' '}
          {trainer.areaLabel}.
        </p>
      </section>

      {selectedCategory && children.length > 0 && (
        <EnquiryComposer
          trainerId={trainer.id}
          trainerName={trainer.fullName}
          categories={trainer.categories}
          initialCategoryId={selectedCategory.categoryId}
          childrenList={children}
          initialChildId={searchParams.child ?? children[0].id}
          existing={(openEnquiries ?? []).map((e) => ({
            categoryId: e.category_id as string,
            childId: e.child_id as string,
            status: e.status as string,
          }))}
        />
      )}

      {selectedCategory && children.length === 0 && (
        <>
          <div className="h-24" />
          <div className="fixed inset-x-0 bottom-[4.25rem] z-20 border-t border-line bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] px-5 py-3 backdrop-blur">
            <div className="mx-auto max-w-[42rem]">
              <Link
                href="/parent/children/new"
                className="flex w-full items-center justify-center rounded-xl bg-grass px-5 text-base font-semibold text-white py-3.5"
              >
                Add a child to send a request
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
