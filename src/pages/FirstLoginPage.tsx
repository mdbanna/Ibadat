import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { AccessMessage } from '../components/member/AccessMessage'
import { Button, Card, FormField, Input, Loading, Notice, SectionHeading } from '../components/ui'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD_LENGTH, newPasswordProblem } from '../lib/phone'
import { usePageMeta } from '../lib/usePageMeta'
import { LOGIN_PATH } from '../routes'

/** Shown right after a member signs in with the temporary password (their phone number). */
export default function FirstLoginPage() {
  const { t } = useTranslation()
  usePageMeta(null, t('firstLogin.title'))
  const auth = useAuth()
  const navigate = useNavigate()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ next?: string; confirm?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (auth.status === 'loading' || auth.status === 'checking') return <PageContainer narrow className="py-16"><Loading /></PageContainer>
  if (auth.status !== 'ready') return <Navigate to={LOGIN_PATH} replace />
  if (auth.access !== 'active') return <AccessMessage access={auth.access ?? 'error'} status={auth.profile?.membership_status} />
  if (!auth.mustChangePassword && !busy) return <Navigate to="/dashboard" replace />
  const phone = auth.profile?.phone ?? ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const found: typeof errors = {}
    const problem = next ? newPasswordProblem(next, phone) : null
    if (!next) found.next = t('validation.required')
    else if (problem === 'too_short') found.next = t('validation.tooShort', { min: MIN_PASSWORD_LENGTH })
    else if (problem === 'same_as_phone') found.next = t('firstLogin.errSameAsPhone')
    if (!confirm) found.confirm = t('validation.required')
    else if (confirm !== next) found.confirm = t('member.settings.errMismatch')
    setErrors(found); setFailure(null)
    if (Object.keys(found).length > 0) { document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); return }
    setBusy(true)
    const result = await auth.completeFirstLogin(next)
    if (result.ok) { navigate('/dashboard', { replace: true }); return }
    setBusy(false)
    setFailure(result.reason === 'same_as_phone' ? t('firstLogin.errSameAsPhone') : result.reason === 'too_short' ? t('validation.tooShort', { min: MIN_PASSWORD_LENGTH }) : t('firstLogin.errUnavailable'))
  }

  return (
    <PageContainer narrow className="flex flex-col gap-6 py-10 md:py-16">
      <SectionHeading level={1} title={t('firstLogin.title')} description={t('firstLogin.lead')} />
      <Notice tone="warning">{t('firstLogin.why')}</Notice>
      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={busy}>
          {failure && <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 font-medium text-danger">{failure}</div>}
          <FormField label={t('member.settings.newPassword')} hint={t('member.settings.passwordHint')} required error={errors.next}>
            {(p) => <Input {...p} name="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} />}
          </FormField>
          <FormField label={t('member.settings.confirm')} required error={errors.confirm}>
            {(p) => <Input {...p} name="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </FormField>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={busy}>{busy ? t('member.settings.changing') : t('firstLogin.submit')}</Button>
            <Button type="button" variant="secondary" aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? t('forms.hidePassword') : t('forms.showPassword')}</Button>
            <Button type="button" variant="ghost" onClick={async () => { await auth.signOut(); navigate(LOGIN_PATH, { replace: true }) }}>{t('nav.logout')}</Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  )
}
