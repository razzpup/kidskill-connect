import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Test-mode Razorpay for the demo gateway. Real Orders API, real Checkout widget, real
 * signature verification — the only thing that makes it "test" is which key pair is in
 * the environment. Swapping in live keys would make this a real gateway with no code
 * change, which is exactly why the signature check below is not optional: without it,
 * anyone could call the fund action with a made-up order id and pay for nothing.
 */

function credentials() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  return { keyId, keySecret }
}

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
}

/** amountPaise is already what Razorpay wants — its smallest-unit amount for INR is paise. */
export async function createOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
  const creds = credentials()
  if (!creds) throw new Error('Razorpay test keys are not configured on the server.')

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      // Belt and braces: Razorpay's own dashboard marks the order as a test order too,
      // so a stray live key pair can never be mistaken for having taken real money.
      notes: { environment: 'test', receipt },
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error?.description ?? `Razorpay order creation failed (${res.status})`)
  }
  return { id: json.id, amount: json.amount, currency: json.currency }
}

/**
 * The Checkout widget's success handler is client-side and therefore not trustworthy on
 * its own — this is the server-side check that the payment actually happened and wasn't
 * fabricated in the browser. Razorpay's documented scheme:
 * signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const creds = credentials()
  if (!creds) return false

  const expected = createHmac('sha256', creds.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function publicKeyId(): string | null {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null
}
