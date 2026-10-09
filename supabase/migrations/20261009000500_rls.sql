-- IBADAT Phase 1 / migration 5: privileges and Row Level Security.
--
-- Principles
--   * Default deny: privileges are revoked from anon/authenticated, then granted per table; RLS then filters rows.
--   * No client policy exists for fund_transactions writes, user_roles writes, profile inserts, audit_logs writes
--     or application inserts. Those happen only through SECURITY DEFINER triggers/functions or service-role code.
--   * Anonymous visitors never touch private tables; they get published content and the application RPC.
--   * Role checks use has_role()/is_staff()/is_active_member() (admin satisfies every role).

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

alter table public.profiles                  enable row level security;
alter table public.user_roles                enable row level security;
alter table public.membership_applications   enable row level security;
alter table public.funds                     enable row level security;
alter table public.contributions             enable row level security;
alter table public.fund_transactions         enable row level security;
alter table public.beneficiaries             enable row level security;
alter table public.assistance_records        enable row level security;
alter table public.employment_projects       enable row level security;
alter table public.activities                enable row level security;
alter table public.gallery_images            enable row level security;
alter table public.announcements             enable row level security;
alter table public.documents                 enable row level security;
alter table public.monthly_reports           enable row level security;
alter table public.monthly_report_fund_lines enable row level security;
alter table public.audit_logs                enable row level security;

-- Table privileges (RLS decides which rows) ----------------------------------
grant select on public.funds, public.activities, public.gallery_images, public.announcements, public.documents to anon;

grant select on public.profiles, public.user_roles, public.membership_applications, public.funds, public.contributions,
  public.fund_transactions, public.beneficiaries, public.assistance_records, public.employment_projects,
  public.activities, public.gallery_images, public.announcements, public.documents, public.monthly_reports,
  public.monthly_report_fund_lines, public.audit_logs, public.fund_balances to authenticated;

grant update on public.profiles, public.membership_applications, public.funds, public.contributions to authenticated;
grant insert on public.contributions, public.beneficiaries, public.assistance_records, public.employment_projects,
  public.activities, public.gallery_images, public.announcements, public.documents,
  public.monthly_reports, public.monthly_report_fund_lines to authenticated;
grant update on public.beneficiaries, public.assistance_records, public.employment_projects, public.activities,
  public.gallery_images, public.announcements, public.documents, public.monthly_reports to authenticated;
grant delete on public.activities, public.gallery_images, public.announcements, public.documents to authenticated;

-- profiles --------------------------------------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_select_treasurer on public.profiles for select to authenticated
  using (public.has_role('treasurer'));
-- Members edit only descriptive fields; protected columns are enforced by guard_profile_changes().
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- user_roles (read-only for clients) ------------------------------------------
create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_roles_select_admin on public.user_roles for select to authenticated
  using (public.has_role('admin'));

-- membership_applications (admins only; applicants use the RPC) ---------------
create policy applications_select_admin on public.membership_applications for select to authenticated
  using (public.has_role('admin'));
create policy applications_update_admin on public.membership_applications for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- funds (names/descriptions are public; no balances live here) ----------------
create policy funds_select_public on public.funds for select to anon using (active_status);
create policy funds_select_authenticated on public.funds for select to authenticated
  using (active_status or public.has_role('admin'));
create policy funds_update_admin on public.funds for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- contributions ---------------------------------------------------------------
create policy contributions_select_own on public.contributions for select to authenticated
  using (profile_id = (select auth.uid()));
create policy contributions_select_treasurer on public.contributions for select to authenticated
  using (public.has_role('treasurer'));
-- A member may submit only their own PENDING contribution.
create policy contributions_insert_own on public.contributions for insert to authenticated
  with check (
    profile_id = (select auth.uid()) and verification_status = 'pending'
    and verified_by is null and verified_at is null and reversed_by is null and reversed_at is null
  );
create policy contributions_insert_treasurer on public.contributions for insert to authenticated
  with check (public.has_role('treasurer'));
create policy contributions_update_treasurer on public.contributions for update to authenticated
  using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

-- fund_transactions: read-only for treasurers/admins; NO client write policy ---
create policy fund_tx_select_treasurer on public.fund_transactions for select to authenticated
  using (public.has_role('treasurer'));

-- beneficiaries / assistance / projects (private) -----------------------------
create policy beneficiaries_admin_select on public.beneficiaries for select to authenticated using (public.has_role('admin'));
create policy beneficiaries_admin_insert on public.beneficiaries for insert to authenticated with check (public.has_role('admin'));
create policy beneficiaries_admin_update on public.beneficiaries for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy assistance_select_staff on public.assistance_records for select to authenticated using (public.has_role('treasurer'));
create policy assistance_admin_insert on public.assistance_records for insert to authenticated with check (public.has_role('admin'));
create policy assistance_admin_update on public.assistance_records for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy projects_select_staff on public.employment_projects for select to authenticated using (public.has_role('treasurer'));
create policy projects_admin_insert on public.employment_projects for insert to authenticated with check (public.has_role('admin'));
create policy projects_admin_update on public.employment_projects for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- activities ------------------------------------------------------------------
create policy activities_select_public on public.activities for select to anon
  using (publication_status = 'published');
create policy activities_select_authenticated on public.activities for select to authenticated
  using (publication_status = 'published' or public.has_role('editor'));
create policy activities_insert_editor on public.activities for insert to authenticated with check (public.has_role('editor'));
create policy activities_update_editor on public.activities for update to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));
create policy activities_delete_admin on public.activities for delete to authenticated using (public.has_role('admin'));

-- gallery_images --------------------------------------------------------------
create policy gallery_select_public on public.gallery_images for select to anon
  using (publication_status = 'published' and privacy_level = 'public');
create policy gallery_select_authenticated on public.gallery_images for select to authenticated
  using (
    public.has_role('editor')
    or (publication_status = 'published' and privacy_level = 'public')
    or (publication_status = 'published' and privacy_level = 'members' and public.is_active_member())
  );
create policy gallery_insert_editor on public.gallery_images for insert to authenticated with check (public.has_role('editor'));
create policy gallery_update_editor on public.gallery_images for update to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));
create policy gallery_delete_admin on public.gallery_images for delete to authenticated using (public.has_role('admin'));

-- announcements ---------------------------------------------------------------
create policy announcements_select_public on public.announcements for select to anon
  using (publication_status = 'published' and audience = 'public' and published_at <= now());
create policy announcements_select_authenticated on public.announcements for select to authenticated
  using (
    public.has_role('editor')
    or (publication_status = 'published' and published_at <= now() and (
         audience = 'public'
         or (audience = 'members' and public.is_active_member())
         or (audience = 'admins' and public.is_staff())
       ))
  );
create policy announcements_insert_editor on public.announcements for insert to authenticated with check (public.has_role('editor'));
create policy announcements_update_editor on public.announcements for update to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));
create policy announcements_delete_admin on public.announcements for delete to authenticated using (public.has_role('admin'));

-- documents -------------------------------------------------------------------
create policy documents_select_public on public.documents for select to anon
  using (publication_status = 'published' and access_level = 'public');
create policy documents_select_authenticated on public.documents for select to authenticated
  using (
    public.has_role('editor')
    or (publication_status = 'published' and (
         access_level = 'public'
         or (access_level = 'members' and public.is_active_member())
         or (access_level = 'admin' and public.is_staff())
       ))
  );
create policy documents_insert_editor on public.documents for insert to authenticated with check (public.has_role('editor'));
create policy documents_update_editor on public.documents for update to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));
create policy documents_delete_admin on public.documents for delete to authenticated using (public.has_role('admin'));

-- monthly reports: active members see only verified + published ones ----------
create policy reports_select_members on public.monthly_reports for select to authenticated
  using (
    public.has_role('treasurer')
    or (verification_status = 'verified' and published_at is not null and published_at <= now() and public.is_active_member())
  );
create policy reports_insert_treasurer on public.monthly_reports for insert to authenticated with check (public.has_role('treasurer'));
create policy reports_update_treasurer on public.monthly_reports for update to authenticated
  using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

create policy report_lines_select on public.monthly_report_fund_lines for select to authenticated
  using (
    public.has_role('treasurer')
    or exists (
      select 1 from public.monthly_reports r
      where r.id = report_id and r.verification_status = 'verified'
        and r.published_at is not null and r.published_at <= now() and public.is_active_member()
    )
  );
-- Lines can only be added while the report is still unpublished.
create policy report_lines_insert_treasurer on public.monthly_report_fund_lines for insert to authenticated
  with check (
    public.has_role('treasurer')
    and exists (select 1 from public.monthly_reports r where r.id = report_id and r.published_at is null)
  );

-- audit_logs: admins read; nobody writes through the API ----------------------
create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (public.has_role('admin'));
