import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/ui'
import { ActivityCard } from '../components/site/ActivityCard'
import { DataBoundary } from '../components/site/DataBoundary'
import { PageHero, Section } from '../components/site/Sections'
import { listActivities } from '../lib/content'
import { useAsync } from '../lib/useAsync'
import { usePageMeta } from '../lib/usePageMeta'
import { useSignedUrls } from '../lib/useSignedUrls'

export default function ActivitiesPage() {
  const { t } = useTranslation()
  usePageMeta('activities')
  const state = useAsync(() => listActivities(0, 24), [])
  const items = state.status === 'ready' ? state.data : []
  const covers = useSignedUrls('gallery', items.map((a) => a.cover_image_path))
  return (
    <>
      <PageHero title={t('activitiesPage.title')} lead={t('activitiesPage.lead')} />
      <Section>
        <DataBoundary status={state.status} onRetry={state.reload}>
          {items.length === 0 ? (
            <EmptyState title={t('activitiesPage.empty')} description={t('activitiesPage.emptyHint')} />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((a) => (
                <li key={a.id}><ActivityCard activity={a} coverUrl={a.cover_image_path ? covers[a.cover_image_path] : undefined} /></li>
              ))}
            </ul>
          )}
        </DataBoundary>
      </Section>
    </>
  )
}
