-- Remove only the fictional directory entries and gallery fixtures added by
-- 20261011101301_demo_public_content.sql. Keep the published brand assets.
delete from public.gallery_images
where image_path in (
  'static:gallery/demo/community-support.svg',
  'static:gallery/demo/community-health.svg',
  'static:gallery/demo/learning-together.svg'
);

create or replace function public.list_public_member_profiles(p_limit int default 24, p_offset int default 0)
returns table (id uuid, full_name text, profile_image_path text, short_bio text, general_location text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.profile_image_path, p.short_bio, p.general_location
  from public.profiles p
  where p.membership_status = 'active' and p.public_profile_preference and p.public_profile_approved
  order by p.full_name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;
grant execute on function public.list_public_member_profiles(int, int) to anon, authenticated;

drop table public.demo_members;
