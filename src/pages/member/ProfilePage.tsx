import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CheckboxField, FormField, Input, Notice, StatusBadge, Textarea, toStatusKey } from '../../components/ui'
import { SiteImage } from '../../components/site/SiteImage'
import { MemberHeading, Stack } from '../../components/member/MemberUi'
import { useAuth } from '../../lib/auth'
import { PHOTO_MAX_BYTES, PHOTO_TYPES, removeStorageObject, updateOwnProfile, uploadProfilePhoto } from '../../lib/member'
import { formatDate } from '../../lib/localize'
import { isValidEmail, isValidPhone, normalizePhone } from '../../lib/validation'
import { usePageMeta } from '../../lib/usePageMeta'
import { useSignedUrls } from '../../lib/useSignedUrls'
import type { Language } from '../../i18n'

interface Form { fullName: string; phone: string; email: string; location: string; bio: string; isPublic: boolean }
type Errs = Partial<Record<keyof Form, string>>

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  const { profile, setProfile } = useAuth()
  usePageMeta(null, t('member.nav.profile'))
  const [form, setForm] = useState<Form>(() => ({
    fullName: profile?.full_name ?? '', phone: profile?.phone ?? '', email: profile?.email ?? '',
    location: profile?.general_location ?? '', bio: profile?.short_bio ?? '', isPublic: profile?.public_profile_preference ?? false,
  }))
  const [errors, setErrors] = useState<Errs>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoUrls = useSignedUrls('member-photos', [profile?.profile_image_path])
  if (!profile) return null

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setMessage(null); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })) }

  function validate(): Errs {
    const e: Errs = {}
    const name = form.fullName.trim()
    if (!name) e.fullName = t('validation.required')
    else if (name.length < 2) e.fullName = t('validation.tooShort', { min: 2 })
    else if (name.length > 120) e.fullName = t('validation.tooLong', { max: 120 })
    if (form.phone.trim() && !isValidPhone(normalizePhone(form.phone))) e.phone = t('validation.invalidPhone')
    if (form.email.trim() && !isValidEmail(form.email.trim())) e.email = t('validation.invalidEmail')
    if (form.location.trim().length > 120) e.location = t('validation.tooLong', { max: 120 })
    if (form.bio.trim().length > 300) e.bio = t('validation.tooLong', { max: 300 })
    return e
  }

  async function onSave(ev: FormEvent) {
    ev.preventDefault()
    if (!profile || saving) return
    const found = validate()
    setErrors(found)
    setMessage(null)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    try {
      const saved = await updateOwnProfile(profile.id, {
        full_name: form.fullName.trim(),
        phone: form.phone.trim() ? normalizePhone(form.phone) : null,
        email: form.email.trim() || null,
        general_location: form.location.trim() || null,
        short_bio: form.bio.trim() || null,
        public_profile_preference: form.isPublic,
      })
      setProfile(saved)
      setMessage({ kind: 'ok', text: t('member.profile.saved') })
    } catch (e) {
      const code = (e as { code?: string }).code
      setMessage({ kind: 'error', text: code === '23505' ? t('member.profile.errTaken') : t('member.profile.errSave') })
    } finally { setSaving(false) }
  }

  async function onPhoto(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file || !profile) return
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) { setMessage({ kind: 'error', text: t('member.profile.errPhotoType') }); return }
    if (file.size > PHOTO_MAX_BYTES) { setMessage({ kind: 'error', text: t('member.profile.errPhotoSize') }); return }
    setPhotoBusy(true); setMessage(null)
    try {
      const previous = profile.profile_image_path
      const path = await uploadProfilePhoto(profile.id, file)
      const saved = await updateOwnProfile(profile.id, {
        full_name: profile.full_name, phone: profile.phone, email: profile.email, general_location: profile.general_location,
        short_bio: profile.short_bio, public_profile_preference: profile.public_profile_preference, profile_image_path: path,
      })
      setProfile(saved)
      if (previous) void removeStorageObject('member-photos', previous)
      setMessage({ kind: 'ok', text: t('member.profile.photoSaved') })
    } catch {
      setMessage({ kind: 'error', text: t('member.profile.errSave') })
    } finally { setPhotoBusy(false) }
  }

  const status = toStatusKey(profile.membership_status)
  const publicState = !profile.public_profile_preference ? t('member.profile.stateOff') : profile.public_profile_approved ? t('member.profile.stateLive') : t('member.profile.stateWaiting')

  return (
    <Stack>
      <MemberHeading title={t('member.profile.title')} lead={t('member.profile.lead')} />
      {message && (
        message.kind === 'ok'
          ? <div role="status" className="rounded-lg border border-leaf/40 bg-leaf-soft p-3 font-medium text-forest-deep">{message.text}</div>
          : <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 font-medium text-danger">{message.text}</div>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-(length:--text-h3) font-bold">{t('member.profile.accountTitle')}</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-muted-strong">{t('member.overview.memberId')}</dt><dd className="font-bold" dir="ltr">{profile.member_id}</dd></div>
          <div><dt className="text-sm text-muted-strong">{t('member.overview.status')}</dt><dd>{status ? <StatusBadge status={status} /> : profile.membership_status}</dd></div>
          <div><dt className="text-sm text-muted-strong">{t('member.overview.since')}</dt><dd className="font-bold">{formatDate(profile.membership_start_date, lang) || '—'}</dd></div>
        </dl>
        <p className="text-sm text-muted-strong">{t('member.profile.accountNote')}</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-(length:--text-h3) font-bold">{t('member.profile.photoTitle')}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <SiteImage url={profile.profile_image_path ? photoUrls[profile.profile_image_path] : undefined} alt={t('member.profile.photoAlt')} ratio="1 / 1" className="size-24 rounded-full" />
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(',')} onChange={onPhoto} className="sr-only" id="photo-input" aria-label={t('member.profile.photoTitle')} aria-describedby="photo-hint" />
            <Button type="button" variant="secondary" loading={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? t('member.profile.photoUploading') : t('member.profile.photoChoose')}
            </Button>
            <p id="photo-hint" className="text-sm text-muted-strong">{t('member.profile.photoHint')}</p>
          </div>
        </div>
      </Card>

      <Card>
        <form onSubmit={onSave} noValidate className="flex flex-col gap-5" aria-busy={saving}>
          <h2 className="text-(length:--text-h3) font-bold">{t('member.profile.editTitle')}</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormField label={t('forms.fullName')} required error={errors.fullName}>
                {(p) => <Input {...p} name="fullName" autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />}
              </FormField>
            </div>
            <FormField label={t('forms.phone')} error={errors.phone}>
              {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
            </FormField>
            <FormField label={t('forms.email')} error={errors.email}>
              {(p) => <Input {...p} name="email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={(e) => set('email', e.target.value)} />}
            </FormField>
            <div className="md:col-span-2">
              <FormField label={t('member.profile.location')} error={errors.location}>
                {(p) => <Input {...p} name="location" value={form.location} onChange={(e) => set('location', e.target.value)} />}
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label={t('member.profile.bio')} hint={t('member.profile.bioHint')} error={errors.bio}>
                {(p) => <Textarea {...p} name="bio" rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} />}
              </FormField>
            </div>
          </div>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <legend className="px-1 font-bold">{t('member.profile.publicTitle')}</legend>
            <CheckboxField name="isPublic" label={t('member.profile.publicLabel')} checked={form.isPublic} onChange={(v) => set('isPublic', v)} />
            <p className="text-sm text-muted-strong">{t('member.profile.publicLead')}</p>
            <p className="text-sm"><span className="font-semibold">{publicState}</span></p>
            <Notice>{t('member.profile.resetNote')}</Notice>
          </fieldset>

          <div><Button type="submit" loading={saving}>{t('common.save')}</Button></div>
        </form>
      </Card>
    </Stack>
  )
}
