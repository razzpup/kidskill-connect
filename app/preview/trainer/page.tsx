import { TodayScreen } from '@/app/trainer/TodayScreen'
import {
  previewOpenEnquiries,
  previewOverdue,
  previewToday,
  previewTrainerBalance,
  previewUpcoming,
} from '@/lib/fixtures'
import { PreviewChrome } from '../PreviewChrome'

export default function PreviewTrainer() {
  return (
    <PreviewChrome surface="dark">
      <main className="min-h-dvh bg-paper text-ink">
        <div className="mx-auto w-full max-w-[64rem] px-5 pb-24 pt-7">
          <TodayScreen
            firstName="Lakshmi"
            today={previewToday}
            overdue={previewOverdue}
            upcoming={previewUpcoming}
            balance={previewTrainerBalance}
            openEnquiries={previewOpenEnquiries}
          />
        </div>
      </main>
    </PreviewChrome>
  )
}
