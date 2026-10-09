import { useTranslation } from 'react-i18next'
import { LANGUAGES, type Language } from '../../i18n'
import { cx } from '../../lib/cx'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage as Language
  return (
    <div role="group" aria-label={t('language.switchTo')} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={current === lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={cx(
            'min-h-10 min-w-12 rounded-md px-3 text-sm font-semibold transition-colors',
            current === lng ? 'bg-forest text-white' : 'text-muted hover:text-forest',
          )}
        >
          {t(`language.${lng}`)}
        </button>
      ))}
    </div>
  )
}
