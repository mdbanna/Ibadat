import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from './PageContainer'
import { JOIN_PATH, NAV_ITEMS } from '../../routes'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="mt-auto bg-forest-deep text-white">
      <PageContainer className="grid gap-8 py-10 md:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-2">
          <Link to="/" aria-label={t('brand.name')} className="inline-block self-start rounded-md bg-white p-1.5">
            <img src="/brand/ibadat-logo.png" alt={t('brand.fullName')} className="block h-auto w-48" />
          </Link>
          <p className="mt-2 border-s-2 border-gold ps-3 text-sm text-white/90">{t('footer.contributionsNote')}</p>
        </div>
        <nav aria-label={t('footer.explore')}>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold">{t('footer.explore')}</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {NAV_ITEMS.map((l) => (
              <li key={l.to}><Link to={l.to} className="inline-block py-1.5 text-white/90 underline-offset-4 hover:underline">{t(l.key)}</Link></li>
            ))}
            <li><Link to={JOIN_PATH} className="inline-block py-1.5 font-semibold text-white underline underline-offset-4">{t('nav.join')}</Link></li>
          </ul>
        </nav>
        <div className="flex flex-col gap-1 border-t border-white/20 pt-4 text-sm text-white/80 md:col-span-2 md:flex-row md:justify-between">
          <p>{t('footer.privacy')}</p>
          <p>{t('footer.rights', { year: 2026 })}</p>
        </div>
      </PageContainer>
    </footer>
  )
}
