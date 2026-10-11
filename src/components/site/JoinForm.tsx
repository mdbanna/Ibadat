import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, CheckboxField, FormField, Input, Textarea } from '../ui'
import { submitApplication, type SubmitError } from '../../lib/submissions'
import { validateJoin, type Errors, type FieldError, type JoinField, type JoinValues } from '../../lib/validation'
import type { Language } from '../../i18n'

const EMPTY: JoinValues = {
  fullName: '', phone: '', email: '', dateOfBirth: '', occupation: '',
  addressLine: '', district: '', upazila: '', motivation: '', consent: false,
}

type Status = 'idle' | 'submitting' | 'done'

export function JoinForm() {
  const { t, i18n } = useTranslation()
  const [values, setValues] = useState<JoinValues>(EMPTY)
  const [errors, setErrors] = useState<Errors<JoinField>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)
  const [reference, setReference] = useState('')
  const [attempt, setAttempt] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const honeypot = useRef<HTMLInputElement>(null)

  // After a failed submit, move focus to the first invalid field.
  useEffect(() => {
    if (attempt === 0) return
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [attempt])
  useEffect(() => { if (status === 'done') doneRef.current?.focus() }, [status])

  const err = (k: JoinField) => {
    const e: FieldError | undefined = errors[k]
    return e ? t(`validation.${e.key}`, e.params) : undefined
  }
  const set = <K extends keyof JoinValues>(k: K, v: JoinValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((prev) => { const { [k]: _removed, ...rest } = prev; return rest })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'submitting') return
    const found = validateJoin(values)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) { setAttempt((n) => n + 1); return }
    // Hidden field only bots fill in: pretend success without sending anything.
    if (honeypot.current?.value) { setReference(''); setStatus('done'); return }
    setStatus('submitting')
    const result = await submitApplication(values, i18n.resolvedLanguage as Language)
    if (result.ok) { setReference(result.value); setStatus('done') }
    else { setSubmitError(result.error); setStatus('idle') }
  }

  if (status === 'done') {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h2 ref={doneRef} tabIndex={-1} className="text-(length:--text-h2) font-bold outline-none">{t('join.successTitle')}</h2>
        <p>{t('join.successBody')}</p>
        {reference && (
          <div className="rounded-lg border border-line bg-forest-soft p-4">
            <p className="text-sm text-muted">{t('join.referenceLabel')}</p>
            <p className="text-2xl font-bold tracking-wide" dir="ltr">{reference}</p>
            <p className="mt-1 text-sm text-muted">{t('join.referenceHint')}</p>
          </div>
        )}
      </div>
    )
  }

  const submitMessage: Record<SubmitError, string> = {
    duplicate: t('join.errDuplicate'),
    invalid: t('join.errInvalid'),
    unavailable: t('join.errUnavailable'),
    rate_limited: t('join.errRateLimited'),
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-8" aria-busy={status === 'submitting'}>
      {(Object.keys(errors).length > 0 || submitError) && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 font-medium text-danger">
          {submitError ? submitMessage[submitError] : t('join.fixErrors')}
        </div>
      )}

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-3 text-(length:--text-h3) font-bold">{t('join.sectionPersonal')}</legend>
        <div className="md:col-span-2">
          <FormField label={t('forms.fullName')} required error={err('fullName')}>
            {(p) => <Input {...p} name="fullName" autoComplete="name" value={values.fullName} onChange={(e) => set('fullName', e.target.value)} />}
          </FormField>
        </div>
        <FormField label={t('forms.phone')} hint={t('join.phoneHint')} required error={err('phone')}>
          {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={values.phone} onChange={(e) => set('phone', e.target.value)} />}
        </FormField>
        <FormField label={t('forms.email')} error={err('email')}>
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </FormField>
        <FormField label={t('forms.dateOfBirth')} error={err('dateOfBirth')}>
          {(p) => <Input {...p} name="dateOfBirth" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={values.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />}
        </FormField>
        <FormField label={t('forms.occupation')} error={err('occupation')}>
          {(p) => <Input {...p} name="occupation" autoComplete="organization-title" value={values.occupation} onChange={(e) => set('occupation', e.target.value)} />}
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-3 text-(length:--text-h3) font-bold">{t('join.sectionAddress')}</legend>
        <div className="md:col-span-2">
          <FormField label={t('forms.address')} error={err('addressLine')}>
            {(p) => <Input {...p} name="addressLine" autoComplete="street-address" value={values.addressLine} onChange={(e) => set('addressLine', e.target.value)} />}
          </FormField>
        </div>
        <FormField label={t('forms.district')} error={err('district')}>
          {(p) => <Input {...p} name="district" autoComplete="address-level1" value={values.district} onChange={(e) => set('district', e.target.value)} />}
        </FormField>
        <FormField label={t('forms.upazila')} error={err('upazila')}>
          {(p) => <Input {...p} name="upazila" autoComplete="address-level2" value={values.upazila} onChange={(e) => set('upazila', e.target.value)} />}
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-(length:--text-h3) font-bold">{t('join.sectionAbout')}</legend>
        <FormField label={t('forms.motivation')} hint={t('join.motivationHint')} error={err('motivation')}>
          {(p) => <Textarea {...p} name="motivation" rows={5} value={values.motivation} onChange={(e) => set('motivation', e.target.value)} />}
        </FormField>
        <CheckboxField name="consent" label={t('forms.consent')} checked={values.consent} onChange={(v) => set('consent', v)} error={err('consent')} />
      </fieldset>

      {/* Honeypot: invisible to people and assistive technology, tempting to bots. */}
      <div className="hidden" aria-hidden="true">
        <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <Button type="submit" loading={status === 'submitting'}>
          {status === 'submitting' ? t('join.submitting') : t('join.submit')}
        </Button>
      </div>
    </form>
  )
}
