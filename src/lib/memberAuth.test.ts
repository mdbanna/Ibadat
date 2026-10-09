import { describe, expect, it } from 'vitest'
import { memberIdToAuthEmail, normalizeMemberId } from './memberAuth'

describe('member id helpers', () => {
  it('normalizes case and whitespace', () => expect(normalizeMemberId('  ibd-0001 ')).toBe('IBD-0001'))
  it('rejects ids that are not IBD-####', () => {
    for (const bad of ['', 'IBD0001', 'IBD-1', '1234567890', 'admin@x.com', "IBD-0001'; drop table"]) expect(normalizeMemberId(bad)).toBeNull()
  })
  it('derives the synthetic auth email', () => expect(memberIdToAuthEmail('IBD-0042', 'members.ibadat.example')).toBe('ibd-0042@members.ibadat.example'))
  it('refuses a bad domain or id', () => {
    expect(memberIdToAuthEmail('IBD-0042', 'not a domain')).toBeNull()
    expect(memberIdToAuthEmail('nope', 'members.ibadat.example')).toBeNull()
  })
})
