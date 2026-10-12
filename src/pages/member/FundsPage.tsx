import { useTranslation } from 'react-i18next'
import { Card, Notice } from '../../components/ui'
import { DataBoundary } from '../../components/site/DataBoundary'
import { MemberHeading, Stack, StatCard } from '../../components/member/MemberUi'
import { listFunds, listPublishedReports } from '../../lib/member'
import { formatMoney, formatMonth, formatNumber, pickLocalized } from '../../lib/localize'
import { useAsync } from '../../lib/useAsync'
import { usePageMeta } from '../../lib/usePageMeta'
import type { Language } from '../../i18n'

export default function FundsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.funds'))
  const state = useAsync(async () => {
    const [funds, reports] = await Promise.all([listFunds(), listPublishedReports(0, 1)])
    return { funds, report: reports[0] ?? null }
  }, [])
  const data = state.status === 'ready' ? state.data : null

  return (
    <Stack>
      <MemberHeading title={t('member.funds.title')} lead={t('member.funds.lead')} />
      <DataBoundary status={state.status} onRetry={state.reload}>
        {data && (
          <>
            <ul className="grid gap-4 xl:grid-cols-3">
              {data.funds.map((f) => {
                const line = data.report?.lines.find((l) => l.fund_type === f.fund_type)
                const percent = `${formatNumber(Number(f.default_allocation_percent), lang)}%`
                return (
                  <li key={f.fund_type}>
                    <Card className="flex h-full flex-col gap-3 border-t-4 border-t-forest">
                      <h2 className="text-(length:--text-h3) font-bold">{pickLocalized(f.name_bn, f.name, lang)}</h2>
                      <p className="text-muted-strong">{pickLocalized(f.description_bn, f.description, lang) || t(`fundDesc.${f.fund_type === 'direct_aid' ? 'directAid' : f.fund_type === 'employment' ? 'employment' : 'emergencyMedical'}`)}</p>
                      <p className="text-sm font-semibold text-forest-deep">{t('member.funds.share', { percent })}</p>
                      {line && (
                        <div className="mt-auto grid gap-2 border-t border-line pt-3">
                          <StatCard label={t('member.funds.closing')} value={formatMoney(line.closing_balance, lang)} />
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            <div><dt className="text-muted-strong">{t('member.funds.totalIn')}</dt><dd className="font-semibold">{formatMoney(line.total_in, lang)}</dd></div>
                            <div><dt className="text-muted-strong">{t('member.funds.totalOut')}</dt><dd className="font-semibold">{formatMoney(line.total_out, lang)}</dd></div>
                          </dl>
                        </div>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
            {data.report ? (
              <p className="text-sm text-muted-strong">{t('member.funds.latestTitle', { month: formatMonth(data.report.reporting_month, lang) })}. {t('member.funds.note')}</p>
            ) : (
              <Notice>{t('member.funds.noReport')}</Notice>
            )}
          </>
        )}
      </DataBoundary>
    </Stack>
  )
}
