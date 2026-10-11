import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import {
  Button, Card, DataTable, EmptyState, ErrorMessage, FormField, Input, Loading, Modal, Notice, SectionHeading, StatusBadge,
  Textarea, type Column, type StatusKey,
} from '../components/ui'

interface Row { id: string; name: string; status: StatusKey; amount: string }

/** Component gallery for checking tokens, Bengali/English rendering and responsiveness. Contains no real data. */
export function DesignSystemPage() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rows: Row[] = [
    { id: '1', name: `${t('foundation.sampleRowName')} 1`, status: 'verified', amount: '0.00' },
    { id: '2', name: `${t('foundation.sampleRowName')} 2`, status: 'pending', amount: '0.00' },
    { id: '3', name: `${t('foundation.sampleRowName')} 3`, status: 'rejected', amount: '0.00' },
  ]
  const columns: Column<Row>[] = [
    { key: 'name', header: t('foundation.colName'), cell: (r) => r.name },
    { key: 'status', header: t('foundation.colStatus'), cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'amount', header: t('foundation.colAmount'), cell: (r) => r.amount, align: 'end' },
  ]
  const statuses: StatusKey[] = ['pending', 'submitted', 'underReview', 'verified', 'approved', 'rejected', 'reversed', 'active', 'suspended', 'draft', 'published', 'archived']

  return (
    <PageContainer className="flex flex-col gap-10 py-8 md:py-12">
      <SectionHeading level={1} title={t('foundation.title')} description={t('foundation.intro')} />

      <section className="flex flex-col gap-4" aria-labelledby="ds-type">
        <SectionHeading level={3} title={<span id="ds-type">{t('foundation.typography')}</span>} />
        <Card className="flex flex-col gap-3">
          <p className="text-(length:--text-display) font-extrabold">{t('brand.name')}</p>
          <h2 className="text-(length:--text-h2) font-bold">{t('brand.fullName')}</h2>
          <p>{t('foundation.typographySample')}</p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level={3} title={t('foundation.buttons')} />
        <div className="flex flex-wrap gap-3">
          <Button>{t('common.submit')}</Button>
          <Button variant="secondary">{t('common.cancel')}</Button>
          <Button variant="ghost">{t('common.back')}</Button>
          <Button variant="danger">{t('common.confirm')}</Button>
          <Button loading>{t('common.loading')}</Button>
          <Button disabled>{t('common.save')}</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level={3} title={t('foundation.formFields')} />
        <Card className="grid gap-4 md:grid-cols-2">
          <FormField label={t('forms.memberId')} hint={t('forms.memberIdHint')} required>
            {(p) => <Input {...p} autoComplete="username" />}
          </FormField>
          <FormField label={t('forms.phone')} error={t('validation.invalidPhone')} required>
            {(p) => <Input {...p} type="tel" inputMode="tel" defaultValue="017" />}
          </FormField>
          <div className="md:col-span-2">
            <FormField label={t('forms.motivation')}>{(p) => <Textarea {...p} />}</FormField>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level={3} title={t('foundation.badges')} />
        <div className="flex flex-wrap gap-2">{statuses.map((s) => <StatusBadge key={s} status={s} />)}</div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level={3} title={t('foundation.states')} />
        <Loading />
        <EmptyState />
        <ErrorMessage onRetry={() => undefined} />
        <Notice>{t('notices.sampleInfo')}</Notice>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level={3} title={t('foundation.table')} />
        <DataTable caption={t('foundation.table')} columns={columns} rows={rows} rowKey={(r) => r.id} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading level={3} title={t('foundation.modal')} />
        <div><Button onClick={() => setOpen(true)}>{t('foundation.openModal')}</Button></div>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={t('foundation.modalTitle')}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={() => setOpen(false)}>{t('common.confirm')}</Button></>}
        >
          <p>{t('foundation.modalBody')}</p>
        </Modal>
      </section>
    </PageContainer>
  )
}
