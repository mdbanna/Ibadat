import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, FormField, Input, Notice, Textarea } from '../ui'
import { submitContactMessage, type SubmitError } from '../../lib/submissions'
import { validateContact, type ContactField, type ContactValues, type Errors, type FieldError } from '../../lib/validation'
import type { Language } from '../../i18n'

const EMPTY: ContactValues = { name: '', email: '', phone: '', subject: '', message: '' }

export function ContactForm() {
  const { t, i18n } = useTranslation()
  const [values, setValues] = useState<ContactValues>(EMPTY)
  const [errors, setErrors] = useState<Errors<ContactField>>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const honeypot = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (attempt === 0) return
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [attempt])
  useEffect(() => { if (status === 'done') doneRef.current?.focus() }, [status])

  const err = (k: ContactField) => {
    const e: FieldError | undefined = errors[k]
    return e ? t(`validation.${e.key}`, e.params) : undefined
  }
  const set = (k: keyof ContactValues, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }))
    if (errors[k] || errors.channel) setErrors((prev) => { const { [k]: _a, channel: _b, ...rest } = prev; return rest })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'submitting') return
    const found = validateContact(values)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) { setAttempt((n) => n + 1); return }
    if (honeypot.current?.value) { setStatus('done'); return }
    setStatus('submitting')
    const result = await submitContactMessage(values, i18n.resolvedLanguage as Language)
    if (result.ok) { setValues(EMPTY); setStatus('done') }
    else { setSubmitError(result.error); setStatus('idle') }
  }

  if (status === 'done') {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h2 ref={doneRef} tabIndex={-1} className="text-(length:--text-h2) font-bold outline-none">{t('contact.successTitle')}</h2>
        <p>{t('contact.successBody')}</p>
        <div><Button variant="secondary" onClick={() => setStatus('idle')}>{t('contact.another')}</Button></div>
      </div>
    )
  }

  const submitMessage: Record<SubmitError, string> = {
    duplicate: t('contact.errInvalid'),
    invalid: t('contact.errInvalid'),
    unavailable: t('contact.errUnavailable'),
    rate_limited: t('contact.errRateLimited'),
  }
  const hasErrors = Object.keys(errors).length > 0

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={status === 'submitting'}>
      <div>
        <h2 className="text-(length:--text-h2) font-bold">{t('contact.formTitle')}</h2>
        <p className="mt-1 text-muted">{t('contact.formLead')}</p>
      </div>
      {(hasErrors || submitError) && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 font-medium text-danger">
          {submitError ? submitMessage[submitError] : errors.channel ? t(`validation.${errors.channel.key}`) : t('join.fixErrors')}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField label={t('forms.yourName')} required error={err('name')}>
            {(p) => <Input {...p} name="name" autoComplete="name" value={values.name} onChange={(e) => set('name', e.target.value)} />}
          </FormField>
        </div>
        <FormField label={t('forms.email')} error={err('email')}>
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" aria-invalid={p['aria-invalid'] || errors.channel ? true : undefined} value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </FormField>
        <FormField label={t('forms.phone')} error={err('phone')}>
          {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={values.phone} onChange={(e) => set('phone', e.target.value)} />}
        </FormField>
        <div className="md:col-span-2">
          <FormField label={t('forms.subject')} error={err('subject')}>
            {(p) => <Input {...p} name="subject" value={values.subject} onChange={(e) => set('subject', e.target.value)} />}
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label={t('forms.message')} required error={err('message')}>
            {(p) => <Textarea {...p} name="message" rows={6} value={values.message} onChange={(e) => set('message', e.target.value)} />}
          </FormField>
        </div>
      </div>
      <Notice>{t('contact.memberOnly')}</Notice>
      <div className="hidden" aria-hidden="true">
        <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div>
        <Button type="submit" loading={status === 'submitting'}>{status === 'submitting' ? t('contact.sending') : t('contact.send')}</Button>
      </div>
    </form>
  )
}
