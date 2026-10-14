import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, FormField, Input, Notice } from '../../components/ui'
import { MemberHeading, Stack } from '../../components/member/MemberUi'
import { createMemberAsAdmin, type AddMemberValues } from '../../lib/admin'
import { canonicalPhone, initialPassword } from '../../lib/phone'
import { isValidEmail } from '../../lib/validation'
import { usePageMeta } from '../../lib/usePageMeta'

const EMPTY: AddMemberValues = { fullName: '', phone: '', nidNumber: '', email: '', dateOfBirth: '', occupation: '', addressLine: '', district: '', upazila: '' }
type Errs = Partial<Record<keyof AddMemberValues, string>>

/** First admin screen: create a member account with the same data the application collects, plus the NID number. */
export default function AddMemberPage() {
  const { t } = useTranslation()
  usePageMeta(null, t('adminMember.title'))
  const [v, setV] = useState<AddMemberValues>(EMPTY)
  const [errors, setErrors] = useState<Errs>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState<{ memberId: string; phone: string; initialPassword: string } | null>(null)
  const set = (k: keyof AddMemberValues, val: string) => { setV((p) => ({ ...p, [k]: val })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })) }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const found: Errs = {}
    if (v.fullName.trim().length < 2) found.fullName = t('validation.required')
    if (!v.phone.trim()) found.phone = t('validation.required')
    else if (!canonicalPhone(v.phone)) found.phone = t('validation.invalidPhone')
    if (!/^([0-9]{10}|[0-9]{13}|[0-9]{17})$/.test(v.nidNumber.replace(/[\s-]/g, ''))) found.nidNumber = t('adminMember.nidHint')
    if (v.email.trim() && !isValidEmail(v.email.trim())) found.email = t('validation.invalidEmail')
    setErrors(found); setFailure(null)
    if (Object.keys(found).length > 0) { document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); return }
    setBusy(true)
    const result = await createMemberAsAdmin(v)
    setBusy(false)
    if (result.ok) { setDone({ memberId: result.memberId, phone: result.phone, initialPassword: result.initialPassword }); return }
    setFailure(
      result.code === 'phone_taken' ? t('adminMember.errPhoneTaken') : result.code === 'nid_taken' ? t('adminMember.errNidTaken')
      : result.code === 'forbidden' ? t('adminMember.errForbidden') : result.code === 'invalid' ? t('adminMember.errInvalid') : t('adminMember.errFailed'),
    )
  }

  if (done) {
    return (
      <Stack>
        <MemberHeading title={t('adminMember.successTitle')} lead={t('adminMember.successBody')} />
        <Card className="flex flex-col gap-3" role="status">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-sm text-muted-strong">{t('adminMember.memberIdLabel')}</dt><dd className="text-xl font-bold" dir="ltr">{done.memberId}</dd></div>
            <div><dt className="text-sm text-muted-strong">{t('adminMember.loginLabel')}</dt><dd className="text-xl font-bold" dir="ltr">{initialPassword(done.phone)}</dd></div>
            <div><dt className="text-sm text-muted-strong">{t('adminMember.tempLabel')}</dt><dd className="text-xl font-bold" dir="ltr">{done.initialPassword}</dd></div>
          </dl>
        </Card>
        <div><Button onClick={() => { setDone(null); setV(EMPTY) }}>{t('adminMember.another')}</Button></div>
      </Stack>
    )
  }

  return (
    <Stack>
      <MemberHeading title={t('adminMember.title')} lead={t('adminMember.lead')} />
      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={busy}>
          {failure && <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 font-medium text-danger">{failure}</div>}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormField label={t('forms.fullName')} required error={errors.fullName}>{(p) => <Input {...p} name="fullName" autoComplete="off" value={v.fullName} onChange={(e) => set('fullName', e.target.value)} />}</FormField>
            </div>
            <FormField label={t('forms.phone')} hint={t('login.phoneHint')} required error={errors.phone}>{(p) => <Input {...p} name="phone" type="tel" inputMode="tel" dir="ltr" value={v.phone} onChange={(e) => set('phone', e.target.value)} />}</FormField>
            <FormField label={t('forms.nid')} hint={t('adminMember.nidHint')} required error={errors.nidNumber}>{(p) => <Input {...p} name="nidNumber" inputMode="numeric" autoComplete="off" dir="ltr" value={v.nidNumber} onChange={(e) => set('nidNumber', e.target.value)} />}</FormField>
            <FormField label={t('forms.email')} error={errors.email}>{(p) => <Input {...p} name="email" type="email" dir="ltr" value={v.email} onChange={(e) => set('email', e.target.value)} />}</FormField>
            <FormField label={t('forms.dateOfBirth')}>{(p) => <Input {...p} name="dateOfBirth" type="date" value={v.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />}</FormField>
            <FormField label={t('forms.occupation')}>{(p) => <Input {...p} name="occupation" value={v.occupation} onChange={(e) => set('occupation', e.target.value)} />}</FormField>
            <FormField label={t('forms.address')}>{(p) => <Input {...p} name="addressLine" value={v.addressLine} onChange={(e) => set('addressLine', e.target.value)} />}</FormField>
            <FormField label={t('forms.district')}>{(p) => <Input {...p} name="district" value={v.district} onChange={(e) => set('district', e.target.value)} />}</FormField>
            <FormField label={t('forms.upazila')}>{(p) => <Input {...p} name="upazila" value={v.upazila} onChange={(e) => set('upazila', e.target.value)} />}</FormField>
          </div>
          <Notice>{t('adminMember.nidPrivacy')}</Notice>
          <div><Button type="submit" loading={busy}>{busy ? t('adminMember.submitting') : t('adminMember.submit')}</Button></div>
        </form>
      </Card>
    </Stack>
  )
}
