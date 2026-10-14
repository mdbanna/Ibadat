import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, FormField, Input, Notice } from '../../components/ui'
import { LanguageSwitcher } from '../../components/layout'
import { MemberHeading, Stack } from '../../components/member/MemberUi'
import { useAuth } from '../../lib/auth'
import { changePassword, signOutOtherDevices } from '../../lib/memberAuth'
import { usePageMeta } from '../../lib/usePageMeta'
import { LOGIN_PATH } from '../../routes'

const MIN_PASSWORD = 8

export default function SettingsPage() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  usePageMeta(null, t('member.nav.settings'))
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [othersBusy, setOthersBusy] = useState(false)
  if (!profile) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || busy) return
    const found: typeof errors = {}
    if (!current) found.current = t('validation.required')
    if (!next) found.next = t('validation.required')
    else if (next.length < MIN_PASSWORD) found.next = t('validation.tooShort', { min: MIN_PASSWORD })
    else if (next === current) found.next = t('member.settings.errSame')
    if (!confirm) found.confirm = t('validation.required')
    else if (confirm !== next) found.confirm = t('member.settings.errMismatch')
    setErrors(found); setMessage(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    const result = await changePassword(profile.phone, current, next)
    setBusy(false)
    if (result.ok) { setCurrent(''); setNext(''); setConfirm(''); setMessage({ kind: 'ok', text: t('member.settings.changed') }) }
    else if (result.reason === 'wrong_current') setErrors({ current: t('member.settings.errWrongCurrent') })
    else setMessage({ kind: 'error', text: t('member.settings.errFailed') })
  }

  async function onSignOutOthers() {
    setOthersBusy(true); setMessage(null)
    const ok = await signOutOtherDevices()
    setOthersBusy(false)
    setMessage(ok ? { kind: 'ok', text: t('member.settings.signOutOthersDone') } : { kind: 'error', text: t('member.settings.errFailed') })
  }

  return (
    <Stack>
      <MemberHeading title={t('member.settings.title')} lead={t('member.settings.lead')} />
      {message && (message.kind === 'ok'
        ? <div role="status" className="rounded-lg border border-leaf/40 bg-leaf-soft p-3 font-medium text-forest-deep">{message.text}</div>
        : <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 font-medium text-danger">{message.text}</div>)}

      <Card className="flex flex-col gap-3">
        <h2 className="text-(length:--text-h3) font-bold">{t('member.settings.languageTitle')}</h2>
        <div><LanguageSwitcher /></div>
      </Card>

      <Card>
        <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-5" aria-busy={busy}>
          <h2 className="text-(length:--text-h3) font-bold">{t('member.settings.passwordTitle')}</h2>
          <FormField label={t('member.settings.current')} required error={errors.current}>
            {(p) => <Input {...p} name="current-password" type="password" autoComplete="current-password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </FormField>
          <FormField label={t('member.settings.newPassword')} hint={t('member.settings.passwordHint')} required error={errors.next}>
            {(p) => <Input {...p} name="new-password" type="password" autoComplete="new-password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} />}
          </FormField>
          <FormField label={t('member.settings.confirm')} required error={errors.confirm}>
            {(p) => <Input {...p} name="confirm-password" type="password" autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </FormField>
          <div><Button type="submit" loading={busy}>{busy ? t('member.settings.changing') : t('member.settings.change')}</Button></div>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-(length:--text-h3) font-bold">{t('member.settings.sessionsTitle')}</h2>
        <p className="text-muted-strong">{t('member.settings.sessionsBody')}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" loading={othersBusy} onClick={() => void onSignOutOthers()}>{t('member.settings.signOutOthers')}</Button>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate(LOGIN_PATH, { replace: true }) }}>{t('member.settings.logoutTitle')}</Button>
        </div>
      </Card>
      <Notice>{t('member.settings.loginIdNote')}</Notice>
    </Stack>
  )
}
