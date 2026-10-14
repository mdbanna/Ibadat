-- IBADAT Phase 3b / migration: phone-number login, first-login password change, private member details (NID).
-- Supersedes the Member-ID binding of 20261012000100 (which has not been applied anywhere): login identity is now the phone number.
-- Existing migrations are untouched; this file replaces functions/triggers with CREATE OR REPLACE / DROP+CREATE.
--
-- Login model
--   Auth email  = "<phone digits>@<domain>"   e.g. 8801712345678@members.example   (derived by the app / Edge Function)
--   profiles.phone = canonical "+8801712345678"; a profile can only exist for the Auth user whose email local part equals the phone digits.
--   First password = the phone number itself (set by an Edge Function when an admin creates the member).
--   profiles.must_change_password = true until the member sets a new password through the `complete-first-login` Edge Function
--   (service role). While it is true, is_active_member() is false, so members-only data (reports, announcements, documents,
--   aggregates) is withheld by the database itself, not just by the UI.

-- ---------------------------------------------------------------------------
-- (a) phone becomes the canonical login identity
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles alter column phone set not null;
alter table public.profiles add constraint profiles_phone_canonical check (phone ~ '^\+[0-9]{8,15}$');

alter table public.profiles add column must_change_password boolean not null default true;

drop trigger if exists profiles_bind_member_id on public.profiles;
create or replace function public.check_member_auth_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = new.id;
  if v_email is null or lower(split_part(v_email, '@', 1)) <> regexp_replace(new.phone, '[^0-9]', '', 'g') then
    raise exception 'phone_must_match_auth_account' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.check_member_auth_email() from public, anon, authenticated;
create trigger profiles_bind_phone before insert or update of id, phone on public.profiles
  for each row execute function public.check_member_auth_email();

-- ---------------------------------------------------------------------------
-- (b) members cannot touch phone or must_change_password; only service-role code (Edge Functions) can
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.has_role('admin') then
    if new.id is distinct from old.id
       or new.member_id is distinct from old.member_id
       or new.phone is distinct from old.phone
       or new.must_change_password is distinct from old.must_change_password
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

  -- even administrators acting through the API may not flip the first-login flag or edit the phone (login identity);
  -- those go through Edge Functions that also update the Auth account.
  if (select auth.uid()) is not null then
    if new.must_change_password is distinct from old.must_change_password or new.phone is distinct from old.phone then
      raise exception 'protected_profile_column' using errcode = '42501';
    end if;
  end if;

  if not new.public_profile_preference then
    new.public_profile_approved := false;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- (c) a member who still has the temporary password is not an "active member" for data access
-- ---------------------------------------------------------------------------
create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.membership_status = 'active' and not p.must_change_password
  )
$$;

-- ---------------------------------------------------------------------------
-- (d) private member details (national ID number). Admin-only; never exposed to members, public pages or the audit log values.
--     Recommendation: enable column encryption (Supabase Vault / pgsodium) before storing real NIDs at scale.
-- ---------------------------------------------------------------------------
create table public.member_private_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  nid_number text not null check (nid_number ~ '^([0-9]{10}|[0-9]{13}|[0-9]{17})$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index member_private_details_nid_key on public.member_private_details (nid_number);
create trigger member_private_details_set_updated_at before update on public.member_private_details
  for each row execute function public.set_updated_at();
alter table public.member_private_details enable row level security;
revoke all on public.member_private_details from anon, authenticated;
grant select, insert, update on public.member_private_details to authenticated;
create policy member_private_details_admin_select on public.member_private_details for select to authenticated using (public.has_role('admin'));
create policy member_private_details_admin_insert on public.member_private_details for insert to authenticated with check (public.has_role('admin'));
create policy member_private_details_admin_update on public.member_private_details for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
-- audit changes by column NAME only so the NID never lands in audit_logs
create trigger audit_member_private_details after insert or update or delete on public.member_private_details
  for each row execute function public.audit_row_change('columns');

-- ---------------------------------------------------------------------------
-- (e) Member IDs: never hand out an ID that already exists (e.g. one inserted by hand), so account creation cannot collide.
-- ---------------------------------------------------------------------------
create or replace function public.generate_member_id() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v text;
begin
  loop
    v := 'IBD-' || lpad(nextval('public.member_id_seq')::text, 4, '0');
    exit when not exists (select 1 from public.profiles p where p.member_id = v);
  end loop;
  return v;
end $$;
