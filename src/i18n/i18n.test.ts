import { describe, expect, it } from 'vitest'
import { bn } from './locales/bn'
import { en } from './locales/en'

type Tree = { [k: string]: string | Tree }
const flatten = (o: Tree, prefix = ''): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) }
  }, {})

const flatBn = flatten(bn)
const flatEn = flatten(en)
const placeholders = (s: string) => (s.match(/\{\{\s*\w+[^}]*\}\}/g) ?? []).sort().join(',')

describe('translations', () => {
  it('Bengali and English define exactly the same keys', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatBn).sort())
  })
  it('has no empty strings', () => {
    for (const [k, v] of [...Object.entries(flatBn), ...Object.entries(flatEn)]) expect(v.trim(), k).not.toBe('')
  })
  it('uses the same interpolation placeholders in both languages', () => {
    for (const k of Object.keys(flatBn)) expect(placeholders(flatEn[k]), k).toBe(placeholders(flatBn[k]))
  })
  it('Bengali strings that are not brand names actually contain Bengali script', () => {
    const exempt = new Set(['brand.name', 'language.en', 'forms.memberIdHint', 'member.contributions.bkash', 'member.contributions.nagad', 'member.contributions.rocket'])
    for (const [k, v] of Object.entries(flatBn)) if (!exempt.has(k)) expect(/[\u0980-\u09FF]/.test(v), k).toBe(true)
  })
})
