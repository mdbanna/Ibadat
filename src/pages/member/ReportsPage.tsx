import { useTranslation } from 'react-i18next'
import { Button, Card, DataTable, EmptyState, ErrorMessage, type Column } from '../../components/ui'
import { DataBoundary } from '../../components/site/DataBoundary'
import { MemberHeading, Stack } from '../../components/member/MemberUi'
import { listPublishedReports, type MonthlyReport, type ReportLine } from '../../lib/member'
import { formatDate, formatMoney, formatMonth, pickLocalized } from '../../lib/localize'
import { usePaged } from '../../lib/useAsync'
import { usePageMeta } from '../../lib/usePageMeta'
import type { Language } from '../../i18n'

const PAGE_SIZE = 12
const FUND_KEY = { direct_aid: 'directAid', employment: 'employment', emergency_medical: 'emergencyMedical' } as const

export default function ReportsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.reports'))
  const list = usePaged((offset, limit) => listPublishedReports(offset, limit), PAGE_SIZE)

  const columns: Column<ReportLine>[] = [
    { key: 'fund', header: t('member.reports.colFund'), cell: (l) => t(`funds.${FUND_KEY[l.fund_type]}`) },
    { key: 'open', header: t('member.reports.opening'), cell: (l) => formatMoney(l.opening_balance, lang), align: 'end' },
    { key: 'in', header: t('member.reports.in'), cell: (l) => formatMoney(l.total_in, lang), align: 'end' },
    { key: 'out', header: t('member.reports.out'), cell: (l) => formatMoney(l.total_out, lang), align: 'end' },
    { key: 'close', header: t('member.reports.closing'), cell: (l) => formatMoney(l.closing_balance, lang), align: 'end' },
  ]
  const totalLine = (r: MonthlyReport): ReportLine => ({
    fund_type: 'direct_aid',
    opening_balance: r.lines.reduce((s, l) => s + l.opening_balance, 0),
    total_in: r.lines.reduce((s, l) => s + l.total_in, 0),
    total_out: r.lines.reduce((s, l) => s + l.total_out, 0),
    closing_balance: r.lines.reduce((s, l) => s + l.closing_balance, 0),
  })

  return (
    <Stack>
      <MemberHeading title={t('member.reports.title')} lead={t('member.reports.lead')} />
      <DataBoundary status={list.status} onRetry={list.reload}>
        {list.items.length === 0 ? (
          <EmptyState title={t('member.reports.empty')} description={t('member.reports.emptyHint')} />
        ) : (
          <>
            <ul className="flex flex-col gap-6">
              {list.items.map((r) => {
                const summary = pickLocalized(r.summary_bn, r.summary_en, lang)
                const total = totalLine(r)
                return (
                  <li key={r.id}>
                    <Card className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-(length:--text-h3) font-bold">{formatMonth(r.reporting_month, lang)}</h2>
                        <p className="text-sm text-muted-strong">{t('member.reports.published', { date: formatDate(r.published_at, lang) })}</p>
                      </div>
                      {summary && <p className="whitespace-pre-line"><span className="font-semibold">{t('member.reports.summary')}: </span>{summary}</p>}
                      <DataTable caption={`${t('member.reports.title')} — ${formatMonth(r.reporting_month, lang)}`} columns={columns} rows={r.lines} rowKey={(l) => l.fund_type} />
                      {r.lines.length > 0 && (
                        <p className="text-sm text-muted-strong">
                          {t('member.reports.totalRow')}: {t('member.reports.in')} {formatMoney(total.total_in, lang)} · {t('member.reports.out')} {formatMoney(total.total_out, lang)} · {t('member.reports.closing')} {formatMoney(total.closing_balance, lang)}
                        </p>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
            {list.moreError && <ErrorMessage onRetry={list.loadMore} />}
            {list.hasMore && <div className="flex justify-center"><Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>{t('common.loadMore')}</Button></div>}
          </>
        )}
      </DataBoundary>
    </Stack>
  )
}
