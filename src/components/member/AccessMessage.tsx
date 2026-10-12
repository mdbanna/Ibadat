import { useTranslation } from 'react-i18next'
import { PageContainer } from '../layout'
import { Button, ButtonLink, Card, SectionHeading } from '../ui'
import { useAuth, type Access } from '../../lib/auth'

/** Shown to someone who is signed in but may not use the members-only area (not active, no profile, or load failure). */
export function AccessMessage({ access, status }: { access: Exclude<Access, 'active'>; status?: string | null }) {
  const { t } = useTranslation()
  const auth = useAuth()
  const keys =
    access === 'no_profile' ? (['access.noProfileTitle', 'access.noProfileBody'] as const)
    : access === 'error' ? (['access.errorTitle', 'access.errorBody'] as const)
    : status === 'pending' ? (['access.pendingTitle', 'access.pendingBody'] as const)
    : status === 'suspended' ? (['access.suspendedTitle', 'access.suspendedBody'] as const)
    : (['access.inactiveTitle', 'access.inactiveBody'] as const)
  return (
    <PageContainer narrow className="py-10 md:py-16">
      <Card className="flex flex-col gap-4">
        <SectionHeading level={1} title={t(keys[0])} description={t(keys[1])} />
        <div className="flex flex-wrap gap-3">
          {access === 'error' && <Button onClick={auth.refreshProfile}>{t('common.retry')}</Button>}
          <ButtonLink to="/contact" variant="secondary">{t('access.contactAdmin')}</ButtonLink>
          <Button variant="ghost" onClick={() => void auth.signOut()}>{t('nav.logout')}</Button>
        </div>
      </Card>
    </PageContainer>
  )
}

