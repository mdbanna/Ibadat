-- IBADAT Phase 1 / migration 6: Storage buckets and access policies.
--
-- Every bucket is PRIVATE. Objects are served with signed URLs (createSignedUrl), which require
-- SELECT permission under these policies, so a file is reachable only by people allowed to read it.
--
-- Object path conventions
--   gallery            <anything>/<file>            (must match gallery_images.image_path to be readable)
--   member-photos      <user_id>/<file>             (public only while profile is approved + active)
--   documents          <anything>/<file>            (must match documents.file_path)
--   beneficiary-files  <case_reference>/<file>      (admins only)
--   payment-receipts   <user_id>/<file>             (owner + treasurers)
--
-- Limits (enforced by Storage, also documented in docs/storage.md)
--   gallery 5 MB, member-photos 2 MB, documents 10 MB, beneficiary-files 10 MB, payment-receipts 5 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('gallery',           'gallery',           false,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('member-photos',     'member-photos',     false,  2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents',         'documents',         false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('beneficiary-files', 'beneficiary-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('payment-receipts',  'payment-receipts',  false,  5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- True when the path is the photo of an active member whose public profile is approved.
create function public.is_public_member_photo(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.profile_image_path = p_path
      and p.membership_status = 'active' and p.public_profile_preference and p.public_profile_approved
  )
$$;
grant execute on function public.is_public_member_photo(text) to anon, authenticated;

-- gallery: readable exactly when the caller can read the matching gallery_images row (its RLS applies).
create policy storage_gallery_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'gallery' and exists (select 1 from public.gallery_images g where g.image_path = name));
create policy storage_gallery_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.has_role('editor'));
create policy storage_gallery_update on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and public.has_role('editor')) with check (bucket_id = 'gallery' and public.has_role('editor'));
create policy storage_gallery_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.has_role('admin'));

-- documents: same pattern via documents.file_path.
create policy storage_documents_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'documents' and exists (select 1 from public.documents d where d.file_path = name));
create policy storage_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.has_role('editor'));
create policy storage_documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.has_role('editor')) with check (bucket_id = 'documents' and public.has_role('editor'));
create policy storage_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_role('admin'));

-- member-photos: own folder always; everyone only while approved public; admins everything.
create policy storage_member_photos_read_public on storage.objects for select to anon
  using (bucket_id = 'member-photos' and public.is_public_member_photo(name));
create policy storage_member_photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'member-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.has_role('admin')
         or public.is_public_member_photo(name))
  );
create policy storage_member_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_member_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_member_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_role('admin')));

-- beneficiary-files: administrators only.
create policy storage_beneficiary_files_admin on storage.objects for all to authenticated
  using (bucket_id = 'beneficiary-files' and public.has_role('admin'))
  with check (bucket_id = 'beneficiary-files' and public.has_role('admin'));

-- payment-receipts: owner and treasurers read; owner and treasurers upload; never updated or deleted by clients.
create policy storage_receipts_read on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_role('treasurer'))
  );
create policy storage_receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_role('treasurer'))
  );
