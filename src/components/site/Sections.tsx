import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../layout'
import { ButtonLink, Card, SectionHeading } from '../ui'
import { cx } from '../../lib/cx'
import { JOIN_PATH } from '../../routes'

/** Band at the top of every inner page. Exactly one <h1> per page lives here. */
export function PageHero({ title, lead, eyebrow }: { title: string; lead?: string; eyebrow?: string }) {
  return (
    <div className="border-b border-line bg-forest-soft">
      <PageContainer className="py-10 md:py-14">
        <SectionHeading level={1} title={title} description={lead} eyebrow={eyebrow} />
      </PageContainer>
    </div>
  )
}

export function Section({ children, className, tinted }: { children: ReactNode; className?: string; tinted?: boolean }) {
  return (
    <section className={cx('py-10 md:py-14', tinted && 'bg-surface border-y border-line', className)}>
      <PageContainer className="flex flex-col gap-8">{children}</PageContainer>
    </section>
  )
}

/** Numbered steps; <ol> so the order is announced. */
export function Steps({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {items.map((s, i) => (
        <li key={s.title}>
          <Card className="flex h-full flex-col gap-3">
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-forest text-lg font-bold text-white">{i + 1}</span>
            <h3 className="text-(length:--text-h3) font-bold">{s.title}</h3>
            <p className="text-muted">{s.body}</p>
          </Card>
        </li>
      ))}
    </ol>
  )
}

/** The single, consistent explanation that IBADAT is funded only by registered members. There is no donate action anywhere. */
export function MemberFundedNotice({ showCta = true }: { showCta?: boolean }) {
  const { t } = useTranslation()
  return (
    <aside aria-labelledby="member-funded-title" className="rounded-(--radius-card) border border-line border-s-4 border-s-gold bg-surface p-5 shadow-(--shadow-card) md:p-6">
      <div className="flex flex-col gap-3">
        <h2 id="member-funded-title" className="text-(length:--text-h3) font-bold">{t('memberFunded.title')}</h2>
        <p className="max-w-3xl text-ink/90">{t('memberFunded.body')}</p>
        {showCta && <div><ButtonLink to={JOIN_PATH}>{t('memberFunded.cta')}</ButtonLink></div>}
      </div>
    </aside>
  )
}

export function FundCards() {
  const { t } = useTranslation()
  const funds = [
    { key: 'directAid', name: t('funds.directAid'), body: t('fundDesc.directAid') },
    { key: 'employment', name: t('funds.employment'), body: t('fundDesc.employment') },
    { key: 'emergencyMedical', name: t('funds.emergencyMedical'), body: t('fundDesc.emergencyMedical') },
  ]
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {funds.map((f) => (
        <li key={f.key}>
          <Card className="h-full border-t-4 border-t-forest">
            <h3 className="text-(length:--text-h3) font-bold">{f.name}</h3>
            <p className="mt-2 text-muted">{f.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  )
}
