import { describe, expect, it } from 'vitest'
import { JOIN_PATH, NAV_ITEMS } from './routes'

describe('public navigation', () => {
  it('covers the seven public sections (Join is the header call to action)', () => {
    expect(NAV_ITEMS.map((i) => i.to)).toEqual(['/', '/about', '/activities', '/gallery', '/members', '/contact'])
    expect(JOIN_PATH).toBe('/join')
  })
  it('has no donate route: contributions come only from registered members', () => {
    for (const i of NAV_ITEMS) expect(`${i.to} ${i.key}`.toLowerCase()).not.toMatch(/donat/)
    expect(JOIN_PATH).not.toMatch(/donat/)
  })
})
