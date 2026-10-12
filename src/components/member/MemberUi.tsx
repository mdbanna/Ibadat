import type { ReactNode } from 'react'
import { SectionHeading } from '../ui'
import { cx } from '../../lib/cx'

/** Page heading used by every dashboard section. Exactly one h1 per page. */
export function MemberHeading({ title, lead }: { title: string; lead?: string }) {
  return <SectionHeading level={1} title={title} description={lead} />
}

export function StatCard({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-(--radius-card) border border-line bg-surface p-4 shadow-(--shadow-card)', className)}>
      <p className="text-sm text-muted-strong">{label}</p>
      <p className="mt-1 break-words text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-strong">{hint}</p>}
    </div>
  )
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-6">{children}</div>
}
