-- TEST-ONLY fixtures for the local backend (real PostgreSQL + real PostgREST). Never run against a real project.
-- Everyone signs in with the fake-auth password "Test-Pass-1" (see backend.mjs).
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ibd-0001@members.test'),   -- A: active member
  ('b0000000-0000-0000-0000-000000000002', 'ibd-0002@members.test'),   -- B: active member (must never be visible to A)
  ('c0000000-0000-0000-0000-000000000003', 'ibd-0003@members.test'),   -- C: pending member
  ('d0000000-0000-0000-0000-000000000004', 'ibd-0004@members.test'),   -- T: treasurer
  ('e0000000-0000-0000-0000-000000000005', 'ibd-0005@members.test'),   -- ADM: administrator
  ('f0000000-0000-0000-0000-000000000006', 'ibd-0006@members.test');   -- S: suspended member

insert into public.profiles (id, member_id, full_name, phone, email, short_bio, general_location, membership_status, membership_start_date, public_profile_preference) values
  ('a0000000-0000-0000-0000-000000000001', 'IBD-0001', 'আব্দুল করিম', '+8801711111111', 'a@example.org', 'শিক্ষক ও সমাজকর্মী', 'ঢাকা', 'active', '2026-01-10', true),
  ('b0000000-0000-0000-0000-000000000002', 'IBD-0002', 'Fatima Rahman', '+8801722222222', 'b@example.org', 'Private bio of B', 'Chattogram', 'active', '2026-02-01', false),
  ('c0000000-0000-0000-0000-000000000003', 'IBD-0003', 'Pending Person', '+8801733333333', null, null, null, 'pending', null, false),
  ('d0000000-0000-0000-0000-000000000004', 'IBD-0004', 'Treasurer User', '+8801744444444', null, null, null, 'active', '2026-01-01', false),
  ('e0000000-0000-0000-0000-000000000005', 'IBD-0005', 'Admin User', '+8801755555555', null, null, null, 'active', '2026-01-01', false),
  ('f0000000-0000-0000-0000-000000000006', 'IBD-0006', 'Suspended Person', '+8801766666666', null, null, null, 'suspended', '2026-01-05', false);
update public.profiles set public_profile_approved = true where id = 'a0000000-0000-0000-0000-000000000001';
insert into public.user_roles (user_id, role) values ('d0000000-0000-0000-0000-000000000004', 'treasurer'), ('e0000000-0000-0000-0000-000000000005', 'admin');

-- contributions (verified ones are allocated to the three funds by the ledger trigger)
insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method, transaction_reference, verification_status, verified_by, verified_at) values
  ('a0000000-0000-0000-0000-000000000001', 1000, '2026-08-05', '2026-08-01', 'bkash', 'TRX-A1', 'verified', 'd0000000-0000-0000-0000-000000000004', now()),
  ('a0000000-0000-0000-0000-000000000001', 1500, '2026-09-05', '2026-09-01', 'cash',  null,     'verified', 'd0000000-0000-0000-0000-000000000004', now()),
  ('b0000000-0000-0000-0000-000000000002', 2000, '2026-09-07', '2026-09-01', 'nagad', 'TRX-B1', 'verified', 'd0000000-0000-0000-0000-000000000004', now());
insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method, transaction_reference) values
  ('a0000000-0000-0000-0000-000000000001', 500, '2026-10-02', '2026-10-01', 'rocket', 'TRX-A3');

-- a verified, published monthly report
insert into public.monthly_reports (reporting_month, summary_bn, summary_en, verification_status, verified_by, verified_at, published_at) values
  ('2026-09-01', 'সেপ্টেম্বর মাসের যাচাইকৃত প্রতিবেদন।', 'Verified report for September.', 'verified', 'e0000000-0000-0000-0000-000000000005', now(), now() - interval '1 day');
insert into public.monthly_report_fund_lines (report_id, fund_id, opening_balance, total_in, total_out, closing_balance)
  select r.id, f.id, 0, case f.fund_type when 'direct_aid' then 2250 else 1125 end, case f.fund_type when 'employment' then 100 else 0 end,
         (case f.fund_type when 'direct_aid' then 2250 else 1125 end) - (case f.fund_type when 'employment' then 100 else 0 end)
  from public.monthly_reports r cross join public.funds f;
-- an UNPUBLISHED report that members must never see
insert into public.monthly_reports (reporting_month, summary_en, verification_status) values ('2026-10-01', 'DRAFT report, not for members', 'pending');

-- content
insert into public.announcements (title_bn, title_en, content_bn, content_en, audience, publication_status, published_at) values
  ('সদস্যদের সভা', 'Members meeting', 'আগামী মাসে সদস্যদের সভা হবে।', 'A members meeting will be held next month.', 'members', 'published', now() - interval '2 days'),
  ('সাধারণ ঘোষণা', 'General notice', 'সকলের জন্য ঘোষণা।', 'A notice for everyone.', 'public', 'published', now() - interval '3 days'),
  ('Admins only', 'Admins only', 'secret admin notice', 'secret admin notice', 'admins', 'published', now() - interval '1 day'),
  ('Draft', 'Draft', 'draft', 'draft', 'members', 'draft', null);
insert into public.documents (title_bn, title_en, file_path, document_type, access_level, publication_status) values
  ('গঠনতন্ত্র', 'Constitution', 'docs/constitution.pdf', 'constitution', 'members', 'published'),
  ('Admin handbook', 'Admin handbook', 'docs/admin.pdf', 'policy', 'admin', 'published');
insert into public.activities (slug, title_bn, title_en, description_bn, description_en, activity_date, general_location, publication_status) values
  ('winter-relief', 'শীতবস্ত্র বিতরণ', 'Winter clothes distribution', 'বিবরণ', 'Details', '2026-09-20', 'Rangpur', 'published'),
  ('draft-activity', 'খসড়া', 'Draft activity', null, null, null, null, 'draft');

-- beneficiary data (private): aggregates must reveal counts/totals only
insert into public.beneficiaries (full_name, phone, address_detail, general_location) values ('SECRET Beneficiary Name', '+8801799999999', 'SECRET address line', 'SECRET place');
insert into public.assistance_records (beneficiary_id, fund_id, assistance_type, approved_amount, disbursed_amount, status, privacy_level, approved_by, created_by)
  select b.id, f.id, v.t, v.a, v.d, v.s::public.assistance_status, v.p::public.privacy_level, 'e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004'
  from public.beneficiaries b
  join (values
    ('direct_aid', 'food', 500, 500, 'disbursed', 'members'), ('direct_aid', 'food', 300, 100, 'partially_disbursed', 'public_anonymized'),
    ('direct_aid', 'food', 200, 200, 'disbursed', 'public'), ('direct_aid', 'food', 900, 900, 'disbursed', 'private'),
    ('emergency_medical', 'surgery', 4000, 4000, 'disbursed', 'members'), ('emergency_medical', 'medicine', 600, 0, 'approved', 'members')
  ) as v(ft, t, a, d, s, p) on true
  join public.funds f on f.fund_type = v.ft::public.fund_type;
insert into public.employment_projects (beneficiary_id, title, approved_budget, actual_expense, implementation_status)
  select b.id, v.t, v.ab, v.ae, v.s::public.project_status from public.beneficiaries b
  join (values ('SECRET Sewing machine', 20000, 15000, 'in_progress'), ('SECRET Tea stall', 30000, 30000, 'completed'), ('SECRET Poultry', 10000, 2000, 'planned')) as v(t, ab, ae, s) on true;
