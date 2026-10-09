-- Behavioural tests for RLS, ledger integrity and storage policies (run via tests/run.sh).
create schema tt;
grant usage on schema tt to anon, authenticated;

create function tt.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;

-- Runs sql and asserts it raises an error whose message contains `needle`.
create function tt.denied(sql text, needle text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm like '%' || needle || '%' then
      raise notice 'PASS: % (%)', msg, sqlerrm; return;
    end if;
    raise exception 'FAIL: % -- wrong error: %', msg, sqlerrm;
  end;
  raise exception 'FAIL: % -- statement succeeded', msg;
end $$;

create function tt.as_user(uid uuid, r text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute 'set local role ' || r;
end $$;

create function tt.n(q text) returns bigint language plpgsql as $$
declare v bigint; begin execute 'select count(*) from (' || q || ') s' into v; return v; end $$;

-- ---------------------------------------------------------------- fixtures (superuser)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@t'), ('00000000-0000-0000-0000-0000000000b1', 'treasurer@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'editor@t'), ('00000000-0000-0000-0000-000000000011', 'm1@t'),
  ('00000000-0000-0000-0000-000000000022', 'm2@t'),     ('00000000-0000-0000-0000-000000000033', 'pending@t');
insert into public.profiles (id, full_name, membership_status, membership_start_date, public_profile_preference) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin User',     'active', '2026-01-01', false),
  ('00000000-0000-0000-0000-0000000000b1', 'Treasurer User', 'active', '2026-01-01', false),
  ('00000000-0000-0000-0000-0000000000c1', 'Editor User',    'active', '2026-01-01', false),
  ('00000000-0000-0000-0000-000000000011', 'Member One',     'active', '2026-01-01', true),
  ('00000000-0000-0000-0000-000000000022', 'Member Two',     'active', '2026-01-01', false),
  ('00000000-0000-0000-0000-000000000033', 'Pending Person', 'pending', null, false);
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'), ('00000000-0000-0000-0000-0000000000b1', 'treasurer'),
  ('00000000-0000-0000-0000-0000000000c1', 'editor');
update public.profiles set public_profile_approved = true where full_name = 'Member One';
insert into public.activities (slug, title_en, publication_status) values ('pub-act', 'Published', 'published'), ('draft-act', 'Draft', 'draft');
insert into public.gallery_images (image_path, publication_status, privacy_level) values
  ('g/public.jpg', 'published', 'public'), ('g/members.jpg', 'published', 'members'), ('g/draft.jpg', 'draft', 'public');
insert into storage.buckets (id) values ('gallery') on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('gallery', 'g/public.jpg'), ('gallery', 'g/members.jpg'), ('gallery', 'g/draft.jpg'),
  ('payment-receipts', '00000000-0000-0000-0000-000000000011/r1.pdf'),
  ('member-photos', '00000000-0000-0000-0000-000000000011/me.jpg'),
  ('member-photos', '00000000-0000-0000-0000-000000000022/me.jpg');
update public.profiles set profile_image_path = '00000000-0000-0000-0000-000000000011/me.jpg'
  where full_name = 'Member One';
update public.profiles set public_profile_approved = true where full_name = 'Member One';

do $$
declare
  m1 uuid := '00000000-0000-0000-0000-000000000011'; m2 uuid := '00000000-0000-0000-0000-000000000022';
  adm uuid := '00000000-0000-0000-0000-0000000000a1'; tre uuid := '00000000-0000-0000-0000-0000000000b1';
  edi uuid := '00000000-0000-0000-0000-0000000000c1'; pnd uuid := '00000000-0000-0000-0000-000000000033';
  cid uuid; v_ref text; v_sum numeric; r record;
begin
  -- ============================================================ anonymous visitor
  perform tt.as_user(null, 'anon');
  perform tt.denied('select * from public.profiles', 'permission denied', 'anon cannot read profiles');
  perform tt.denied('select * from public.contributions', 'permission denied', 'anon cannot read contributions');
  perform tt.denied('select * from public.beneficiaries', 'permission denied', 'anon cannot read beneficiaries');
  perform tt.denied('select * from public.fund_transactions', 'permission denied', 'anon cannot read ledger');
  perform tt.denied('select * from public.membership_applications', 'permission denied', 'anon cannot read applications');
  perform tt.denied('select * from public.audit_logs', 'permission denied', 'anon cannot read audit logs');
  perform tt.ok(tt.n('select 1 from public.activities') = 1, 'anon sees only published activities');
  perform tt.ok(tt.n('select 1 from public.gallery_images') = 1, 'anon sees only published public gallery images');
  perform tt.ok(tt.n('select 1 from public.funds') = 3, 'anon sees the 3 funds');
  perform tt.ok(tt.n('select 1 from public.list_public_member_profiles()') = 1, 'public directory lists only approved public profiles');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='gallery'$q$) = 1, 'anon can read only the public gallery object');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='payment-receipts'$q$) = 0, 'anon cannot see receipts');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='member-photos'$q$) = 1, 'anon sees only the approved public member photo');
  perform tt.denied('insert into public.activities (slug, title_en) values (''x'', ''x'')', 'permission denied', 'anon cannot write activities');

  -- application RPC
  select public.submit_membership_application('Applicant One', '+8801700000001', null, null, null, null, null, null, null, 'bn', true) into v_ref;
  perform tt.ok(v_ref like 'APP-2026-%', 'anon can submit an application and gets a reference');
  perform tt.denied($q$select public.submit_membership_application('Applicant One', '+8801700000001', null, null, null, null, null, null, null, 'bn', true)$q$,
                    'application_not_accepted', 'duplicate open application is rejected');
  perform tt.denied($q$select public.submit_membership_application('Applicant Two', '+8801700000002', null, null, null, null, null, null, null, 'bn', false)$q$,
                    'consent_required', 'consent is mandatory');

  -- ============================================================ member
  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.profiles') = 1, 'member sees only own profile');
  perform tt.ok(tt.n('select 1 from public.user_roles') = 0, 'plain member has no roles');
  perform tt.denied($q$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000011', 'admin')$q$,
                    'permission denied', 'member cannot grant themselves a role');
  perform tt.denied($q$update public.profiles set membership_status = 'suspended' where id = auth.uid()$q$,
                    'protected_profile_column', 'member cannot change membership_status');
  perform tt.denied($q$update public.profiles set member_id = 'IBD-9999' where id = auth.uid()$q$,
                    'protected_profile_column', 'member cannot change member_id');
  update public.profiles set short_bio = 'Hello' where id = auth.uid();
  perform tt.ok((select short_bio from public.profiles where id = auth.uid()) = 'Hello', 'member can edit own bio');
  perform tt.ok((select public_profile_approved from public.profiles where id = auth.uid()) = false, 'editing public content resets approval');
  perform tt.denied($q$update public.profiles set public_profile_approved = true where id = auth.uid()$q$,
                    'protected_profile_column', 'member cannot self-approve public profile');
  perform tt.denied($q$update public.profiles set profile_image_path = '00000000-0000-0000-0000-000000000022/me.jpg' where id = auth.uid()$q$,
                    'profiles_image_in_own_folder', 'member cannot point photo at another folder');
  update public.profiles set full_name = 'Hacked' where id = m2;
  reset role; perform tt.ok((select full_name from public.profiles where id = m2) = 'Member Two', 'member cannot update another profile'); perform tt.as_user(m1, 'authenticated');

  insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method, transaction_reference)
    values (m1, 1000.01, current_date, date_trunc('month', current_date)::date, 'bkash', 'TRX-0001') returning id into cid;
  perform tt.ok(cid is not null, 'member can submit own pending contribution');
  perform tt.denied($q$insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method, verification_status, verified_by, verified_at)
                       values ('00000000-0000-0000-0000-000000000011', 5, current_date, date_trunc('month', current_date)::date, 'cash', 'verified', '00000000-0000-0000-0000-000000000011', now())$q$,
                    'not_authorized_to_verify', 'member cannot insert a pre-verified contribution (trigger fires before RLS check)');
  perform tt.denied($q$insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method)
                       values ('00000000-0000-0000-0000-000000000022', 5, current_date, date_trunc('month', current_date)::date, 'cash')$q$,
                    'row-level security', 'member cannot submit for someone else');
  perform tt.denied($q$insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method, transaction_reference)
                       values ('00000000-0000-0000-0000-000000000011', 50, current_date, date_trunc('month', current_date)::date, 'bkash', ' trx-0001 ')$q$,
                    'contributions_payment_reference_key', 'duplicate payment reference is blocked');
  update public.contributions set verification_status = 'verified' where id = cid;
  reset role; perform tt.ok((select verification_status from public.contributions where id = cid) = 'pending', 'member cannot verify own contribution'); perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.fund_transactions') = 0, 'member sees no ledger rows');
  perform tt.ok(tt.n('select 1 from public.fund_balances') = 0, 'member sees no fund balances');
  perform tt.ok(tt.n('select 1 from public.beneficiaries') = 0, 'member sees no beneficiaries');
  perform tt.ok(tt.n('select 1 from public.audit_logs') = 0, 'member sees no audit logs');
  perform tt.denied($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, description)
                       select id, 'adjustment', 'credit', 999999, current_date, 'free money' from public.funds limit 1$q$,
                    'permission denied', 'member cannot write to the ledger');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='payment-receipts'$q$) = 1, 'member reads own receipt folder');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='member-photos'$q$) = 1, 'member sees own photo (and none of others unless public)');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='gallery'$q$) = 2, 'active member sees public + members gallery objects');

  perform tt.as_user(m2, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.contributions') = 0, 'member two cannot see member one contributions');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='payment-receipts'$q$) = 0, 'member two cannot see member one receipts');
  perform tt.denied($q$insert into storage.objects (bucket_id, name) values ('payment-receipts', '00000000-0000-0000-0000-000000000011/evil.pdf')$q$,
                    'row-level security', 'member cannot upload into another member receipt folder');
  perform tt.denied($q$insert into public.activities (slug, title_en) values ('x', 'x')$q$, 'row-level security', 'member cannot create activities');

  perform tt.as_user(pnd, 'authenticated');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='gallery'$q$) = 1, 'pending member does not get members-only gallery');

  -- ============================================================ treasurer: verification + ledger
  perform tt.as_user(tre, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.contributions') = 1, 'treasurer sees contributions');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='payment-receipts'$q$) = 1, 'treasurer reads receipts');
  update public.contributions set verification_status = 'verified' where id = cid;
  reset role;
  select sum(amount) into v_sum from public.fund_transactions where contribution_id = cid;
  perform tt.ok(v_sum = 1000.01, 'allocations sum exactly to the contribution (rounding remainder handled)');
  perform tt.ok((select count(*) from public.fund_transactions where contribution_id = cid and transaction_type = 'allocation') = 3, 'verification posts 3 allocations');
  perform tt.ok((select amount from public.fund_transactions t join public.funds f on f.id = t.fund_id where t.contribution_id = cid and f.fund_type = 'direct_aid') = 500.01, 'direct aid gets 50% (+ remainder)');
  perform tt.ok((select verified_by from public.contributions where id = cid) = tre, 'verified_by is stamped from the session, not client input');
  perform tt.as_user(tre, 'authenticated');
  perform tt.ok((select balance from public.fund_balances where fund_type = 'employment') = 250.00, 'treasurer sees derived fund balance');
  perform tt.denied($q$update public.fund_transactions set amount = 1 where true$q$, 'permission denied', 'treasurer cannot edit the ledger');
  perform tt.denied($q$delete from public.fund_transactions$q$, 'permission denied', 'treasurer cannot delete ledger rows');
  perform tt.denied($q$update public.contributions set amount = 1 where id = '$q$ || cid || $q$'$q$, 'verified_contribution_is_immutable', 'verified contribution amount is frozen');
  perform tt.denied($q$update public.contributions set verification_status = 'pending' where id = '$q$ || cid || $q$'$q$, 'verified_contribution_can_only_be_reversed', 'verified cannot go back to pending');
  perform tt.denied($q$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000b1', 'admin')$q$, 'permission denied', 'treasurer cannot grant roles');
end $$;
