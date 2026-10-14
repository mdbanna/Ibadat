import { describe, expect, it } from 'vitest'
import { loginEmailFor } from './memberAuth'
import { canonicalPhone, initialPassword, newPasswordProblem, phoneDigits, phoneToAuthEmail, toAsciiDigits } from './phone'

describe('canonicalPhone', () => {
  it.each([
    ['01712345678', '+8801712345678'], ['+8801712345678', '+8801712345678'], ['8801712345678', '+8801712345678'], ['008801712345678', '+8801712345678'],
    ['০১৭১২-৩৪৫ ৬৭৮', '+8801712345678'], ['  017 1234 5678 ', '+8801712345678'], ['+880 1712-345678', '+8801712345678'], ['(017) 12345678', '+8801712345678'],
    ['+14155552671', '+14155552671'],
  ])('%s -> %s', (input, expected) => expect(canonicalPhone(input)).toBe(expected))

  it.each(['', '   ', 'abc', '12345', '1712345678', '0171234567', '017123456789', '02123456', '+880171234567', '+8801212345678', 'IBD-0001', "0171234567'; drop table", '+1234'])(
    'rejects %j', (input) => expect(canonicalPhone(input)).toBeNull())
})

describe('login identity helpers', () => {
  it('maps a phone number to the Auth email', () => {
    expect(phoneToAuthEmail('+8801712345678', 'members.ibadat.example')).toBe('8801712345678@members.ibadat.example')
    expect(phoneToAuthEmail('01712345678', 'members.example')).toBeNull()
    expect(phoneToAuthEmail('+8801712345678', 'not a domain')).toBeNull()
  })
  it('loginEmailFor accepts any typed form and needs a configured domain', () => {
    expect(loginEmailFor('০১৭১২৩৪৫৬৭৮', 'members.test')).toEqual({ phone: '+8801712345678', email: '8801712345678@members.test' })
    expect(loginEmailFor('01712345678', undefined)).toBeNull()
    expect(loginEmailFor('nope', 'members.test')).toBeNull()
  })
  it('the temporary first password is the phone number as people type it', () => {
    expect(initialPassword('+8801712345678')).toBe('01712345678')
    expect(initialPassword('+14155552671')).toBe('14155552671')
    expect(phoneDigits('+8801712345678')).toBe('8801712345678')
    expect(toAsciiDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789')
  })
  it('a new password cannot be the phone number in any form, and must be at least 8 characters', () => {
    const phone = '+8801712345678'
    for (const bad of ['01712345678', '8801712345678', '+8801712345678']) expect(newPasswordProblem(bad, phone)).toBe('same_as_phone')
    expect(newPasswordProblem('short', phone)).toBe('too_short')
    expect(newPasswordProblem('', phone)).toBe('too_short')
    expect(newPasswordProblem('a-good-passphrase', phone)).toBeNull()
  })
})
