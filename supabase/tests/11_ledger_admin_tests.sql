-- Part 2: ledger guards, reversal, administrators, editors, reports, audit (runs after 10_rls_tests.sql).
do $$
declare
  m1 uuid := '00000000-0000-0000-0000-000000000011'; m2 uuid := '00000000-0000-0000-0000-000000000022';
  adm uuid := '00000000-0000-0000-0000-0000000000a1'; tre uuid := '00000000-0000-0000-0000-0000000000b1';
  edi uuid := '00000000-0000-0000-0000-0000000000c1';
  cid uuid := (select id from public.contributions where transaction_reference = 'TRX-0001');
  cid2 uuid; cid3 uuid; ben uuid; asst uuid; rep uuid; n bigint;
  da uuid := (select id from public.funds where fund_type = 'direct_aid');
begin
  -- ---- ledger guards (even for the table owner)
  reset role;
  perform tt.denied('delete from public.fund_transactions', 'ledger_is_append_only', 'ledger rows cannot be deleted');
  perform tt.denied('update public.fund_transactions set description = ''x''', 'ledger_row_is_final', 'approved ledger rows cannot be edited');
  perform tt.denied('truncate public.fund_transactions', 'truncate_not_allowed', 'ledger cannot be truncated');
  perform tt.denied('delete from public.contributions', 'contributions_are_append_only', 'contributions cannot be deleted');

  insert into public.beneficiaries (full_name) values ('Test Beneficiary') returning id into ben;
  insert into public.assistance_records (beneficiary_id, fund_id, assistance_type, approved_amount, status, approved_by, created_by)
    values (ben, da, 'food', 10000, 'approved', adm, tre) returning id into asst;
  perform tt.denied(format($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, assistance_record_id, approval_status, created_by, approved_by, approved_at)
    values (%L, 'disbursement', 'debit', 999999, current_date, %L, 'approved', %L, %L, now())$q$, da, asst, tre, adm),
    'insufficient_fund_balance', 'disbursement beyond the fund balance is rejected');
  perform tt.denied(format($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, assistance_record_id, approval_status, created_by, approved_by, approved_at)
    values (%L, 'disbursement', 'debit', 10, current_date, %L, 'approved', %L, %L, now())$q$, da, asst, tre, tre),
    'fund_tx_maker_checker', 'creator cannot approve their own disbursement');
  insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, assistance_record_id, approval_status, created_by, approved_by, approved_at)
    values (da, 'disbursement', 'debit', 100, current_date, asst, 'approved', tre, adm, now());
  perform tt.ok((select sum(case direction when 'credit' then amount else -amount end) from public.fund_transactions where fund_id = da and approval_status = 'approved') = 400.01,
                'valid disbursement reduces the derived balance');
  perform tt.denied(format($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, description) values (%L, 'allocation', 'credit', 5, current_date, 'x')$q$, da),
                    'fund_tx_required_reference', 'allocation must reference a contribution');
  perform tt.denied(format($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, assistance_record_id, description) values (%L, 'disbursement', 'credit', 5, current_date, %L, 'x')$q$, da, asst),
                    'fund_tx_direction_matches_type', 'disbursement must be a debit');

  -- reversal that would overdraw a fund is refused as a whole
  perform tt.as_user(tre, 'authenticated');
  perform tt.denied(format($q$update public.contributions set verification_status = 'reversed', reversal_reason = 'duplicate' where id = %L$q$, cid),
                    'insufficient_fund_balance', 'reversal blocked while it would overdraw a fund');
  reset role;
  perform tt.ok((select verification_status from public.contributions where id = cid) = 'verified', 'blocked reversal left the contribution verified');

  -- clean reversal on a second contribution
  insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method)
    values (m2, 200, current_date, date_trunc('month', current_date)::date, 'cash') returning id into cid2;
  update public.contributions set verification_status = 'verified', verified_by = tre where id = cid2;
  perform tt.ok((select count(*) from public.fund_transactions where contribution_id = cid2) = 3, 'second contribution allocated');
  perform tt.as_user(m2, 'authenticated');
  update public.contributions set verification_status = 'reversed', reversal_reason = 'self' where id = cid2;
  reset role;
  perform tt.ok((select verification_status from public.contributions where id = cid2) = 'verified', 'member cannot reverse a contribution');
  perform tt.as_user(tre, 'authenticated');
  update public.contributions set verification_status = 'reversed', reversal_reason = 'entered twice' where id = cid2;
  reset role;
  perform tt.ok((select count(*) from public.fund_transactions where contribution_id = cid2 and transaction_type = 'reversal') = 3, 'reversal posts 3 opposite entries');
  perform tt.ok((select coalesce(sum(case direction when 'credit' then amount else -amount end), 0) from public.fund_transactions where contribution_id = cid2) = 0, 'reversed contribution nets to zero');
  perform tt.ok((select reversed_by from public.contributions where id = cid2) = tre, 'reversed_by stamped from session');
  perform tt.denied(format($q$update public.contributions set verification_status = 'verified' where id = %L$q$, cid2), 'terminal_contribution_status', 'reversed is terminal');
  perform tt.denied(format($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, reverses_transaction_id, description, approval_status, created_by, approved_by, approved_at)
    select fund_id, 'reversal', 'debit', amount, current_date, reverses_transaction_id, 'again', 'approved', %L, %L, now() from public.fund_transactions where contribution_id = %L and transaction_type = 'reversal' limit 1$q$, tre, tre, cid2),
    'fund_tx_reversed_once', 'an entry can be reversed only once');
  perform tt.denied(format($q$insert into public.fund_transactions (fund_id, transaction_type, direction, amount, transaction_date, reverses_transaction_id, description, approval_status, created_by, approved_by, approved_at)
    select fund_id, 'reversal', 'credit', amount, current_date, id, 'undo the undo', 'approved', %L, %L, now() from public.fund_transactions where contribution_id = %L and transaction_type = 'reversal' limit 1$q$, tre, tre, cid2),
    'invalid_reversal', 'a reversal entry cannot itself be reversed');
  perform tt.denied(format($q$update public.contributions set amount = 1 where id = %L$q$, cid), 'verified_contribution_is_immutable', 'verified amount is frozen');

  insert into public.contributions (profile_id, amount, contribution_date, contribution_month, payment_method)
    values (tre, 50, current_date, date_trunc('month', current_date)::date, 'cash') returning id into cid3;
  perform tt.as_user(tre, 'authenticated');
  perform tt.denied(format($q$update public.contributions set verification_status = 'verified' where id = %L$q$, cid3),
                    'cannot_verify_own_contribution', 'treasurer cannot verify their own contribution');
  reset role;

  -- ---- administrator
  perform tt.as_user(adm, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.membership_applications') = 1, 'admin reads applications');
  update public.membership_applications set status = 'approved', internal_notes = 'ok' where status = 'submitted';
  perform tt.ok((select reviewed_by from public.membership_applications limit 1) = adm, 'reviewer stamped from session');
  perform tt.ok(tt.n('select 1 from public.beneficiaries') = 1, 'admin reads beneficiaries');
  perform tt.ok(tt.n('select 1 from public.audit_logs') > 0, 'admin reads audit logs');
  perform tt.denied($q$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin')$q$, 'permission denied', 'even admins cannot grant roles via the API');
  perform tt.denied('update public.audit_logs set action = ''x''', 'permission denied', 'audit logs cannot be edited via the API');
  perform tt.ok(tt.n('select 1 from public.profiles') = 6, 'admin reads all profiles');
  perform tt.ok(tt.n($q$select 1 from storage.objects where bucket_id='member-photos'$q$) = 2, 'admin reads all member photos');
  reset role;
  perform tt.denied('update public.audit_logs set action = ''x''', 'audit_log_is_append_only', 'audit log is immutable even for the owner');
  perform tt.ok(not exists (select 1 from public.audit_logs where entity_type = 'profiles' and metadata::text like '%Member One%'), 'profile audit entries store column names, not personal values');
  perform tt.ok(exists (select 1 from public.audit_logs where entity_type = 'fund_transactions' and action = 'insert'), 'ledger inserts are audited with values');

  -- ---- treasurer / editor scoping
  perform tt.as_user(tre, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.beneficiaries') = 0, 'treasurer cannot see private beneficiaries');
  perform tt.ok(tt.n('select 1 from public.assistance_records') = 1, 'treasurer sees assistance records');
  perform tt.as_user(edi, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.beneficiaries') = 0, 'editor cannot see beneficiaries');
  perform tt.ok(tt.n('select 1 from public.contributions') = 0, 'editor cannot see contributions');
  insert into public.activities (slug, title_bn, publication_status) values ('editor-act', 'কার্যক্রম', 'draft');
  perform tt.ok(tt.n('select 1 from public.activities') = 3, 'editor sees drafts and can create activities');
  delete from public.activities where slug = 'editor-act';
  perform tt.ok(tt.n('select 1 from public.activities') = 3, 'editor cannot delete activities (admin only)');

  -- ---- monthly reports
  perform tt.as_user(tre, 'authenticated');
  insert into public.monthly_reports (reporting_month) values (date_trunc('month', current_date)::date) returning id into rep;
  perform tt.denied(format($q$update public.monthly_reports set verification_status = 'verified' where id = %L$q$, rep), 'only_admin_can_verify_reports', 'only admin verifies reports');
  insert into public.monthly_report_fund_lines (report_id, fund_id, opening_balance, total_in, total_out, closing_balance) values (rep, da, 0, 10, 0, 10);
  perform tt.denied(format($q$insert into public.monthly_report_fund_lines (report_id, fund_id, opening_balance, total_in, total_out, closing_balance) values (%L, (select id from public.funds where fund_type='employment'), 0, 10, 0, 99)$q$, rep),
                    'report_line_balances_add_up', 'report line arithmetic is enforced');
  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.monthly_reports') = 0, 'member cannot see unverified report');
  perform tt.as_user(adm, 'authenticated');
  update public.monthly_reports set verification_status = 'verified', published_at = now() - interval '1 minute' where id = rep;
  perform tt.ok((select verified_by from public.monthly_reports where id = rep) = adm, 'report verifier stamped from session');
  perform tt.as_user(m1, 'authenticated');
  perform tt.ok(tt.n('select 1 from public.monthly_reports') = 1, 'active member sees verified + published report');
  perform tt.ok(tt.n('select 1 from public.monthly_report_fund_lines') = 1, 'member sees its lines');
  perform tt.as_user(null, 'anon');
  perform tt.denied('select * from public.monthly_reports', 'permission denied', 'anon cannot read reports');
  perform tt.as_user(tre, 'authenticated');
  perform tt.denied(format($q$insert into public.monthly_report_fund_lines (report_id, fund_id, opening_balance, total_in, total_out, closing_balance) values (%L, (select id from public.funds where fund_type='employment'), 0, 1, 0, 1)$q$, rep),
                    'row-level security', 'lines cannot be added to a published report');
  reset role;
  perform tt.denied(format($q$update public.monthly_reports set verification_status = 'pending' where id = %L$q$, rep), 'monthly_reports_publish_requires_verified', 'published report cannot be un-verified');
end $$;
