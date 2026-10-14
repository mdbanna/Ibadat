-- Removes everything created by the Phase 1, Phase 2, Phase 3 and phone-login migrations. It does NOT remove the user's demo-content
-- migrations (20261011*), which already undo themselves. DESTRUCTIVE: deletes all data in these tables.
-- Only safe while the database holds nothing you need. Run in the SQL editor as postgres.
-- Storage buckets are NOT removed here: Supabase blocks direct deletes on storage tables. Empty and delete the five buckets
-- (gallery, member-photos, documents, beneficiary-files, payment-receipts) in the dashboard or via the Storage API.
begin;
drop policy if exists storage_gallery_read on storage.objects;
drop policy if exists storage_gallery_insert on storage.objects;
drop policy if exists storage_gallery_update on storage.objects;
drop policy if exists storage_gallery_delete on storage.objects;
drop policy if exists storage_documents_read on storage.objects;
drop policy if exists storage_documents_insert on storage.objects;
drop policy if exists storage_documents_update on storage.objects;
drop policy if exists storage_documents_delete on storage.objects;
drop policy if exists storage_member_photos_read_public on storage.objects;
drop policy if exists storage_member_photos_read on storage.objects;
drop policy if exists storage_member_photos_insert on storage.objects;
drop policy if exists storage_member_photos_update on storage.objects;
drop policy if exists storage_member_photos_delete on storage.objects;
drop policy if exists storage_beneficiary_files_admin on storage.objects;
drop policy if exists storage_receipts_read on storage.objects;
drop policy if exists storage_receipts_insert on storage.objects;

drop view if exists public.fund_balances;
drop table if exists public.contact_messages, public.member_private_details cascade;
drop table if exists
  public.monthly_report_fund_lines, public.monthly_reports, public.audit_logs, public.documents, public.announcements,
  public.gallery_images, public.activities, public.employment_projects, public.assistance_records, public.beneficiaries,
  public.fund_transactions, public.contributions, public.funds, public.membership_applications, public.user_roles, public.profiles
  cascade;

drop function if exists
  public.get_assistance_summary(), public.get_employment_summary(), public.check_member_auth_email(),
  public.submit_contact_message(text, text, text, text, text, text), public.stamp_contact_message_handling(),
  public.is_public_member_photo(text), public.list_public_member_profiles(int, int),
  public.submit_membership_application(text, text, text, date, text, text, text, text, text, text, boolean),
  public.has_role(public.app_role), public.is_staff(), public.is_active_member(), public.generate_member_id(),
  public.set_updated_at(), public.guard_profile_changes(), public.stamp_application_review(), public.guard_fund_transactions(),
  public.block_truncate(), public.guard_contributions(), public.post_contribution_ledger(), public.guard_monthly_reports(),
  public.block_audit_mutation(), public.audit_row_change();

drop sequence if exists public.member_id_seq, public.application_ref_seq, public.case_ref_seq, public.project_ref_seq;

drop type if exists
  public.message_status, public.app_role, public.membership_status, public.application_status, public.contribution_status, public.payment_method,
  public.fund_type, public.ledger_transaction_type, public.ledger_direction, public.approval_status, public.review_status,
  public.eligibility_status, public.consent_status, public.assistance_status, public.privacy_level, public.project_status,
  public.follow_up_status, public.publication_status, public.audience_type, public.document_access, public.document_type;
commit;
