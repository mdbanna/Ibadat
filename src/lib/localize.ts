import type { Language } from '../i18n'

/** Prefer the visitor's language, fall back to the other one, never show an empty heading. */
export function pickLocalized(bn: string | null | undefined, en: string | null | undefined, lang: Language): string {
  const first = lang === 'bn' ? bn : en
  const second = lang === 'bn' ? en : bn
  return (first && first.trim()) || (second && second.trim()) || ''
}

/** Date-only strings (YYYY-MM-DD) are formatted in UTC so the day never shifts with the visitor's time zone. */
export function formatDate(isoDate: string | null | undefined, lang: Language): string {
  if (!isoDate) return ''
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(d)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '').slice(0, 2)).toUpperCase()
}
