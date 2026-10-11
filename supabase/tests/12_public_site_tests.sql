-- Phase 2 additions: contact inbox, anon column grants, activity cover images (runs after tests 10 and 11).
do $$
declare
  adm uuid := '00000000-0000-0000-0000-0000000000a1'; m1 uuid := '00000000-0000-0000-0000-000000000011';
begin
  reset role;
  insert into public.activities (slug, title_en, publication_status, cover_image_path) values
    ('cover-pub', 'Has cover', 'published', 'covers/pub.jpg'), ('cover-draft', 'Draft cover', 'draft', 'covers/draft.jpg');
  insert into storage.objects (bucket_id, name) values ('gallery', 'covers/pub.jpg'), ('gallery', 'covers/draft.jpg');

  -- anonymous column hardening
  perform tt.as_user(null, 'anon');
  perform tt.denied('select * from public.activities', 'permission denied', 'anon cannot select * from activities (created_by hidden)');
  perform tt.denied('select * from public.gallery_images', 'permission denied', 'anon cannot select * from gallery_images (created_by hidden)');
  perform tt.denied('select created_by from public.activities', 'permission denied', 'anon cannot read created_by');
  perform tt.ok(tt.n('select id, slug, title_bn, title_en, cover_image_path from public.activities') = 2, 'anon reads published activities with explicit columns');
  perform tt.ok(tt.n('select id, image_path, caption_bn from public.gallery_images') = 1, 'anon still sees only the published public gallery image');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id = 'gallery' and name = 'covers/pub.jpg'$q$) = 1, 'anon can read the cover of a published activity');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id = 'gallery' and name = 'covers/draft.jpg'$q$) = 0, 'anon cannot read the cover of a draft activity');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id = 'gallery'$q$) = 2, 'gallery bucket exposure is exactly public image + published cover');

  -- contact messages
  perform tt.denied('select * from public.contact_messages', 'permission denied', 'anon cannot read contact messages');
  perform public.submit_contact_message('Visitor One', 'v@example.org', null, 'Hello', 'I would like to know more.', 'en');
  perform public.submit_contact_message('Visitor Two', null, '+8801700000009', null, 'Please call me back soon.', 'bn');
  perform tt.denied($q$select public.submit_contact_message('V', 'v@example.org', null, null, 'A long enough message', 'en')$q$, 'contact_messages_name_check', 'name too short is rejected');
  perform tt.denied($q$select public.submit_contact_message('Visitor', 'v@example.org', null, null, 'short', 'en')$q$, 'contact_messages_message_check', 'message too short is rejected');
  perform tt.denied($q$select public.submit_contact_message('Visitor', null, null, null, 'A long enough message', 'en')$q$, 'contact_messages_has_channel', 'a reply channel is required');
  perform tt.denied($q$select public.submit_contact_message('Visitor', 'not-an-email', null, null, 'A long enough message', 'en')$q$, 'contact_messages_email_check', 'bad email is rejected');

  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.contact_messages') = 0, 'a member cannot read contact messages');
  update public.contact_messages set status = 'read';
  reset role;
  perform tt.ok((select count(*) from public.contact_messages where status = 'new') = 2, 'a member cannot update contact messages');

  perform tt.as_user(adm, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.contact_messages') = 2, 'admin reads contact messages');
  update public.contact_messages set status = 'read' where name = 'Visitor One';
  perform tt.ok((select handled_by from public.contact_messages where name = 'Visitor One') = adm, 'handler is stamped from the session');
  reset role;
  perform tt.ok(exists (select 1 from public.audit_logs where entity_type = 'contact_messages' and action = 'update'), 'handling a message is audited');
  perform tt.ok(not exists (select 1 from public.audit_logs where entity_type = 'contact_messages' and metadata::text like '%would like to know%'), 'audit log holds no message text');

  -- flood cap
  insert into public.contact_messages (name, email, message) select 'Bot ' || g, 'b@example.org', 'flood message number ' || g from generate_series(1, 100) g;
  perform tt.as_user(null, 'anon');
  perform tt.denied($q$select public.submit_contact_message('Visitor', 'v@example.org', null, null, 'A long enough message', 'en')$q$, 'too_many_requests', 'global hourly cap stops inbox flooding');
end $$;
