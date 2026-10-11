import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { SectionHeading } from '../components/ui'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <PageContainer className="flex flex-col gap-4 py-8 md:py-12">
      <SectionHeading level={1} title={t('errors.notFound')} />
      <Link to="/" className="font-semibold text-forest underline underline-offset-4">{t('nav.home')}</Link>
    </PageContainer>
  )
}
