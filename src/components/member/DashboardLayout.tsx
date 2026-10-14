import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../layout'
import { Button } from '../ui'
import { useAuth } from '../../lib/auth'
import { cx } from '../../lib/cx'
import { ADMIN_ADD_MEMBER_PATH, DASHBOARD_ITEMS, LOGIN_PATH } from '../../routes'

/** Sidebar from 1200px; below that a disclosure menu that shows the current section, so nothing scrolls sideways at 360px. */
export function DashboardLayout() {
  const { t } = useTranslation()
  const auth = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const current = DASHBOARD_ITEMS.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to))) ?? DASHBOARD_ITEMS[0]
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'block rounded-lg px-3 py-2.5 font-medium transition-colors',
      isActive ? 'bg-forest text-white' : 'text-ink hover:bg-forest-soft hover:text-forest',
    )

  async function logout() {
    await auth.signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  return (
    <PageContainer className="grid gap-6 py-6 md:py-10 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-10">
      <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="dashboard-nav"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-start font-semibold xl:hidden"
        >
          <span className="min-w-0 truncate"><span className="text-muted-strong">{t('member.menu')}: </span>{t(current.key)}</span>
          <svg aria-hidden viewBox="0 0 24 24" className={cx('size-5 shrink-0 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <nav id="dashboard-nav" aria-label={t('member.navLabel')} className={cx('mt-2 rounded-(--radius-card) border border-line bg-surface p-2 xl:mt-0 xl:block', open ? 'block' : 'hidden')}>
          <ul className="flex flex-col gap-0.5">
            {DASHBOARD_ITEMS.map((i) => (
              <li key={i.to}><NavLink to={i.to} end={i.end} className={linkClass}>{t(i.key)}</NavLink></li>
            ))}
            {auth.isAdmin && <li><NavLink to={ADMIN_ADD_MEMBER_PATH} className={linkClass}>{t('member.nav.addMember')}</NavLink></li>}
          </ul>
          <div className="mt-2 border-t border-line pt-2">
            <Button variant="ghost" fullWidth onClick={() => void logout()}>{t('nav.logout')}</Button>
          </div>
        </nav>
      </aside>
      <div className="min-w-0"><Outlet /></div>
    </PageContainer>
  )
}
