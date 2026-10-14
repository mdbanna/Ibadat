import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase } from '../../test/fakeSupabase'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('../../lib/supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import i18n from '../../i18n'
import { ContactForm } from './ContactForm'
import { JoinForm } from './JoinForm'

describe('JoinForm', () => {
  beforeEach(() => { h.client = null })

  it('shows Bengali validation messages, focuses the first problem and sends nothing when invalid', async () => {
    const fake = makeFakeSupabase()
    h.client = fake.client
    const user = userEvent.setup()
    render(<JoinForm />)
    await user.click(screen.getByRole('button', { name: 'আবেদন জমা দিন' }))
    expect(screen.getAllByText('এই তথ্যটি আবশ্যক').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('সম্মতি দেওয়া আবশ্যক')).toBeInTheDocument()
    expect(screen.getByLabelText(/পূর্ণ নাম/)).toHaveFocus()
    expect(fake.rpc).not.toHaveBeenCalled()
  })

  it('submits a valid application through the RPC and shows the reference number', async () => {
    const fake = makeFakeSupabase({}, { submit_membership_application: () => ({ data: 'APP-2026-00042', error: null }) })
    h.client = fake.client
    const user = userEvent.setup()
    render(<JoinForm />)
    await user.type(screen.getByLabelText(/পূর্ণ নাম/), 'রহিম উদ্দিন')
    await user.type(screen.getByLabelText(/মোবাইল নম্বর/), '০১৭১২৩৪৫৬৭৮')
    await user.click(screen.getByLabelText(/আমি তথ্য সংরক্ষণ/))
    await user.click(screen.getByRole('button', { name: 'আবেদন জমা দিন' }))
    expect(await screen.findByText('APP-2026-00042')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'আপনার আবেদন জমা হয়েছে' })).toHaveFocus()
    expect(fake.rpc).toHaveBeenCalledTimes(1)
    expect(fake.rpc.mock.calls[0][1]).toMatchObject({ p_phone: '+8801712345678', p_preferred_language: 'bn', p_consent: true })
  })

  it('sends the interface language with the application', async () => {
    const fake = makeFakeSupabase({}, { submit_membership_application: () => ({ data: 'APP-2026-00043', error: null }) })
    h.client = fake.client
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    render(<JoinForm />)
    await user.type(screen.getByLabelText(/Full name/), 'Rahim Uddin')
    await user.type(screen.getByLabelText(/Mobile number/), '01712345678')
    await user.click(screen.getByLabelText(/I consent/))
    await user.click(screen.getByRole('button', { name: 'Submit application' }))
    await screen.findByText('APP-2026-00043')
    expect(fake.rpc.mock.calls[0][1]).toMatchObject({ p_preferred_language: 'en' })
  })

  it('explains a duplicate application and keeps the form so nothing is lost', async () => {
    h.client = makeFakeSupabase({}, { submit_membership_application: () => ({ data: null, error: { message: 'application_not_accepted', code: '23505' } }) }).client
    const user = userEvent.setup()
    render(<JoinForm />)
    await user.type(screen.getByLabelText(/পূর্ণ নাম/), 'রহিম উদ্দিন')
    await user.type(screen.getByLabelText(/মোবাইল নম্বর/), '01712345678')
    await user.click(screen.getByLabelText(/আমি তথ্য সংরক্ষণ/))
    await user.click(screen.getByRole('button', { name: 'আবেদন জমা দিন' }))
    expect(await screen.findByText('এই মোবাইল নম্বর দিয়ে একটি আবেদন ইতিমধ্যে পর্যালোচনাধীন আছে।')).toBeInTheDocument()
    expect(screen.getByLabelText(/পূর্ণ নাম/)).toHaveValue('রহিম উদ্দিন')
  })

  it('says applications are unavailable (instead of crashing) when Supabase is not configured', async () => {
    const user = userEvent.setup()
    render(<JoinForm />)
    await user.type(screen.getByLabelText(/পূর্ণ নাম/), 'রহিম উদ্দিন')
    await user.type(screen.getByLabelText(/মোবাইল নম্বর/), '01712345678')
    await user.click(screen.getByLabelText(/আমি তথ্য সংরক্ষণ/))
    await user.click(screen.getByRole('button', { name: 'আবেদন জমা দিন' }))
    expect(await screen.findByText(/এই মুহূর্তে আবেদন জমা নেওয়া যাচ্ছে না/)).toBeInTheDocument()
  })

  it('silently drops submissions that fill the honeypot field', async () => {
    const fake = makeFakeSupabase()
    h.client = fake.client
    const user = userEvent.setup()
    const { container } = render(<JoinForm />)
    await user.type(screen.getByLabelText(/পূর্ণ নাম/), 'Bot Name')
    await user.type(screen.getByLabelText(/মোবাইল নম্বর/), '01712345678')
    await user.click(screen.getByLabelText(/আমি তথ্য সংরক্ষণ/))
    await user.type(container.querySelector('input[name="website"]') as HTMLInputElement, 'http://spam.example')
    await user.click(screen.getByRole('button', { name: 'আবেদন জমা দিন' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'আপনার আবেদন জমা হয়েছে' })).toBeInTheDocument())
    expect(fake.rpc).not.toHaveBeenCalled()
  })
})

describe('ContactForm', () => {
  beforeEach(() => { h.client = null })

  it('requires an email or a phone number', async () => {
    const fake = makeFakeSupabase()
    h.client = fake.client
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.type(screen.getByLabelText(/আপনার নাম/), 'Visitor')
    await user.type(screen.getByLabelText(/বার্তা/), 'একটি যথেষ্ট লম্বা বার্তা')
    await user.click(screen.getByRole('button', { name: 'বার্তা পাঠান' }))
    expect(screen.getByRole('alert')).toHaveTextContent('ইমেইল অথবা মোবাইল নম্বর দিন')
    expect(fake.rpc).not.toHaveBeenCalled()
  })

  it('sends a valid message and confirms', async () => {
    const fake = makeFakeSupabase({}, { submit_contact_message: () => ({ data: null, error: null }) })
    h.client = fake.client
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.type(screen.getByLabelText(/আপনার নাম/), 'Visitor')
    await user.type(screen.getByLabelText(/ইমেইল/), 'v@example.org')
    await user.type(screen.getByLabelText(/বার্তা/), 'একটি যথেষ্ট লম্বা বার্তা')
    await user.click(screen.getByRole('button', { name: 'বার্তা পাঠান' }))
    expect(await screen.findByRole('heading', { name: 'আপনার বার্তা পাঠানো হয়েছে' })).toBeInTheDocument()
    expect(fake.rpc).toHaveBeenCalledTimes(1)
  })

  it('tells the visitor when the hourly cap is hit', async () => {
    h.client = makeFakeSupabase({}, { submit_contact_message: () => ({ data: null, error: { message: 'too_many_requests', code: '53400' } }) }).client
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.type(screen.getByLabelText(/আপনার নাম/), 'Visitor')
    await user.type(screen.getByLabelText(/ইমেইল/), 'v@example.org')
    await user.type(screen.getByLabelText(/বার্তা/), 'একটি যথেষ্ট লম্বা বার্তা')
    await user.click(screen.getByRole('button', { name: 'বার্তা পাঠান' }))
    expect(await screen.findByText(/অনেক বেশি বার্তা এসেছে/)).toBeInTheDocument()
  })
})
