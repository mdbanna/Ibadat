import { requireSupabase } from './supabase'

/**
 * Login is Member ID + password. Supabase Auth needs an email or phone, so every approved member is created
 * (by a server-side Edge Function, not built yet) with a synthetic email derived from the Member ID.
 * The member's real contact email/phone live in public.profiles. Phone + OTP can be added later without
 * changing profiles, because profiles.phone is already unique.
 */
const MEMBER_ID_PATTERN = /^IBD-\d{4,}$/

export function normalizeMemberId(input: string): string | null {
  const value = input.trim().toUpperCase()
  return MEMBER_ID_PATTERN.test(value) ? value : null
}

export function memberIdToAuthEmail(memberId: string, domain: string): string | null {
  const id = normalizeMemberId(memberId)
  const host = domain.trim().toLowerCase()
  if (!id || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null
  return `${id.toLowerCase()}@${host}`
}

export type SignInResult = { ok: true } | { ok: false; reason: 'invalid_member_id' | 'invalid_credentials' | 'not_configured' | 'network' }

/** Prepared but not verified against a live account yet: no member accounts exist. */
export async function signInWithMemberId(memberId: string, password: string): Promise<SignInResult> {
  const domain = import.meta.env.VITE_MEMBER_AUTH_EMAIL_DOMAIN
  if (!domain) return { ok: false, reason: 'not_configured' }
  const email = memberIdToAuthEmail(memberId, domain)
  if (!email) return { ok: false, reason: 'invalid_member_id' }
  try {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
    if (!error) return { ok: true }
    return { ok: false, reason: error.status === 400 ? 'invalid_credentials' : 'network' }
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.message === 'supabase_not_configured' ? 'not_configured' : 'network' }
  }
}
