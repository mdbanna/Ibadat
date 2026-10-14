// TEST-ONLY local backend for browser and integration tests.
//   /rest/v1/*     -> REAL PostgREST (real PostgreSQL, real RLS, real JWT verification)
//   /auth/v1/*     -> FAKE GoTrue (in-memory password check that mints real HS256 JWTs). NOT Supabase Auth.
//   /storage/v1/*  -> FAKE storage (returns signed-URL shaped responses and a placeholder image). NOT Supabase Storage.
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const SECRET = process.env.PGRST_JWT_SECRET
const POSTGREST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:3001'
const PORT = Number(process.env.BACKEND_PORT ?? 3112)
const PASSWORD = 'Test-Pass-1'
const USERS = {
  '8801711111111@members.test': 'a0000000-0000-0000-0000-000000000001', '8801722222222@members.test': 'b0000000-0000-0000-0000-000000000002',
  '8801733333333@members.test': 'c0000000-0000-0000-0000-000000000003', '8801744444444@members.test': 'd0000000-0000-0000-0000-000000000004',
  '8801755555555@members.test': 'e0000000-0000-0000-0000-000000000005', '8801766666666@members.test': 'f0000000-0000-0000-0000-000000000006',
  '8801777777777@members.test': 'a1000000-0000-0000-0000-000000000007',
}
// the brand-new member G still has the temporary password = their phone number; everyone else already chose one
const passwords = new Map(Object.keys(USERS).map((e) => [e, e.startsWith('8801777777777') ? '01777777777' : PASSWORD]))
const DB = process.env.TEST_DB ?? 'ibadat_it'
const sql = (q) => execFileSync('su', ['postgres', '-c', `psql -qAt -d ${DB} -c ${JSON.stringify(q)}`]).toString().trim()
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
export function mint(claims) {
  const head = b64({ alg: 'HS256', typ: 'JWT' }), body = b64(claims)
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}
const now = () => Math.floor(Date.now() / 1000)
const userObj = (email) => ({ id: USERS[email], aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
function session(email) {
  const exp = now() + 3600
  return { access_token: mint({ sub: USERS[email], email, role: 'authenticated', aud: 'authenticated', iat: now(), exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `rt.${email}.${now()}`, user: userObj(email) }
}
const emailFromBearer = (req) => {
  try { const p = JSON.parse(Buffer.from((req.headers.authorization ?? '').split('.')[1], 'base64url').toString()); return p.email } catch { return null }
}
const PLACEHOLDER = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#E6F0EC"/><path d="M320 120c60 60 90 105 90 150a90 90 0 0 1-180 0c0-45 30-90 90-150z" fill="#075B48"/><circle cx="320" cy="285" r="28" fill="#D7AC3F"/></svg>'

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-type' }
const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { ...cors, 'content-type': type })
  res.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body))
}
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') return send(res, 204)
  try {
    if (url.pathname.startsWith('/rest/v1/')) {
      const body = await readBody(req)
      const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'content-length', 'connection', 'origin', 'referer'].includes(k)))
      const upstream = await fetch(POSTGREST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body })
      const out = Buffer.from(await upstream.arrayBuffer())
      const h = { ...cors }
      upstream.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(k)) h[k] = v })
      res.writeHead(upstream.status, h); return res.end(out)
    }
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type'); const data = JSON.parse((await readBody(req)).toString() || '{}')
      if (grant === 'password') {
        if (!USERS[data.email] || passwords.get(data.email) !== data.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
        return send(res, 200, session(data.email))
      }
      if (grant === 'refresh_token') { const email = String(data.refresh_token).split('.')[1]; return USERS[email] ? send(res, 200, session(email)) : send(res, 400, { code: 400, msg: 'Invalid Refresh Token' }) }
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204)
    if (url.pathname === '/auth/v1/user') {
      const email = emailFromBearer(req); if (!email || !USERS[email]) return send(res, 401, { code: 401, msg: 'invalid JWT' })
      if (req.method === 'PUT') { const d = JSON.parse((await readBody(req)).toString() || '{}'); if (d.password) passwords.set(email, d.password) }
      return send(res, 200, userObj(email))
    }
    if (req.method === 'POST' && url.pathname.startsWith('/storage/v1/object/sign/')) {
      const bucket = url.pathname.split('/').pop(); const { paths = [] } = JSON.parse((await readBody(req)).toString() || '{}')
      return send(res, 200, paths.map((path) => ({ error: null, path, signedURL: `/object/sign/${bucket}/${path}?token=fake` })))
    }
    if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/sign/')) return send(res, 200, PLACEHOLDER, 'image/svg+xml')
    if (url.pathname.startsWith('/storage/v1/object/')) return send(res, 200, req.method === 'DELETE' ? [] : { Key: 'x' })
    // ---- FAKE Edge Functions (test-only re-implementations; the real ones are in supabase/functions and are not run here)
    if (req.method === 'POST' && url.pathname === '/functions/v1/complete-first-login') {
      const email = emailFromBearer(req); if (!email || !USERS[email]) return send(res, 401, { ok: false, code: 'unauthenticated' })
      const { newPassword = '' } = JSON.parse((await readBody(req)).toString() || '{}')
      const local = '0' + email.split('@')[0].slice(3)
      if (sql(`select must_change_password from public.profiles where id='${USERS[email]}'`) !== 't') return send(res, 400, { ok: false, code: 'not_required' })
      if (String(newPassword).length < 8) return send(res, 400, { ok: false, code: 'too_short' })
      if ([local, email.split('@')[0], '+' + email.split('@')[0]].includes(newPassword)) return send(res, 400, { ok: false, code: 'same_as_phone' })
      passwords.set(email, newPassword)
      sql(`update public.profiles set must_change_password=false where id='${USERS[email]}'`)
      return send(res, 200, { ok: true })
    }
    if (req.method === 'POST' && url.pathname === '/functions/v1/admin-create-member') {
      const email = emailFromBearer(req)
      if (!email || !USERS[email] || sql(`select count(*) from public.user_roles where user_id='${USERS[email]}' and role='admin'`) !== '1') return send(res, 403, { ok: false, code: 'forbidden' })
      const b = JSON.parse((await readBody(req)).toString() || '{}')
      const ascii = String(b.phone).replace(/[\u09E6-\u09EF]/g, (d) => String(d.charCodeAt(0) - 0x09E6)) // Bengali digits, like the real canonicalPhone()
      const digits = ascii.replace(/[^0-9]/g, '').replace(/^0/, '880')
      const phone = '+' + digits, local = '0' + digits.slice(3), newEmail = `${digits}@members.test`
      if (!/^\+8801[3-9][0-9]{8}$/.test(phone) || !/^([0-9]{10}|[0-9]{13}|[0-9]{17})$/.test(String(b.nidNumber))) return send(res, 422, { ok: false, code: 'invalid' })
      if (USERS[newEmail]) return send(res, 409, { ok: false, code: 'phone_taken' })
      const id = sql("select gen_random_uuid()"), mid = sql('select public.generate_member_id()')
      sql(`insert into auth.users(id,email) values ('${id}','${newEmail}'); insert into public.profiles(id,member_id,full_name,phone,membership_status,membership_start_date) values ('${id}','${mid}','${String(b.fullName).replace(/'/g, "''")}','${phone}','active',current_date); insert into public.member_private_details(profile_id,nid_number) values ('${id}','${b.nidNumber}')`)
      USERS[newEmail] = id; passwords.set(newEmail, local)
      return send(res, 200, { ok: true, memberId: mid, phone, initialPassword: local })
    }
    if (url.pathname === '/__health') return send(res, 200, { ok: true })
    send(res, 404, { message: 'not found in test backend' })
  } catch (e) { send(res, 500, { message: String(e) }) }
}).listen(PORT, '127.0.0.1', () => console.log(`test backend on ${PORT}`))
