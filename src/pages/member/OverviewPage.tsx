import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, ErrorMessage, Loading, StatusBadge, toStatusKey } from '../../components/ui'
import { MemberHeading, Stack, StatCard } from '../../components/member/MemberUi'
import { useAuth } from '../../lib/auth'
import { getOwnContributionTotals, listAnnouncements, listPublishedReports } from '../../lib/member'
import { formatDate, formatMoney, formatMonth, formatNumber, pickLocalized } from '../../lib/localize'
import { useAsync } from '../../lib/useAsync'
import { usePageMeta } from '../../lib/usePageMeta'
import type { Language } from '../../i18n'

export default function OverviewPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  const { profile } = useAuth()
  usePageMeta(null, t('member.nav.overview'))
  const uid = profile?.id ?? ''
  const totals = useAsync(() => getOwnContributionTotals(uid), [uid])
  const reports = useAsync(() => listPublishedReports(0, 1), [])
  const news = useAsync(() => listAnnouncements(0, 3), [])
  if (!profile) return null
  const status = toStatusKey(profile.membership_status)

  return (
    <Stack>
      <MemberHeading title={t('member.overview.welcome', { name: profile.full_name })} lead={t('member.overview.subtitle')} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t('member.overview.memberId')} value={<span dir="ltr">{profile.member_id}</span>} />
        <StatCard label={t('member.overview.status')} value={status ? <StatusBadge status={status} /> : profile.membership_status} />
        <StatCard label={t('member.overview.since')} value={formatDate(profile.membership_start_date, lang) || '—'} />
      </div>

      <section aria-labelledby="ov-contrib" className="flex flex-col gap-3">
        <h2 id="ov-contrib" className="text-(length:--text-h3) font-bold">{t('member.nav.contributions')}</h2>
        {totals.status === 'loading' && <Loading />}
        {(totals.status === 'error' || totals.status === 'unconfigured') && <ErrorMessage onRetry={totals.reload} />}
        {totals.status === 'ready' && (
          totals.data.verifiedCount === 0 && totals.data.pendingCount === 0 ? (
            <p className="text-muted-strong">{t('member.overview.noContribution')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t('member.overview.verifiedTotal')} value={formatMoney(totals.data.verifiedTotal, lang)} hint={t('member.overview.verifiedCount', { n: formatNumber(totals.data.verifiedCount, lang) })} />
              <StatCard label={t('member.contributions.pendingCount')} value={formatNumber(totals.data.pendingCount, lang)} hint={t('member.overview.pendingCount', { n: formatNumber(totals.data.pendingCount, lang) })} />
              <StatCard label={t('member.overview.lastContribution')} value={formatDate(totals.data.lastDate, lang) || '—'} />
            </div>
          )
        )}
        <Link to="/dashboard/contributions" className="w-fit font-semibold text-forest underline underline-offset-4">{t('member.overview.viewAll')}</Link>
      </section>

      <section aria-labelledby="ov-report" className="flex flex-col gap-3">
        <h2 id="ov-report" className="text-(length:--text-h3) font-bold">{t('member.overview.latestReport')}</h2>
        {reports.status === 'loading' && <Loading />}
        {(reports.status === 'error' || reports.status === 'unconfigured') && <ErrorMessage onRetry={reports.reload} />}
        {reports.status === 'ready' && (
          reports.data.length === 0 ? <p className="text-muted-strong">{t('member.overview.noReport')}</p> : (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-bold">{formatMonth(reports.data[0].reporting_month, lang)}</p>
              <Link to="/dashboard/reports" className="font-semibold text-forest underline underline-offset-4">{t('member.overview.viewReport')}</Link>
            </Card>
          )
        )}
      </section>

      <section aria-labelledby="ov-news" className="flex flex-col gap-3">
        <h2 id="ov-news" className="text-(length:--text-h3) font-bold">{t('member.overview.announcements')}</h2>
        {news.status === 'loading' && <Loading />}
        {(news.status === 'error' || news.status === 'unconfigured') && <ErrorMessage onRetry={news.reload} />}
        {news.status === 'ready' && (
          news.data.length === 0 ? <p className="text-muted-strong">{t('member.overview.noAnnouncements')}</p> : (
            <ul className="flex flex-col gap-3">
              {news.data.map((a) => (
                <li key={a.id}>
                  <Card>
                    <h3 className="font-bold">{pickLocalized(a.title_bn, a.title_en, lang)}</h3>
                    <p className="text-sm text-muted-strong">{formatDate(a.published_at, lang)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )
        )}
        <Link to="/dashboard/announcements" className="w-fit font-semibold text-forest underline underline-offset-4">{t('member.overview.viewAll')}</Link>
      </section>
    </Stack>
  )
}
