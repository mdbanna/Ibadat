import { useTranslation } from 'react-i18next'
import { Button, EmptyState, ErrorMessage, Notice, SectionHeading } from '../components/ui'
import { DataBoundary } from '../components/site/DataBoundary'
import { MemberCard } from '../components/site/MemberCard'
import { MemberFundedNotice, PageHero, Section, Steps } from '../components/site/Sections'
import { listPublicMembers } from '../lib/content'
import { usePaged } from '../lib/useAsync'
import { usePageMeta } from '../lib/usePageMeta'
import { useSignedUrls } from '../lib/useSignedUrls'

const PAGE_SIZE = 24

export default function MembersPage() {
  const { t } = useTranslation()
  usePageMeta('members')
  const list = usePaged((offset, limit) => listPublicMembers(offset, limit), PAGE_SIZE)
  const photos = useSignedUrls('member-photos', list.items.map((m) => m.profile_image_path))
  return (
    <>
      <PageHero title={t('membersPage.title')} lead={t('membersPage.lead')} />
      <Section>
        <SectionHeading level={2} title={t('membersPage.directoryTitle')} description={t('membersPage.directoryNote')} />
        <DataBoundary status={list.status} onRetry={list.reload}>
          {list.items.length === 0 ? (
            <EmptyState title={t('membersPage.empty')} description={t('membersPage.emptyHint')} />
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.items.map((m) => (
                  <li key={m.id}><MemberCard member={m} photoUrl={m.profile_image_path ? photos[m.profile_image_path] : undefined} /></li>
                ))}
              </ul>
              {list.moreError && <ErrorMessage onRetry={list.loadMore} />}
              {list.hasMore && (
                <div className="flex justify-center">
                  <Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>{t('common.loadMore')}</Button>
                </div>
              )}
            </>
          )}
        </DataBoundary>
      </Section>
      <Section tinted>
        <SectionHeading level={2} title={t('membersPage.joinTitle')} />
        <Steps items={[
          { title: t('membersPage.step1Title'), body: t('membersPage.step1Body') },
          { title: t('membersPage.step2Title'), body: t('membersPage.step2Body') },
          { title: t('membersPage.step3Title'), body: t('membersPage.step3Body') },
        ]} />
        <Notice title={t('membersPage.privateTitle')}>{t('membersPage.privateBody')}</Notice>
      </Section>
      <Section>
        <MemberFundedNotice />
      </Section>
    </>
  )
}
