// TEST-ONLY local backend for browser and integration tests.
//   /rest/v1/*     -> REAL PostgREST (real PostgreSQL, real RLS, real JWT verification)
//   /auth/v1/*     -> FAKE GoTrue (in-memory password check that mints real HS256 JWTs). NOT Supabase Auth.
//   /storage/v1/*  -> FAKE storage (returns signed-URL shaped responses and a placeholder image). NOT Supabase Storage.
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'

const SECRET = process.env.PGRST_JWT_SECRET
const POSTGREST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:3001'
const PORT = Number(process.env.BACKEND_PORT ?? 3112)
const PASSWORD = 'Test-Pass-1'
const USERS = {
  'ibd-0001@members.test': 'a0000000-0000-0000-0000-000000000001', 'ibd-0002@members.test': 'b0000000-0000-0000-0000-000000000002',
  'ibd-0003@members.test': 'c0000000-0000-0000-0000-000000000003', 'ibd-0004@members.test': 'd0000000-0000-0000-0000-000000000004',
  'ibd-0005@members.test': 'e0000000-0000-0000-0000-000000000005', 'ibd-0006@members.test': 'f0000000-0000-0000-0000-000000000006',
}
const passwords = new Map(Object.keys(USERS).map((e) => [e, PASSWORD]))
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
    if (url.pathname === '/__health') return send(res, 200, { ok: true })
    send(res, 404, { message: 'not found in test backend' })
  } catch (e) { send(res, 500, { message: String(e) }) }
}).listen(PORT, '127.0.0.1', () => console.log(`test backend on ${PORT}`))
