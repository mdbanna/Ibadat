import { useTranslation } from 'react-i18next'
import { Button, DataTable, EmptyState, ErrorMessage, StatusBadge, toStatusKey, type Column } from '../../components/ui'
import { DataBoundary } from '../../components/site/DataBoundary'
import { MemberHeading, Stack, StatCard } from '../../components/member/MemberUi'
import { useAuth } from '../../lib/auth'
import { getOwnContributionTotals, listOwnContributions, type Contribution } from '../../lib/member'
import { formatDate, formatMoney, formatMonth, formatNumber } from '../../lib/localize'
import { useAsync, usePaged } from '../../lib/useAsync'
import { usePageMeta } from '../../lib/usePageMeta'
import { useSignedUrls } from '../../lib/useSignedUrls'
import type { Language } from '../../i18n'

const PAGE_SIZE = 20

export default function ContributionsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  const { profile } = useAuth()
  usePageMeta(null, t('member.nav.contributions'))
  const uid = profile?.id ?? ''
  const totals = useAsync(() => getOwnContributionTotals(uid), [uid])
  const list = usePaged((offset, limit) => listOwnContributions(uid, offset, limit), PAGE_SIZE)
  const receipts = useSignedUrls('payment-receipts', list.items.map((c) => c.receipt_path))

  const columns: Column<Contribution>[] = [
    { key: 'month', header: t('member.contributions.colMonth'), cell: (c) => formatMonth(c.contribution_month, lang) },
    { key: 'date', header: t('member.contributions.colDate'), cell: (c) => formatDate(c.contribution_date, lang) },
    { key: 'amount', header: t('member.contributions.colAmount'), cell: (c) => formatMoney(c.amount, lang), align: 'end' },
    { key: 'method', header: t('member.contributions.colMethod'), cell: (c) => t(`member.contributions.${c.payment_method}`) },
    { key: 'ref', header: t('member.contributions.colReference'), cell: (c) => (c.transaction_reference ? <span dir="ltr">{c.transaction_reference}</span> : '—') },
    { key: 'status', header: t('member.contributions.colStatus'), cell: (c) => { const k = toStatusKey(c.verification_status); return k ? <StatusBadge status={k} /> : c.verification_status } },
    {
      key: 'receipt', header: t('member.contributions.colReceipt'),
      cell: (c) => (c.receipt_path && receipts[c.receipt_path]
        ? <a href={receipts[c.receipt_path]} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">{t('member.contributions.viewReceipt')}</a>
        : '—'),
    },
  ]

  return (
    <Stack>
      <MemberHeading title={t('member.contributions.title')} lead={t('member.contributions.lead')} />
      {totals.status === 'ready' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label={t('member.contributions.verifiedTotal')} value={formatMoney(totals.data.verifiedTotal, lang)} />
          <StatCard label={t('member.contributions.verifiedCount')} value={formatNumber(totals.data.verifiedCount, lang)} />
          <StatCard label={t('member.contributions.pendingCount')} value={formatNumber(totals.data.pendingCount, lang)} />
        </div>
      )}
      <DataBoundary status={list.status} onRetry={list.reload}>
        {list.items.length === 0 ? (
          <EmptyState title={t('member.contributions.empty')} description={t('member.contributions.emptyHint')} />
        ) : (
          <>
            <DataTable caption={t('member.contributions.title')} columns={columns} rows={list.items} rowKey={(c) => c.id} />
            {list.moreError && <ErrorMessage onRetry={list.loadMore} />}
            {list.hasMore && <div className="flex justify-center"><Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>{t('common.loadMore')}</Button></div>}
          </>
        )}
      </DataBoundary>
      <p className="text-sm text-muted-strong">{t('member.contributions.note')}</p>
    </Stack>
  )
}
