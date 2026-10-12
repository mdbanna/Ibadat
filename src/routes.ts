/** Public navigation. There is deliberately no donate route: IBADAT accepts contributions only from registered members. */
export const NAV_ITEMS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/about', key: 'nav.about', end: false },
  { to: '/activities', key: 'nav.activities', end: false },
  { to: '/gallery', key: 'nav.gallery', end: false },
  { to: '/members', key: 'nav.members', end: false },
  { to: '/contact', key: 'nav.contact', end: false },
] as const

export const JOIN_PATH = '/join'

/** Member dashboard sections, in display order. `key` is a translation key. */
export const DASHBOARD_ITEMS = [
  { to: '/dashboard', key: 'member.nav.overview', end: true },
  { to: '/dashboard/profile', key: 'member.nav.profile', end: false },
  { to: '/dashboard/contributions', key: 'member.nav.contributions', end: false },
  { to: '/dashboard/funds', key: 'member.nav.funds', end: false },
  { to: '/dashboard/reports', key: 'member.nav.reports', end: false },
  { to: '/dashboard/assistance', key: 'member.nav.assistance', end: false },
  { to: '/dashboard/employment', key: 'member.nav.employment', end: false },
  { to: '/dashboard/medical', key: 'member.nav.medical', end: false },
  { to: '/dashboard/activities', key: 'member.nav.activities', end: false },
  { to: '/dashboard/announcements', key: 'member.nav.announcements', end: false },
  { to: '/dashboard/documents', key: 'member.nav.documents', end: false },
  { to: '/dashboard/settings', key: 'member.nav.settings', end: false },
] as const

export const LOGIN_PATH = '/login'
