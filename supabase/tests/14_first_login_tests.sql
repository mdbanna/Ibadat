-- Phone login support: first-login gate, protected columns and private member details (runs after 10-13).
do $$
declare
  adm uuid := '00000000-0000-0000-0000-0000000000a1'; m1 uuid := '00000000-0000-0000-0000-000000000011';
  g uuid := '00000000-0000-0000-0000-0000000000e1'; r record;
begin
  -- a freshly created member still has the temporary password (must_change_password defaults to true)
  perform tt.as_super();
  insert into auth.users (id, email) values (g, '8801700000081@members.test');
  insert into public.profiles (id, full_name, phone, membership_status, membership_start_date) values (g, 'Fresh Member', '+8801700000081', 'active', '2026-10-01');
  perform tt.ok((select must_change_password from public.profiles where id = g), 'new profiles default to must_change_password = true');

  perform tt.as_user(g, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.profiles') = 1, 'a member on the temporary password can read only their own profile');
  perform tt.ok(not public.is_active_member(), 'is_active_member() is false until the password is changed');
  perform tt.ok(tt.n('select 1 from public.monthly_reports') = 0, 'no monthly reports before the first password change');
  perform tt.ok(tt.n('select 1 from public.announcements') = 1, 'only public announcements before the first password change');
  perform tt.ok(tt.n('select 1 from public.documents') = 1, 'only public documents before the first password change');
  perform tt.denied('select * from public.get_assistance_summary()', 'not_authorized', 'aggregates are refused before the first password change');
  perform tt.denied('select * from public.get_employment_summary()', 'not_authorized', 'employment aggregates are refused before the first password change');

  -- the member cannot clear the flag themselves (only the Edge Function, with the service role, can)
  perform tt.denied($q$update public.profiles set must_change_password = false where id = auth.uid()$q$, 'protected_profile_column', 'member cannot clear must_change_password');
  perform tt.as_user(adm, 'authenticated');
  perform tt.denied($q$update public.profiles set must_change_password = false where id = '00000000-0000-0000-0000-0000000000e1'$q$, 'protected_profile_column', 'not even an administrator can clear it through the API');
  perform tt.denied($q$update public.profiles set phone = '+8801700000082' where id = '00000000-0000-0000-0000-0000000000e1'$q$, 'phone_must_match_auth_account', 'not even an administrator can edit the login phone through the API');

  -- service role (Edge Function) completes the first login
  perform tt.as_super();
  update public.profiles set must_change_password = false where id = g;
  perform tt.as_user(g, 'authenticated');
  perform tt.ok(public.is_active_member(), 'after the password change the member is active for data access');
  perform tt.ok(tt.n('select 1 from public.get_assistance_summary()') = 3, 'aggregates work after the first password change');
  perform tt.ok(tt.n('select 1 from public.announcements') = 2, 'members-only announcements appear after the first password change');

  -- private member details (NID): admin only
  perform tt.as_user(adm, 'authenticated');
  insert into public.member_private_details (profile_id, nid_number) values ('00000000-0000-0000-0000-0000000000e1', '1234567890');
  perform tt.ok(tt.n('select 1 from public.member_private_details') = 1, 'administrator can store and read private member details');
  perform tt.denied($q$insert into public.member_private_details (profile_id, nid_number) values ('00000000-0000-0000-0000-000000000011', '1234567890')$q$, 'member_private_details_nid_key', 'the same NID cannot belong to two members');
  perform tt.denied($q$insert into public.member_private_details (profile_id, nid_number) values ('00000000-0000-0000-0000-000000000011', '12345')$q$, 'member_private_details_nid_number_check', 'NID must be 10, 13 or 17 digits');
  perform tt.as_user(g, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.member_private_details') = 0, 'a member cannot read private member details, not even their own');
  perform tt.denied($q$insert into public.member_private_details (profile_id, nid_number) values ('00000000-0000-0000-0000-0000000000e1', '9999999999')$q$, 'row-level security', 'a member cannot write private member details');
  perform tt.as_user(null, 'anon');
  perform tt.denied('select * from public.member_private_details', 'permission denied', 'anonymous visitors cannot touch private member details');
  perform tt.as_user('00000000-0000-0000-0000-0000000000b1', 'authenticated');
  perform tt.ok(tt.n('select 1 from public.member_private_details') = 0, 'a treasurer cannot read NIDs');
  perform tt.as_super();
  perform tt.ok(not exists (select 1 from public.audit_logs where entity_type = 'member_private_details' and metadata::text like '%1234567890%'), 'the NID never appears in audit_logs');
  perform tt.ok(exists (select 1 from public.audit_logs where entity_type = 'member_private_details' and action = 'insert'), 'inserting private details is audited (column names only)');

  -- Member IDs never collide with ones inserted by hand
  perform tt.as_super();
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e2', '8801700000071@members.test');
  insert into public.profiles (id, member_id, full_name, phone, must_change_password)
    values ('00000000-0000-0000-0000-0000000000e2', 'IBD-' || lpad(((select last_value from public.member_id_seq) + 1)::text, 4, '0'), 'Collision Test', '+8801700000071', false);
  perform tt.ok(not exists (select 1 from public.profiles where member_id = public.generate_member_id()), 'generate_member_id skips IDs that already exist');
end $$;
