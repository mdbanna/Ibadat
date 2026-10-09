import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  level?: 1 | 2 | 3
  align?: 'start' | 'center'
}

const sizes = { 1: 'text-(length:--text-h1)', 2: 'text-(length:--text-h2)', 3: 'text-(length:--text-h3)' } as const

export function SectionHeading({ title, eyebrow, description, level = 2, align = 'start' }: Props) {
  const Tag = `h${level}` as const
  return (
    <div className={cx('flex max-w-2xl flex-col gap-2', align === 'center' && 'mx-auto items-center text-center')}>
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-leaf">{eyebrow}</p>}
      <Tag className={cx('font-bold', sizes[level])}>{title}</Tag>
      {description && <p className="text-base text-muted md:text-lg">{description}</p>}
    </div>
  )
}
