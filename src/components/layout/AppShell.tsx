import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'
import { Footer } from './Footer'

export function AppShell() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:font-semibold focus:text-ink">
        {t('nav.skipToContent')}
      </a>
      <Header />
      <main id="main" className="flex-1 py-8 md:py-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
