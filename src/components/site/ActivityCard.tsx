import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SiteImage } from './SiteImage'
import type { Activity } from '../../lib/content'
import { formatDate, pickLocalized } from '../../lib/localize'
import type { Language } from '../../i18n'

export function activityTitle(a: Activity, lang: Language, fallback: string) {
  return pickLocalized(a.title_bn, a.title_en, lang) || fallback
}

export function ActivityCard({ activity, coverUrl }: { activity: Activity; coverUrl?: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  const title = activityTitle(activity, lang, t('activitiesPage.untitled'))
  const summary = pickLocalized(activity.description_bn, activity.description_en, lang)
  const meta = [formatDate(activity.activity_date, lang), activity.general_location].filter(Boolean).join(' · ')
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-card)">
      <SiteImage url={coverUrl} alt="" ratio="16 / 9" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        {meta && <p className="text-sm text-muted">{meta}</p>}
        <h3 className="text-(length:--text-h3) font-bold">
          {/* the whole card is clickable through this link's ::after, keeping a single focus stop */}
          <Link to={`/activities/${activity.slug}`} className="after:absolute after:inset-0 hover:text-forest">{title}</Link>
        </h3>
        {summary && <p className="line-clamp-3 text-muted">{summary}</p>}
        <p className="mt-auto pt-2 font-semibold text-forest">{t('common.readMore')}</p>
      </div>
    </article>
  )
}
