import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, Notice } from '../../components/ui'
import { DataBoundary } from '../../components/site/DataBoundary'
import { MemberHeading, Stack, StatCard } from '../../components/member/MemberUi'
import { getAssistanceSummary, getEmploymentSummary, type AssistanceSummaryRow } from '../../lib/member'
import { formatMoney, formatNumber } from '../../lib/localize'
import { useAsync } from '../../lib/useAsync'
import { usePageMeta } from '../../lib/usePageMeta'
import type { Language } from '../../i18n'

const FUND_KEY = { direct_aid: 'directAid', employment: 'employment', emergency_medical: 'emergencyMedical' } as const

function FundSummaryCard({ row, lang }: { row: AssistanceSummaryRow; lang: Language }) {
  const { t } = useTranslation()
  return (
    <Card className="flex h-full flex-col gap-3">
      <h2 className="text-(length:--text-h3) font-bold">{t(`funds.${FUND_KEY[row.fund_type]}`)}</h2>
      {row.cases_total === 0 ? (
        <p className="text-muted-strong">{t('member.assistance.none')}</p>
      ) : (
        <dl className="grid grid-cols-3 gap-2">
          <div><dt className="text-sm text-muted-strong">{t('member.assistance.casesTotal')}</dt><dd className="text-xl font-bold">{formatNumber(row.cases_total, lang)}</dd></div>
          <div><dt className="text-sm text-muted-strong">{t('member.assistance.completed')}</dt><dd className="text-xl font-bold">{formatNumber(row.cases_completed, lang)}</dd></div>
          <div><dt className="text-sm text-muted-strong">{t('member.assistance.inProgress')}</dt><dd className="text-xl font-bold">{formatNumber(row.cases_in_progress, lang)}</dd></div>
        </dl>
      )}
      {row.cases_total > 0 && (
        <p className="mt-auto border-t border-line pt-3">
          <span className="text-sm text-muted-strong">{t('member.assistance.disbursed')}: </span>
          <span className="font-bold">{row.amounts_suppressed || row.disbursed_total === null ? t('member.assistance.withheld') : formatMoney(row.disbursed_total, lang)}</span>
        </p>
      )}
    </Card>
  )
}

/** Beneficiary and assistance updates: aggregates only, produced by a database function that exposes no identities. */
export function AssistancePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.assistance'))
  const state = useAsync(getAssistanceSummary, [])
  return (
    <Stack>
      <MemberHeading title={t('member.assistance.title')} lead={t('member.assistance.lead')} />
      <Notice title={t('member.assistance.privacyTitle')}>{t('member.assistance.privacyBody')} {t('member.assistance.shareNote')}</Notice>
      <DataBoundary status={state.status} onRetry={state.reload}>
        {state.status === 'ready' && (
          <ul className="grid gap-4 xl:grid-cols-3">
            {state.data.map((r) => <li key={r.fund_type}><FundSummaryCard row={r} lang={lang} /></li>)}
          </ul>
        )}
      </DataBoundary>
      <p><Link to="/dashboard/announcements" className="font-semibold text-forest underline underline-offset-4">{t('member.assistance.moreNews')}</Link></p>
    </Stack>
  )
}

export function MedicalPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.medical'))
  const state = useAsync(getAssistanceSummary, [])
  const row = state.status === 'ready' ? state.data.find((r) => r.fund_type === 'emergency_medical') : undefined
  return (
    <Stack>
      <MemberHeading title={t('member.medical.title')} lead={t('member.medical.lead')} />
      <Notice title={t('member.assistance.privacyTitle')}>{t('member.assistance.privacyBody')} {t('member.assistance.shareNote')}</Notice>
      <DataBoundary status={state.status} onRetry={state.reload}>
        {row && <div className="max-w-xl"><FundSummaryCard row={row} lang={lang} /></div>}
      </DataBoundary>
      <p><Link to="/dashboard/announcements" className="font-semibold text-forest underline underline-offset-4">{t('member.assistance.moreNews')}</Link></p>
    </Stack>
  )
}

export function EmploymentPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta(null, t('member.nav.employment'))
  const state = useAsync(getEmploymentSummary, [])
  const d = state.status === 'ready' ? state.data : null
  return (
    <Stack>
      <MemberHeading title={t('member.employment.title')} lead={t('member.employment.lead')} />
      <Notice title={t('member.assistance.privacyTitle')}>{t('member.employment.privacyBody')}</Notice>
      <DataBoundary status={state.status} onRetry={state.reload}>
        {d && (d.projects_total === 0 ? (
          <p className="text-muted-strong">{t('member.employment.none')}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label={t('member.employment.total')} value={formatNumber(d.projects_total, lang)} />
              <StatCard label={t('member.employment.planned')} value={formatNumber(d.projects_planned, lang)} />
              <StatCard label={t('member.employment.approved')} value={formatNumber(d.projects_approved, lang)} />
              <StatCard label={t('member.employment.inProgress')} value={formatNumber(d.projects_in_progress, lang)} />
              <StatCard label={t('member.employment.completed')} value={formatNumber(d.projects_completed, lang)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label={t('member.employment.budget')} value={d.amounts_suppressed || d.approved_budget_total === null ? t('member.employment.withheld') : formatMoney(d.approved_budget_total, lang)} />
              <StatCard label={t('member.employment.expense')} value={d.amounts_suppressed || d.actual_expense_total === null ? t('member.employment.withheld') : formatMoney(d.actual_expense_total, lang)} />
            </div>
          </>
        ))}
      </DataBoundary>
    </Stack>
  )
}
