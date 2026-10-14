-- Phase 3: Member ID <-> Auth binding, privacy-safe aggregates, members-only content isolation (runs after 10-12).
-- A server-side (service role / SQL editor) session has no login claim at all. `reset role` alone keeps the previous claim.
create function tt.as_super() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  m1 uuid := '00000000-0000-0000-0000-000000000011'; m2 uuid := '00000000-0000-0000-0000-000000000022';
  pnd uuid := '00000000-0000-0000-0000-000000000033'; adm uuid := '00000000-0000-0000-0000-0000000000a1';
  tre uuid := '00000000-0000-0000-0000-0000000000b1';
  x1 uuid := '00000000-0000-0000-0000-0000000000f1'; x2 uuid := '00000000-0000-0000-0000-0000000000f2'; nop uuid := '00000000-0000-0000-0000-0000000000f3';
  da uuid := (select id from public.funds where fund_type = 'direct_aid');
  em uuid := (select id from public.funds where fund_type = 'emergency_medical');
  ben uuid := (select id from public.beneficiaries limit 1);
  r record; n int;
begin
  -- ============================================================ phone <-> Auth account binding (login identity)
  perform tt.as_super();
  insert into auth.users (id, email) values (x1, '8801700000098@members.test'), (x2, '8801700000099@members.test'), (nop, '8801700000097@members.test');
  insert into public.profiles (id, full_name, phone, must_change_password) values (x1, 'Bound Member', '+8801700000098', false);
  perform tt.ok(true, 'profile whose phone matches its auth email is accepted');
  perform tt.denied($q$insert into public.profiles (id, full_name, phone) values ('00000000-0000-0000-0000-0000000000f2', 'Wrong Binding', '+8801700000098')$q$,
                    'phone_must_match_auth_account', 'profile cannot claim a phone number that belongs to another auth account');
  perform tt.denied($q$insert into public.profiles (id, full_name, phone) values ('00000000-0000-0000-0000-0000000000aa', 'No Auth User', '+8801700000050')$q$,
                    'phone_must_match_auth_account', 'profile cannot exist without a matching auth user');
  perform tt.denied($q$update public.profiles set phone = '+8801700000099' where id = '00000000-0000-0000-0000-0000000000f1'$q$,
                    'phone_must_match_auth_account', 'phone cannot be re-pointed even by a server-side session');
  perform tt.denied($q$insert into public.profiles (id, full_name, phone) values ('00000000-0000-0000-0000-0000000000f2', 'Bad Format', '8801700000099')$q$,
                    'profiles_phone_canonical', 'phone must be stored in canonical +880 form');
  update public.profiles set full_name = 'Bound Member Renamed' where id = x1;
  perform tt.ok((select full_name from public.profiles where id = x1) = 'Bound Member Renamed', 'ordinary profile updates are unaffected by the binding');

  -- ============================================================ aggregate functions: who may call them
  perform tt.as_user(null, 'anon');
  perform tt.denied('select * from public.get_assistance_summary()', 'permission denied', 'anon cannot call get_assistance_summary');
  perform tt.denied('select * from public.get_employment_summary()', 'permission denied', 'anon cannot call get_employment_summary');
  perform tt.as_user(nop, 'authenticated');
  perform tt.denied('select * from public.get_assistance_summary()', 'not_authorized', 'a signed-in user without a profile is refused');
  perform tt.as_user(pnd, 'authenticated');
  perform tt.denied('select * from public.get_assistance_summary()', 'not_authorized', 'a pending member is refused');
  perform tt.denied('select * from public.get_employment_summary()', 'not_authorized', 'a pending member is refused (employment)');

  -- ============================================================ assistance aggregates: privacy rules
  perform tt.as_super();
  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.get_assistance_summary()') = 3, 'active member gets one row per fund');
  perform tt.ok((select cases_total from public.get_assistance_summary() where fund_type = 'direct_aid') = 0, 'private (default) assistance records are not counted');
  perform tt.ok(pg_get_function_result('public.get_assistance_summary()'::regprocedure) !~* 'name|location|beneficiar|case_ref|phone|address',
                'assistance aggregate exposes no identifying columns');
  perform tt.as_super();
  insert into public.assistance_records (beneficiary_id, fund_id, assistance_type, approved_amount, disbursed_amount, status, privacy_level, approved_by, created_by) values
    (ben, da, 'food', 500, 500, 'disbursed',           'members',           adm, tre),
    (ben, da, 'food', 300, 100, 'partially_disbursed', 'public_anonymized', adm, tre),
    (ben, da, 'food', 900, 900, 'disbursed',           'private',           adm, tre),   -- private: never counted
    (ben, da, 'food', 700, 0,   'proposed',            'members',           null, tre),  -- not approved: never counted
    (ben, da, 'food', 700, 0,   'rejected',            'members',           null, tre);  -- rejected: never counted
  perform tt.as_user(m1, 'authenticated');
  select * into r from public.get_assistance_summary() where fund_type = 'direct_aid';
  perform tt.ok(r.cases_total = 2 and r.cases_completed = 1 and r.cases_in_progress = 1, 'only approved, non-private cases are counted');
  perform tt.ok(r.amounts_suppressed and r.disbursed_total is null, 'amounts are withheld when fewer than 3 cases (small-cell suppression)');
  perform tt.as_super();
  insert into public.assistance_records (beneficiary_id, fund_id, assistance_type, approved_amount, disbursed_amount, status, privacy_level, approved_by, created_by)
    values (ben, da, 'food', 200, 200, 'disbursed', 'public', adm, tre);
  perform tt.as_user(m1, 'authenticated');
  select * into r from public.get_assistance_summary() where fund_type = 'direct_aid';
  perform tt.ok(r.cases_total = 3 and not r.amounts_suppressed and r.disbursed_total = 800, 'amounts appear once at least 3 cases exist');
  perform tt.ok((select cases_total from public.get_assistance_summary() where fund_type = 'emergency_medical') = 0, 'other funds are counted separately');

  -- ============================================================ employment aggregates
  perform tt.as_super();
  perform tt.as_user(m1, 'authenticated');
  select * into r from public.get_employment_summary();
  perform tt.ok(r.projects_total = 0 and r.approved_budget_total = 0 and not r.amounts_suppressed, 'no projects: zeros, nothing suppressed');
  perform tt.as_super();
  insert into public.employment_projects (beneficiary_id, title, approved_budget, actual_expense, implementation_status) values
    (ben, 'Sewing machine', 20000, 15000, 'in_progress'), (ben, 'Tea stall', 30000, 30000, 'completed'), (ben, 'Cancelled', 99999, 99999, 'cancelled');
  perform tt.as_user(m1, 'authenticated');
  select * into r from public.get_employment_summary();
  perform tt.ok(r.projects_total = 2 and r.amounts_suppressed and r.approved_budget_total is null, 'cancelled projects are excluded; 2 projects -> amounts suppressed');
  perform tt.ok(pg_get_function_result('public.get_employment_summary()'::regprocedure) !~* 'name|title|beneficiar|location|reference', 'employment aggregate exposes no identifying columns');
  perform tt.as_super();
  insert into public.employment_projects (beneficiary_id, title, approved_budget, actual_expense, implementation_status) values (ben, 'Poultry', 10000, 2000, 'planned');
  perform tt.as_user(m1, 'authenticated');
  select * into r from public.get_employment_summary();
  perform tt.ok(r.projects_total = 3 and r.projects_completed = 1 and r.projects_in_progress = 1 and r.projects_planned = 1 and r.approved_budget_total = 60000 and r.actual_expense_total = 47000,
                'with 3 projects the totals are shown');
  perform tt.ok(tt.n('select 1 from public.employment_projects') = 0, 'members still cannot read individual employment projects');
  perform tt.ok(tt.n('select 1 from public.assistance_records') = 0, 'members still cannot read individual assistance records');
  perform tt.ok(tt.n('select 1 from public.beneficiaries') = 0, 'members still cannot read beneficiaries');

  -- ============================================================ members-only content: announcements and documents
  perform tt.as_super();
  insert into public.announcements (title_en, audience, publication_status, published_at) values
    ('Public notice',   'public',  'published', now() - interval '1 day'),
    ('Members notice',  'members', 'published', now() - interval '1 day'),
    ('Admins notice',   'admins',  'published', now() - interval '1 day'),
    ('Draft members',   'members', 'draft',     null),
    ('Future members',  'members', 'published', now() + interval '1 day');
  insert into public.documents (title_en, file_path, access_level, publication_status) values
    ('Public doc', 'd/public.pdf', 'public', 'published'), ('Members doc', 'd/members.pdf', 'members', 'published'),
    ('Admin doc', 'd/admin.pdf', 'admin', 'published'),   ('Draft members doc', 'd/draft.pdf', 'members', 'draft');
  perform tt.as_user(null, 'anon');
  perform tt.ok(tt.n('select id from public.announcements') = 1, 'anon sees only the public announcement');
  perform tt.ok(tt.n('select id from public.documents') = 1, 'anon sees only the public document');
  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.announcements') = 2, 'active member sees public + members announcements (not admins, draft or future)');
  perform tt.ok(tt.n('select 1 from public.documents') = 2, 'active member sees public + members documents (not admin or draft)');
  perform tt.denied($q$insert into public.announcements (title_en, audience, publication_status, published_at) values ('x', 'members', 'published', now())$q$, 'row-level security', 'member cannot create announcements');
  perform tt.as_user(pnd, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.announcements') = 1, 'pending member sees public announcements only');
  perform tt.ok(tt.n('select 1 from public.documents') = 1, 'pending member sees public documents only');

  -- ============================================================ suspended member loses members-only access immediately
  perform tt.as_super();
  update public.profiles set membership_status = 'suspended' where id = m2;
  perform tt.as_user(m2, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.monthly_reports') = 0, 'suspended member cannot read monthly reports');
  perform tt.ok(tt.n('select 1 from public.monthly_report_fund_lines') = 0, 'suspended member cannot read report lines');
  perform tt.ok(tt.n('select 1 from public.announcements') = 1, 'suspended member sees only public announcements');
  perform tt.denied('select * from public.get_assistance_summary()', 'not_authorized', 'suspended member is refused the aggregates');
  perform tt.as_super();
  update public.profiles set membership_status = 'active' where id = m2;

  -- ============================================================ isolation between active members
  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.profiles') = 1, 'member one sees only their own profile row');
  perform tt.ok(tt.n(format($q$select 1 from public.profiles where id = %L$q$, m2)) = 0, 'member one cannot fetch member two by id');
  perform tt.ok(tt.n(format($q$select 1 from public.contributions where profile_id = %L$q$, m2)) = 0, 'member one cannot fetch member two contributions');
  perform tt.ok(tt.n('select 1 from public.fund_transactions') = 0 and tt.n('select 1 from public.fund_balances') = 0, 'ledger and balances stay hidden from members');
  perform tt.ok(tt.n('select 1 from public.user_roles') = 0, 'members cannot list roles');
  perform tt.ok(tt.n('select 1 from public.contact_messages') = 0, 'members cannot read contact messages');
  update public.profiles set email = 'new@example.org', short_bio = 'Updated', general_location = 'Khulna' where id = m1;
  perform tt.as_super();
  perform tt.ok((select email from public.profiles where id = m1) = 'new@example.org', 'member can edit their own contact fields');
  perform tt.as_user(m1, 'authenticated');
  perform tt.denied($q$update public.profiles set phone = '+8801799999999' where id = auth.uid()$q$, 'phone_must_match_auth_account', 'member cannot change their login phone (binding trigger fires before the column guard)');
  update public.profiles set phone = '01712345678' where id = '00000000-0000-0000-0000-000000000022';  -- RLS hides the row: 0 rows updated
  perform tt.as_super();
  perform tt.ok((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000022') is distinct from '01712345678', 'member cannot edit another member profile (0 rows updated)');
end $$;
