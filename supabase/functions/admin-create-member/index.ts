// Supabase Edge Function (Deno). NOT executed or deployed yet: needs `supabase functions deploy admin-create-member`
// and the secret MEMBER_AUTH_EMAIL_DOMAIN (the same value as VITE_MEMBER_AUTH_EMAIL_DOMAIN).
// An administrator creates a member: Auth account (first password = phone number) + profile + private NID record.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createMember } from '../_shared/members.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  const domain = Deno.env.get('MEMBER_AUTH_EMAIL_DOMAIN') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  const body = await req.json().catch(() => ({}))
  const callerId = who.user?.id ?? null

  const result = await createMember(body, callerId, domain, {
    async isAdmin(userId) {
      const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle()
      return Boolean(data)
    },
    async allocateMemberId() {
      const { data, error } = await admin.rpc('generate_member_id')
      if (error || !data) throw new Error('member_id_allocation_failed')
      return data as string
    },
    async createAuthUser(email, password) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error || !data.user) return { error: /already|exists|registered/i.test(error?.message ?? '') ? 'exists' as const : 'failed' as const }
      return { id: data.user.id }
    },
    async deleteAuthUser(userId) { await admin.auth.admin.deleteUser(userId) },
    async insertProfile(row) {
      const { error } = await admin.from('profiles').insert(row)
      if (!error) return {}
      if (error.code === '23505') return { error: /email/i.test(error.message) ? 'email_taken' as const : 'phone_taken' as const }
      return { error: 'failed' as const }
    },
    async insertPrivateDetails(row) {
      const { error } = await admin.from('member_private_details').insert(row)
      if (!error) return {}
      return { error: error.code === '23505' ? 'nid_taken' as const : 'failed' as const }
    },
    async approveApplication(applicationId, profileId, reviewerId) {
      const { error } = await admin.from('membership_applications')
        .update({ status: 'approved', approved_profile_id: profileId, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
        .eq('id', applicationId)
      return error ? { error: 'failed' as const } : {}
    },
    today: () => new Date().toISOString().slice(0, 10),
  })
  const status = result.ok ? 200 : result.code === 'forbidden' ? 403 : result.code === 'invalid' ? 422 : result.code === 'failed' ? 500 : 409
  return json(status, result)
})
