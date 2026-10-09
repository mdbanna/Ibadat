import { useTranslation } from 'react-i18next'

/**
 * PLACEHOLDER wordmark. The IBADAT logo file was not supplied with the brief.
 * Replace the SVG below with the official logo (put the file in public/brand/ and use <img>).
 */
export function Logo() {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-2.5">
      <svg aria-hidden viewBox="0 0 64 64" className="size-9 shrink-0">
        <rect width="64" height="64" rx="14" fill="var(--color-forest)" />
        <path d="M32 14c8 8 12 14 12 21a12 12 0 0 1-24 0c0-7 4-13 12-21z" fill="var(--color-leaf)" />
        <circle cx="32" cy="38" r="4" fill="var(--color-gold)" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold tracking-wide text-forest">{t('brand.name')}</span>
        <span className="hidden text-xs text-muted sm:block">{t('brand.established')}</span>
      </span>
    </span>
  )
}
