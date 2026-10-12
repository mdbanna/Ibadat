import { useTranslation } from 'react-i18next'
import { Card, EmptyState } from '../../components/ui'
import { ActivityCard } from '../../components/site/ActivityCard'
import { DataBoundary } from '../../components/site/DataBoundary'
import { MemberHeading, Stack } from '../../components/member/MemberUi'
import { Button, ErrorMessage } from '../../components/ui'
import { listActivities } from '../../lib/content'
import { listAnnouncements, listDocuments } from '../../lib/member'
import { formatDate, pickLocalized } from '../../lib/localize'
import { useAsync, usePaged } from '../../lib/useAsync'
import { usePageMeta } from '../../lib/usePageMeta'
import { useSignedUrls } from '../../lib/useSignedUrls'
import type { Language } from '../../i18n'

export function MemberActivitiesPage() {
  const { t } = useTranslation()
  usePageMeta(null, t('member.nav.activities'))
  const state = useAsync(() => listActivities(0, 24), [])
  const items = state.status === 'ready' ? state.data : []
  const covers = useSignedUrls('gallery', items.map((a) => a.cover_image_path))
  return (
    <Stack>
      <MemberHeading title={t('member.activities.title')} lead={t('member.activities.lead')} />
      <DataBoundary status={state.status} onRetry={state.reload}>
        {items.length === 0 ? (
          <EmptyState title={t('activitiesPage.empty')} description={t('activitiesPage.emptyHint')} />
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((a) => <li key={a.id}><ActivityCard activity={a} coverUrl={a.cover_image_path ? covers[a.cover_image_path] : undefined} /></li>)}
          </ul>
        )}
      </DataBoundary>
    </Stack>
  )
}

export function MemberAnnouncementsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.announcements'))
  const list = usePaged((offset, limit) => listAnnouncements(offset, limit), 10)
  return (
    <Stack>
      <MemberHeading title={t('member.announcements.title')} lead={t('member.announcements.lead')} />
      <DataBoundary status={list.status} onRetry={list.reload}>
        {list.items.length === 0 ? (
          <EmptyState title={t('member.announcements.empty')} description={t('member.announcements.emptyHint')} />
        ) : (
          <>
            <ul className="flex flex-col gap-4">
              {list.items.map((a) => (
                <li key={a.id}>
                  <Card className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-(length:--text-h3) font-bold">{pickLocalized(a.title_bn, a.title_en, lang)}</h2>
                      <p className="text-sm text-muted-strong">
                        {formatDate(a.published_at, lang)}{a.audience === 'members' ? ` · ${t('member.announcements.membersOnly')}` : ''}
                      </p>
                    </div>
                    <p className="whitespace-pre-line">{pickLocalized(a.content_bn, a.content_en, lang)}</p>
                  </Card>
                </li>
              ))}
            </ul>
            {list.moreError && <ErrorMessage onRetry={list.loadMore} />}
            {list.hasMore && <div className="flex justify-center"><Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>{t('common.loadMore')}</Button></div>}
          </>
        )}
      </DataBoundary>
    </Stack>
  )
}

export function MemberDocumentsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.documents'))
  const state = useAsync(listDocuments, [])
  const docs = state.status === 'ready' ? state.data : []
  const urls = useSignedUrls('documents', docs.map((d) => d.file_path))
  return (
    <Stack>
      <MemberHeading title={t('member.documents.title')} lead={t('member.documents.lead')} />
      <DataBoundary status={state.status} onRetry={state.reload}>
        {docs.length === 0 ? (
          <EmptyState title={t('member.documents.empty')} description={t('member.documents.emptyHint')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {docs.map((d) => (
              <li key={d.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{pickLocalized(d.title_bn, d.title_en, lang)}</h2>
                    <p className="text-sm text-muted-strong">{t(`member.documents.${d.document_type}`)} · {formatDate(d.created_at, lang)}</p>
                  </div>
                  {urls[d.file_path]
                    ? <a href={urls[d.file_path]} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">{t('member.documents.open')}</a>
                    : <span className="text-sm text-muted-strong">{t('member.documents.unavailable')}</span>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </DataBoundary>
    </Stack>
  )
}
