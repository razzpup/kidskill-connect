import { requireRole } from '@/lib/db/session'
import { childSpine, listChildren, parentEnrollments, walletStrip } from '@/lib/db/parent'
import { monthRange, parentCalendar } from '@/lib/db/calendar'
import { EmptyState, LinkButton } from '@/components/ui'
import { ParentHome } from './ParentHome'

export default async function ParentHomePage(props: {
  searchParams: Promise<{ child?: string }>
}) {
  const { userId } = await requireRole('parent')
  const searchParams = await props.searchParams

  const children = await listChildren(userId)
  if (children.length === 0) {
    return (
      <EmptyState
        title="Add a child to begin"
        body="The progress spine belongs to a child. Add one and every class a trainer records lands here."
        action={<LinkButton href="/parent/children/new">Add a child</LinkButton>}
      />
    )
  }

  const selected = children.find((c) => c.id === searchParams.child) ?? children[0]
  const now = new Date()
  const [entries, enrollments, classes] = await Promise.all([
    childSpine(selected.id),
    parentEnrollments(userId),
    parentCalendar(userId, monthRange(now.getFullYear(), now.getMonth())),
  ])
  const strip = walletStrip(enrollments, selected.id)

  return (
    <ParentHome
      parentId={userId}
      childrenList={children}
      selectedId={selected.id}
      entries={entries}
      strip={strip}
      enrollments={enrollments.filter((e) => e.childId === selected.id)}
      calendarClasses={classes}
      calendarYear={now.getFullYear()}
      calendarMonth={now.getMonth()}
    />
  )
}
