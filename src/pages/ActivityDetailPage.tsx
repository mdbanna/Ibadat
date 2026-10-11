import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { SectionHeading } from '../components/ui'
import { activityTitle } from '../components/site/ActivityCard'
import { DataBoundary } from '../components/site/DataBoundary'
import { PageHero, Section } from '../components/site/Sections'
import { SiteImage } from '../components/site/SiteImage'
import { getActivityBySlug, listGalleryImages } from '../lib/content'
import { formatDate, pickLocalized } from '../lib/localize'
import { useAsync } from '../lib/useAsync'
import { usePageMeta } from '../lib/usePageMeta'
import { useSignedUrls } from '../lib/useSignedUrls'
import type { Language } from '../i18n'

export default function ActivityDetailPage() {
  const { slug = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  const state = useAsync(async () => {
    const activity = await getActivityBySlug(slug)
    const photos = activity ? await listGalleryImages(0, 24, activity.id) : []
    return { activity, photos }
  }, [slug])
  const data = state.status === 'ready' ? state.data : null
  const urls = useSignedUrls('gallery', [data?.activity?.cover_image_path, ...(data?.photos.map((p) => p.image_path) ?? [])])
  const title = data?.activity ? activityTitle(data.activity, lang, t('activitiesPage.untitled')) : undefined
  usePageMeta('activities', title)

  // Loading / error / unconfigured states still get a page heading and the shared layout.
  if (state.status !== 'ready') {
    return (
      <>
        <PageHero title={t('activitiesPage.title')} />
        <Section><DataBoundary status={state.status} onRetry={state.reload}><></></DataBoundary></Section>
      </>
    )
  }

  return (
    <>
      {!data?.activity ? (
        <PageHero title={t('activitiesPage.notFoundTitle')} lead={t('activitiesPage.notFoundBody')} />
      ) : (
        <>
          <PageHero title={title ?? ''} lead={[formatDate(data.activity.activity_date, lang), data.activity.general_location].filter(Boolean).join(' · ') || undefined} />
          <Section>
            {data.activity.cover_image_path && (
              <SiteImage url={urls[data.activity.cover_image_path]} alt="" ratio="16 / 9" className="rounded-(--radius-card)" />
            )}
            <div className="max-w-3xl whitespace-pre-line text-lg">
              {pickLocalized(data.activity.description_bn, data.activity.description_en, lang)}
            </div>
            {data.photos.length > 0 && (
              <>
                <SectionHeading level={2} title={t('activitiesPage.photos')} />
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {data.photos.map((p) => (
                    <li key={p.id}>
                      <SiteImage url={urls[p.image_path]} alt={pickLocalized(p.caption_bn, p.caption_en, lang) || t('galleryPage.fallbackAlt')} className="rounded-lg" />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </>
      )}
      <PageContainer className="pb-12">
        <Link to="/activities" className="font-semibold text-forest underline underline-offset-4">← {t('activitiesPage.back')}</Link>
      </PageContainer>
    </>
  )
}
