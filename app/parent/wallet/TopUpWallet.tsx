'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Script from 'next/script'
import { createWalletTopupOrder, verifyAndTopupWallet } from '@/lib/db/actions'
import { buttonClass } from '@/components/ui'
import { formatRupees } from '@/lib/money'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

const PRESETS = [500, 1000, 2000, 5000]

/**
 * Funds the wallet ahead of picking a coach — same Razorpay Checkout flow as paying
 * for an enrollment, just not tied to one. The amount lands in `parent_wallet` as soon
 * as the signature checks out; nothing here touches escrow or a coach's payout.
 */
export function TopUpWallet() {
  const router = useRouter()
  const [amount, setAmount] = useState<number>(1000)
  const [custom, setCustom] = useState('')
  const [state, setState] = useState<'idle' | 'paying'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  const effectiveAmount = custom.trim() ? Number(custom) : amount

  async function pay() {
    setState('paying')
    setError(null)

    const order = await createWalletTopupOrder(effectiveAmount)
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
      description: `Wallet top-up · ${formatRupees(orderData.amount)}`,
      theme: { color: '#FF6F59' },
      handler: async (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
      }) => {
        const res = await verifyAndTopupWallet(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
          orderData.amount,
        )
        if (!res.ok) {
          setState('idle')
          setError(res.error ?? 'Payment could not be confirmed')
          return
        }
        setState('idle')
        setCustom('')
        router.refresh()
      },
      modal: {
        ondismiss: () => setState((s) => (s === 'paying' ? 'idle' : s)),
      },
    })
    razorpay.open()
  }

  return (
    <div className="rounded-2xl border border-line bg-[var(--card)] p-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setScriptReady(true)} />
      <p className="eyebrow mb-1">Top up</p>
      <h3 className="display text-[1.125rem] font-bold leading-none">Add money to your wallet</h3>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
        Funds land in your wallet right away. They only move into escrow once you commit
        to a coach — nothing here pays anyone yet.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setAmount(p)
              setCustom('')
            }}
            className="rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition"
            style={
              !custom.trim() && amount === p
                ? { background: 'var(--grass)', color: '#fff', borderColor: 'var(--grass)' }
                : { color: 'var(--muted)', borderColor: 'var(--line)' }
            }
          >
            {formatRupees(p * 100)}
          </button>
        ))}
      </div>

      <label htmlFor="custom-amount" className="eyebrow mb-1.5 mt-4 block">
        Or a custom amount
      </label>
      <input
        id="custom-amount"
        type="number"
        inputMode="numeric"
        min={50}
        step={50}
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="₹"
        className="num w-full rounded-xl border border-line bg-[var(--paper)] px-3.5 py-2.5 text-[0.9375rem] outline-none focus:border-grass"
      />

      <button
        onClick={() => void pay()}
        disabled={state === 'paying' || !scriptReady || !effectiveAmount || effectiveAmount < 50}
        className={buttonClass('primary', 'lg', 'mt-4 w-full')}
      >
        {state === 'paying'
          ? 'Waiting for payment…'
          : !scriptReady
            ? 'Loading payment…'
            : `Add ${formatRupees(Math.max(0, Math.round(effectiveAmount || 0)) * 100)}`}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-alert-wash px-3.5 py-2.5 text-[0.8125rem] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}
