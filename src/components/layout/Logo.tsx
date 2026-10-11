import { useTranslation } from 'react-i18next'

/** Supplied IBADAT wordmark used in the site header. */
export function Logo() {
  const { t } = useTranslation()
  return (
    <span className="block w-[110px] shrink-0">
      <img src="/brand/ibadat-logo-green.svg" alt={t('brand.fullName')} className="block h-auto w-full" />
    </span>
  )
}
