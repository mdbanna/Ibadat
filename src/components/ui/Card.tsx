import type { HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-(--radius-card) border border-line bg-surface p-5 shadow-(--shadow-card) md:p-6', className)} {...rest} />
}
