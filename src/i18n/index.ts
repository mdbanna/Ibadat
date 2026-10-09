import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { bn } from './locales/bn'
import { en } from './locales/en'
import type { Messages } from './types'

export const LANGUAGES = ['bn', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'bn'
export const LANGUAGE_STORAGE_KEY = 'ibadat.lang'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Messages }
  }
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

/** The chosen language survives navigation, reloads and login/logout because it lives outside auth state. */
export function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function applyLanguage(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  } catch {
    /* storage unavailable (private mode): language still works for this session */
  }
}

void i18n.use(initReactI18next).init({
  resources: { bn: { translation: bn }, en: { translation: en } },
  lng: typeof localStorage === 'undefined' ? DEFAULT_LANGUAGE : readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
})
i18n.on('languageChanged', applyLanguage)
applyLanguage(i18n.language)

export default i18n
