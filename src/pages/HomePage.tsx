import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { ButtonLink, SectionHeading } from '../components/ui'
import { ActivityCard } from '../components/site/ActivityCard'
import { DataBoundary } from '../components/site/DataBoundary'
import { FundCards, MemberFundedNotice, Section, Steps } from '../components/site/Sections'
import { SiteImage } from '../components/site/SiteImage'
import { listActivities, listGalleryImages } from '../lib/content'
import { pickLocalized } from '../lib/localize'
import { useAsync } from '../lib/useAsync'
import { useSignedUrls } from '../lib/useSignedUrls'
import { usePageMeta } from '../lib/usePageMeta'
import { JOIN_PATH } from '../routes'
import type { Language } from '../i18n'

function Hero() {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden bg-forest-deep text-white">
      {/* decorative leaf pattern, kept very faint so text contrast is unaffected */}
      <svg aria-hidden className="absolute inset-0 size-full text-leaf opacity-[0.07]">
        <defs>
          <pattern id="leaf" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M36 8c8 8 12 14 12 21a12 12 0 0 1-24 0c0-7 4-13 12-21z" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#leaf)" />
      </svg>
      <PageContainer className="relative flex flex-col gap-6 py-14 md:py-20 xl:py-28">
        <p className="w-fit border-b-2 border-gold pb-1 text-sm font-semibold uppercase tracking-wide text-white">{t('brand.established')}</p>
        <h1 className="max-w-3xl text-(length:--text-display) font-extrabold text-white">{t('home.heroTitle')}</h1>
        <p className="max-w-2xl text-lg text-white/90 md:text-xl">{t('home.heroLead')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink to={JOIN_PATH} variant="accent">{t('home.ctaJoin')}</ButtonLink>
          <ButtonLink to="/activities" variant="light">{t('home.ctaWork')}</ButtonLink>
        </div>
      </PageContainer>
    </section>
  )
}

function RecentActivities() {
  const { t } = useTranslation()
  const state = useAsync(() => listActivities(0, 3), [])
  const items = state.status === 'ready' ? state.data : []
  const covers = useSignedUrls('gallery', items.map((a) => a.cover_image_path))
  if (state.status === 'ready' && items.length === 0) return null
  return (
    <DataBoundary status={state.status} quiet>
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title={t('home.recentTitle')} description={t('home.recentLead')} />
          <ButtonLink to="/activities" variant="secondary">{t('home.viewAllActivities')}</ButtonLink>
        </div>
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <li key={a.id}><ActivityCard activity={a} coverUrl={a.cover_image_path ? covers[a.cover_image_path] : undefined} /></li>
          ))}
        </ul>
      </Section>
    </DataBoundary>
  )
}

function GalleryPreview() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  const state = useAsync(() => listGalleryImages(0, 4), [])
  const items = state.status === 'ready' ? state.data : []
  const urls = useSignedUrls('gallery', items.map((g) => g.image_path))
  if (state.status === 'ready' && items.length === 0) return null
  return (
    <DataBoundary status={state.status} quiet>
      <Section tinted>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title={t('home.galleryTitle')} />
          <ButtonLink to="/gallery" variant="secondary">{t('home.viewGallery')}</ButtonLink>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((g) => (
            <li key={g.id}>
              <SiteImage url={urls[g.image_path]} alt={pickLocalized(g.caption_bn, g.caption_en, lang) || t('galleryPage.fallbackAlt')} className="rounded-lg" />
            </li>
          ))}
        </ul>
      </Section>
    </DataBoundary>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  usePageMeta(null)
  return (
    <>
      <Hero />
      <Section>
        <SectionHeading title={t('home.howTitle')} description={t('home.howLead')} />
        <Steps items={[
          { title: t('home.step1Title'), body: t('home.step1Body') },
          { title: t('home.step2Title'), body: t('home.step2Body') },
          { title: t('home.step3Title'), body: t('home.step3Body') },
        ]} />
      </Section>
      <Section tinted>
        <SectionHeading title={t('home.fundsTitle')} description={t('home.fundsLead')} />
        <FundCards />
      </Section>
      <RecentActivities />
      <GalleryPreview />
      <Section>
        <MemberFundedNotice />
      </Section>
    </>
  )
}
