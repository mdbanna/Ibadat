import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'error' }
  | { status: 'ready'; data: T }

const isNotConfigured = (e: unknown) => e instanceof Error && e.message === 'supabase_not_configured'

/** Runs `load` on mount and whenever `deps` change; ignores results that arrive after unmount or a newer request. */
export function useAsync<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    load().then(
      (data) => { if (current) setState({ status: 'ready', data }) },
      (e: unknown) => { if (current) setState({ status: isNotConfigured(e) ? 'unconfigured' : 'error' }) },
    )
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, reload }
}

export interface PagedState<T> {
  items: T[]
  status: 'loading' | 'unconfigured' | 'error' | 'ready'
  loadingMore: boolean
  moreError: boolean
  hasMore: boolean
  loadMore: () => void
  reload: () => void
}

/** Offset pagination for "Load more" lists. A short page means there is nothing further to load. */
export function usePaged<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>, pageSize: number): PagedState<T> {
  const [items, setItems] = useState<T[]>([])
  const [status, setStatus] = useState<PagedState<T>['status']>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let current = true
    setStatus('loading')
    setItems([])
    fetchPage(0, pageSize).then(
      (rows) => { if (current) { setItems(rows); setHasMore(rows.length === pageSize); setStatus('ready') } },
      (e: unknown) => { if (current) setStatus(isNotConfigured(e) ? 'unconfigured' : 'error') },
    )
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, pageSize])

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    setMoreError(false)
    fetchPage(items.length, pageSize).then(
      (rows) => { setItems((prev) => [...prev, ...rows]); setHasMore(rows.length === pageSize); setLoadingMore(false) },
      () => { setMoreError(true); setLoadingMore(false) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, pageSize])

  return { items, status, loadingMore, moreError, hasMore, loadMore, reload: () => setNonce((n) => n + 1) }
}
