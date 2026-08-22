import { notFound, redirect } from 'next/navigation'
import { requireRole } from '@/lib/db/session'
import { enrollmentById } from '@/lib/db/parent'
import { PaymentScreen } from './PaymentScreen'

export default async function PayPage(props: { params: Promise<{ id: string }> }) {
  const { userId } = await requireRole('parent')
  const { id } = await props.params

  const enrollment = await enrollmentById(id)
  if (!enrollment || enrollment.parentId !== userId) notFound()
  if (enrollment.status !== 'pending_payment') redirect('/parent')

  return <PaymentScreen enrollment={enrollment} />
}
