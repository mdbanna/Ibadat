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
