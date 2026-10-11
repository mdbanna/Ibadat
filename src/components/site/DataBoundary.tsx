import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorMessage, Loading, Notice } from '../ui'

interface Props {
  status: 'loading' | 'unconfigured' | 'error' | 'ready'
  onRetry?: () => void
  /** Non-essential sections (e.g. on the home page) disappear instead of showing an error. */
  quiet?: boolean
  children: ReactNode
}

export function DataBoundary({ status, onRetry, quiet, children }: Props) {
  const { t } = useTranslation()
  if (status === 'ready') return <>{children}</>
  if (status === 'loading') return quiet ? null : <Loading />
  if (quiet) return null
  if (status === 'unconfigured') return <Notice tone="warning">{t('errors.supabaseNotConfigured')}</Notice>
  return <ErrorMessage onRetry={onRetry} />
}
