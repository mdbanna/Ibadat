import { requireSupabase } from './supabase'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

/**
 * Member-area data access. EVERY query here relies on Row Level Security for isolation (the browser only holds the
 * member's own JWT); the `.eq(...)` filters below are there for clarity and index use, never as the security boundary.
 * Explicit column lists are used so internal ids (created_by, verified_by) are never requested.
 */

export type MembershipStatus = Enums['membership_status']

const PROFILE_COLUMNS =
  'id, member_id, full_name, phone, email, profile_image_path, short_bio, general_location, membership_status, membership_start_date, public_profile_preference, public_profile_approved, must_change_password, created_at'
export type MemberProfile = Pick<Tables['profiles']['Row'],
  'id' | 'member_id' | 'full_name' | 'phone' | 'email' | 'profile_image_path' | 'short_bio' | 'general_location'
  | 'membership_status' | 'membership_start_date' | 'public_profile_preference' | 'public_profile_approved' | 'must_change_password' | 'created_at'>

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
}

export async function fetchOwnProfile(userId: string): Promise<MemberProfile | null> {
  const { data, error } = await requireSupabase().from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
  fail(error)
  return data
}

export interface ProfilePatch {
  full_name: string
  email: string | null
  general_location: string | null
  short_bio: string | null
  public_profile_preference: boolean
  profile_image_path?: string | null
}

/** Only descriptive fields can be sent. The phone (login identity), status, member_id, approval and the first-login flag are protected by a database trigger. */
export async function updateOwnProfile(userId: string, patch: ProfilePatch): Promise<MemberProfile> {
  const { data, error } = await requireSupabase().from('profiles').update(patch).eq('id', userId).select(PROFILE_COLUMNS).maybeSingle()
  fail(error)
  if (!data) throw new Error('profile_not_updated')
  return data
}

// ---------------------------------------------------------------- contributions (own rows only)
const CONTRIBUTION_COLUMNS = 'id, amount, currency, contribution_date, contribution_month, payment_method, transaction_reference, receipt_path, verification_status, verified_at, created_at'
export type Contribution = Pick<Tables['contributions']['Row'],
  'id' | 'amount' | 'currency' | 'contribution_date' | 'contribution_month' | 'payment_method' | 'transaction_reference' | 'receipt_path' | 'verification_status' | 'verified_at' | 'created_at'>

export async function listOwnContributions(userId: string, offset = 0, limit = 20): Promise<Contribution[]> {
  const { data, error } = await requireSupabase()
    .from('contributions')
    .select(CONTRIBUTION_COLUMNS)
    .eq('profile_id', userId)
    .order('contribution_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  fail(error)
  return data ?? []
}

export interface ContributionTotals { verifiedTotal: number; verifiedCount: number; pendingCount: number; lastDate: string | null }

/** Totals are derived from the member's own rows (verified only count towards the total). */
export async function getOwnContributionTotals(userId: string): Promise<ContributionTotals> {
  const { data, error } = await requireSupabase()
    .from('contributions')
    .select('amount, verification_status, contribution_date')
    .eq('profile_id', userId)
    .limit(2000)
  fail(error)
  const rows = data ?? []
  const verified = rows.filter((r) => r.verification_status === 'verified')
  return {
    verifiedTotal: verified.reduce((sum, r) => sum + Number(r.amount), 0),
    verifiedCount: verified.length,
    pendingCount: rows.filter((r) => r.verification_status === 'pending').length,
    lastDate: rows.map((r) => r.contribution_date).sort().at(-1) ?? null,
  }
}

// ---------------------------------------------------------------- funds and reports (authorized aggregates)
export type FundInfo = Pick<Tables['funds']['Row'], 'fund_type' | 'name' | 'name_bn' | 'description' | 'description_bn' | 'default_allocation_percent'>
export async function listFunds(): Promise<FundInfo[]> {
  const { data, error } = await requireSupabase()
    .from('funds')
    .select('fund_type, name, name_bn, description, description_bn, default_allocation_percent')
    .eq('active_status', true)
  fail(error)
  const order: Record<string, number> = { direct_aid: 0, employment: 1, emergency_medical: 2 }
  return (data ?? []).sort((a, b) => (order[a.fund_type] ?? 9) - (order[b.fund_type] ?? 9))
}

export interface ReportLine { fund_type: Enums['fund_type']; opening_balance: number; total_in: number; total_out: number; closing_balance: number }
export interface MonthlyReport {
  id: string
  reporting_month: string
  summary_bn: string | null
  summary_en: string | null
  published_at: string
  lines: ReportLine[]
}

/** RLS returns only verified + published reports to active members. The explicit filters mirror that. */
export async function listPublishedReports(offset = 0, limit = 12): Promise<MonthlyReport[]> {
  const supabase = requireSupabase()
  const { data: reports, error } = await supabase
    .from('monthly_reports')
    .select('id, reporting_month, summary_bn, summary_en, published_at')
    .eq('verification_status', 'verified')
    .not('published_at', 'is', null)
    .order('reporting_month', { ascending: false })
    .range(offset, offset + limit - 1)
  fail(error)
  if (!reports || reports.length === 0) return []
  const { data: lines, error: lineError } = await supabase
    .from('monthly_report_fund_lines')
    .select('report_id, opening_balance, total_in, total_out, closing_balance, funds(fund_type)')
    .in('report_id', reports.map((r) => r.id))
  fail(lineError)
  const byReport = new Map<string, ReportLine[]>()
  for (const l of lines ?? []) {
    const fund = Array.isArray(l.funds) ? l.funds[0] : l.funds
    if (!fund) continue
    const list = byReport.get(l.report_id) ?? []
    list.push({ fund_type: fund.fund_type, opening_balance: Number(l.opening_balance), total_in: Number(l.total_in), total_out: Number(l.total_out), closing_balance: Number(l.closing_balance) })
    byReport.set(l.report_id, list)
  }
  const order: Record<string, number> = { direct_aid: 0, employment: 1, emergency_medical: 2 }
  return reports.map((r) => ({
    id: r.id,
    reporting_month: r.reporting_month,
    summary_bn: r.summary_bn,
    summary_en: r.summary_en,
    published_at: r.published_at as string,
    lines: (byReport.get(r.id) ?? []).sort((a, b) => (order[a.fund_type] ?? 9) - (order[b.fund_type] ?? 9)),
  }))
}

// ---------------------------------------------------------------- privacy-safe aggregates (database functions)
export interface AssistanceSummaryRow {
  fund_type: Enums['fund_type']
  cases_total: number
  cases_completed: number
  cases_in_progress: number
  disbursed_total: number | null
  amounts_suppressed: boolean
}
export async function getAssistanceSummary(): Promise<AssistanceSummaryRow[]> {
  const { data, error } = await requireSupabase().rpc('get_assistance_summary')
  fail(error)
  return (data ?? []).map((r) => ({
    fund_type: r.fund_type,
    cases_total: r.cases_total,
    cases_completed: r.cases_completed,
    cases_in_progress: r.cases_in_progress,
    disbursed_total: r.disbursed_total === null ? null : Number(r.disbursed_total),
    amounts_suppressed: r.amounts_suppressed,
  }))
}

export interface EmploymentSummary {
  projects_total: number
  projects_planned: number
  projects_approved: number
  projects_in_progress: number
  projects_completed: number
  approved_budget_total: number | null
  actual_expense_total: number | null
  amounts_suppressed: boolean
}
export async function getEmploymentSummary(): Promise<EmploymentSummary> {
  const { data, error } = await requireSupabase().rpc('get_employment_summary')
  fail(error)
  const r = (data ?? [])[0]
  if (!r) throw new Error('empty_employment_summary')
  return {
    projects_total: r.projects_total,
    projects_planned: r.projects_planned,
    projects_approved: r.projects_approved,
    projects_in_progress: r.projects_in_progress,
    projects_completed: r.projects_completed,
    approved_budget_total: r.approved_budget_total === null ? null : Number(r.approved_budget_total),
    actual_expense_total: r.actual_expense_total === null ? null : Number(r.actual_expense_total),
    amounts_suppressed: r.amounts_suppressed,
  }
}

// ---------------------------------------------------------------- announcements and documents (members-only content)
export type Announcement = Pick<Tables['announcements']['Row'], 'id' | 'title_bn' | 'title_en' | 'content_bn' | 'content_en' | 'audience' | 'published_at'>
export async function listAnnouncements(offset = 0, limit = 10): Promise<Announcement[]> {
  const { data, error } = await requireSupabase()
    .from('announcements')
    .select('id, title_bn, title_en, content_bn, content_en, audience, published_at')
    .eq('publication_status', 'published')
    .in('audience', ['public', 'members'])
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)
  fail(error)
  return data ?? []
}

export type MemberDocument = Pick<Tables['documents']['Row'], 'id' | 'title_bn' | 'title_en' | 'file_path' | 'document_type' | 'access_level' | 'created_at'>
export async function listDocuments(): Promise<MemberDocument[]> {
  const { data, error } = await requireSupabase()
    .from('documents')
    .select('id, title_bn, title_en, file_path, document_type, access_level, created_at')
    .eq('publication_status', 'published')
    .in('access_level', ['public', 'members'])
    .order('created_at', { ascending: false })
    .limit(100)
  fail(error)
  return data ?? []
}

// ---------------------------------------------------------------- profile photo (private bucket, own folder only)
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Uploads to member-photos/<user id>/avatar-<time>.<ext>. Storage policies only allow the owner's own folder. */
export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.${EXT[file.type] ?? 'jpg'}`
  const { error } = await requireSupabase().storage.from('member-photos').upload(path, file, { contentType: file.type, upsert: false })
  fail(error)
  return path
}

export async function removeStorageObject(bucket: string, path: string): Promise<void> {
  try { await requireSupabase().storage.from(bucket).remove([path]) } catch { /* best effort: an orphaned old photo is harmless */ }
}

/** The signed-in user's own roles (RLS: user_roles are readable by their owner). Used only to show admin links; admin actions are re-checked server-side. */
export async function fetchOwnRoles(userId: string): Promise<string[]> {
  const { data, error } = await requireSupabase().from('user_roles').select('role').eq('user_id', userId)
  fail(error)
  return (data ?? []).map((r) => r.role)
}
