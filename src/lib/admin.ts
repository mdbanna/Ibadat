import { requireSupabase } from './supabase'

export interface AddMemberValues {
  fullName: string; phone: string; nidNumber: string; email: string; dateOfBirth: string
  occupation: string; addressLine: string; district: string; upazila: string
}
export type AddMemberResult =
  | { ok: true; memberId: string; phone: string; initialPassword: string }
  | { ok: false; code: 'forbidden' | 'invalid' | 'phone_taken' | 'nid_taken' | 'failed'; fields?: Record<string, string> }

/**
 * Calls the admin-create-member Edge Function with the administrator's own session. The function itself re-checks the admin role
 * with the service role; this page being hidden from non-admins is only a convenience. Not deployed yet.
 */
export async function createMemberAsAdmin(v: AddMemberValues): Promise<AddMemberResult> {
  try {
    const { data, error } = await requireSupabase().functions.invoke('admin-create-member', { body: v })
    if (!error && data?.ok) return { ok: true, memberId: data.memberId, phone: data.phone, initialPassword: data.initialPassword }
    // supabase-js puts non-2xx JSON bodies on error.context; fall back to a generic failure when it is not readable
    let body: { code?: string; fields?: Record<string, string> } | null = (data as never) ?? null
    const ctx = (error as { context?: Response } | null)?.context
    if (!body && ctx && typeof ctx.json === 'function') body = await ctx.json().catch(() => null)
    const code = body?.code
    if (code === 'forbidden' || code === 'invalid' || code === 'phone_taken' || code === 'nid_taken') return { ok: false, code, fields: body?.fields }
    return { ok: false, code: 'failed' }
  } catch {
    return { ok: false, code: 'failed' }
  }
}
