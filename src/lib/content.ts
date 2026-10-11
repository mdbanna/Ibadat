import { requireSupabase } from './supabase'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']

/**
 * Public content queries. Anonymous visitors are restricted by RLS and column grants, but these queries ALSO filter
 * explicitly (published / public) because a signed-in editor or admin browsing the public site would otherwise see drafts.
 * Anonymous access to activities and gallery_images is column-limited, so never use select('*') here.
 */
const ACTIVITY_COLUMNS = 'id, slug, title_bn, title_en, description_bn, description_en, activity_date, general_location, cover_image_path'
const GALLERY_COLUMNS = 'id, image_path, caption_bn, caption_en, image_date, related_activity_id'

export type Activity = Pick<Tables['activities']['Row'],
  'id' | 'slug' | 'title_bn' | 'title_en' | 'description_bn' | 'description_en' | 'activity_date' | 'general_location' | 'cover_image_path'>
export type GalleryImage = Pick<Tables['gallery_images']['Row'],
  'id' | 'image_path' | 'caption_bn' | 'caption_en' | 'image_date' | 'related_activity_id'>
export interface PublicMember {
  id: string
  full_name: string
  profile_image_path: string | null
  short_bio: string | null
  general_location: string | null
}

function fail(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message)
}

export async function listActivities(offset = 0, limit = 12): Promise<Activity[]> {
  const { data, error } = await requireSupabase()
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .eq('publication_status', 'published')
    .order('activity_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  fail(error)
  return data ?? []
}

export async function getActivityBySlug(slug: string): Promise<Activity | null> {
  const { data, error } = await requireSupabase()
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .eq('publication_status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  fail(error)
  return data
}

export async function listGalleryImages(offset = 0, limit = 24, activityId?: string): Promise<GalleryImage[]> {
  let query = requireSupabase()
    .from('gallery_images')
    .select(GALLERY_COLUMNS)
    .eq('publication_status', 'published')
    .eq('privacy_level', 'public')
  if (activityId) query = query.eq('related_activity_id', activityId)
  const { data, error } = await query
    .order('image_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  fail(error)
  return data ?? []
}

/** Only members who opted in AND were approved by an admin are returned (enforced in the database function). */
export async function listPublicMembers(offset = 0, limit = 24): Promise<PublicMember[]> {
  const { data, error } = await requireSupabase().rpc('list_public_member_profiles', { p_limit: limit, p_offset: offset })
  fail(error)
  return (data ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    profile_image_path: m.profile_image_path || null,
    short_bio: m.short_bio || null,
    general_location: m.general_location || null,
  }))
}
