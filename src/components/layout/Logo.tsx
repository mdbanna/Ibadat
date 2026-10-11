import { useTranslation } from 'react-i18next'

/** Header crop of the supplied IBADAT wordmark. The complete mark appears in the footer. */
export function Logo() {
  const { t } = useTranslation()
  return (
    <span className="block h-9 w-[110px] shrink-0 overflow-hidden">
      <img src="/brand/ibadat-logo.png" alt={t('brand.fullName')} className="block h-auto w-full max-w-none" />
    </span>
  )
}
