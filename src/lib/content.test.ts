import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase } from '../test/fakeSupabase'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import { listActivities, listGalleryImages, listPublicMembers } from './content'

const ops = (q: { ops: Array<[string, unknown[]]> }, name: string) => q.ops.filter(([n]) => n === name).map(([, a]) => a)

describe('public content queries', () => {
  beforeEach(() => { h.client = null })

  it('activities: only published rows, explicit columns (never select *)', async () => {
    const fake = makeFakeSupabase({ activities: [{ id: '1' }] })
    h.client = fake.client
    await listActivities(0, 12)
    const q = fake.queries[0]
    expect(ops(q, 'eq')).toContainEqual(['publication_status', 'published'])
    const cols = String(ops(q, 'select')[0][0])
    expect(cols).not.toContain('*')
    expect(cols).not.toContain('created_by')
    expect(ops(q, 'range')[0]).toEqual([0, 11])
  })

  it('gallery: only published AND public images, optionally per activity', async () => {
    const fake = makeFakeSupabase({ gallery_images: [] })
    h.client = fake.client
    await listGalleryImages(24, 24, 'act-1')
    const q = fake.queries[0]
    expect(ops(q, 'eq')).toEqual(expect.arrayContaining([['publication_status', 'published'], ['privacy_level', 'public'], ['related_activity_id', 'act-1']]))
    expect(String(ops(q, 'select')[0][0])).not.toContain('*')
    expect(ops(q, 'range')[0]).toEqual([24, 47])
  })

  it('members: goes through the opt-in + approval database function and never reads profiles directly', async () => {
    const fake = makeFakeSupabase({}, {
      list_public_member_profiles: () => ({ data: [{ id: 'm', full_name: 'Member', profile_image_path: '', short_bio: '', general_location: 'Dhaka' }], error: null }),
    })
    h.client = fake.client
    const rows = await listPublicMembers(0, 24)
    expect(fake.rpc).toHaveBeenCalledWith('list_public_member_profiles', { p_limit: 24, p_offset: 0 })
    expect(fake.queries).toHaveLength(0)
    expect(rows[0]).toMatchObject({ profile_image_path: null, short_bio: null, general_location: 'Dhaka' })
  })

  it('reports a missing configuration instead of crashing', async () => {
    await expect(listActivities()).rejects.toThrow('supabase_not_configured')
  })
})
