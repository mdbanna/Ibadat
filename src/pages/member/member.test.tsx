// MOCKED tests: Supabase is an in-memory fake. They verify routing, guards, UI states and what the app asks for.
// Real data isolation is verified separately (SQL tests + PostgREST integration tests), see docs/phase3-member-dashboard.md.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeAuth, makeFakeSupabase } from '../../test/fakeSupabase'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('../../lib/supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import App from '../../App'
import i18n from '../../i18n'
import { DASHBOARD_ITEMS } from '../../routes'

const UID = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const account = { email: 'ibd-0001@members.test', password: 'correct-horse', userId: UID }
const profile = (over: Record<string, unknown> = {}) => ({
  id: UID, member_id: 'IBD-0001', full_name: 'Test Member', phone: '01712345678', email: 'm@example.org', profile_image_path: null,
  short_bio: 'Hello', general_location: 'Dhaka', membership_status: 'active', membership_start_date: '2026-01-01',
  public_profile_preference: true, public_profile_approved: false, created_at: '2026-01-01T00:00:00Z', ...over,
})
const tables = (over: Record<string, unknown[]> = {}) => ({
  profiles: [profile()],
  contributions: [
    { id: 'c1', profile_id: UID, amount: 1000, currency: 'BDT', contribution_date: '2026-09-05', contribution_month: '2026-09-01', payment_method: 'bkash', transaction_reference: 'TRX1', receipt_path: `${UID}/r.pdf`, verification_status: 'verified', verified_at: '2026-09-06T00:00:00Z', created_at: '2026-09-05T00:00:00Z' },
    { id: 'c2', profile_id: UID, amount: 500, currency: 'BDT', contribution_date: '2026-10-02', contribution_month: '2026-10-01', payment_method: 'cash', transaction_reference: null, receipt_path: null, verification_status: 'pending', verified_at: null, created_at: '2026-10-02T00:00:00Z' },
  ],
  funds: [
    { fund_type: 'emergency_medical', name: 'Emergency Medical Fund', name_bn: 'জরুরি চিকিৎসা তহবিল', description: null, description_bn: null, default_allocation_percent: 25, active_status: true },
    { fund_type: 'direct_aid', name: 'Direct Aid Fund', name_bn: 'সরাসরি সহায়তা তহবিল', description: null, description_bn: null, default_allocation_percent: 50, active_status: true },
    { fund_type: 'employment', name: 'Employment Fund', name_bn: 'কর্মসংস্থান তহবিল', description: null, description_bn: null, default_allocation_percent: 25, active_status: true },
  ],
  monthly_reports: [{ id: 'r1', reporting_month: '2026-09-01', summary_bn: 'সারসংক্ষেপ', summary_en: 'Summary', published_at: '2026-10-05T00:00:00Z', verification_status: 'verified' }],
  monthly_report_fund_lines: [
    { report_id: 'r1', opening_balance: 0, total_in: 1000, total_out: 0, closing_balance: 1000, funds: { fund_type: 'direct_aid' } },
    { report_id: 'r1', opening_balance: 0, total_in: 500, total_out: 100, closing_balance: 400, funds: { fund_type: 'employment' } },
  ],
  announcements: [{ id: 'a1', title_bn: 'ঘোষণা', title_en: 'Notice', content_bn: 'বিস্তারিত', content_en: 'Details', audience: 'members', publication_status: 'published', published_at: '2026-10-01T00:00:00Z' }],
  documents: [{ id: 'd1', title_bn: 'গঠনতন্ত্র', title_en: 'Constitution', file_path: 'docs/c.pdf', document_type: 'constitution', access_level: 'members', publication_status: 'published', created_at: '2026-09-01T00:00:00Z' }],
  activities: [{ id: 'act1', slug: 'relief', title_bn: 'ত্রাণ', title_en: 'Relief', description_bn: null, description_en: null, activity_date: '2026-09-01', general_location: null, cover_image_path: null, publication_status: 'published' }],
  ...over,
})
const rpcs = {
  get_assistance_summary: () => ({ data: [
    { fund_type: 'direct_aid', cases_total: 4, cases_completed: 3, cases_in_progress: 1, disbursed_total: 12000, amounts_suppressed: false },
    { fund_type: 'employment', cases_total: 0, cases_completed: 0, cases_in_progress: 0, disbursed_total: 0, amounts_suppressed: false },
    { fund_type: 'emergency_medical', cases_total: 2, cases_completed: 1, cases_in_progress: 1, disbursed_total: null, amounts_suppressed: true },
  ], error: null }),
  get_employment_summary: () => ({ data: [{ projects_total: 3, projects_planned: 1, projects_approved: 0, projects_in_progress: 1, projects_completed: 1, approved_budget_total: 60000, actual_expense_total: 47000, amounts_suppressed: false }], error: null }),
}

function boot(opts: { path: string; signedIn?: boolean; data?: ReturnType<typeof tables>; extraAccounts?: Array<{ email: string; password: string; userId: string }> }) {
  const fakeAuth = makeFakeAuth([account, ...(opts.extraAccounts ?? [])], opts.signedIn ? { userId: UID, email: account.email } : undefined)
  const fake = makeFakeSupabase(opts.data ?? tables(), rpcs, fakeAuth.auth)
  h.client = fake.client
  window.history.pushState({}, '', opts.path)
  const view = render(<App />)
  return { fake, fakeAuth, view }
}

beforeEach(() => { vi.stubEnv('VITE_MEMBER_AUTH_EMAIL_DOMAIN', 'members.test'); localStorage.clear() })
afterEach(() => { vi.unstubAllEnvs(); h.client = null; window.history.pushState({}, '', '/') })

describe('protected routes', () => {
  it.each(DASHBOARD_ITEMS.map((i) => i.to))('unauthenticated visitor to %s is sent to the login page with a safe return path', async (path) => {
    boot({ path })
    expect(await screen.findByRole('heading', { level: 1, name: 'সদস্য লগইন' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('next')).toBe(path)
    expect(screen.getByText('চালিয়ে যেতে লগইন করুন')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).not.toBeInTheDocument()
  })

  it('unconfigured Supabase shows a clear message, never the dashboard', async () => {
    h.client = null
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    expect(await screen.findByText('ডাটাবেস সংযোগ এখনো কনফিগার করা হয়নি')).toBeInTheDocument()
  })

  it.each([['pending', 'আপনার সদস্যপদ এখনো সক্রিয় হয়নি'], ['suspended', 'আপনার সদস্যপদ বর্তমানে স্থগিত'], ['resigned', 'আপনার সদস্যপদ সক্রিয় নয়']])(
    'a signed-in %s member is blocked from the dashboard', async (membership_status, title) => {
      boot({ path: '/dashboard/contributions', signedIn: true, data: tables({ profiles: [profile({ membership_status })] }) })
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).not.toBeInTheDocument()
    })

  it('a signed-in account with no member profile is blocked', async () => {
    boot({ path: '/dashboard', signedIn: true, data: tables({ profiles: [] }) })
    expect(await screen.findByRole('heading', { level: 1, name: 'আপনার সদস্য প্রোফাইল পাওয়া যায়নি' })).toBeInTheDocument()
  })

  it('an active member with a persisted session lands directly on the requested section', async () => {
    boot({ path: '/dashboard/contributions', signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'আমার অনুদানের ইতিহাস' })).toBeInTheDocument()
  })
})

describe('login flow', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, id: string, pw: string) {
    await user.type(await screen.findByLabelText(/সদস্য আইডি/), id)
    await user.type(screen.getByLabelText(/পাসওয়ার্ড/, { selector: 'input' }), pw)
    await user.click(screen.getByRole('button', { name: 'লগইন করুন' }))
  }

  it('validates the form in Bengali before contacting Supabase', async () => {
    const { fakeAuth } = boot({ path: '/login' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'লগইন করুন' }))
    expect(screen.getAllByText('এই তথ্যটি আবশ্যক')).toHaveLength(2)
    expect(screen.getByLabelText(/সদস্য আইডি/)).toHaveFocus()
    await user.type(screen.getByLabelText(/সদস্য আইডি/), 'abc')
    await user.click(screen.getByRole('button', { name: 'লগইন করুন' }))
    expect(screen.getByText('সদস্য আইডি সঠিক নয় (যেমন IBD-0001)')).toBeInTheDocument()
    expect(fakeAuth.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('logs in with real-shaped credentials and returns the member to the page they asked for', async () => {
    boot({ path: '/dashboard/profile' })
    const user = userEvent.setup()
    await fill(user, 'ibd-0001', 'correct-horse')
    expect(await screen.findByRole('heading', { level: 1, name: 'আমার প্রোফাইল' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard/profile')
    expect(screen.getByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).toBeInTheDocument()
  })

  it('shows one generic message for a wrong password and keeps the visitor on the login page', async () => {
    boot({ path: '/login' })
    const user = userEvent.setup()
    await fill(user, 'IBD-0001', 'nope')
    expect(await screen.findByRole('alert')).toHaveTextContent('সদস্য আইডি বা পাসওয়ার্ড সঠিক নয়।')
    expect(window.location.pathname).toBe('/login')
    expect(screen.getByLabelText(/পাসওয়ার্ড/, { selector: 'input' })).toHaveValue('')
  })

  it('gives the SAME message for an unknown Member ID (no account enumeration)', async () => {
    boot({ path: '/login' })
    const user = userEvent.setup()
    await fill(user, 'IBD-9999', 'whatever')
    expect(await screen.findByRole('alert')).toHaveTextContent('সদস্য আইডি বা পাসওয়ার্ড সঠিক নয়।')
  })

  it('a correct password for an account whose profile belongs to another Member ID is refused', async () => {
    boot({ path: '/login', data: tables({ profiles: [profile({ member_id: 'IBD-0002' })] }) })
    const user = userEvent.setup()
    await fill(user, 'IBD-0001', 'correct-horse')
    expect(await screen.findByRole('alert')).toHaveTextContent('সদস্য আইডি বা পাসওয়ার্ড সঠিক নয়।')
    expect(window.location.pathname).toBe('/login')
  })

  it('a correct password for a pending member shows the inactive message, not the dashboard', async () => {
    boot({ path: '/login', data: tables({ profiles: [profile({ membership_status: 'pending' })] }) })
    const user = userEvent.setup()
    await fill(user, 'IBD-0001', 'correct-horse')
    expect(await screen.findByRole('heading', { level: 1, name: 'আপনার সদস্যপদ এখনো সক্রিয় হয়নি' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).not.toBeInTheDocument()
  })

  it('password visibility toggle works and is announced', async () => {
    boot({ path: '/login' })
    const user = userEvent.setup()
    const pw = await screen.findByLabelText(/পাসওয়ার্ড/, { selector: 'input' })
    expect(pw).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'পাসওয়ার্ড দেখান' }))
    expect(pw).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'পাসওয়ার্ড লুকান' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('an open-redirect style next parameter falls back to the dashboard', async () => {
    boot({ path: '/login?next=' + encodeURIComponent('https://evil.example/x') })
    const user = userEvent.setup()
    await fill(user, 'IBD-0001', 'correct-horse')
    expect(await screen.findByRole('heading', { level: 1, name: /স্বাগতম/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('logout ends the session, shows the notice, and the dashboard is locked again', async () => {
    boot({ path: '/dashboard', signedIn: true })
    const user = userEvent.setup()
    await screen.findByRole('heading', { level: 1, name: /স্বাগতম/ })
    await user.click(within(screen.getByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).getByRole('button', { name: 'লগআউট' }))
    expect(await screen.findByText('আপনি সফলভাবে লগআউট করেছেন')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    window.history.pushState({}, '', '/dashboard/documents')
    window.dispatchEvent(new PopStateEvent('popstate'))
    // wait for the guard's redirect to settle (the login heading is already on screen, so waiting for it alone would race)
    await waitFor(() => expect(window.location.search).toContain('next=%2Fdashboard%2Fdocuments'))
    expect(window.location.pathname).toBe('/login')
    expect(await screen.findByRole('heading', { level: 1, name: 'সদস্য লগইন' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).not.toBeInTheDocument()
  })
})

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/

describe.each(['bn', 'en'] as const)('dashboard sections in %s', (lang) => {
  beforeEach(async () => { await i18n.changeLanguage(lang) })

  it.each(DASHBOARD_ITEMS.map((i) => i.to))('%s: renders real data, one h1, no raw keys, no accessibility violations', async (path) => {
    const { view } = boot({ path, signedIn: true })
    await screen.findAllByRole('heading', { level: 1 })
    await waitFor(() => expect(screen.queryByText(i18n.t('common.loading'))).not.toBeInTheDocument())
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: i18n.t('member.navLabel') })).toBeInTheDocument()
    const walker = document.createTreeWalker(view.container, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) expect((n.textContent ?? '').trim()).not.toMatch(KEY_PATTERN)
    const results = await axe.run(view.container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
})

describe('section content', () => {
  it('overview greets the member and totals only their verified contributions', async () => {
    boot({ path: '/dashboard', signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'স্বাগতম, Test Member' })).toBeInTheDocument()
    expect(await screen.findByText('১টি যাচাইকৃত অনুদান')).toBeInTheDocument()
    expect(screen.getAllByText(/১,০০০/).length).toBeGreaterThan(0)
  })
  it('contribution history shows the member\'s own rows with status and receipt', async () => {
    boot({ path: '/dashboard/contributions', signedIn: true })
    expect(await screen.findAllByText('TRX1')).not.toHaveLength(0)
    expect(screen.getAllByText('যাচাইকৃত').length).toBeGreaterThan(0)
    expect((await screen.findAllByRole('link', { name: 'রসিদ দেখুন' }))[0]).toHaveAttribute('href', `https://signed.test/${UID}/r.pdf`)
  })
  it('assistance shows aggregates, withholds small-cell amounts and never shows individual cases', async () => {
    boot({ path: '/dashboard/assistance', signedIn: true })
    expect(await screen.findByText(/১২,০০০/)).toBeInTheDocument()
    expect(screen.getAllByText('গোপনীয়তার জন্য গোপন রাখা হয়েছে').length).toBeGreaterThan(0)
    expect(screen.getByText(/গোপনীয়তা সুরক্ষা/)).toBeInTheDocument()
  })
  it('medical page shows only the Emergency Medical Fund', async () => {
    boot({ path: '/dashboard/medical', signedIn: true })
    expect(await screen.findByRole('heading', { level: 2, name: 'জরুরি চিকিৎসা তহবিল' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'সরাসরি সহায়তা তহবিল' })).not.toBeInTheDocument()
  })
  it('employment shows totals when there are enough projects', async () => {
    boot({ path: '/dashboard/employment', signedIn: true })
    expect(await screen.findByText(/৬০,০০০/)).toBeInTheDocument()
  })
  it('reports show per-fund lines for published reports', async () => {
    boot({ path: '/dashboard/reports', signedIn: true })
    expect(await screen.findAllByText('সেপ্টেম্বর ২০২৬')).not.toHaveLength(0)
    expect(screen.getAllByText('সরাসরি সহায়তা তহবিল').length).toBeGreaterThan(0)
  })
  it('funds page shows each fund with its share and the latest balance', async () => {
    boot({ path: '/dashboard/funds', signedIn: true })
    expect(await screen.findAllByText(/প্রতিটি অনুদানের ৫০% এই তহবিলে যায়/)).not.toHaveLength(0)
  })
  it('empty states: no reports, no documents, no announcements', async () => {
    boot({ path: '/dashboard/reports', signedIn: true, data: tables({ monthly_reports: [], documents: [], announcements: [] }) })
    expect(await screen.findByText('এখনো কোনো প্রতিবেদন প্রকাশিত হয়নি')).toBeInTheDocument()
  })
  it('documents link to signed URLs', async () => {
    boot({ path: '/dashboard/documents', signedIn: true })
    expect(await screen.findByRole('link', { name: 'নথি খুলুন' })).toHaveAttribute('href', 'https://signed.test/docs/c.pdf')
  })
})

describe('what the dashboard asks the backend for (mocked: scoping, not security)', () => {
  it('only touches member-safe tables and database functions, and scopes personal queries to the signed-in user', async () => {
    const { fake } = boot({ path: '/dashboard', signedIn: true })
    await screen.findByRole('heading', { level: 1, name: /স্বাগতম/ })
    const user = userEvent.setup()
    for (const item of DASHBOARD_ITEMS.slice(1)) {
      await user.click(within(screen.getByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).getByRole('link', { name: i18n.t(item.key as never) as string }))
      await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1))
    }
    const touched = new Set(fake.queries.map((q) => q.table))
    const allowed = new Set(['profiles', 'contributions', 'funds', 'monthly_reports', 'monthly_report_fund_lines', 'announcements', 'documents', 'activities'])
    for (const t of touched) expect(allowed.has(t), `unexpected table ${t}`).toBe(true)
    for (const forbidden of ['user_roles', 'fund_transactions', 'beneficiaries', 'assistance_records', 'employment_projects', 'audit_logs', 'membership_applications', 'contact_messages']) {
      expect(touched.has(forbidden), forbidden).toBe(false)
    }
    expect(new Set(fake.rpc.mock.calls.map((c) => c[0]))).toEqual(new Set(['get_assistance_summary', 'get_employment_summary']))
    const eqs = (table: string) => fake.queries.filter((q) => q.table === table).flatMap((q) => q.ops.filter(([o]) => o === 'eq'))
    expect(eqs('profiles').every(([, a]) => a[0] === 'id' && a[1] === UID)).toBe(true)
    expect(eqs('contributions').every(([, a]) => a[0] !== 'profile_id' || a[1] === UID)).toBe(true)
    expect(eqs('contributions').some(([, a]) => a[0] === 'profile_id' && a[1] === UID)).toBe(true)
    expect(JSON.stringify([...fake.queries])).not.toContain(OTHER)
  })

  it('never requests internal admin ids or select(*) on member pages', async () => {
    const { fake } = boot({ path: '/dashboard/contributions', signedIn: true })
    await screen.findByRole('heading', { level: 1, name: 'আমার অনুদানের ইতিহাস' })
    await screen.findAllByText('TRX1')
    for (const q of fake.queries) {
      for (const [op, args] of q.ops) if (op === 'select') {
        expect(String(args[0])).not.toBe('*')
        expect(String(args[0])).not.toMatch(/created_by|verified_by|reversed_by|approved_by/)
      }
    }
  })
})

describe('profile editing and settings', () => {
  it('saving sends only descriptive fields (never status, member id or approval) and confirms', async () => {
    const { fake } = boot({ path: '/dashboard/profile', signedIn: true })
    const user = userEvent.setup()
    const name = await screen.findByLabelText(/পূর্ণ নাম/)
    await user.clear(name)
    await user.type(name, 'Renamed Member')
    await user.click(screen.getByRole('button', { name: 'সংরক্ষণ করুন' }))
    expect(await screen.findByText('প্রোফাইল সংরক্ষিত হয়েছে।')).toBeInTheDocument()
    const update = fake.queries.flatMap((q) => q.ops).find(([o]) => o === 'update')
    expect(update).toBeDefined()
    const patch = (update as [string, unknown[]])[1][0] as Record<string, unknown>
    expect(Object.keys(patch).sort()).toEqual(['email', 'full_name', 'general_location', 'phone', 'public_profile_preference', 'short_bio'])
    expect(patch.full_name).toBe('Renamed Member')
    for (const forbidden of ['membership_status', 'member_id', 'public_profile_approved', 'id', 'membership_start_date']) expect(patch).not.toHaveProperty(forbidden)
  })

  it('validates profile fields client-side', async () => {
    const { fake } = boot({ path: '/dashboard/profile', signedIn: true })
    const user = userEvent.setup()
    const phone = await screen.findByLabelText(/মোবাইল নম্বর/)
    await user.clear(phone)
    await user.type(phone, '12ab')
    await user.click(screen.getByRole('button', { name: 'সংরক্ষণ করুন' }))
    expect(await screen.findByText('সঠিক মোবাইল নম্বর দিন')).toBeInTheDocument()
    expect(fake.queries.flatMap((q) => q.ops).some(([o]) => o === 'update')).toBe(false)
  })

  it('rejects a wrong photo type and an oversized photo without uploading', async () => {
    const { fake } = boot({ path: '/dashboard/profile', signedIn: true })
    const input = (await screen.findByLabelText(/ছবি বাছাই করুন|প্রোফাইল ছবি/, { selector: 'input[type=file]' }).catch(() => document.getElementById('photo-input'))) as HTMLInputElement
    const user = userEvent.setup({ applyAccept: false })
    await user.upload(input, new File(['x'], 'a.gif', { type: 'image/gif' }))
    expect(await screen.findByText('শুধু JPG, PNG বা WebP ছবি দেওয়া যাবে।')).toBeInTheDocument()
    await user.upload(input, new File([new Uint8Array(3 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText('ছবির আকার ২ এমবির বেশি হতে পারবে না।')).toBeInTheDocument()
    expect(fake.upload).not.toHaveBeenCalled()
  })

  it('password change: re-checks the current password, validates, then updates and signs out other sessions', async () => {
    const { fakeAuth } = boot({ path: '/dashboard/settings', signedIn: true })
    const user = userEvent.setup()
    const field = (label: RegExp) => screen.getByLabelText(label, { selector: 'input' })
    await screen.findByRole('heading', { level: 1, name: 'অ্যাকাউন্ট সেটিংস' })

    await user.type(field(/^বর্তমান পাসওয়ার্ড/), 'wrong-current')
    await user.type(field(/^নতুন পাসওয়ার্ড\*?$/), 'brand-new-pass')
    await user.type(field(/আবার লিখুন/), 'different')
    await user.click(screen.getByRole('button', { name: 'পাসওয়ার্ড পরিবর্তন করুন' }))
    expect(await screen.findByText('দুটি পাসওয়ার্ড মেলেনি।')).toBeInTheDocument()
    expect(fakeAuth.auth.updateUser).not.toHaveBeenCalled()

    await user.clear(field(/আবার লিখুন/))
    await user.type(field(/আবার লিখুন/), 'brand-new-pass')
    await user.click(screen.getByRole('button', { name: 'পাসওয়ার্ড পরিবর্তন করুন' }))
    expect(await screen.findByText('বর্তমান পাসওয়ার্ড সঠিক নয়।')).toBeInTheDocument()
    expect(fakeAuth.auth.updateUser).not.toHaveBeenCalled()

    await user.clear(field(/^বর্তমান পাসওয়ার্ড/))
    await user.type(field(/^বর্তমান পাসওয়ার্ড/), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'পাসওয়ার্ড পরিবর্তন করুন' }))
    expect(await screen.findByText('পাসওয়ার্ড পরিবর্তন হয়েছে।')).toBeInTheDocument()
    expect(fakeAuth.auth.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pass' })
    expect(fakeAuth.auth.signOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('enforces a minimum password length of 8', async () => {
    const { fakeAuth } = boot({ path: '/dashboard/settings', signedIn: true })
    const user = userEvent.setup()
    await screen.findByRole('heading', { level: 1, name: 'অ্যাকাউন্ট সেটিংস' })
    await user.type(screen.getByLabelText(/^বর্তমান পাসওয়ার্ড/, { selector: 'input' }), 'correct-horse')
    await user.type(screen.getByLabelText(/^নতুন পাসওয়ার্ড\*?$/, { selector: 'input' }), 'short')
    await user.type(screen.getByLabelText(/আবার লিখুন/, { selector: 'input' }), 'short')
    await user.click(screen.getByRole('button', { name: 'পাসওয়ার্ড পরিবর্তন করুন' }))
    expect(await screen.findByText('অন্তত ৮ অক্ষর লিখুন')).toBeInTheDocument()
    expect(fakeAuth.auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('language and navigation', () => {
  it('switching language inside the dashboard translates the page and persists across sections', async () => {
    boot({ path: '/dashboard/funds', signedIn: true })
    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'তহবিলের সারসংক্ষেপ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Fund overview' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    await user.click(within(screen.getByRole('navigation', { name: 'Dashboard sections' })).getByRole('link', { name: 'Monthly financial reports' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Monthly financial reports' })).toBeInTheDocument()
    expect(localStorage.getItem('ibadat.lang')).toBe('en')
  })

  it('the language survives login and logout', async () => {
    boot({ path: '/login' })
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Member ID/), 'IBD-0001')
    await user.type(screen.getByLabelText(/Password/, { selector: 'input' }), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Welcome/ })).toBeInTheDocument()
    await user.click(within(screen.getByRole('navigation', { name: 'Dashboard sections' })).getByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Member login' })).toBeInTheDocument()
  })

  it('on small screens the section menu is a disclosure that shows the current section and opens/closes', async () => {
    boot({ path: '/dashboard/reports', signedIn: true })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('button', { name: /ড্যাশবোর্ড মেনু/ })
    expect(toggle).toHaveTextContent('মাসিক আর্থিক প্রতিবেদন')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(screen.getByRole('navigation', { name: 'ড্যাশবোর্ডের অংশসমূহ' })).getByRole('link', { name: 'নথি ও নিয়মাবলি' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'নথি ও নিয়মাবলি' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ড্যাশবোর্ড মেনু/ })).toHaveAttribute('aria-expanded', 'false')
  })
})
