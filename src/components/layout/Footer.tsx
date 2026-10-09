import { useTranslation } from 'react-i18next'
import { PageContainer } from './PageContainer'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="mt-auto bg-forest-deep text-white">
      <PageContainer className="flex flex-col gap-3 py-8 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold">{t('brand.name')}</p>
          <p className="text-white/80">{t('brand.fullName')}</p>
          <p className="text-sm text-white/70">{t('footer.privacy')}</p>
        </div>
        <p className="text-sm text-white/70">{t('footer.rights', { year: 2026 })}</p>
      </PageContainer>
    </footer>
  )
}
