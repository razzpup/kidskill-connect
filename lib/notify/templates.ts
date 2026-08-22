/**
 * One template registry, used by both providers. The in-app thread renders `body` as a
 * WhatsApp-style message; Twilio sends the same string. When the sandbox is swapped for
 * a real WhatsApp Business number these become the pre-approved templates, so the copy
 * is written for that now rather than rewritten later.
 */

export type TemplateKey =
  | 'enquiry_received'
  | 'enquiry_accepted'
  | 'booking_confirmed'
  | 'enquiry_declined'
  | 'payment_confirmed'
  | 'enrollment_funded'
  | 'class_reminder'
  | 'class_completed'
  | 'feedback_request'
  | 'identity_verified'
  | 'identity_rejected'
  | 'category_approved'
  | 'category_rejected'
  | 'enrollment_refunded'

type Payload = Record<string, unknown>

const rupees = (v: unknown) => {
  const n = Number(v ?? 0)
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`
}

interface Template {
  /** Shown as the bold first line in the in-app thread. */
  title: (p: Payload) => string
  body: (p: Payload) => string
  /** Where tapping the message takes the recipient. */
  href?: (p: Payload) => string | null
}

export const TEMPLATES: Record<TemplateKey, Template> = {
  enquiry_received: {
    title: () => 'New enquiry',
    body: (p) =>
      `${p.child_name}${p.child_age ? `, ${p.child_age}` : ''} in ${p.area_label ?? 'your area'} ` +
      `wants to learn ${p.category_name}.` +
      (p.message ? `\n\n“${p.message}”` : '') +
      `\n\nAccept or decline in the app.`,
    href: () => '/trainer/enquiries',
  },
  enquiry_accepted: {
    title: () => 'Enquiry accepted',
    body: (p) =>
      `${p.trainer_name} accepted ${p.child_name} for ${p.category_name}. ` +
      `${p.weekday ? `${p.weekday}s at ${p.time}` : `${p.classes_per_month} classes`}, ` +
      `${p.classes_per_month} classes this month, ${rupees(p.amount)} total. ` +
      `Fund the month to lock the slot — the money is held in escrow and released one ` +
      `class at a time, only when a class is actually taught.`,
    href: (p) => (p.enrollment_id ? `/parent/pay/${p.enrollment_id}` : '/parent/enquiries'),
  },
  booking_confirmed: {
    title: () => 'Booking confirmed',
    body: (p) =>
      `You accepted ${p.child_name} for ${p.category_name}` +
      `${p.area_label ? ` in ${p.area_label}` : ''}. ` +
      `${p.weekday ? `${p.weekday}s at ${p.time}. ` : ''}` +
      `${p.parent_name} has been asked to fund ${p.classes_per_month} classes ` +
      `(${rupees(p.amount)}). The classes appear on your Today screen the moment they pay, ` +
      `and you are paid per class as you mark each one taught.`,
    href: () => '/trainer',
  },
  enquiry_declined: {
    title: () => 'Enquiry declined',
    body: (p) =>
      `Your ${p.category_name} enquiry was declined${p.reason ? `: ${p.reason}` : '.'} ` +
      `There are other trainers nearby.`,
    href: () => '/parent/search',
  },
  payment_confirmed: {
    title: () => 'Payment held',
    body: (p) =>
      `${rupees(p.amount)} is held for ${p.child_name}'s ${p.category_name} classes. ` +
      `${p.classes_per_month} credits added. Nothing is paid out until a class is ` +
      `marked attended with an assessment.`,
    href: () => '/parent',
  },
  enrollment_funded: {
    title: () => 'Class funded',
    body: (p) =>
      `${p.child_name}'s ${p.category_name} month is funded — ${p.classes_per_month} classes. ` +
      `You are paid per class, as soon as you mark it attended and write the assessment.`,
    href: () => '/trainer',
  },
  class_reminder: {
    title: () => 'Class in 2 hours',
    body: (p) => `${p.child_name} · ${p.category_name} at ${p.time ?? 'today'}.`,
    href: () => '/trainer',
  },
  class_completed: {
    title: () => 'Class completed',
    body: (p) =>
      `${p.trainer_name} marked ${p.child_name}'s ${p.category_name} class attended.\n\n` +
      `“${p.assessment_note}”\n\nSkill ${p.skill_rating}/5 · ${rupees(p.amount)} released from escrow.`,
    href: (p) => (p.session_id ? `/parent/session/${p.session_id}` : '/parent'),
  },
  feedback_request: {
    title: () => 'How did it go?',
    body: (p) => `Rate ${p.child_name}'s ${p.category_name} class. Takes ten seconds.`,
    href: (p) => (p.session_id ? `/parent/session/${p.session_id}` : '/parent'),
  },
  identity_verified: {
    title: () => 'Identity verified',
    body: () =>
      'Your ID has been checked. Parents now see the verified badge on your profile, and ' +
      'your category applications can be reviewed.',
    href: () => '/trainer/categories',
  },
  identity_rejected: {
    title: () => 'Identity needs another look',
    body: (p) =>
      `We could not verify your document${p.reason ? `: ${p.reason}` : '.'} ` +
      'Submit a clearer photo and it goes back in the queue.',
    href: () => '/onboarding/trainer',
  },
  category_approved: {
    title: () => 'Category approved',
    body: (p) =>
      `You are now approved for ${p.category_name}. Parents searching your area can see ` +
      `you from now on.`,
    href: () => '/trainer/categories',
  },
  category_rejected: {
    title: () => 'Category not approved',
    body: (p) =>
      `Your ${p.category_name} application was not approved${p.reason ? `: ${p.reason}` : '.'} ` +
      `You can apply again with a stronger credential.`,
    href: () => '/trainer/categories',
  },
  enrollment_refunded: {
    title: () => 'Refunded to your wallet',
    body: (p) =>
      `${rupees(p.amount)} has been returned to your wallet${p.reason ? `: ${p.reason}` : '.'}`,
    href: () => '/parent',
  },
}

export function renderTemplate(key: string, payload: Payload) {
  const t = TEMPLATES[key as TemplateKey]
  if (!t) {
    return { title: key.replace(/_/g, ' '), body: JSON.stringify(payload), href: null }
  }
  return { title: t.title(payload), body: t.body(payload), href: t.href?.(payload) ?? null }
}
