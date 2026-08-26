'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Script from 'next/script'
import { createRazorpayOrder, verifyAndFundEnrollment } from '@/lib/db/actions'
import { buttonClass, CheckIcon, LinkButton, Money } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import type { EnrollmentSummary } from '@/lib/db/types'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

/**
 * Razorpay Checkout in test mode — a real order, a real widget, a real signature
 * check, backed by a key pair that can never move real money. One button, and a
 * success state that says exactly what was locked and what happens next, because the
 * thing a parent is actually buying here is the guarantee that the money does not move
 * until a class does.
 */
export function PaymentScreen({ enrollment }: { enrollment: EnrollmentSummary }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'paying' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  async function pay() {
    setState('paying')
    setError(null)

    const order = await createRazorpayOrder(enrollment.id)
    if (!order.ok || !order.data) {
      setState('idle')
      setError(order.error ?? 'Could not start payment')
      return
    }
    const orderData = order.data as { orderId: string; amount: number; keyId: string }

    const razorpay = new window.Razorpay({
      key: orderData.keyId,
      order_id: orderData.orderId,
      amount: orderData.amount,
      currency: 'INR',
      name: 'KidsConnect',
      description: `${enrollment.categoryName} · ${enrollment.classesPerMonth} classes for ${enrollment.childName}`,
      theme: { color: '#2F6F4E' },
      handler: async (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
      }) => {
        const res = await verifyAndFundEnrollment(
          enrollment.id,
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
        )
        if (!res.ok) {
          setState('idle')
          setError(res.error ?? 'Payment could not be confirmed')
          return
        }
        setState('done')
        router.refresh()
      },
      modal: {
        ondismiss: () => setState((s) => (s === 'paying' ? 'idle' : s)),
      },
    })
    razorpay.open()
  }

  if (state === 'done') {
    return (
      <div className="pt-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-grass text-white">
          <CheckIcon className="h-7 w-7" />
        </div>
        <h1 className="display mt-6 text-[1.875rem] font-extrabold leading-tight">
          Held, not spent.
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          <Money paise={enrollment.committed} size="sm" /> is in escrow for{' '}
          {enrollment.childName}&apos;s {enrollment.categoryName.toLowerCase()} classes.
        </p>

        <ol className="mt-7 space-y-4 border-l border-line pl-5">
          {[
            `${enrollment.trainerName} teaches a class.`,
            'They mark it attended and write what your child worked on.',
            `That releases ${formatRupees(enrollment.ratePerClass)} — one class, no more.`,
            'The note appears on the progress spine, permanently.',
          ].map((line, i) => (
            <li key={i} className="relative text-[0.9375rem] leading-relaxed">
              <span
                aria-hidden
                className="absolute -left-[1.4rem] top-[0.45rem] h-2 w-2 rounded-full"
                style={{ background: 'var(--grass)' }}
              />
              {line}
            </li>
          ))}
        </ol>

        <LinkButton href="/parent" size="lg" className="mt-8 w-full">
          See the spine
        </LinkButton>
      </div>
    )
  }

  return (
    <div className="pt-2">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptReady(true)}
      />
      <p className="eyebrow">Monthly commitment</p>
      <h1 className="display mt-2 text-[1.75rem] font-extrabold leading-tight">
        {enrollment.categoryName} for {enrollment.childName}
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted">with {enrollment.trainerName}</p>

      <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-[var(--card)]">
        <Row label={`${enrollment.classesPerMonth} classes`} />
        <Row
          label="Per class"
          value={<Money paise={enrollment.ratePerClass} size="sm" tone="ink" />}
        />
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-[0.9375rem] font-semibold">Held in escrow</span>
          <Money paise={enrollment.committed} size="lg" />
        </div>
      </div>

      <p className="mt-4 text-[0.875rem] leading-relaxed text-muted">
        This is not a payment to {enrollment.trainerName.split(' ')[0]}. It sits in escrow and
        is released one class at a time, only when a class is marked attended with an
        assessment written. Anything not taught this month stays yours.
      </p>

      <button
        onClick={() => void pay()}
        disabled={state === 'paying' || !scriptReady}
        className={buttonClass('primary', 'lg', 'mt-7 w-full')}
      >
        {state === 'paying'
          ? 'Waiting for payment…'
          : !scriptReady
            ? 'Loading payment…'
            : `Pay ${formatRupees(enrollment.committed)}`}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}

    </div>
  )
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
      <span className="text-[0.9375rem] text-muted">{label}</span>
      {value}
    </div>
  )
}
