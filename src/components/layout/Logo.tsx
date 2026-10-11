import { useTranslation } from 'react-i18next'

/** Supplied IBADAT wordmark used in the site header. */
export function Logo() {
  const { t } = useTranslation()
  return (
    <span className="block h-9 w-[110px] shrink-0 overflow-hidden">
      <img src="/brand/ibadat-logo.png" alt={t('brand.fullName')} className="block h-auto w-full max-w-none" />
    </span>
  )
}
