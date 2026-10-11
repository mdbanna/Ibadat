import { requireSupabase } from './supabase'
import { normalizePhone, type ContactValues, type JoinValues } from './validation'
import type { Database } from '../types/database'
import type { Language } from '../i18n'

type Fn = Database['public']['Functions']

export type SubmitError = 'duplicate' | 'rate_limited' | 'invalid' | 'unavailable'
export type SubmitResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { value: T })) | { ok: false; error: SubmitError }

interface RpcError { message?: string; code?: string }

function classify(error: unknown): SubmitError {
  if (error instanceof Error && error.message === 'supabase_not_configured') return 'unavailable'
  const e = error as RpcError
  const text = `${e.message ?? ''} ${e.code ?? ''}`
  if (text.includes('application_not_accepted')) return 'duplicate'
  if (text.includes('too_many_requests') || e.code === '53400') return 'rate_limited'
  if (text.includes('consent_required') || e.code === '23514' || e.code === '22023') return 'invalid'
  return 'unavailable'
}

const orNull = (s: string) => (s.trim() === '' ? null : s.trim())

/**
 * Calls the SECURITY DEFINER function created in migration 2. The generated types mark every function argument as
 * non-null, but optional fields are nullable in SQL, hence the single cast below.
 */
export async function submitApplication(v: JoinValues, language: Language): Promise<SubmitResult<string>> {
  try {
    const args = {
      p_full_name: v.fullName.trim(),
      p_phone: normalizePhone(v.phone),
      p_email: orNull(v.email),
      p_date_of_birth: orNull(v.dateOfBirth),
      p_occupation: orNull(v.occupation),
      p_address_line: orNull(v.addressLine),
      p_district: orNull(v.district),
      p_upazila: orNull(v.upazila),
      p_motivation: orNull(v.motivation),
      p_preferred_language: language,
      p_consent: v.consent,
    } as unknown as Fn['submit_membership_application']['Args']
    const { data, error } = await requireSupabase().rpc('submit_membership_application', args)
    if (error) return { ok: false, error: classify(error) }
    return { ok: true, value: String(data) }
  } catch (e) {
    return { ok: false, error: classify(e) }
  }
}

/** Calls submit_contact_message (migration 7, Phase 2). */
export async function submitContactMessage(v: ContactValues, language: Language): Promise<SubmitResult> {
  try {
    const args = {
      p_name: v.name.trim(),
      p_email: orNull(v.email),
      p_phone: v.phone.trim() ? normalizePhone(v.phone) : null,
      p_subject: orNull(v.subject),
      p_message: v.message.trim(),
      p_preferred_language: language,
    } as unknown as Fn['submit_contact_message']['Args']
    const { error } = await requireSupabase().rpc('submit_contact_message', args)
    if (error) return { ok: false, error: classify(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: classify(e) }
  }
}
