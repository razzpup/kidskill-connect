import { requireRole } from '@/lib/db/session'
import { trainerEnquiries } from '@/lib/db/trainer'
import { EnquiryInbox } from './EnquiryInbox'

export default async function TrainerEnquiriesPage() {
  const { userId } = await requireRole('trainer')
  const enquiries = await trainerEnquiries(userId)
  return <EnquiryInbox enquiries={enquiries} />
}
