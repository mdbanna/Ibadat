-- IBADAT Phase 1 / migration 2: identity (profiles, roles, applications) and shared helpers

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Member ID: sequential, non-sensitive, never derived from NID / birth registration.
-- ---------------------------------------------------------------------------
create sequence public.member_id_seq start 1;

create function public.generate_member_id() returns text
language sql volatile set search_path = '' as $$
  select 'IBD-' || lpad(nextval('public.member_id_seq')::text, 4, '0')
$$;
revoke execute on function public.generate_member_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user. Rows are created by an admin-controlled
-- server path (Edge Function with service role) after an application is approved.
-- Clients can never INSERT profiles.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  member_id                text not null unique default public.generate_member_id(),
  full_name                text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone                    text check (phone ~ '^\+?[0-9]{7,15}$'),
  email                    text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  profile_image_path       text,
  short_bio                text check (char_length(short_bio) <= 300),
  general_location         text check (char_length(general_location) <= 120),
  membership_status        public.membership_status not null default 'pending',
  membership_start_date    date,
  public_profile_preference boolean not null default false,
  public_profile_approved  boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint profiles_member_id_format check (member_id ~ '^IBD-[0-9]{4,}$'),
  constraint profiles_public_requires_preference check (not public_profile_approved or public_profile_preference),
  constraint profiles_active_requires_start check (membership_status <> 'active' or membership_start_date is not null),
  constraint profiles_image_in_own_folder check (profile_image_path is null or profile_image_path like id::text || '/%')
);
-- Phone is the future OTP identifier, so it must be unique when present.
create unique index profiles_phone_key on public.profiles (phone) where phone is not null;
create unique index profiles_email_key on public.profiles (lower(email)) where email is not null;
create index profiles_membership_status_idx on public.profiles (membership_status);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles: elevated roles only. No client write policy exists (see RLS migration);
-- roles are granted by service-role code, so a user can never self-promote.
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_id_idx on public.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so RLS on user_roles/profiles does not recurse.
-- 'admin' satisfies every role check.
-- ---------------------------------------------------------------------------
create function public.has_role(_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role in (_role, 'admin')
  )
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role in ('editor', 'treasurer', 'admin')
  )
$$;

create function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.membership_status = 'active'
  )
$$;

revoke execute on function public.has_role(public.app_role), public.is_staff(), public.is_active_member() from public, anon;
grant execute on function public.has_role(public.app_role), public.is_staff(), public.is_active_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Guard: members may edit only their own descriptive fields.
-- Admins and server-side (service role / SQL) sessions are unrestricted.
-- Editing public-facing content resets public approval until an admin re-approves.
-- ---------------------------------------------------------------------------
create function public.guard_profile_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.has_role('admin') then
    if new.id is distinct from old.id
       or new.member_id is distinct from old.member_id
       or new.membership_status is distinct from old.membership_status
       or new.membership_start_date is distinct from old.membership_start_date
       or new.public_profile_approved is distinct from old.public_profile_approved
       or new.created_at is distinct from old.created_at then
      raise exception 'protected_profile_column' using errcode = '42501';
    end if;

    if new.full_name is distinct from old.full_name
       or new.short_bio is distinct from old.short_bio
       or new.general_location is distinct from old.general_location
       or new.profile_image_path is distinct from old.profile_image_path then
      new.public_profile_approved := false;
    end if;
  end if;

  if not new.public_profile_preference then
    new.public_profile_approved := false;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- Public member directory without exposing private columns (no table access for anon).
create function public.list_public_member_profiles(p_limit int default 24, p_offset int default 0)
returns table (id uuid, full_name text, profile_image_path text, short_bio text, general_location text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.profile_image_path, p.short_bio, p.general_location
  from public.profiles p
  where p.membership_status = 'active' and p.public_profile_preference and p.public_profile_approved
  order by p.full_name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;
grant execute on function public.list_public_member_profiles(int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- membership_applications: submitted through submit_membership_application() only.
-- No NID / birth registration number is collected in Phase 1.
-- ---------------------------------------------------------------------------
create sequence public.application_ref_seq start 1;

create table public.membership_applications (
  id                    uuid primary key default gen_random_uuid(),
  application_reference text not null unique default
    ('APP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.application_ref_seq')::text, 5, '0')),
  full_name             text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone                 text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email                 text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  date_of_birth         date check (date_of_birth <= current_date),
  occupation            text check (char_length(occupation) <= 120),
  address_line          text check (char_length(address_line) <= 300),
  district              text check (char_length(district) <= 80),
  upazila               text check (char_length(upazila) <= 80),
  motivation            text check (char_length(motivation) <= 2000),
  preferred_language    text not null default 'bn' check (preferred_language in ('bn', 'en')),
  consent_accepted      boolean not null check (consent_accepted),
  consent_at            timestamptz not null default now(),
  status                public.application_status not null default 'submitted',
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid references auth.users (id) on delete set null,
  internal_notes        text check (char_length(internal_notes) <= 4000),
  decision_reason       text check (char_length(decision_reason) <= 1000),
  approved_profile_id   uuid references public.profiles (id) on delete set null,
  updated_at            timestamptz not null default now(),
  constraint applications_decision_has_reviewer check (
    status not in ('approved', 'rejected') or (reviewed_at is not null and reviewed_by is not null)
  )
);
-- One open application per phone number.
create unique index membership_applications_open_phone_key
  on public.membership_applications (phone) where status in ('submitted', 'under_review');
create index membership_applications_status_idx on public.membership_applications (status, submitted_at desc);

create trigger membership_applications_set_updated_at before update on public.membership_applications
  for each row execute function public.set_updated_at();

-- Stamp the reviewer from the session when a decision is made.
create function public.stamp_application_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    if (select auth.uid()) is not null then
      new.reviewed_by := (select auth.uid());
    end if;
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger membership_applications_review before update on public.membership_applications
  for each row execute function public.stamp_application_review();

create function public.submit_membership_application(
  p_full_name text, p_phone text, p_email text, p_date_of_birth date, p_occupation text,
  p_address_line text, p_district text, p_upazila text, p_motivation text,
  p_preferred_language text, p_consent boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_ref text;
begin
  if not coalesce(p_consent, false) then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  insert into public.membership_applications (
    full_name, phone, email, date_of_birth, occupation, address_line, district, upazila,
    motivation, preferred_language, consent_accepted
  ) values (
    btrim(p_full_name), btrim(p_phone), nullif(btrim(p_email), ''), p_date_of_birth,
    nullif(btrim(p_occupation), ''), nullif(btrim(p_address_line), ''), nullif(btrim(p_district), ''),
    nullif(btrim(p_upazila), ''), nullif(btrim(p_motivation), ''), coalesce(p_preferred_language, 'bn'), true
  ) returning application_reference into v_ref;
  return v_ref;
exception when unique_violation then
  raise exception 'application_not_accepted' using errcode = '23505';
end $$;
grant execute on function public.submit_membership_application(text, text, text, date, text, text, text, text, text, text, boolean)
  to anon, authenticated;
