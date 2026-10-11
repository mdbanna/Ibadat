import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'light'
type Variant = ButtonVariant
type Size = 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-white hover:bg-forest-deep border-transparent',
  secondary: 'bg-surface text-forest border-forest hover:bg-forest-soft',
  ghost: 'bg-transparent text-forest border-transparent hover:bg-forest-soft',
  danger: 'bg-danger text-white border-transparent hover:brightness-90',
  // gold is reserved for the single most important call to action on a dark surface
  accent: 'bg-gold text-ink border-transparent hover:brightness-95',
  light: 'bg-transparent text-white border-white/70 hover:bg-white/10',
}

/** Shared by <Button> and <ButtonLink> so links styled as buttons look identical. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', fullWidth?: boolean, className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors text-center',
    'disabled:cursor-not-allowed disabled:opacity-60',
    size === 'md' ? 'min-h-11 px-5 py-2.5 text-base' : 'min-h-9 px-3 py-1.5 text-sm',
    variants[variant],
    fullWidth && 'w-full',
    className,
  )
}

export function Button({ variant = 'primary', size = 'md', loading = false, fullWidth, className, disabled, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, fullWidth, className)}
      {...rest}
    >
      {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}
