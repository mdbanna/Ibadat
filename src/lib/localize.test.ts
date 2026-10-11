import { describe, expect, it } from 'vitest'
import { formatDate, initials, pickLocalized } from './localize'

describe('pickLocalized', () => {
  it('prefers the visitor language', () => {
    expect(pickLocalized('বাংলা', 'English', 'bn')).toBe('বাংলা')
    expect(pickLocalized('বাংলা', 'English', 'en')).toBe('English')
  })
  it('falls back to the other language, never to an empty string if any text exists', () => {
    expect(pickLocalized(null, 'English', 'bn')).toBe('English')
    expect(pickLocalized('  ', 'English', 'bn')).toBe('English')
    expect(pickLocalized('বাংলা', '', 'en')).toBe('বাংলা')
    expect(pickLocalized(null, undefined, 'bn')).toBe('')
  })
})

describe('formatDate', () => {
  it('formats date-only values without shifting the day', () => {
    expect(formatDate('2026-03-01', 'en')).toBe('1 March 2026')
    expect(formatDate('2026-12-31', 'en')).toBe('31 December 2026')
  })
  it('uses Bengali numerals and month names for bn', () => expect(formatDate('2026-03-01', 'bn')).toMatch(/[০-৯]/))
  it('returns an empty string for missing or invalid input', () => {
    expect(formatDate(null, 'bn')).toBe('')
    expect(formatDate('not-a-date', 'en')).toBe('')
  })
})

describe('initials', () => {
  it('uses first and last name', () => expect(initials('Abdul Karim Rahman')).toBe('AR'))
  it('handles a single name', () => expect(initials('Rahim')).toBe('RA'))
})
