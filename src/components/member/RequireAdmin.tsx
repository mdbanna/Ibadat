import { useTranslation } from 'react-i18next'
import { Card, SectionHeading } from '../ui'
import { useAuth } from '../../lib/auth'
import { Outlet } from 'react-router-dom'

/** Hides admin pages from non-admins. The Edge Functions and RLS re-check the admin role on the server for every action. */
export function RequireAdmin() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Card><SectionHeading level={1} title={t('adminMember.notAdmin')} /></Card>
  return <Outlet />
}
