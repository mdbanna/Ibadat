import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../layout'
import { Loading, Notice } from '../ui'
import { useAuth } from '../../lib/auth'
import { LOGIN_PATH } from '../../routes'
import { AccessMessage } from './AccessMessage'

/**
 * Route guard for the members-only area. This is a USABILITY layer only: every piece of member data is also protected by
 * Row Level Security and database functions, so bypassing this component in the browser reveals nothing.
 */
export function RequireMember() {
  const { t } = useTranslation()
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading' || auth.status === 'checking') return <Loading className="min-h-[50dvh]" />
  if (auth.status === 'unconfigured') {
    return <PageContainer narrow className="py-10"><Notice tone="warning">{t('errors.supabaseNotConfigured')}</Notice></PageContainer>
  }
  if (auth.status === 'signed_out') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${LOGIN_PATH}?next=${next}`} replace />
  }
  if (auth.access !== 'active') {
    return <AccessMessage access={auth.access ?? 'error'} status={auth.profile?.membership_status} />
  }
  return <Outlet />
}
