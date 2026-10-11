-- Demo-only content for the public website. These fictional entries stay separate
-- from auth-backed member profiles and real published gallery uploads.

create table public.demo_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  short_bio text not null check (char_length(short_bio) <= 300),
  general_location text not null check (char_length(general_location) <= 120),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.demo_members is 'Fictional sample profiles for the public site. Never used for authentication or membership records.';
alter table public.demo_members enable row level security;
revoke all on table public.demo_members from anon, authenticated;

insert into public.demo_members (full_name, short_bio, general_location) values
  ('Ayesha Karim (Demo)', 'Demo profile - Supports community relief programs.', 'Dhaka'),
  ('Rafiq Hasan (Demo)', 'Demo profile - Helps organize local volunteer activities.', 'Chattogram'),
  ('Nusrat Jahan (Demo)', 'Demo profile - Interested in community health and wellbeing.', 'Sylhet'),
  ('Sajid Rahman (Demo)', 'Demo profile - Supports learning and youth activities.', 'Rajshahi');

-- Keep the existing consent-and-approval rule for real members; add only the
-- clearly labeled fictional fixtures to the same read-only public directory RPC.
create or replace function public.list_public_member_profiles(p_limit integer default 24, p_offset integer default 0)
returns table (id uuid, full_name text, profile_image_path text, short_bio text, general_location text)
language sql stable security definer set search_path = '' as $$
  select directory.id, directory.full_name, directory.profile_image_path,
         directory.short_bio, directory.general_location
  from (
    select p.id, p.full_name, p.profile_image_path, p.short_bio, p.general_location
    from public.profiles p
    where p.membership_status = 'active' and p.public_profile_preference and p.public_profile_approved

    union all

    select d.id, d.full_name, null::text as profile_image_path, d.short_bio, d.general_location
    from public.demo_members d
    where d.is_published
  ) as directory
  order by directory.full_name, directory.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;
grant execute on function public.list_public_member_profiles(integer, integer) to anon, authenticated;

-- Local SVG illustrations are committed with the site and have no identifiable
-- people. The static:gallery/ prefix is resolved by the gallery URL helper.
insert into public.gallery_images (image_path, caption_bn, caption_en, publication_status, privacy_level) values
  ('static:gallery/demo/community-support.svg', 'ডেমো ছবি — কমিউনিটি সহায়তার নমুনা চিত্র।', 'Demo illustration - Community support packages.', 'published', 'public'),
  ('static:gallery/demo/community-health.svg', 'ডেমো ছবি — কমিউনিটি স্বাস্থ্যসেবার নমুনা চিত্র।', 'Demo illustration - Community health and wellbeing.', 'published', 'public'),
  ('static:gallery/demo/learning-together.svg', 'ডেমো ছবি — একসঙ্গে শেখার নমুনা চিত্র।', 'Demo illustration - Learning together.', 'published', 'public');
