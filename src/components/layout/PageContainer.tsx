import type { ElementType, HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

type Props = HTMLAttributes<HTMLElement> & { as?: ElementType; narrow?: boolean }

/** Max width 1200px. Gutters: 16px (mobile) / 24px (>=768) / 32px (>=1200). min-w-0 prevents flex children forcing overflow. */
export function PageContainer({ as: Tag = 'div', narrow, className, ...rest }: Props) {
  return <Tag className={cx('mx-auto w-full min-w-0 px-4 md:px-6 xl:px-8', narrow ? 'max-w-3xl' : 'max-w-300', className)} {...rest} />
}
