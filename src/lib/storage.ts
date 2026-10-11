import { requireSupabase } from './supabase'

/**
 * All buckets are private, so public pages display images through short-lived signed URLs.
 * Anonymous visitors can only obtain a URL for objects their RLS policies allow them to read.
 */
const TTL_SECONDS = 3600
const cache = new Map<string, { url: string; expires: number }>()

export async function getSignedUrls(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const result: Record<string, string> = {}
  const missing: string[] = []
  for (const path of new Set(paths.filter(Boolean))) {
    // Demo gallery illustrations are shipped with the site, not stored in the private user-image bucket.
    if (bucket === 'gallery' && path.startsWith('static:gallery/')) {
      result[path] = `/${path.slice('static:'.length)}`
      continue
    }
    const hit = cache.get(`${bucket}/${path}`)
    if (hit && hit.expires > now + 60_000) result[path] = hit.url
    else missing.push(path)
  }
  if (missing.length > 0) {
    const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrls(missing, TTL_SECONDS)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) {
        result[row.path] = row.signedUrl
        cache.set(`${bucket}/${row.path}`, { url: row.signedUrl, expires: now + TTL_SECONDS * 1000 })
      }
    }
  }
  return result
}
