import { describe, expect, it } from 'vitest'
import { normalizePhone, validateContact, validateJoin, type JoinValues } from './validation'

const valid: JoinValues = {
  fullName: 'রহিম উদ্দিন', phone: '01712345678', email: '', dateOfBirth: '', occupation: '',
  addressLine: '', district: '', upazila: '', motivation: '', consent: true,
}

describe('normalizePhone', () => {
  it('converts Bengali digits and strips separators', () => expect(normalizePhone('০১৭১২-৩৪৫ ৬৭৮')).toBe('01712345678'))
  it('keeps a leading +', () => expect(normalizePhone('+880 1712-345678')).toBe('+8801712345678'))
})

describe('validateJoin', () => {
  it('accepts a minimal valid application', () => expect(validateJoin(valid)).toEqual({}))
  it('requires name, phone and consent', () => {
    const e = validateJoin({ ...valid, fullName: ' ', phone: '', consent: false })
    expect(e.fullName?.key).toBe('required')
    expect(e.phone?.key).toBe('required')
    expect(e.consent?.key).toBe('consentRequired')
  })
  it('rejects malformed phone and email', () => {
    const e = validateJoin({ ...valid, phone: '12ab', email: 'nope' })
    expect(e.phone?.key).toBe('invalidPhone')
    expect(e.email?.key).toBe('invalidEmail')
  })
  it('accepts a Bengali-digit phone number', () => expect(validateJoin({ ...valid, phone: '০১৭১২৩৪৫৬৭৮' }).phone).toBeUndefined())
  it('rejects a future or impossible birth date', () => {
    const today = new Date('2026-10-10T00:00:00Z')
    expect(validateJoin({ ...valid, dateOfBirth: '2027-01-01' }, today).dateOfBirth?.key).toBe('futureDate')
    expect(validateJoin({ ...valid, dateOfBirth: '2026-13-45' }, today).dateOfBirth?.key).toBe('invalidDate')
    expect(validateJoin({ ...valid, dateOfBirth: '1990-05-01' }, today).dateOfBirth).toBeUndefined()
  })
  it('enforces the same length limits as the database', () => {
    const e = validateJoin({ ...valid, fullName: 'x', motivation: 'm'.repeat(2001), addressLine: 'a'.repeat(301), district: 'd'.repeat(81) })
    expect(e.fullName).toEqual({ key: 'tooShort', params: { min: 2 } })
    expect(e.motivation).toEqual({ key: 'tooLong', params: { max: 2000 } })
    expect(e.addressLine?.key).toBe('tooLong')
    expect(e.district?.key).toBe('tooLong')
  })
})

describe('validateContact', () => {
  const ok = { name: 'Visitor', email: 'a@b.org', phone: '', subject: '', message: 'Hello there, friends' }
  it('accepts email only or phone only', () => {
    expect(validateContact(ok)).toEqual({})
    expect(validateContact({ ...ok, email: '', phone: '01712345678' })).toEqual({})
  })
  it('needs at least one reply channel', () => expect(validateContact({ ...ok, email: '' }).channel?.key).toBe('needEmailOrPhone'))
  it('needs a message of at least 10 characters', () => expect(validateContact({ ...ok, message: 'short' }).message?.key).toBe('tooShort'))
})
