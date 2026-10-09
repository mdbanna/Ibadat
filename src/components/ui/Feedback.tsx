import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { cx } from '../../lib/cx'

export function Loading({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-live="polite" className={cx('flex items-center justify-center gap-3 p-8 text-muted', className)}>
      <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title?: string; description?: string; action?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2 rounded-(--radius-card) border border-dashed border-line bg-surface px-6 py-12 text-center">
      <svg aria-hidden viewBox="0 0 24 24" className="size-10 text-leaf" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
      </svg>
      <p className="text-lg font-semibold">{title ?? t('empty.noData')}</p>
      <p className="max-w-md text-muted">{description ?? t('empty.noDataHint')}</p>
      {action}
    </div>
  )
}

export function ErrorMessage({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-(--radius-card) border border-danger/30 bg-danger-soft p-4 text-danger sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium">{message ?? t('errors.generic')}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{t('common.retry')}</Button>}
    </div>
  )
}

export function Notice({ title, children, tone = 'info' }: { title?: string; children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div role="note" className={cx('rounded-(--radius-card) border p-4', tone === 'warning' ? 'border-gold bg-gold-soft' : 'border-leaf/40 bg-leaf-soft')}>
      {title && <p className="font-semibold">{title}</p>}
      <div className="text-ink/90">{children}</div>
    </div>
  )
}
