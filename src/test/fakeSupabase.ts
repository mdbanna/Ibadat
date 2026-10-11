import { vi } from 'vitest'

export interface RecordedQuery { table: string; ops: Array<[string, unknown[]]> }

/** Chainable stand-in for the Supabase client: records every query so tests can assert on filters. */
export function makeFakeSupabase(
  tables: Record<string, unknown[]> = {},
  rpcHandlers: Record<string, (args: unknown) => { data: unknown; error: unknown }> = {},
) {
  const queries: RecordedQuery[] = []
  const from = (table: string) => {
    const rec: RecordedQuery = { table, ops: [] }
    queries.push(rec)
    const rows = tables[table] ?? []
    const builder: object = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res, rej)
        if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: rows[0] ?? null, error: null })
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
  const storage = { from: vi.fn(() => ({ createSignedUrls })) }
  return { client: { from, rpc, storage }, queries, rpc, createSignedUrls }
}
