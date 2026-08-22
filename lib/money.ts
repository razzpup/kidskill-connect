/**
 * Money crosses the boundary as a `numeric(12,2)` string from Postgres and lives in
 * TypeScript as an integer count of paise. It is never a float at any point: parsing
 * "1500.00" with parseFloat and multiplying by 100 is exactly the operation that
 * eventually produces a ledger that is two paise out, so we do it on the digits.
 */

export type Paise = number

const NUMERIC = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

/** Postgres numeric string -> integer paise. */
export function toPaise(value: string | number | null | undefined): Paise {
  if (value === null || value === undefined) return 0
  const raw = typeof value === 'number' ? value.toFixed(2) : value.trim()
  const m = NUMERIC.exec(raw)
  if (!m) throw new Error(`Not a numeric(12,2) value: ${JSON.stringify(value)}`)
  const [, sign, whole, frac = ''] = m
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return sign ? -paise : paise
}

/** Integer paise -> the numeric string Postgres expects back. */
export function toNumeric(paise: Paise): string {
  const sign = paise < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(paise))
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

const GROUPED = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Indian grouping, no decimals when the amount is whole rupees — which, given rates
 * are set in whole rupees, is nearly always. `₹4,000` reads faster than `₹4,000.00`
 * and the paise only appear when they carry information.
 */
export function formatRupees(paise: Paise, opts: { sign?: boolean } = {}): string {
  const negative = paise < 0
  const abs = Math.abs(paise)
  const rupees = Math.floor(abs / 100)
  const rem = abs % 100
  const body = rem === 0
    ? GROUPED.format(rupees)
    : `${GROUPED.format(rupees)}.${String(rem).padStart(2, '0')}`
  const prefix = negative ? '−' : opts.sign ? '+' : ''
  return `${prefix}₹${body}`
}

/**
 * Commission is a percentage stored per enrollment, so it is applied, not assumed.
 *
 * Mirrors the trigger exactly: `round(rate_per_class * commission_pct / 100.0, 2)`.
 * `pct` arrives as numeric(5,2) — "15.00" — so toPaise gives hundredths of a percent,
 * and dividing by 10_000 undoes both that scaling and the percent.
 */
export function commissionOf(ratePaise: Paise, pct: string | number): Paise {
  const hundredthsOfAPercent = toPaise(pct) // "15.00" -> 1500
  return Math.round((ratePaise * hundredthsOfAPercent) / 10_000)
}
