import { useTranslation } from 'react-i18next'
import { Card, SectionHeading } from '../components/ui'
import { FundCards, MemberFundedNotice, PageHero, Section } from '../components/site/Sections'
import { usePageMeta } from '../lib/usePageMeta'

export default function AboutPage() {
  const { t } = useTranslation()
  usePageMeta('about')
  const values = [
    { title: t('about.v1Title'), body: t('about.v1Body') },
    { title: t('about.v2Title'), body: t('about.v2Body') },
    { title: t('about.v3Title'), body: t('about.v3Body') },
    { title: t('about.v4Title'), body: t('about.v4Body') },
  ]
  return (
    <>
      <PageHero title={t('about.title')} lead={t('about.lead')} eyebrow={t('brand.established')} />
      <Section>
        <SectionHeading title={t('about.whoTitle')} />
        <div className="flex max-w-3xl flex-col gap-4 text-lg">
          <p>{t('about.whoBody1')}</p>
          <p>{t('about.whoBody2')}</p>
        </div>
      </Section>
      <Section tinted>
        <SectionHeading title={t('about.valuesTitle')} />
        <ul className="grid gap-4 md:grid-cols-2">
          {values.map((v) => (
            <li key={v.title}>
              <Card className="h-full border-s-4 border-s-forest">
                <h3 className="text-(length:--text-h3) font-bold">{v.title}</h3>
                <p className="mt-2 text-muted">{v.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
      <Section>
        <SectionHeading title={t('about.fundsTitle')} />
        <FundCards />
      </Section>
      <Section tinted>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 className="text-(length:--text-h3) font-bold">{t('about.fundingTitle')}</h2>
            <p className="text-muted">{t('about.fundingBody')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-(length:--text-h3) font-bold">{t('about.reportsTitle')}</h2>
            <p className="text-muted">{t('about.reportsBody')}</p>
          </div>
        </div>
        <MemberFundedNotice />
      </Section>
    </>
  )
}
