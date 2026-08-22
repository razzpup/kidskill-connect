import { ParentHome } from '@/app/parent/ParentHome'
import {
  previewCalendarClasses,
  previewChildren,
  previewEnrollments,
  previewSpine,
  previewStrip,
} from '@/lib/fixtures'
import { PreviewChrome } from '../PreviewChrome'

export default function PreviewParent() {
  const now = new Date()
  return (
    <PreviewChrome surface="light">
      <main className="min-h-dvh bg-paper text-ink">
        <div className="mx-auto w-full max-w-[76rem] px-6 pb-16 pt-8">
          <ParentHome
            parentId="p-anitha"
            childrenList={previewChildren}
            selectedId="child-aarav"
            entries={previewSpine}
            strip={previewStrip}
            enrollments={previewEnrollments}
            calendarClasses={previewCalendarClasses}
            calendarYear={now.getFullYear()}
            calendarMonth={now.getMonth()}
          />
        </div>
      </main>
    </PreviewChrome>
  )
}
