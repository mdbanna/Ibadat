import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../layout'
import { Loading, Notice } from '../ui'
import { useAuth } from '../../lib/auth'
import { FIRST_LOGIN_PATH, LOGIN_PATH } from '../../routes'
import { AccessMessage } from './AccessMessage'

/**
 * Route guard for the members-only area. This is a USABILITY layer only: every piece of member data is also protected by
 * Row Level Security and database functions, so bypassing this component in the browser reveals nothing.
 */
export function RequireMember() {
  const { t } = useTranslation()
  const auth = useAuth()
  const location = useLocation()
  const previousStatus = useRef(auth.status)
  useEffect(() => { previousStatus.current = auth.status })

  if (auth.status === 'loading' || auth.status === 'checking') return <Loading className="min-h-[50dvh]" />
  if (auth.status === 'unconfigured') {
    return <PageContainer narrow className="py-10"><Notice tone="warning">{t('errors.supabaseNotConfigured')}</Notice></PageContainer>
  }
  if (auth.status === 'signed_out') {
    // the moment of an intentional logout (we were just signed in on this page) goes to a clean /login;
    // a fresh visit or an expired session remembers where the member was going
    if (previousStatus.current === 'ready' && auth.notice === 'loggedOut') return <Navigate to={LOGIN_PATH} replace />
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${LOGIN_PATH}?next=${next}`} replace />
  }
  if (auth.access !== 'active') {
    return <AccessMessage access={auth.access ?? 'error'} status={auth.profile?.membership_status} />
  }
  // still on the temporary password (their phone number): only the "choose a new password" page is available
  if (auth.mustChangePassword) return <Navigate to={FIRST_LOGIN_PATH} replace />
  return <Outlet />
}
