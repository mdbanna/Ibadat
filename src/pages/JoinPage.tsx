import { useTranslation } from 'react-i18next'
import { Card, Notice } from '../components/ui'
import { JoinForm } from '../components/site/JoinForm'
import { MemberFundedNotice, PageHero, Section } from '../components/site/Sections'
import { usePageMeta } from '../lib/usePageMeta'

export default function JoinPage() {
  const { t } = useTranslation()
  usePageMeta('join')
  return (
    <>
      <PageHero title={t('join.title')} lead={t('join.lead')} />
      <Section>
        <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
          <Card className="min-w-0"><JoinForm /></Card>
          <div className="flex flex-col gap-4 xl:order-last">
            <Notice title={t('join.privacyTitle')}>{t('join.privacyBody')}</Notice>
            <MemberFundedNotice showCta={false} />
          </div>
        </div>
      </Section>
    </>
  )
}
