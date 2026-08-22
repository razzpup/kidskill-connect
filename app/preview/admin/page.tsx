import { ActiveServicesMonitor } from '@/app/admin/ActiveServicesMonitor'
import { previewPendingCount, previewServices, previewTotals } from '@/lib/fixtures'
import { PreviewChrome } from '../PreviewChrome'

export default function PreviewAdmin() {
  return (
    <PreviewChrome surface="dark">
      <main className="min-h-dvh bg-paper text-ink">
        <div className="mx-auto w-full max-w-[84rem] px-5 pb-24 pt-7">
          <ActiveServicesMonitor
            services={previewServices}
            totals={previewTotals}
            pendingCount={previewPendingCount}
          />
        </div>
      </main>
    </PreviewChrome>
  )
}
