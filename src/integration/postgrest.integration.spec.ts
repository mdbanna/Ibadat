/**
 * INTEGRATION tests: the app's real data-access code (src/lib/member.ts, content.ts) runs through supabase-js against a REAL
 * PostgREST server and a REAL PostgreSQL database with ALL migrations applied. Row Level Security, column grants,
 * security-definer functions and triggers are therefore genuinely exercised.
 *
 * NOT covered (not available locally): Supabase Auth (GoTrue) and Supabase Storage. Identities here are JWTs signed with the
 * PostgREST secret, which is exactly what PostgREST sees in production after GoTrue issues a token. Run with
 *   bash supabase/tests/local-backend/run_integration.sh
 */
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('../lib/supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import { listActivities, listPublicMembers } from '../lib/content'
import {
  fetchOwnProfile, getAssistanceSummary, getEmploymentSummary, getOwnContributionTotals, listAnnouncements, listDocuments,
  listOwnContributions, listPublishedReports, updateOwnProfile,
} from '../lib/member'

const URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3112'
const SECRET = process.env.PGRST_JWT_SECRET ?? 'test-only-secret-at-least-32-characters-long!!'
const IDS = {
  A: 'a0000000-0000-0000-0000-000000000001', B: 'b0000000-0000-0000-0000-000000000002', C: 'c0000000-0000-0000-0000-000000000003',
  T: 'd0000000-0000-0000-0000-000000000004', ADM: 'e0000000-0000-0000-0000-000000000005', S: 'f0000000-0000-0000-0000-000000000006',
}
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
function mint(claims: Record<string, unknown>, secret = SECRET) {
  const head = b64({ alg: 'HS256', typ: 'JWT' }), body = b64(claims)
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`
}
const now = () => Math.floor(Date.now() / 1000)
const userJwt = (id: string) => mint({ sub: id, role: 'authenticated', aud: 'authenticated', iat: now(), exp: now() + 3600 })
const anonJwt = () => mint({ role: 'anon', iss: 'supabase', iat: now(), exp: now() + 3600 })

type Actor = keyof typeof IDS | 'anon'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientFor(actor: Actor): any {
  const token = actor === 'anon' ? anonJwt() : userJwt(IDS[actor])
  return createClient(URL, anonJwt(), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
const as = (actor: Actor) => { h.client = clientFor(actor) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (): any => h.client

beforeAll(async () => {
  const res = await fetch(`${URL}/rest/v1/funds?select=fund_type`, { headers: { Authorization: `Bearer ${anonJwt()}` } })
  if (!res.ok) throw new Error(`test backend not reachable (${res.status}). Use supabase/tests/local-backend/run_integration.sh`)
})

describe('own profile: a member sees only themselves', () => {
  it('A reads their own profile through the app code', async () => {
    as('A')
    const me = await fetchOwnProfile(IDS.A)
    expect(me?.member_id).toBe('IBD-0001')
    expect(me?.membership_status).toBe('active')
  })
  it('A asking for B by id gets nothing (RLS), and cannot list other members', async () => {
    as('A')
    expect(await fetchOwnProfile(IDS.B)).toBeNull()
    const all = await raw().from('profiles').select('id, phone, email')
    expect(all.error).toBeNull()
    expect(all.data).toHaveLength(1)
    expect(all.data[0].id).toBe(IDS.A)
    const probe = await raw().from('profiles').select('id, phone').in('id', Object.values(IDS))
    expect(probe.data.map((r: { id: string }) => r.id)).toEqual([IDS.A])
  })
  it('a pending member can read only their own profile (and the app then blocks the dashboard)', async () => {
    as('C')
    expect((await fetchOwnProfile(IDS.C))?.membership_status).toBe('pending')
    expect(await fetchOwnProfile(IDS.A)).toBeNull()
  })
})

describe('contributions: only my own, never anyone else\'s', () => {
  it('A gets exactly A\'s rows, in any way they ask', async () => {
    as('A')
    const rows = await listOwnContributions(IDS.A)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.transaction_reference).sort()).toEqual(['TRX-A1', 'TRX-A3', null])
    expect(await listOwnContributions(IDS.B)).toEqual([]) // asking for B\'s rows returns nothing
    const everything = await raw().from('contributions').select('*')
    expect(everything.data).toHaveLength(3)
    expect(JSON.stringify(everything.data)).not.toContain('TRX-B1')
  })
  it('totals count verified contributions only', async () => {
    as('A')
    expect(await getOwnContributionTotals(IDS.A)).toMatchObject({ verifiedTotal: 2500, verifiedCount: 2, pendingCount: 1 })
    as('B')
    expect(await getOwnContributionTotals(IDS.B)).toMatchObject({ verifiedTotal: 2000, verifiedCount: 1, pendingCount: 0 })
    expect(await getOwnContributionTotals(IDS.A)).toMatchObject({ verifiedTotal: 0, verifiedCount: 0 }) // B cannot total A\'s rows
  })
  it('the treasurer sees all contributions (positive control that the data is really there)', async () => {
    as('T')
    const all = await raw().from('contributions').select('amount')
    expect(all.data).toHaveLength(4)
  })
})

describe('private tables stay private to a member', () => {
  const privateTables = ['user_roles', 'fund_transactions', 'beneficiaries', 'assistance_records', 'employment_projects', 'audit_logs', 'membership_applications', 'contact_messages']
  it.each(privateTables)('A reads nothing from %s', async (table) => {
    as('A')
    const r = await raw().from(table).select('*')
    expect(JSON.stringify(r.data ?? [])).not.toContain('SECRET')
    expect(r.data ?? []).toEqual([])
  })
  it('fund balances (ledger-derived) are hidden from members', async () => {
    as('A')
    const r = await raw().from('fund_balances').select('*')
    expect(r.data ?? []).toEqual([])
    as('T')
    const t = await raw().from('fund_balances').select('fund_type, balance')
    expect(t.data).toHaveLength(3) // treasurers can see them
  })
  it('only the administrator can read beneficiary data (positive control)', async () => {
    as('ADM')
    const r = await raw().from('beneficiaries').select('full_name')
    expect(r.data).toEqual([{ full_name: 'SECRET Beneficiary Name' }])
    as('T')
    expect((await raw().from('beneficiaries').select('full_name')).data).toEqual([])
  })
})

describe('privacy-safe aggregates', () => {
  it('assistance: counts private/unapproved cases out, shows totals when >= 3 cases, withholds when fewer', async () => {
    as('A')
    const rows = await getAssistanceSummary()
    expect(rows).toHaveLength(3)
    const direct = rows.find((r) => r.fund_type === 'direct_aid')
    expect(direct).toMatchObject({ cases_total: 3, cases_completed: 2, cases_in_progress: 1, disbursed_total: 800, amounts_suppressed: false })
    const medical = rows.find((r) => r.fund_type === 'emergency_medical')
    expect(medical).toMatchObject({ cases_total: 2, disbursed_total: null, amounts_suppressed: true })
    expect(JSON.stringify(rows)).not.toMatch(/SECRET|surgery|medicine|food/i)
  })
  it('employment: totals only, no project titles', async () => {
    as('A')
    const e = await getEmploymentSummary()
    expect(e).toMatchObject({ projects_total: 3, projects_completed: 1, projects_in_progress: 1, projects_planned: 1, approved_budget_total: 60000, actual_expense_total: 47000, amounts_suppressed: false })
    expect(JSON.stringify(e)).not.toContain('SECRET')
  })
  it.each(['C', 'S', 'anon'] as const)('%s (not an active member) is refused the aggregates', async (actor) => {
    as(actor)
    await expect(getAssistanceSummary()).rejects.toThrow()
    await expect(getEmploymentSummary()).rejects.toThrow()
  })
})

describe('monthly reports: published + verified, active members only', () => {
  it('A sees the published report with its fund lines and not the draft', async () => {
    as('A')
    const reports = await listPublishedReports()
    expect(reports).toHaveLength(1)
    expect(reports[0].reporting_month).toBe('2026-09-01')
    expect(reports[0].lines.map((l) => l.fund_type)).toEqual(['direct_aid', 'employment', 'emergency_medical'])
    expect(reports[0].lines[0]).toMatchObject({ total_in: 2250, closing_balance: 2250 })
    expect(JSON.stringify(reports)).not.toContain('DRAFT')
    const rawReports = await raw().from('monthly_reports').select('summary_en')
    expect(rawReports.data).toHaveLength(1)
  })
  it.each(['C', 'S'] as const)('%s (pending / suspended) sees no reports', async (actor) => {
    as(actor)
    expect(await listPublishedReports()).toEqual([])
  })
  it('an anonymous visitor cannot even query reports', async () => {
    as('anon')
    await expect(listPublishedReports()).rejects.toThrow()
  })
})

describe('members-only content', () => {
  it('announcements: A sees members + public notices only', async () => {
    as('A')
    const titles = (await listAnnouncements()).map((a) => a.title_en)
    expect(titles.sort()).toEqual(['General notice', 'Members meeting'])
  })
  it.each(['C', 'S', 'anon'] as const)('announcements: %s sees public notices only', async (actor) => {
    as(actor)
    expect((await listAnnouncements()).map((a) => a.title_en)).toEqual(['General notice'])
  })
  it('documents: members see members-level documents, never admin ones', async () => {
    as('A')
    expect((await listDocuments()).map((d) => d.title_en)).toEqual(['Constitution'])
    as('C')
    expect(await listDocuments()).toEqual([])
    as('anon')
    expect(await listDocuments()).toEqual([])
  })
})

describe('public website data', () => {
  it('activities: anonymous visitors get published ones through explicit columns only', async () => {
    as('anon')
    expect((await listActivities()).map((a) => a.slug)).toEqual(['winter-relief'])
    const star = await raw().from('activities').select('*')
    expect(star.error).not.toBeNull() // created_by is not granted to anon, so select(*) is refused
  })
  it('member directory: opted in AND approved only; no contact details', async () => {
    as('anon')
    const members = await listPublicMembers()
    expect(members.map((m) => m.full_name)).toEqual(['আব্দুল করিম'])
    expect(Object.keys(members[0]).sort()).toEqual(['full_name', 'general_location', 'id', 'profile_image_path', 'short_bio'])
    expect(JSON.stringify(members)).not.toMatch(/01711111111|a@example.org|Fatima|Pending/)
  })
})

describe('writes: members cannot elevate themselves or touch the ledger', () => {
  it('A cannot change status, member id or approval (database trigger)', async () => {
    as('A')
    for (const patch of [{ membership_status: 'suspended' }, { public_profile_approved: false }, { member_id: 'IBD-9999' }, { membership_start_date: '2020-01-01' }]) {
      const r = await raw().from('profiles').update(patch).eq('id', IDS.A).select()
      expect(r.error, JSON.stringify(patch)).not.toBeNull()
    }
    expect((await fetchOwnProfile(IDS.A))?.member_id).toBe('IBD-0001')
  })
  it('A cannot edit B (0 rows) and the app helper reports it', async () => {
    as('A')
    await expect(updateOwnProfile(IDS.B, { full_name: 'Hacked', phone: null, email: null, general_location: null, short_bio: null, public_profile_preference: false })).rejects.toThrow('profile_not_updated')
    as('B')
    expect((await fetchOwnProfile(IDS.B))?.full_name).toBe('Fatima Rahman')
  })
  it('A cannot grant roles, write the ledger, or insert a pre-verified or foreign contribution', async () => {
    as('A')
    expect((await raw().from('user_roles').insert({ user_id: IDS.A, role: 'admin' })).error).not.toBeNull()
    expect((await raw().from('fund_transactions').insert({ fund_id: '00000000-0000-0000-0000-000000000000', transaction_type: 'adjustment', direction: 'credit', amount: 1, transaction_date: '2026-10-01', description: 'x' })).error).not.toBeNull()
    const base = { amount: 10, contribution_date: '2026-10-01', contribution_month: '2026-10-01', payment_method: 'cash' }
    expect((await raw().from('contributions').insert({ ...base, profile_id: IDS.A, verification_status: 'verified', verified_by: IDS.A, verified_at: new Date().toISOString() })).error).not.toBeNull()
    expect((await raw().from('contributions').insert({ ...base, profile_id: IDS.B })).error).not.toBeNull()
    expect((await raw().from('contributions').update({ amount: 1 }).eq('profile_id', IDS.A).select()).data ?? []).toEqual([])
  })
  it('A can edit descriptive fields; changing public content withdraws approval', async () => {
    as('A')
    const saved = await updateOwnProfile(IDS.A, { full_name: 'আব্দুল করিম', phone: '+8801711111111', email: 'a@example.org', general_location: 'ঢাকা', short_bio: 'নতুন পরিচিতি', public_profile_preference: true })
    expect(saved.short_bio).toBe('নতুন পরিচিতি')
    expect(saved.public_profile_approved).toBe(false) // an administrator must re-approve
    as('anon')
    expect(await listPublicMembers()).toEqual([])
  })
})

describe('JWT verification is real (PostgREST rejects forged or expired tokens)', () => {
  const get = (token: string) => fetch(`${URL}/rest/v1/profiles?select=id`, { headers: { Authorization: `Bearer ${token}`, apikey: anonJwt() } })
  it('a token signed with the wrong secret is rejected', async () => {
    expect((await get(mint({ sub: IDS.A, role: 'authenticated', aud: 'authenticated', exp: now() + 3600 }, 'a-completely-different-secret-value-32+'))).status).toBe(401)
  })
  it('an expired token is rejected', async () => {
    expect((await get(mint({ sub: IDS.A, role: 'authenticated', aud: 'authenticated', exp: now() - 60 }))).status).toBe(401)
  })
  it('a valid token works (control)', async () => {
    expect((await get(userJwt(IDS.A))).status).toBe(200)
  })
  it('a role claim cannot be self-assigned without the secret', async () => {
    expect((await get(mint({ sub: IDS.A, role: 'service_role', exp: now() + 3600 }, 'forged-secret-forged-secret-forged!!'))).status).toBe(401)
  })
})
