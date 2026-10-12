import { vi } from 'vitest'

export interface RecordedQuery { table: string; ops: Array<[string, unknown[]]> }

type Row = Record<string, unknown>

/** Chainable stand-in for the Supabase client: records every query, applies eq/in filters and update patches in memory. */
export function makeFakeSupabase(
  tables: Record<string, Row[]> = {},
  rpcHandlers: Record<string, (args: unknown) => { data: unknown; error: unknown }> = {},
  auth?: unknown,
) {
  const queries: RecordedQuery[] = []
  const from = (table: string) => {
    const rec: RecordedQuery = { table, ops: [] }
    queries.push(rec)
    const resolve = () => {
      let rows = (tables[table] ?? []).map((r) => ({ ...r }))
      for (const [op, args] of rec.ops) {
        if (op === 'eq') rows = rows.filter((r) => r[args[0] as string] === args[1])
        if (op === 'in') rows = rows.filter((r) => (args[1] as unknown[]).includes(r[args[0] as string]))
      }
      const patch = rec.ops.find(([op]) => op === 'update')?.[1][0] as Row | undefined
      if (patch) rows = rows.map((r) => ({ ...r, ...patch }))
      const range = rec.ops.find(([op]) => op === 'range')?.[1] as [number, number] | undefined
      if (range) rows = rows.slice(range[0], range[1] + 1)
      return rows
    }
    const builder: object = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: resolve(), error: null }).then(res, rej)
        if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: resolve()[0] ?? null, error: null })
        return (...args: unknown[]) => { rec.ops.push([String(prop), args]); return builder }
      },
    })
    return builder
  }
  const rpc = vi.fn(async (name: string, args: unknown) => rpcHandlers[name]?.(args) ?? { data: null, error: null })
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}`, error: null })),
    error: null,
  }))
  const upload = vi.fn(async () => ({ data: {}, error: null }))
  const remove = vi.fn(async () => ({ data: [], error: null }))
  const storage = { from: vi.fn(() => ({ createSignedUrls, upload, remove })) }
  return { client: { from, rpc, storage, auth }, queries, rpc, createSignedUrls, upload }
}

export interface FakeAccount { email: string; password: string; userId: string }
type Listener = (event: string, session: unknown) => void

/** Controllable stand-in for supabase.auth. This is a MOCK: it is not Supabase Auth and proves nothing about GoTrue itself. */
export function makeFakeAuth(accounts: FakeAccount[], initial?: { userId: string; email: string }) {
  let session: unknown = initial ? mkSession(initial.userId, initial.email) : null
  const listeners = new Set<Listener>()
  const emit = (event: string, s: unknown) => listeners.forEach((l) => l(event, s))
  function mkSession(id: string, email: string) {
    return { access_token: `fake.${id}.jwt`, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email } }
  }
  const state = { passwords: new Map(accounts.map((a) => [a.email, a.password])) }
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    }),
    signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
      const acc = accounts.find((a) => a.email === email)
      if (!acc || state.passwords.get(email) !== password) {
        return { data: { user: null, session: null }, error: Object.assign(new Error('Invalid login credentials'), { status: 400 }) }
      }
      session = mkSession(acc.userId, acc.email)
      emit('SIGNED_IN', session)
      return { data: { user: (session as { user: unknown }).user, session }, error: null }
    }),
    signOut: vi.fn(async (opts?: { scope?: string }) => {
      if (opts?.scope === 'others') return { error: null }
      session = null
      emit('SIGNED_OUT', null)
      return { error: null }
    }),
    updateUser: vi.fn(async ({ password }: { password?: string }) => {
      const email = (session as { user: { email: string } } | null)?.user.email
      if (email && password) state.passwords.set(email, password)
      return { data: {}, error: null }
    }),
  }
  return { auth, emit, getSession: () => session, state }
}
