/**
 * Identity document validation, done in the browser.
 *
 * Deliberately client-side: the point is that the full number is checked and then
 * discarded, so only the last four digits ever cross the network. See migration 0008
 * for why we refuse to store the whole thing.
 *
 * This validates format, not authenticity. A number can be well-formed and not belong
 * to the person holding it — that is what the document review by an admin is for, and
 * what real eKYC through a UIDAI-authorised provider would replace.
 */

export type IdKind = 'aadhaar' | 'pan' | 'passport' | 'driving_licence' | 'voter_id'

export const ID_LABELS: Record<IdKind, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  passport: 'Passport',
  driving_licence: 'Driving licence',
  voter_id: 'Voter ID',
}

export const ID_HINTS: Record<IdKind, string> = {
  aadhaar: '12 digits',
  pan: '10 characters, like ABCDE1234F',
  passport: '8 characters, like A1234567',
  driving_licence: '15 characters, like KA0120121234567',
  voter_id: '10 characters, like ABC1234567',
}

/* ------------------------------------------------------------------ Verhoeff
   Aadhaar's checksum. Catches every single-digit error and every adjacent
   transposition, which between them are most of what people mistype. */

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

export function verhoeffValid(digits: string): boolean {
  let c = 0
  const reversed = digits.split('').reverse()
  for (let i = 0; i < reversed.length; i++) {
    c = D[c][P[i % 8][Number(reversed[i])]]
  }
  return c === 0
}

/* ------------------------------------------------------------------ validate */

export interface IdCheck {
  ok: boolean
  /** Only ever the last four digits. Never the full number. */
  last4?: string
  error?: string
}

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const PASSPORT = /^[A-PR-WY][0-9]{7}$/
const DL = /^[A-Z]{2}[0-9]{2}[0-9]{11}$/
const VOTER = /^[A-Z]{3}[0-9]{7}$/

export function checkIdentity(kind: IdKind, raw: string): IdCheck {
  const value = raw.replace(/\s|-/g, '').toUpperCase()

  switch (kind) {
    case 'aadhaar': {
      if (!/^\d{12}$/.test(value)) return { ok: false, error: 'Aadhaar is 12 digits.' }
      // The first digit is never 0 or 1 on a real Aadhaar.
      if (value[0] === '0' || value[0] === '1') {
        return { ok: false, error: 'An Aadhaar number does not start with 0 or 1.' }
      }
      if (!verhoeffValid(value)) {
        return { ok: false, error: "That Aadhaar number's checksum doesn't match — check for a typo." }
      }
      return { ok: true, last4: value.slice(-4) }
    }
    case 'pan':
      return PAN.test(value)
        ? { ok: true, last4: value.slice(-4) }
        : { ok: false, error: 'PAN looks like ABCDE1234F.' }
    case 'passport':
      return PASSPORT.test(value)
        ? { ok: true, last4: value.slice(-4) }
        : { ok: false, error: 'Passport number looks like A1234567.' }
    case 'driving_licence':
      return DL.test(value)
        ? { ok: true, last4: value.slice(-4) }
        : { ok: false, error: 'Driving licence looks like KA0120121234567.' }
    case 'voter_id':
      return VOTER.test(value)
        ? { ok: true, last4: value.slice(-4) }
        : { ok: false, error: 'Voter ID looks like ABC1234567.' }
  }
}
