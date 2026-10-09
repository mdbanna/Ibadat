import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'

export type StatusKey =
  | 'pending' | 'submitted' | 'underReview' | 'verified' | 'approved' | 'rejected' | 'reversed'
  | 'active' | 'suspended' | 'draft' | 'published' | 'archived'

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

const tones: Record<Tone, string> = {
  success: 'bg-forest-soft text-forest-deep',
  info: 'bg-leaf-soft text-forest-deep',
  warning: 'bg-gold-soft text-ink',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-line text-muted',
}

const statusTone: Record<StatusKey, Tone> = {
  pending: 'warning', submitted: 'warning', underReview: 'info',
  verified: 'success', approved: 'success', active: 'success', published: 'success',
  rejected: 'danger', reversed: 'danger', suspended: 'danger',
  draft: 'neutral', archived: 'neutral',
}

/** Maps database enum values (snake_case) to StatusKey, e.g. 'under_review' -> 'underReview'. */
export function toStatusKey(dbValue: string): StatusKey | null {
  const key = dbValue.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return key in statusTone ? (key as StatusKey) : null
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const { t } = useTranslation()
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold', tones[statusTone[status]])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(`status.${status}`)}
    </span>
  )
}
