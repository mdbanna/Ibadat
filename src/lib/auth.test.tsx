// MOCKED tests: Supabase is replaced by an in-memory fake. They verify the app's own auth state machine and logic only.
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeAuth, makeFakeSupabase } from '../test/fakeSupabase'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import { AuthProvider, safeNext, useAuth, type AuthContextValue } from './auth'

const UID = '11111111-1111-1111-1111-111111111111'
const profile = (over: Record<string, unknown> = {}) => ({
  id: UID, member_id: 'IBD-0001', full_name: 'Test Member', phone: '+8801711111111', email: null, must_change_password: false, profile_image_path: null, short_bio: null,
  general_location: null, membership_status: 'active', membership_start_date: '2026-01-01', public_profile_preference: false,
  public_profile_approved: false, created_at: '2026-01-01T00:00:00Z', ...over,
})
const account = { email: '8801711111111@members.test', password: 'correct-horse', userId: UID }

let ctx: AuthContextValue
function Probe() { ctx = useAuth(); return <p data-testid="s">{ctx.status}|{ctx.access ?? '-'}|{ctx.notice ?? '-'}</p> }
const state = () => screen.getByTestId('s').textContent

function mount(opts: { profiles?: ReturnType<typeof profile>[]; signedIn?: boolean; unconfigured?: boolean } = {}) {
  const fakeAuth = makeFakeAuth([account], opts.signedIn ? { userId: UID, email: account.email } : undefined)
  const fake = makeFakeSupabase({ profiles: opts.profiles ?? [profile()] }, {}, fakeAuth.auth)
  h.client = opts.unconfigured ? null : fake.client
  render(<AuthProvider><Probe /></AuthProvider>)
  return { fake, fakeAuth }
}

beforeEach(() => { vi.stubEnv('VITE_MEMBER_AUTH_EMAIL_DOMAIN', 'members.test') })
afterEach(() => { vi.unstubAllEnvs(); h.client = null })

describe('AuthProvider: restoring state', () => {
  it('is "unconfigured" when Supabase is not configured', async () => {
    mount({ unconfigured: true })
    expect(state()).toBe('unconfigured|-|-')
  })
  it('is signed out when there is no stored session', async () => {
    mount()
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
  })
  it('restores a persisted session and opens access for an ACTIVE member', async () => {
    mount({ signedIn: true })
    await waitFor(() => expect(state()).toBe('ready|active|-'))
    expect(ctx.profile?.member_id).toBe('IBD-0001')
  })
  it.each(['pending', 'suspended', 'resigned'])('denies access when membership_status is %s', async (membership_status) => {
    mount({ signedIn: true, profiles: [profile({ membership_status })] })
    await waitFor(() => expect(state()).toBe('ready|inactive|-'))
  })
  it('denies access when the account has no member profile', async () => {
    mount({ signedIn: true, profiles: [] })
    await waitFor(() => expect(state()).toBe('ready|no_profile|-'))
  })
  it('reports a load error instead of granting access', async () => {
    const { fake } = mount({ signedIn: true })
    fake.queries.length = 0
    h.client = { ...(fake.client as object), from: () => { throw new Error('boom') } }
    // a fresh mount with a failing client
    document.body.innerHTML = ''
    const fakeAuth = makeFakeAuth([account], { userId: UID, email: account.email })
    h.client = { from: () => { throw new Error('boom') }, auth: fakeAuth.auth }
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getAllByTestId('s').at(-1)?.textContent).toBe('ready|error|-'))
  })
})

describe('AuthProvider.signIn: phone number + password against Supabase Auth', () => {
  it('maps the phone number to the derived Auth email, verifies the profile and opens access', async () => {
    const { fakeAuth } = mount()
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn(' ০১৭১১-১১১১১১ ', 'correct-horse') })
    expect(out).toEqual({ ok: true, access: 'active', mustChangePassword: false })
    expect(fakeAuth.auth.signInWithPassword).toHaveBeenCalledWith({ email: '8801711111111@members.test', password: 'correct-horse' })
    await waitFor(() => expect(state()).toBe('ready|active|-'))
  })
  it('rejects a wrong password generically, without touching profiles', async () => {
    const { fake } = mount()
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn('01711111111', 'wrong') })
    expect(out).toEqual({ ok: false, reason: 'invalid_credentials' })
    expect(fake.queries.filter((q) => q.table === 'profiles')).toHaveLength(0)
    expect(state()).toBe('signed_out|-|-')
  })
  it('rejects a malformed phone number before contacting Supabase', async () => {
    const { fakeAuth } = mount()
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    for (const bad of ['', 'admin@x.org', 'IBD-0001', '12345', "01711111111' or 1=1"]) {
      let out: unknown
      await act(async () => { out = await ctx.signIn(bad, 'x') })
      expect(out).toEqual({ ok: false, reason: 'invalid_phone' })
    }
    expect(fakeAuth.auth.signInWithPassword).not.toHaveBeenCalled()
  })
  it('maps an auth rate limit to rate_limited', async () => {
    const { fakeAuth } = mount()
    fakeAuth.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null, session: null }, error: Object.assign(new Error('rate'), { status: 429 }) })
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn('01711111111', 'x') })
    expect(out).toEqual({ ok: false, reason: 'rate_limited' })
  })
  it('SIGNS OUT and refuses when the authenticated account does not own the typed phone number', async () => {
    // The Auth email maps to ...1111 but that account\'s profile carries another phone: never trust the typed value alone.
    const { fakeAuth } = mount({ profiles: [profile({ phone: '+8801722222222' })] })
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn('01711111111', 'correct-horse') })
    expect(out).toEqual({ ok: false, reason: 'invalid_credentials' })
    expect(fakeAuth.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    await waitFor(() => expect(state().startsWith('signed_out')).toBe(true))
  })
  it('SIGNS OUT when the authenticated account has no profile at all', async () => {
    const { fakeAuth } = mount({ profiles: [] })
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn('01711111111', 'correct-horse') })
    expect(out).toEqual({ ok: false, reason: 'unavailable' })
    expect(fakeAuth.auth.signOut).toHaveBeenCalled()
  })
  it('is "unavailable" when the email domain is not configured (never guesses one)', async () => {
    vi.stubEnv('VITE_MEMBER_AUTH_EMAIL_DOMAIN', '')
    mount()
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn('01711111111', 'correct-horse') })
    expect(out).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('AuthProvider: sign-out and session end', () => {
  it('logout clears the session, profile and access and leaves a "loggedOut" notice', async () => {
    const { fakeAuth } = mount({ signedIn: true })
    await waitFor(() => expect(state()).toBe('ready|active|-'))
    await act(async () => { await ctx.signOut() })
    expect(fakeAuth.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(state()).toBe('signed_out|-|loggedOut')
    expect(ctx.profile).toBeNull()
  })
  it('a sign-out that happens elsewhere (another tab, expiry) shows "sessionExpired"', async () => {
    const { fakeAuth } = mount({ signedIn: true })
    await waitFor(() => expect(state()).toBe('ready|active|-'))
    act(() => fakeAuth.emit('SIGNED_OUT', null))
    expect(state()).toBe('signed_out|-|sessionExpired')
  })
})

describe('safeNext (post-login redirect)', () => {
  it.each([
    ['/dashboard', '/dashboard'], ['/dashboard/profile', '/dashboard/profile'], [null, '/dashboard'], ['', '/dashboard'],
    ['https://evil.example', '/dashboard'], ['//evil.example', '/dashboard'], ['/dashboard//evil', '/dashboard'],
    ['/admin', '/dashboard'], ['/dashboard/../admin', '/dashboard'], ['javascript:alert(1)', '/dashboard'], ['/dashboard?x=1', '/dashboard'],
  ])('%s -> %s', (input, expected) => expect(safeNext(input)).toBe(expected))
})

describe('AuthProvider: first login with the temporary password', () => {
  it('signIn reports mustChangePassword and the provider exposes it', async () => {
    mount({ profiles: [profile({ must_change_password: true })] })
    await waitFor(() => expect(state()).toBe('signed_out|-|-'))
    let out: unknown
    await act(async () => { out = await ctx.signIn('01711111111', 'correct-horse') })
    expect(out).toEqual({ ok: true, access: 'active', mustChangePassword: true })
    expect(ctx.mustChangePassword).toBe(true)
  })
  it('loads roles with the profile so admin links can be shown (the server re-checks every admin action)', async () => {
    const fakeAuth = makeFakeAuth([account], { userId: UID, email: account.email })
    const fake = makeFakeSupabase({ profiles: [profile()], user_roles: [{ user_id: UID, role: 'admin' }] }, {}, fakeAuth.auth)
    h.client = fake.client
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(state()).toBe('ready|active|-'))
    expect(ctx.isAdmin).toBe(true)
    expect(ctx.roles).toEqual(['admin'])
  })
  it('a plain member has no roles', async () => {
    mount({ signedIn: true })
    await waitFor(() => expect(state()).toBe('ready|active|-'))
    expect(ctx.isAdmin).toBe(false)
  })
})
