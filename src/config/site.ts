/**
 * Public contact channels. NOT hard-coded: no official contact details were provided, so each one appears on the
 * Contact page only when its environment variable is set (see .env.example).
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)

const email = clean(import.meta.env.VITE_CONTACT_EMAIL)
const phone = clean(import.meta.env.VITE_CONTACT_PHONE)

export const siteConfig = {
  email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined,
  phone: phone && /^\+?[0-9 ()-]{7,20}$/.test(phone) ? phone : undefined,
  address: clean(import.meta.env.VITE_CONTACT_ADDRESS),
} as const

/** digits and leading + only, safe for a tel: link */
export const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`
