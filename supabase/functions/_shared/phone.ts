// Phone-number identity helpers. Plain TypeScript with NO imports so the same file runs in the browser (Vite), in Deno
// (Supabase Edge Functions) and in tests. It is the single source of truth for how a phone number becomes a login.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

/** "০১৭১২-৩৪৫ ৬৭৮" -> "01712-345 678" (Bengali digits to ASCII). */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
}

/**
 * Canonical E.164 form ("+8801712345678") or null.
 * Bangladesh mobile numbers may be typed as 01712345678, 8801712345678, +8801712345678, 008801712345678 or with spaces/dashes
 * and Bengali digits. Other countries are accepted only with an explicit + (or 00) prefix and 8-15 digits.
 */
export function canonicalPhone(input: string): string | null {
  let s = toAsciiDigits(String(input ?? '')).replace(/[\s\-().]/g, '')
  if (!s) return null
  let international = false
  if (s.startsWith('+')) { international = true; s = s.slice(1) }
  else if (s.startsWith('00')) { international = true; s = s.slice(2) }
  if (!/^\d+$/.test(s)) return null
  if (s.startsWith('880')) { international = true; s = s.slice(3); return /^1[3-9]\d{8}$/.test(s) ? `+880${s}` : null }
  if (international) return /^[1-9]\d{7,14}$/.test(s) ? `+${s}` : null
  if (s.startsWith('0')) { s = s.slice(1); return /^1[3-9]\d{8}$/.test(s) ? `+880${s}` : null }
  return null
}

/** Digits of the canonical number, without "+": "8801712345678". */
export const phoneDigits = (e164: string): string => e164.replace(/\D/g, '')

/** The Auth account email that represents a phone number: "8801712345678@<domain>". Null if the number or domain is invalid. */
export function phoneToAuthEmail(e164: string, domain: string): string | null {
  const host = String(domain ?? '').trim().toLowerCase()
  if (!/^\+[0-9]{8,15}$/.test(e164) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null
  return `${phoneDigits(e164)}@${host}`
}

/**
 * The temporary first password is the phone number itself, in the form a member naturally types it:
 * Bangladesh "01712345678", other countries the full digits. It only works until the first password change.
 */
export function initialPassword(e164: string): string {
  return e164.startsWith('+880') ? `0${e164.slice(4)}` : phoneDigits(e164)
}

export const MIN_PASSWORD_LENGTH = 8

/** Returns a reason code when a NEW password is not acceptable, or null. */
export function newPasswordProblem(newPassword: string, e164: string): 'too_short' | 'same_as_phone' | null {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) return 'too_short'
  const forbidden = new Set([initialPassword(e164), phoneDigits(e164), e164])
  return forbidden.has(newPassword) ? 'same_as_phone' : null
}
