/** Client-side validation mirroring the database constraints (the database remains the authority). */
export type ValidationKey =
  | 'required' | 'invalidPhone' | 'invalidEmail' | 'tooShort' | 'tooLong'
  | 'consentRequired' | 'invalidDate' | 'futureDate' | 'needEmailOrPhone'
export interface FieldError { key: ValidationKey; params?: { min?: number; max?: number } }
export type Errors<K extends string> = Partial<Record<K, FieldError>>

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
/** Accepts Bengali digits, spaces, dashes and brackets: "০১৭১২-৩৪৫ ৬৭৮" -> "01712345678". */
export function normalizePhone(input: string): string {
  const ascii = input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
  const plus = ascii.trim().startsWith('+') ? '+' : ''
  return plus + ascii.replace(/[^\d]/g, '')
}
export const isValidPhone = (p: string) => /^\+?[0-9]{7,15}$/.test(p)
export const isValidEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 254

function lengthError(value: string, min: number, max: number): FieldError | undefined {
  const n = value.trim().length
  if (n === 0) return { key: 'required' }
  if (n < min) return { key: 'tooShort', params: { min } }
  if (n > max) return { key: 'tooLong', params: { max } }
  return undefined
}
const maxOnly = (value: string, max: number): FieldError | undefined =>
  value.trim().length > max ? { key: 'tooLong', params: { max } } : undefined

import { canonicalPhone } from './phone'

export interface JoinValues {
  fullName: string; phone: string; email: string; dateOfBirth: string; occupation: string
  addressLine: string; district: string; upazila: string; motivation: string; consent: boolean
}
export type JoinField = keyof JoinValues

export function validateJoin(v: JoinValues, today = new Date()): Errors<JoinField> {
  const e: Errors<JoinField> = {}
  const name = lengthError(v.fullName, 2, 120); if (name) e.fullName = name
  if (!v.phone.trim()) e.phone = { key: 'required' }
  else if (!canonicalPhone(v.phone)) e.phone = { key: 'invalidPhone' }
  if (v.email.trim() && !isValidEmail(v.email.trim())) e.email = { key: 'invalidEmail' }
  if (v.dateOfBirth) {
    const d = new Date(`${v.dateOfBirth}T00:00:00Z`)
    if (Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(v.dateOfBirth)) e.dateOfBirth = { key: 'invalidDate' }
    else if (v.dateOfBirth > today.toISOString().slice(0, 10)) e.dateOfBirth = { key: 'futureDate' }
  }
  const occ = maxOnly(v.occupation, 120); if (occ) e.occupation = occ
  const addr = maxOnly(v.addressLine, 300); if (addr) e.addressLine = addr
  const dist = maxOnly(v.district, 80); if (dist) e.district = dist
  const upa = maxOnly(v.upazila, 80); if (upa) e.upazila = upa
  const mot = maxOnly(v.motivation, 2000); if (mot) e.motivation = mot
  if (!v.consent) e.consent = { key: 'consentRequired' }
  return e
}

export interface ContactValues { name: string; email: string; phone: string; subject: string; message: string }
export type ContactField = keyof ContactValues | 'channel'

export function validateContact(v: ContactValues): Errors<ContactField> {
  const e: Errors<ContactField> = {}
  const name = lengthError(v.name, 2, 120); if (name) e.name = name
  const hasEmail = v.email.trim().length > 0
  const hasPhone = v.phone.trim().length > 0
  if (hasEmail && !isValidEmail(v.email.trim())) e.email = { key: 'invalidEmail' }
  if (hasPhone && !isValidPhone(normalizePhone(v.phone))) e.phone = { key: 'invalidPhone' }
  if (!hasEmail && !hasPhone) e.channel = { key: 'needEmailOrPhone' }
  const subj = maxOnly(v.subject, 160); if (subj) e.subject = subj
  const msg = lengthError(v.message, 10, 4000); if (msg) e.message = msg
  return e
}
