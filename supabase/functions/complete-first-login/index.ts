// Supabase Edge Function (Deno). NOT executed or deployed yet: needs `supabase functions deploy complete-first-login`.
// Lets a member who signed in with the temporary password (their phone number) choose a real password.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { completeFirstLogin } from '../_shared/members.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  // Identify the caller from THEIR token; never trust a user id sent in the body.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  const body = await req.json().catch(() => ({}))

  const result = await completeFirstLogin(who.user?.id ?? null, body?.newPassword, {
    async loadProfile(userId) {
      const { data } = await admin.from('profiles').select('phone, must_change_password').eq('id', userId).maybeSingle()
      return data
    },
    async setPassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      return error ? { error: 'failed' as const } : {}
    },
    async clearMustChange(userId) {
      const { error } = await admin.from('profiles').update({ must_change_password: false }).eq('id', userId)
      return error ? { error: 'failed' as const } : {}
    },
  })
  return json(result.ok ? 200 : result.code === 'unauthenticated' ? 401 : 400, result)
})
