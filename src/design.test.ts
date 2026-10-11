/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// read from disk: Vite's ?raw import runs through the Tailwind plugin, which strips @theme
const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

const T = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]))

type RGB = [number, number, number]
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const blend = (fg: string, alpha: number, bg: string): RGB => rgb(fg).map((c, i) => Math.round(c * alpha + rgb(bg)[i] * (1 - alpha))) as RGB
function ratio(a: RGB, b: RGB) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('colour contrast of text pairs used in the interface (WCAG AA, 4.5:1)', () => {
  const pairs: Array<[string, string, string, number?]> = [
    ['ink', 'background', 'body text'], ['ink', 'surface', 'cards'], ['ink', 'forest-soft', 'tinted band'],
    ['ink', 'leaf-soft', 'notices'], ['ink', 'gold-soft', 'warning notices'], ['ink', 'gold', 'accent button'],
    ['muted', 'surface', 'secondary text on cards'], ['muted', 'background', 'secondary text on page'],
    ['muted-strong', 'forest-soft', 'page hero lead'], ['muted-strong', 'line', 'neutral badge'], ['muted-strong', 'leaf-soft', 'tinted'],
    ['forest', 'surface', 'links and secondary buttons'], ['forest', 'background', 'links on page'], ['forest', 'forest-soft', 'active nav, eyebrow'],
    ['white', 'forest', 'primary button'], ['white', 'forest-deep', 'hero and footer'], ['gold', 'forest-deep', 'footer heading'],
    ['danger', 'surface', 'field errors'], ['danger', 'danger-soft', 'error banners'], ['white', 'danger', 'danger button'],
  ]
  for (const [fg, bg, use] of pairs) {
    it(`${fg} on ${bg} (${use})`, () => {
      const f = fg === 'white' ? '#FFFFFF' : T[fg]
      const b = bg === 'white' ? '#FFFFFF' : T[bg]
      expect(f, `missing token ${fg}`).toBeDefined()
      expect(ratio(rgb(f), rgb(b)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('translucent white text on the dark hero/footer stays readable (>= 4.5:1 at 80% opacity)', () => {
    expect(ratio(blend('#FFFFFF', 0.8, T['forest-deep']), rgb(T['forest-deep']))).toBeGreaterThanOrEqual(4.5)
  })
  it('leaf green is NOT used for text: it fails AA on white', () => {
    expect(ratio(rgb(T.leaf), rgb('#FFFFFF'))).toBeLessThan(4.5)
  })
})
