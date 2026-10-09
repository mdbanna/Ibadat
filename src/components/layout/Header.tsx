import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { PageContainer } from './PageContainer'
import { cx } from '../../lib/cx'

/** Only routes that exist today are linked. Add the others as their pages are built in later phases. */
const links = [{ to: '/', key: 'nav.home' as const, end: true }]

export function Header() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('block rounded-lg px-3 py-2.5 font-semibold transition-colors', isActive ? 'bg-forest-soft text-forest' : 'text-ink hover:bg-forest-soft hover:text-forest')

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <PageContainer className="flex min-h-16 items-center justify-between gap-3">
        <Link to="/" aria-label={t('brand.name')} onClick={() => setOpen(false)}><Logo /></Link>
        <nav aria-label={t('nav.primary')} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.to}><NavLink to={l.to} end={l.end} className={linkClass}>{t(l.key)}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg text-forest hover:bg-forest-soft md:hidden"
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
        <nav id="mobile-nav" aria-label={t('nav.primary')} className="border-t border-line bg-surface md:hidden">
          <PageContainer as="ul" className="flex flex-col gap-1 py-3">
            {links.map((l) => (
              <li key={l.to}><NavLink to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>{t(l.key)}</NavLink></li>
            ))}
          </PageContainer>
        </nav>
      )}
    </header>
  )
}
