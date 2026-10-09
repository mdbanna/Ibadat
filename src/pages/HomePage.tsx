import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout'
import { Card, Notice, SectionHeading } from '../components/ui'
import { isSupabaseConfigured } from '../lib/supabase'

/** Foundation placeholder only. The real public home page is built in a later phase. */
export function HomePage() {
  const { t } = useTranslation()
  return (
    <PageContainer className="flex flex-col gap-8">
      <SectionHeading level={1} eyebrow={t('brand.established')} title={t('brand.fullName')} description={t('brand.tagline')} />
      <Notice title={t('notices.foundationTitle')}>{t('notices.foundationBody')}</Notice>
      {!isSupabaseConfigured && <Notice tone="warning">{t('errors.supabaseNotConfigured')}</Notice>}
      <Card>
        <Link to="/design-system" className="font-semibold text-forest underline underline-offset-4">{t('foundation.title')}</Link>
      </Card>
    </PageContainer>
  )
}
