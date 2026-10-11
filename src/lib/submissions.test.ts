import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase } from '../test/fakeSupabase'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import { submitApplication, submitContactMessage } from './submissions'

const join = {
  fullName: '  রহিম উদ্দিন ', phone: '০১৭১২-৩৪৫৬৭৮', email: '', dateOfBirth: '', occupation: 'Teacher',
  addressLine: '', district: 'Dhaka', upazila: '', motivation: '', consent: true,
}

describe('submitApplication', () => {
  beforeEach(() => { h.client = null })

  it('calls submit_membership_application with trimmed, normalized values and nulls for blanks', async () => {
    const fake = makeFakeSupabase({}, { submit_membership_application: () => ({ data: 'APP-2026-00001', error: null }) })
    h.client = fake.client
    const r = await submitApplication(join, 'bn')
    expect(r).toEqual({ ok: true, value: 'APP-2026-00001' })
    expect(fake.rpc).toHaveBeenCalledWith('submit_membership_application', {
      p_full_name: 'রহিম উদ্দিন', p_phone: '01712345678', p_email: null, p_date_of_birth: null, p_occupation: 'Teacher',
      p_address_line: null, p_district: 'Dhaka', p_upazila: null, p_motivation: null, p_preferred_language: 'bn', p_consent: true,
    })
  })
  it('maps database errors to friendly categories', async () => {
    const cases: Array<[{ message: string; code?: string }, string]> = [
      [{ message: 'application_not_accepted', code: '23505' }, 'duplicate'],
      [{ message: 'new row violates check constraint', code: '23514' }, 'invalid'],
      [{ message: 'consent_required', code: '22023' }, 'invalid'],
      [{ message: 'boom' }, 'unavailable'],
    ]
    for (const [error, expected] of cases) {
      h.client = makeFakeSupabase({}, { submit_membership_application: () => ({ data: null, error }) }).client
      expect(await submitApplication(join, 'en')).toEqual({ ok: false, error: expected })
    }
  })
  it('is "unavailable" (not a crash) when Supabase is not configured', async () => {
    expect(await submitApplication(join, 'bn')).toEqual({ ok: false, error: 'unavailable' })
  })
})

describe('submitContactMessage', () => {
  const msg = { name: 'Visitor', email: '', phone: '০১৭১২৩৪৫৬৭৮', subject: '', message: ' Hello there, friends ' }
  beforeEach(() => { h.client = null })
  it('sends normalized values', async () => {
    const fake = makeFakeSupabase({}, { submit_contact_message: () => ({ data: null, error: null }) })
    h.client = fake.client
    expect(await submitContactMessage(msg, 'en')).toEqual({ ok: true })
    expect(fake.rpc).toHaveBeenCalledWith('submit_contact_message', {
      p_name: 'Visitor', p_email: null, p_phone: '01712345678', p_subject: null, p_message: 'Hello there, friends', p_preferred_language: 'en',
    })
  })
  it('maps the hourly cap to rate_limited', async () => {
    h.client = makeFakeSupabase({}, { submit_contact_message: () => ({ data: null, error: { message: 'too_many_requests', code: '53400' } }) }).client
    expect(await submitContactMessage(msg, 'bn')).toEqual({ ok: false, error: 'rate_limited' })
  })
})
