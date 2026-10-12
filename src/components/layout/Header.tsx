import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { PageContainer } from './PageContainer'
import { ButtonLink } from '../ui'
import { cx } from '../../lib/cx'
import { JOIN_PATH, LOGIN_PATH, NAV_ITEMS } from '../../routes'
import { useAuth } from '../../lib/auth'

export function Header() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const auth = useAuth()
  const signedIn = auth.status === 'ready' && auth.access === 'active'
  const [open, setOpen] = useState(false)
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('block rounded-lg px-3 py-2.5 font-semibold transition-colors', isActive ? 'bg-forest-soft text-forest' : 'text-ink hover:bg-forest-soft hover:text-forest')

  // close the mobile menu after navigating, and on Escape
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <PageContainer className="flex min-h-16 items-center justify-between gap-3">
        <Link to="/" aria-label={t('brand.name')}><Logo /></Link>
        <nav aria-label={t('nav.primary')} className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((l) => (
              <li key={l.to}><NavLink to={l.to} end={l.end} className={linkClass}>{t(l.key)}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {/* Desktop-only actions live in a wrapper that is hidden below 1200px. (Putting `hidden` on the link itself does not
              work: the button's own `inline-flex` class wins the cascade. Found by the real-browser test at 360px.) */}
          <div className="hidden items-center gap-2 xl:flex">
            {signedIn
              ? <ButtonLink to="/dashboard" size="sm">{t('nav.dashboard')}</ButtonLink>
              : (
                <>
                  <ButtonLink to={LOGIN_PATH} variant="secondary" size="sm">{t('nav.login')}</ButtonLink>
                  <ButtonLink to={JOIN_PATH} size="sm">{t('nav.join')}</ButtonLink>
                </>
              )}
          </div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg text-forest hover:bg-forest-soft xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            onClick={() => setOpen((v) => !v)}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </PageContainer>
      {open && (
        <nav id="mobile-nav" aria-label={t('nav.primary')} className="border-t border-line bg-surface xl:hidden">
          <PageContainer className="flex flex-col gap-3 py-3">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((l) => (
                <li key={l.to}><NavLink to={l.to} end={l.end} className={linkClass}>{t(l.key)}</NavLink></li>
              ))}
            </ul>
            {signedIn
              ? <ButtonLink to="/dashboard" fullWidth>{t('nav.dashboard')}</ButtonLink>
              : (
                <div className="flex flex-col gap-2">
                  <ButtonLink to={LOGIN_PATH} variant="secondary" fullWidth>{t('nav.login')}</ButtonLink>
                  <ButtonLink to={JOIN_PATH} fullWidth>{t('nav.join')}</ButtonLink>
                </div>
              )}
          </PageContainer>
        </nav>
      )}
    </header>
  )
}
