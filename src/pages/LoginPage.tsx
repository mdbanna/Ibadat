import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { AccessMessage } from '../components/member/AccessMessage'
import { Button, ButtonLink, Card, FormField, Input, Loading, Notice, SectionHeading } from '../components/ui'
import { safeNext, useAuth, type SignInOutcome } from '../lib/auth'
import { normalizeMemberId } from '../lib/memberAuth'
import { usePageMeta } from '../lib/usePageMeta'
import { JOIN_PATH } from '../routes'

type Failure = Extract<SignInOutcome, { ok: false }>['reason']

export default function LoginPage() {
  const { t } = useTranslation()
  usePageMeta(null, t('login.title'))
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [memberId, setMemberId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ memberId?: string; password?: string }>({})
  const [failure, setFailure] = useState<Failure | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [inactive, setInactive] = useState(false)

  if (auth.status === 'loading' || auth.status === 'checking') return <PageContainer narrow className="py-16"><Loading /></PageContainer>
  if (auth.status === 'ready' && auth.access === 'active' && !submitting) return <Navigate to={next} replace />
  if (auth.status === 'ready' && auth.access && auth.access !== 'active') {
    return <AccessMessage access={auth.access} status={auth.profile?.membership_status} />
  }

  const unconfigured = auth.status === 'unconfigured'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const errors: { memberId?: string; password?: string } = {}
    if (!memberId.trim()) errors.memberId = t('validation.required')
    else if (!normalizeMemberId(memberId)) errors.memberId = t('validation.invalidMemberId')
    if (!password) errors.password = t('validation.required')
    setFieldErrors(errors)
    setFailure(null)
    if (errors.memberId || errors.password) {
      document.querySelector<HTMLElement>(errors.memberId ? 'input[name="username"]' : 'input[name="password"]')?.focus()
      return
    }
    setSubmitting(true)
    const result = await auth.signIn(memberId, password)
    setSubmitting(false)
    if (!result.ok) { setFailure(result.reason); setPassword(''); return }
    if (result.access === 'active') navigate(next, { replace: true })
    else setInactive(true)
  }

  const failureText: Record<Failure, string> = {
    invalid_member_id: t('validation.invalidMemberId'),
    invalid_credentials: t('login.errInvalid'),
    rate_limited: t('login.errRateLimited'),
    network: t('login.errNetwork'),
    unavailable: t('login.errUnavailable'),
  }

  if (inactive && auth.access && auth.access !== 'active') {
    return <AccessMessage access={auth.access} status={auth.profile?.membership_status} />
  }

  return (
    <PageContainer className="grid gap-8 py-10 md:py-16 xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] xl:gap-14">
      <div className="flex flex-col gap-6">
        <SectionHeading level={1} title={t('login.title')} description={t('login.lead')} />
        {auth.notice === 'loggedOut' && <Notice><span role="status">{t('auth.loggedOut')}</span></Notice>}
        {auth.notice === 'sessionExpired' && <Notice tone="warning"><span role="status">{t('auth.sessionExpired')}</span></Notice>}
        {!auth.notice && params.has('next') && <Notice><span role="status">{t('auth.signInRequired')}</span></Notice>}
        {unconfigured && <Notice tone="warning">{t('errors.supabaseNotConfigured')}</Notice>}

        <Card>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={submitting}>
            {failure && (
              <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 font-medium text-danger">{failureText[failure]}</div>
            )}
            <FormField label={t('forms.memberId')} hint={t('forms.memberIdHint')} required error={fieldErrors.memberId}>
              {(p) => (
                <Input
                  {...p}
                  name="username"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  dir="ltr"
                  value={memberId}
                  onChange={(e) => { setMemberId(e.target.value); if (fieldErrors.memberId) setFieldErrors((f) => ({ ...f, memberId: undefined })) }}
                />
              )}
            </FormField>
            <FormField label={t('forms.password')} required error={fieldErrors.password}>
              {(p) => (
                <div className="flex gap-2">
                  <Input
                    {...p}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })) }}
                  />
                  <Button type="button" variant="secondary" aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)} className="shrink-0">
                    {showPassword ? t('forms.hidePassword') : t('forms.showPassword')}
                  </Button>
                </div>
              )}
            </FormField>
            <Button type="submit" loading={submitting} disabled={unconfigured} fullWidth>
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:pt-24">
        <Notice title={t('login.forgotTitle')}>
          {t('login.forgotBody')} <Link to="/contact" className="font-semibold text-forest underline underline-offset-4">{t('nav.contact')}</Link>
        </Notice>
        <Card className="flex flex-col gap-3">
          <h2 className="text-(length:--text-h3) font-bold">{t('login.notMemberTitle')}</h2>
          <p className="text-muted-strong">{t('login.notMemberBody')}</p>
          <div><ButtonLink to={JOIN_PATH} variant="secondary">{t('nav.apply')}</ButtonLink></div>
        </Card>
        <p className="text-sm text-muted-strong">{t('login.membersOnly')}</p>
      </div>
    </PageContainer>
  )
}
