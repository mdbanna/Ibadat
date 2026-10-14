import { canonicalPhone, newPasswordProblem, phoneToAuthEmail } from './phone'
import { requireSupabase } from './supabase'

/**
 * Login is PHONE NUMBER + password. Supabase Auth needs an email, so every member's Auth account email is derived from the
 * phone number ("8801712345678@<domain>"); the real contact email (if any) lives in profiles.email. The first password is the
 * phone number itself and must be changed at first login (see complete-first-login Edge Function).
 */
export function loginEmailFor(phoneInput: string, domain: string | undefined): { phone: string; email: string } | null {
  const phone = canonicalPhone(phoneInput)
  const email = phone && domain ? phoneToAuthEmail(phone, domain) : null
  return phone && email ? { phone, email } : null
}

export type ChangePasswordResult = { ok: true } | { ok: false; reason: 'wrong_current' | 'failed' | 'not_configured' }

/**
 * Normal password change (after the first login). Re-checks the CURRENT password with Supabase Auth first, then updates it and
 * ends every other session. Not yet verified against a live Auth server: no accounts exist there.
 */
export async function changePassword(phone: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const login = loginEmailFor(phone, import.meta.env.VITE_MEMBER_AUTH_EMAIL_DOMAIN)
  if (!login) return { ok: false, reason: 'not_configured' }
  if (newPasswordProblem(newPassword, login.phone)) return { ok: false, reason: 'failed' }
  try {
    const client = requireSupabase()
    const check = await client.auth.signInWithPassword({ email: login.email, password: currentPassword })
    if (check.error) return { ok: false, reason: check.error.status === 400 || check.error.status === 401 ? 'wrong_current' : 'failed' }
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) return { ok: false, reason: 'failed' }
    await client.auth.signOut({ scope: 'others' })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.message === 'supabase_not_configured' ? 'not_configured' : 'failed' }
  }
}

/** Ends the member's sessions on every other device. */
export async function signOutOtherDevices(): Promise<boolean> {
  try {
    const { error } = await requireSupabase().auth.signOut({ scope: 'others' })
    return !error
  } catch {
    return false
  }
}

export type FirstLoginOutcome = { ok: true } | { ok: false; reason: 'too_short' | 'same_as_phone' | 'not_required' | 'unavailable' }

/** Calls the complete-first-login Edge Function with the member's own session token. */
export async function requestFirstLoginChange(newPassword: string): Promise<FirstLoginOutcome> {
  try {
    const { data, error } = await requireSupabase().functions.invoke('complete-first-login', { body: { newPassword } })
    if (!error && data?.ok) return { ok: true }
    const code = (data as { code?: string } | null)?.code
    if (code === 'too_short' || code === 'same_as_phone' || code === 'not_required') return { ok: false, reason: code }
    return { ok: false, reason: 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
