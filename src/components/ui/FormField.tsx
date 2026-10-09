import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'

export interface ControlA11yProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
}

interface FormFieldProps {
  label: string
  hint?: string
  /** Already-translated error text. Validation messages come from the `validation.*` translations. */
  error?: string
  required?: boolean
  children: (props: ControlA11yProps) => ReactNode
}

export function FormField({ label, hint, error, required, children }: FormFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="ms-1 text-danger" aria-label={t('common.required')}>*</span> : <span className="ms-2 font-normal text-muted">({t('common.optional')})</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {hint && !error && <p id={hintId} className="text-sm text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </div>
  )
}

const controlClass = (invalid?: boolean) =>
  cx(
    'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70',
    'min-h-11 transition-colors focus:border-forest',
    invalid ? 'border-danger' : 'border-line hover:border-muted',
  )

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlClass(rest['aria-invalid'] === true), className)} {...rest} />
}

export function Textarea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cx(controlClass(rest['aria-invalid'] === true), className)} {...rest} />
}
