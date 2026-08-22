import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkIdentity, verhoeffValid } from './identity.ts'

/**
 * The point of these is the guarantee the whole design rests on: `checkIdentity` returns
 * the last four digits and nothing else, so there is no path by which a full Aadhaar
 * number reaches the server.
 */

test('Verhoeff accepts known-good Aadhaar checksums', () => {
  // Published UIDAI sample numbers.
  assert.ok(verhoeffValid('234567890124'))
  assert.ok(verhoeffValid('999941057058'))
})

test('Verhoeff rejects a single mistyped digit', () => {
  assert.ok(!verhoeffValid('234567890125'))
})

test('Verhoeff rejects a transposition', () => {
  assert.ok(!verhoeffValid('234567890142'))
})

test('Aadhaar must be 12 digits and not start with 0 or 1', () => {
  assert.equal(checkIdentity('aadhaar', '12345').ok, false)
  assert.equal(checkIdentity('aadhaar', '099994105705').ok, false)
  assert.equal(checkIdentity('aadhaar', '199994105705').ok, false)
})

test('a valid Aadhaar yields ONLY the last four digits', () => {
  const r = checkIdentity('aadhaar', '9999 4105 7058')
  assert.equal(r.ok, true)
  assert.equal(r.last4, '7058')
  // The guarantee: nothing on the result carries the rest of the number.
  assert.equal(JSON.stringify(r).includes('999941057058'), false)
  assert.equal(JSON.stringify(r).includes('99994105'), false)
})

test('other document types validate their own shapes', () => {
  assert.equal(checkIdentity('pan', 'ABCDE1234F').last4, '234F')
  assert.equal(checkIdentity('pan', 'ABC1234').ok, false)
  assert.equal(checkIdentity('passport', 'A1234567').last4, '4567')
  assert.equal(checkIdentity('voter_id', 'ABC1234567').last4, '4567')
  assert.equal(checkIdentity('driving_licence', 'KA0120121234567').last4, '4567')
})
