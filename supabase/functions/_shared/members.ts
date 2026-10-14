// Business logic for the two Edge Functions, written against injected ports so it can be unit-tested without Deno or Supabase.
// The thin Deno entry points (../admin-create-member/index.ts, ../complete-first-login/index.ts) wire these ports to supabase-js
// with the service-role key, which exists ONLY inside Edge Functions and never in the browser or the repository.
import { canonicalPhone, initialPassword, newPasswordProblem, phoneToAuthEmail } from './phone.ts'

export interface CreateMemberInput {
  fullName: string
  phone: string
  nidNumber: string
  email?: string
  dateOfBirth?: string
  occupation?: string
  addressLine?: string
  district?: string
  upazila?: string
  applicationId?: string
}

export type CreateMemberResult =
  | { ok: true; memberId: string; profileId: string; phone: string; initialPassword: string }
  | { ok: false; code: 'forbidden' | 'invalid' | 'phone_taken' | 'nid_taken' | 'failed'; fields?: Record<string, string> }

export interface CreateMemberPorts {
  isAdmin(userId: string): Promise<boolean>
  allocateMemberId(): Promise<string>
  /** Creates the Auth account (email confirmed). Returns its id, or an error code if the email already exists. */
  createAuthUser(email: string, password: string): Promise<{ id: string } | { error: 'exists' | 'failed' }>
  deleteAuthUser(userId: string): Promise<void>
  insertProfile(row: { id: string; member_id: string; full_name: string; phone: string; email: string | null; membership_status: 'active'; membership_start_date: string }): Promise<{ error?: 'phone_taken' | 'email_taken' | 'failed' }>
  insertPrivateDetails(row: { profile_id: string; nid_number: string }): Promise<{ error?: 'nid_taken' | 'failed' }>
  /** Marks the application approved and links it to the new profile (optional). */
  approveApplication(applicationId: string, profileId: string, reviewerId: string): Promise<{ error?: 'failed' }>
  today(): string
}

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export function validateCreateMember(raw: unknown):
  | { ok: true; value: Required<Pick<CreateMemberInput, 'fullName' | 'phone' | 'nidNumber'>> & CreateMemberInput }
  | { ok: false; fields: Record<string, string> } {
  const r = (raw ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}
  const fullName = clean(r.fullName)
  if (!fullName || fullName.length < 2 || fullName.length > 120) fields.fullName = 'invalid'
  const phone = canonicalPhone(String(r.phone ?? ''))
  if (!phone) fields.phone = 'invalid'
  const nid = String(r.nidNumber ?? '').replace(/[\s-]/g, '')
  if (!/^([0-9]{10}|[0-9]{13}|[0-9]{17})$/.test(nid)) fields.nidNumber = 'invalid'
  const email = clean(r.email)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = 'invalid'
  const dob = clean(r.dateOfBirth)
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) fields.dateOfBirth = 'invalid'
  const applicationId = clean(r.applicationId)
  if (applicationId && !/^[0-9a-f-]{36}$/i.test(applicationId)) fields.applicationId = 'invalid'
  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    value: {
      fullName: fullName as string, phone: phone as string, nidNumber: nid, email, dateOfBirth: dob,
      occupation: clean(r.occupation), addressLine: clean(r.addressLine), district: clean(r.district), upazila: clean(r.upazila), applicationId,
    },
  }
}

/**
 * Admin creates a member: Auth account (login = phone digits @ domain, first password = the phone number), profile
 * (must_change_password defaults to true) and the private NID record. If anything fails after the Auth account exists, the
 * account is deleted again so no half-created member is left behind.
 */
export async function createMember(raw: unknown, callerId: string | null, domain: string, ports: CreateMemberPorts): Promise<CreateMemberResult> {
  if (!callerId || !(await ports.isAdmin(callerId))) return { ok: false, code: 'forbidden' }
  const parsed = validateCreateMember(raw)
  if (!parsed.ok) return { ok: false, code: 'invalid', fields: parsed.fields }
  const v = parsed.value
  const email = phoneToAuthEmail(v.phone, domain)
  if (!email) return { ok: false, code: 'failed' }
  const password = initialPassword(v.phone)

  const memberId = await ports.allocateMemberId()
  const user = await ports.createAuthUser(email, password)
  if ('error' in user) return { ok: false, code: user.error === 'exists' ? 'phone_taken' : 'failed' }

  const rollback = async (code: 'phone_taken' | 'nid_taken' | 'failed'): Promise<CreateMemberResult> => {
    await ports.deleteAuthUser(user.id)
    return { ok: false, code }
  }
  const profile = await ports.insertProfile({
    id: user.id, member_id: memberId, full_name: v.fullName, phone: v.phone, email: v.email ?? null,
    membership_status: 'active', membership_start_date: ports.today(),
  })
  if (profile.error) return rollback(profile.error === 'phone_taken' ? 'phone_taken' : 'failed')
  const details = await ports.insertPrivateDetails({ profile_id: user.id, nid_number: v.nidNumber })
  if (details.error) return rollback(details.error === 'nid_taken' ? 'nid_taken' : 'failed') // profile row cascades with the Auth user
  if (v.applicationId) {
    const linked = await ports.approveApplication(v.applicationId, user.id, callerId)
    if (linked.error) return rollback('failed')
  }
  return { ok: true, memberId, profileId: user.id, phone: v.phone, initialPassword: password }
}

// ------------------------------------------------------------------------------------------------ first login
export type FirstLoginResult =
  | { ok: true }
  | { ok: false; code: 'unauthenticated' | 'not_required' | 'too_short' | 'same_as_phone' | 'failed' }

export interface FirstLoginPorts {
  loadProfile(userId: string): Promise<{ phone: string; must_change_password: boolean } | null>
  setPassword(userId: string, password: string): Promise<{ error?: 'failed' }>
  clearMustChange(userId: string): Promise<{ error?: 'failed' }>
}

/**
 * Sets the member's own new password and clears must_change_password. Only the signed-in user can do this for themselves,
 * the new password may not be the phone number (the temporary password), and the flag is cleared AFTER the password changed,
 * so a failure in between simply lets the member retry.
 */
export async function completeFirstLogin(userId: string | null, newPassword: unknown, ports: FirstLoginPorts): Promise<FirstLoginResult> {
  if (!userId) return { ok: false, code: 'unauthenticated' }
  const profile = await ports.loadProfile(userId)
  if (!profile) return { ok: false, code: 'unauthenticated' }
  if (!profile.must_change_password) return { ok: false, code: 'not_required' }
  const problem = newPasswordProblem(typeof newPassword === 'string' ? newPassword : '', profile.phone)
  if (problem) return { ok: false, code: problem }
  if ((await ports.setPassword(userId, newPassword as string)).error) return { ok: false, code: 'failed' }
  if ((await ports.clearMustChange(userId)).error) return { ok: false, code: 'failed' }
  return { ok: true }
}
