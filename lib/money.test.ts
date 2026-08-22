import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commissionOf, formatRupees, toNumeric, toPaise } from './money.ts'

/**
 * Run with `npm test`.
 *
 * These exist because the commission split is the one calculation in the product that
 * appears in two places — once in SQL inside `release_session_funds`, and once in
 * TypeScript so the trainer can see what a class will pay before they submit. Two
 * implementations of one rule is exactly where a discrepancy hides, so the SQL is the
 * authority and these tests pin the TypeScript to it.
 */

test('toPaise parses digits, never a float', () => {
  assert.equal(toPaise('800.00'), 80_000)
  assert.equal(toPaise('1500.00'), 150_000)
  assert.equal(toPaise('0.01'), 1)
  assert.equal(toPaise('0.1'), 10)
  assert.equal(toPaise('0'), 0)
  assert.equal(toPaise(null), 0)
  assert.equal(toPaise('-120.50'), -12_050)

  // 8.20 * 100 is 819.9999999999999 as a float. Parsing the digits must not care.
  assert.equal(toPaise('8.20'), 820)
})

test('toPaise refuses more precision than numeric(12,2) holds', () => {
  assert.throws(() => toPaise('1.005'))
  assert.throws(() => toPaise('twelve'))
})

test('paise round-trip back to the numeric string Postgres expects', () => {
  for (const v of ['0.00', '0.01', '1.00', '735.00', '4900.00', '999999.99']) {
    assert.equal(toNumeric(toPaise(v)), v)
  }
})

test('rupees format with Indian grouping', () => {
  assert.equal(formatRupees(640_000), '₹6,400')
  assert.equal(formatRupees(150_000), '₹1,500')
  assert.equal(formatRupees(10_000_000), '₹1,00,000')
  assert.equal(formatRupees(-68_000), '−₹680')
})

test('paise appear only when they carry information', () => {
  assert.equal(formatRupees(68_000), '₹680')
  assert.equal(formatRupees(68_050), '₹680.50')
})

test('commission matches round(rate * pct / 100.0, 2) as the trigger computes it', () => {
  const cases: [string, string, number, number][] = [
    // rate,      pct,       commission, net
    ['800.00', '15.00', 12_000, 68_000], // Lakshmi — ₹120 commission, ₹680 net
    ['500.00', '15.00', 7_500, 42_500], // Priya   — ₹75 commission, ₹425 net
    ['650.00', '15.00', 9_750, 55_250],
    ['950.00', '15.00', 14_250, 80_750],
    ['333.33', '15.00', 5_000, 28_333], // rounds at the half-paise
    ['100.00', '0.00', 0, 10_000], // commission_pct may legitimately be zero
  ]

  for (const [rate, pct, commission, net] of cases) {
    const paise = toPaise(rate)
    assert.equal(commissionOf(paise, pct), commission, `commission of ${rate} at ${pct}%`)
    assert.equal(paise - commissionOf(paise, pct), net, `net of ${rate} at ${pct}%`)
  }
})

test('the seed totals the migration asserts on', () => {
  // supabase/seed.sql marks 5 sketching classes at ₹500 and 3 vocal at ₹800 attended,
  // then fails the reset if the resulting ledger does not agree with these numbers.
  const sketching = toPaise('500.00')
  const vocal = toPaise('800.00')

  assert.equal(5 * sketching + 3 * vocal, toPaise('4900.00'), 'gross released')
  assert.equal(
    5 * commissionOf(sketching, '15.00') + 3 * commissionOf(vocal, '15.00'),
    toPaise('735.00'),
    'platform revenue',
  )
  assert.equal(toPaise('4000.00') - 5 * sketching, toPaise('1500.00'), 'enrollment A escrow')
})
