import { TrainerHome } from '@/app/trainer/TrainerHome'
import {
  previewOpenEnquiries,
  previewOverdue,
  previewToday,
  previewTrainerBalance,
  previewTrainerCalendar,
  previewUpcoming,
} from '@/lib/fixtures'
import { PreviewChrome } from '../PreviewChrome'

export default function PreviewTrainer() {
  const now = new Date()
  return (
    <PreviewChrome surface="dark">
      <main className="min-h-dvh bg-paper text-ink">
        <div className="mx-auto w-full max-w-[64rem] px-5 pb-24 pt-7">
          <TrainerHome
            firstName="Lakshmi"
            today={previewToday}
            overdue={previewOverdue}
            upcoming={previewUpcoming}
            balance={previewTrainerBalance}
            openEnquiries={previewOpenEnquiries}
            calendarClasses={previewTrainerCalendar}
            calendarYear={now.getFullYear()}
            calendarMonth={now.getMonth()}
          />
        </div>
      </main>
    </PreviewChrome>
  )
}
