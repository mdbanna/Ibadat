// Unit tests for the Edge Function business logic with fake ports (no Deno, no Supabase). The Deno entry points themselves
// are NOT executed here: they only wire these ports to supabase-js.
import { describe, expect, it, vi } from 'vitest'
import { completeFirstLogin, createMember, validateCreateMember, type CreateMemberPorts, type FirstLoginPorts } from './members'

const valid = { fullName: 'আব্দুল করিম', phone: '০১৭১২৩৪৫৬৭৮', nidNumber: '1234567890', email: 'a@example.org', district: 'Dhaka' }
const ADMIN = 'admin-uuid'

function ports(over: Partial<CreateMemberPorts> = {}) {
  const calls: string[] = []
  const p: CreateMemberPorts = {
    isAdmin: vi.fn(async (id) => id === ADMIN),
    allocateMemberId: vi.fn(async () => { calls.push('allocate'); return 'IBD-0001' }),
    createAuthUser: vi.fn(async () => { calls.push('createAuth'); return { id: 'new-user' } }),
    deleteAuthUser: vi.fn(async () => { calls.push('deleteAuth') }),
    insertProfile: vi.fn(async () => { calls.push('profile'); return {} }),
    insertPrivateDetails: vi.fn(async () => { calls.push('details'); return {} }),
    approveApplication: vi.fn(async () => { calls.push('approve'); return {} }),
    today: () => '2026-10-13',
    ...over,
  }
  return { p, calls }
}

describe('validateCreateMember', () => {
  it('normalizes the phone and NID', () => {
    const r = validateCreateMember({ ...valid, nidNumber: '123 456-7890' })
    expect(r.ok && r.value.phone).toBe('+8801712345678')
    expect(r.ok && r.value.nidNumber).toBe('1234567890')
  })
  it.each([['phone', '12345'], ['nidNumber', '12345'], ['fullName', 'x'], ['email', 'nope'], ['dateOfBirth', '13/01/1990'], ['applicationId', 'not-a-uuid']])('rejects a bad %s', (field, value) => {
    const r = validateCreateMember({ ...valid, [field]: value })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.fields[field]).toBe('invalid')
  })
  it('accepts 10, 13 and 17 digit NIDs only', () => {
    for (const nid of ['1234567890', '1234567890123', '12345678901234567']) expect(validateCreateMember({ ...valid, nidNumber: nid }).ok).toBe(true)
    for (const nid of ['123456789', '12345678901', '123456789012345678']) expect(validateCreateMember({ ...valid, nidNumber: nid }).ok).toBe(false)
  })
})

describe('createMember', () => {
  it('creates the Auth account with the phone-derived email and the phone as first password, then profile and NID', async () => {
    const { p, calls } = ports()
    const r = await createMember(valid, ADMIN, 'members.test', p)
    expect(r).toEqual({ ok: true, memberId: 'IBD-0001', profileId: 'new-user', phone: '+8801712345678', initialPassword: '01712345678' })
    expect(p.createAuthUser).toHaveBeenCalledWith('8801712345678@members.test', '01712345678')
    expect(calls).toEqual(['allocate', 'createAuth', 'profile', 'details'])
    expect(p.insertProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-user', member_id: 'IBD-0001', phone: '+8801712345678', membership_status: 'active', membership_start_date: '2026-10-13' }))
    expect(p.insertPrivateDetails).toHaveBeenCalledWith({ profile_id: 'new-user', nid_number: '1234567890' })
  })
  it('refuses anyone who is not an administrator, before doing anything', async () => {
    for (const caller of [null, 'a-member', '']) {
      const { p } = ports()
      expect(await createMember(valid, caller, 'members.test', p)).toEqual({ ok: false, code: 'forbidden' })
      expect(p.createAuthUser).not.toHaveBeenCalled()
      expect(p.allocateMemberId).not.toHaveBeenCalled()
    }
  })
  it('validates before touching the backend', async () => {
    const { p } = ports()
    const r = await createMember({ ...valid, phone: 'bad' }, ADMIN, 'members.test', p)
    expect(r).toMatchObject({ ok: false, code: 'invalid' })
    expect(p.createAuthUser).not.toHaveBeenCalled()
  })
  it('reports an existing account for that phone number', async () => {
    const { p } = ports({ createAuthUser: vi.fn(async () => ({ error: 'exists' as const })) })
    expect(await createMember(valid, ADMIN, 'members.test', p)).toEqual({ ok: false, code: 'phone_taken' })
    expect(p.insertProfile).not.toHaveBeenCalled()
  })
  it('deletes the Auth account again when the profile cannot be saved (no half-created member)', async () => {
    const { p, calls } = ports({ insertProfile: vi.fn(async () => ({ error: 'phone_taken' as const })) })
    expect(await createMember(valid, ADMIN, 'members.test', p)).toEqual({ ok: false, code: 'phone_taken' })
    expect(calls).toContain('deleteAuth')
    expect(p.insertPrivateDetails).not.toHaveBeenCalled()
  })
  it('deletes the Auth account again when the NID is already used', async () => {
    const { p, calls } = ports({ insertPrivateDetails: vi.fn(async () => ({ error: 'nid_taken' as const })) })
    expect(await createMember(valid, ADMIN, 'members.test', p)).toEqual({ ok: false, code: 'nid_taken' })
    expect(calls.at(-1)).toBe('deleteAuth')
  })
  it('links and approves the application when one is given, and rolls back if that fails', async () => {
    const appId = '123e4567-e89b-12d3-a456-426614174000'
    const ok = ports()
    await createMember({ ...valid, applicationId: appId }, ADMIN, 'members.test', ok.p)
    expect(ok.p.approveApplication).toHaveBeenCalledWith(appId, 'new-user', ADMIN)
    const bad = ports({ approveApplication: vi.fn(async () => ({ error: 'failed' as const })) })
    expect(await createMember({ ...valid, applicationId: appId }, ADMIN, 'members.test', bad.p)).toEqual({ ok: false, code: 'failed' })
    expect(bad.calls).toContain('deleteAuth')
  })
  it('fails safely when the email domain is not configured', async () => {
    const { p } = ports()
    expect(await createMember(valid, ADMIN, '', p)).toEqual({ ok: false, code: 'failed' })
    expect(p.createAuthUser).not.toHaveBeenCalled()
  })
})

describe('completeFirstLogin', () => {
  const fl = (over: Partial<FirstLoginPorts> = {}, profile: { phone: string; must_change_password: boolean } | null = { phone: '+8801712345678', must_change_password: true }): FirstLoginPorts => ({
    loadProfile: vi.fn(async () => profile), setPassword: vi.fn(async () => ({})), clearMustChange: vi.fn(async () => ({})), ...over,
  })
  it('changes the password and clears the flag, in that order', async () => {
    const order: string[] = []
    const p = fl({ setPassword: vi.fn(async () => { order.push('password'); return {} }), clearMustChange: vi.fn(async () => { order.push('flag'); return {} }) })
    expect(await completeFirstLogin('u1', 'a-good-passphrase', p)).toEqual({ ok: true })
    expect(order).toEqual(['password', 'flag'])
    expect(p.setPassword).toHaveBeenCalledWith('u1', 'a-good-passphrase')
  })
  it('refuses an unauthenticated caller or one without a profile', async () => {
    expect(await completeFirstLogin(null, 'a-good-passphrase', fl())).toEqual({ ok: false, code: 'unauthenticated' })
    expect(await completeFirstLogin('u1', 'a-good-passphrase', fl({}, null))).toEqual({ ok: false, code: 'unauthenticated' })
  })
  it('does nothing when the member already chose a password (cannot be used to reset anyone\'s password)', async () => {
    const p = fl({}, { phone: '+8801712345678', must_change_password: false })
    expect(await completeFirstLogin('u1', 'a-good-passphrase', p)).toEqual({ ok: false, code: 'not_required' })
    expect(p.setPassword).not.toHaveBeenCalled()
  })
  it('rejects short passwords and the phone number itself', async () => {
    const p = fl()
    expect(await completeFirstLogin('u1', 'short', p)).toEqual({ ok: false, code: 'too_short' })
    expect(await completeFirstLogin('u1', '01712345678', p)).toEqual({ ok: false, code: 'same_as_phone' })
    expect(await completeFirstLogin('u1', 12345678 as never, p)).toEqual({ ok: false, code: 'too_short' })
    expect(p.setPassword).not.toHaveBeenCalled()
  })
  it('keeps the flag set when the password update fails, so the member can retry', async () => {
    const p = fl({ setPassword: vi.fn(async () => ({ error: 'failed' as const })) })
    expect(await completeFirstLogin('u1', 'a-good-passphrase', p)).toEqual({ ok: false, code: 'failed' })
    expect(p.clearMustChange).not.toHaveBeenCalled()
  })
})
