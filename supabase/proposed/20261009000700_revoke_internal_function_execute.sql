-- PROPOSED (not yet part of the migration set): internal trigger functions never need to be callable through the API.
-- PostgreSQL checks EXECUTE on a trigger function only when the trigger is created, not when it fires,
-- so revoking it does not affect triggers. Supabase grants EXECUTE on new public functions to anon/authenticated by default,
-- which the security advisor flags for the SECURITY DEFINER ones (audit_row_change, post_contribution_ledger).
revoke execute on function
  public.set_updated_at(),
  public.guard_profile_changes(),
  public.stamp_application_review(),
  public.guard_fund_transactions(),
  public.block_truncate(),
  public.guard_contributions(),
  public.post_contribution_ledger(),
  public.guard_monthly_reports(),
  public.block_audit_mutation(),
  public.audit_row_change()
from public, anon, authenticated;
