import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, SectionHeading } from '../components/ui'
import { ContactForm } from '../components/site/ContactForm'
import { PageHero, Section } from '../components/site/Sections'
import { siteConfig, telHref } from '../config/site'
import { usePageMeta } from '../lib/usePageMeta'

export default function ContactPage() {
  const { t } = useTranslation()
  usePageMeta('contact')
  const channels: Array<{ label: string; node: ReactNode }> = []
  const linkClass = 'font-semibold text-forest underline underline-offset-4'
  if (siteConfig.email) channels.push({ label: t('contact.email'), node: <a className={linkClass} href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> })
  if (siteConfig.phone) channels.push({ label: t('contact.phone'), node: <a className={linkClass} href={telHref(siteConfig.phone)} dir="ltr">{siteConfig.phone}</a> })
  if (siteConfig.address) channels.push({ label: t('contact.address'), node: <span className="whitespace-pre-line">{siteConfig.address}</span> })
  return (
    <>
      <PageHero title={t('contact.title')} lead={t('contact.lead')} />
      <Section>
        <div className="grid gap-8 xl:grid-cols-[20rem_1fr]">
          <div className="flex flex-col gap-4">
            <SectionHeading level={2} title={t('contact.channelsTitle')} />
            {channels.length === 0 ? (
              <p className="text-muted">{t('contact.noChannels')}</p>
            ) : (
              <dl className="flex flex-col gap-3">
                {channels.map((c) => (
                  <div key={c.label}>
                    <dt className="text-sm text-muted">{c.label}</dt>
                    <dd className="mt-0.5 break-words">{c.node}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <Card className="min-w-0">
            <ContactForm />
          </Card>
        </div>
      </Section>
    </>
  )
}
