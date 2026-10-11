import { useEffect, useMemo, useState } from 'react'
import { getSignedUrls } from './storage'

/** Resolves image paths to signed URLs. Missing or failed images simply have no entry (callers show a placeholder). */
export function useSignedUrls(bucket: string, paths: Array<string | null | undefined>): Record<string, string> {
  const key = useMemo(() => [...new Set(paths.filter((p): p is string => Boolean(p)))].sort().join('\n'), [paths])
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!key) return
    let current = true
    getSignedUrls(bucket, key.split('\n')).then(
      (map) => { if (current) setUrls((prev) => ({ ...prev, ...map })) },
      () => { /* images are decorative-optional: leave placeholders */ },
    )
    return () => { current = false }
  }, [bucket, key])
  return urls
}
