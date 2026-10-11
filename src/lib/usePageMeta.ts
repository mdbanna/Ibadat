import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

type TitleKey = 'home' | 'about' | 'activities' | 'gallery' | 'members' | 'join' | 'contact'

/** Sets <title> and the meta description from translations so both follow the language switcher. */
export function usePageMeta(page: TitleKey | null, customTitle?: string) {
  const { t, i18n } = useTranslation()
  useEffect(() => {
    const base = t('brand.name')
    const title = customTitle ?? (page ? t(`meta.title.${page}`) : '')
    document.title = title ? `${title} | ${base}` : `${base} | ${t('brand.fullName')}`
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) { tag = document.createElement('meta'); tag.name = 'description'; document.head.appendChild(tag) }
    tag.content = t('meta.description')
  }, [page, customTitle, t, i18n.resolvedLanguage])
}
