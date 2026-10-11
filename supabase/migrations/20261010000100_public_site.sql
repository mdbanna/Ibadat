-- IBADAT Phase 2 / migration 7: schema additions for the public website.
-- Adds (a) a contact-message inbox, (b) column-level hardening of public content tables,
-- (c) activity cover images readable through the private gallery bucket. Existing migrations are untouched.

-- ---------------------------------------------------------------------------
-- (a) contact_messages: written only through submit_contact_message(); read/handled by admins.
-- ---------------------------------------------------------------------------
create type public.message_status as enum ('new', 'read', 'archived');

create table public.contact_messages (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(btrim(name)) between 2 and 120),
  email              text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone              text check (phone ~ '^\+?[0-9]{7,15}$'),
  subject            text check (char_length(subject) <= 160),
  message            text not null check (char_length(btrim(message)) between 10 and 4000),
  preferred_language text not null default 'bn' check (preferred_language in ('bn', 'en')),
  status             public.message_status not null default 'new',
  handled_by         uuid references auth.users (id) on delete set null,
  handled_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint contact_messages_has_channel check (email is not null or phone is not null)
);
create index contact_messages_inbox_idx on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;
create policy contact_messages_select_admin on public.contact_messages for select to authenticated
  using (public.has_role('admin'));
create policy contact_messages_update_admin on public.contact_messages for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
grant select, update on public.contact_messages to authenticated;

-- Stamp who handled a message from the session when its status leaves 'new'.
create function public.stamp_contact_message_handling() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'new' and old.status = 'new' then
    if (select auth.uid()) is not null then
      new.handled_by := (select auth.uid());
    end if;
    new.handled_at := now();
  end if;
  return new;
end $$;
create trigger contact_messages_handling before update on public.contact_messages
  for each row execute function public.stamp_contact_message_handling();
revoke execute on function public.stamp_contact_message_handling() from public, anon, authenticated;

-- Updates/deletes are audited (column names only). Inserts are not, so a flood cannot bloat the audit log.
create trigger audit_contact_messages after update or delete on public.contact_messages
  for each row execute function public.audit_row_change('columns');

-- Anonymous submission. A global cap (100 messages/hour) limits inbox flooding; it is a stop-gap, not a CAPTCHA.
create function public.submit_contact_message(
  p_name text, p_email text, p_phone text, p_subject text, p_message text, p_preferred_language text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too_many_requests' using errcode = '53400';
  end if;
  insert into public.contact_messages (name, email, phone, subject, message, preferred_language)
  values (btrim(p_name), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''), nullif(btrim(p_subject), ''),
          btrim(p_message), coalesce(p_preferred_language, 'bn'));
end $$;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b) Anonymous visitors do not need internal user ids (created_by). Column-level grants replace table-level SELECT for anon.
--     Public pages must therefore select explicit columns (select('*') is rejected for anon).
-- ---------------------------------------------------------------------------
revoke select on public.activities, public.gallery_images from anon;
grant select (id, slug, title_bn, title_en, description_bn, description_en, activity_date, general_location,
              cover_image_path, publication_status, created_at, updated_at) on public.activities to anon;
grant select (id, image_path, caption_bn, caption_en, image_date, related_activity_id,
              publication_status, privacy_level, created_at) on public.gallery_images to anon;

-- ---------------------------------------------------------------------------
-- (c) Activity cover images live in the gallery bucket. They are readable by whoever can read the activity row
--     (published only for the public), exactly like gallery_images.image_path.
-- ---------------------------------------------------------------------------
drop policy storage_gallery_read on storage.objects;
create policy storage_gallery_read on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'gallery'
    and (
      exists (select 1 from public.gallery_images g where g.image_path = name)
      or exists (select 1 from public.activities a where a.cover_image_path = name)
    )
  );
