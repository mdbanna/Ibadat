-- IBADAT Phase 1 / migration 4: beneficiaries, assistance, employment projects,
-- public content, monthly reports and the audit log.

-- ---------------------------------------------------------------------------
-- beneficiaries (private; never publicly readable)
-- ---------------------------------------------------------------------------
create sequence public.case_ref_seq start 1;

create table public.beneficiaries (
  id                   uuid primary key default gen_random_uuid(),
  case_reference       text not null unique default
    ('CASE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.case_ref_seq')::text, 5, '0')),
  full_name            text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone                text check (phone ~ '^\+?[0-9]{7,15}$'),
  guardian_name        text check (char_length(guardian_name) <= 120),
  address_detail       text check (char_length(address_detail) <= 500),
  general_location     text check (char_length(general_location) <= 120),
  need_summary         text check (char_length(need_summary) <= 4000),
  eligibility_status   public.eligibility_status not null default 'pending',
  verification_status  public.review_status not null default 'pending',
  consent_status       public.consent_status not null default 'pending',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index beneficiaries_status_idx on public.beneficiaries (eligibility_status, verification_status);
create trigger beneficiaries_set_updated_at before update on public.beneficiaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- assistance_records
-- ---------------------------------------------------------------------------
create table public.assistance_records (
  id               uuid primary key default gen_random_uuid(),
  beneficiary_id   uuid not null references public.beneficiaries (id) on delete restrict,
  fund_id          uuid not null references public.funds (id) on delete restrict,
  assistance_type  text not null check (char_length(btrim(assistance_type)) between 2 and 80),
  approved_amount  numeric(12, 2) not null default 0 check (approved_amount >= 0),
  disbursed_amount numeric(12, 2) not null default 0 check (disbursed_amount >= 0),
  assistance_date  date,
  status           public.assistance_status not null default 'proposed',
  privacy_level    public.privacy_level not null default 'private',
  approved_by      uuid references auth.users (id) on delete restrict,
  created_by       uuid references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint assistance_disbursed_within_approved check (disbursed_amount <= approved_amount),
  constraint assistance_approved_has_approver check (
    status in ('proposed', 'rejected', 'cancelled') or approved_by is not null
  ),
  constraint assistance_approver_not_creator check (approved_by is null or created_by is null or approved_by <> created_by)
);
create index assistance_beneficiary_idx on public.assistance_records (beneficiary_id);
create index assistance_fund_status_idx on public.assistance_records (fund_id, status);
create trigger assistance_records_set_updated_at before update on public.assistance_records
  for each row execute function public.set_updated_at();

alter table public.fund_transactions
  add constraint fund_transactions_assistance_fk
  foreign key (assistance_record_id) references public.assistance_records (id) on delete restrict;
create index fund_tx_assistance_idx on public.fund_transactions (assistance_record_id) where assistance_record_id is not null;

-- ---------------------------------------------------------------------------
-- employment_projects
-- ---------------------------------------------------------------------------
create sequence public.project_ref_seq start 1;

create table public.employment_projects (
  id                    uuid primary key default gen_random_uuid(),
  project_reference     text not null unique default
    ('EMP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.project_ref_seq')::text, 4, '0')),
  beneficiary_id        uuid not null references public.beneficiaries (id) on delete restrict,
  title                 text not null check (char_length(btrim(title)) between 2 and 160),
  estimated_budget      numeric(12, 2) check (estimated_budget >= 0),
  approved_budget       numeric(12, 2) check (approved_budget >= 0),
  actual_expense        numeric(12, 2) not null default 0 check (actual_expense >= 0),
  implementation_status public.project_status not null default 'planned',
  follow_up_status      public.follow_up_status not null default 'not_due',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index employment_projects_beneficiary_idx on public.employment_projects (beneficiary_id);
create trigger employment_projects_set_updated_at before update on public.employment_projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Public content (bilingual: *_bn / *_en, at least one title required)
-- ---------------------------------------------------------------------------
create table public.activities (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_bn           text,
  title_en           text,
  description_bn     text,
  description_en     text,
  activity_date      date,
  general_location   text check (char_length(general_location) <= 120),
  cover_image_path   text,
  publication_status public.publication_status not null default 'draft',
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint activities_has_title check (coalesce(btrim(title_bn), '') <> '' or coalesce(btrim(title_en), '') <> '')
);
create index activities_published_idx on public.activities (publication_status, activity_date desc);
create trigger activities_set_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

create table public.gallery_images (
  id                  uuid primary key default gen_random_uuid(),
  image_path          text not null unique,
  caption_bn          text,
  caption_en          text,
  image_date          date,
  related_activity_id uuid references public.activities (id) on delete set null,
  publication_status  public.publication_status not null default 'draft',
  privacy_level       public.privacy_level not null default 'private',
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index gallery_published_idx on public.gallery_images (publication_status, privacy_level, image_date desc);
create index gallery_activity_idx on public.gallery_images (related_activity_id);

create table public.announcements (
  id                 uuid primary key default gen_random_uuid(),
  title_bn           text,
  title_en           text,
  content_bn         text,
  content_en         text,
  audience           public.audience_type not null default 'members',
  publication_status public.publication_status not null default 'draft',
  published_at       timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint announcements_has_title check (coalesce(btrim(title_bn), '') <> '' or coalesce(btrim(title_en), '') <> ''),
  constraint announcements_published_has_date check (publication_status <> 'published' or published_at is not null)
);
create index announcements_feed_idx on public.announcements (publication_status, audience, published_at desc);

create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  title_bn           text,
  title_en           text,
  file_path          text not null unique,
  document_type      public.document_type not null default 'other',
  access_level       public.document_access not null default 'admin',
  publication_status public.publication_status not null default 'draft',
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint documents_has_title check (coalesce(btrim(title_bn), '') <> '' or coalesce(btrim(title_en), '') <> '')
);
create index documents_access_idx on public.documents (publication_status, access_level);

-- ---------------------------------------------------------------------------
-- monthly_reports: header + normalized per-fund lines. Lines are written when a report
-- is prepared (from approved ledger rows) so a published report never changes silently.
-- ---------------------------------------------------------------------------
create table public.monthly_reports (
  id                  uuid primary key default gen_random_uuid(),
  reporting_month     date not null unique check (extract(day from reporting_month) = 1),
  summary_bn          text,
  summary_en          text,
  verification_status public.review_status not null default 'pending',
  verified_by         uuid references auth.users (id) on delete restrict,
  verified_at         timestamptz,
  published_at        timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint monthly_reports_verified_fields check (
    verification_status <> 'verified' or (verified_by is not null and verified_at is not null)
  ),
  constraint monthly_reports_publish_requires_verified check (
    published_at is null or verification_status = 'verified'
  )
);

create table public.monthly_report_fund_lines (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.monthly_reports (id) on delete cascade,
  fund_id         uuid not null references public.funds (id) on delete restrict,
  opening_balance numeric(14, 2) not null,
  total_in        numeric(14, 2) not null check (total_in >= 0),
  total_out       numeric(14, 2) not null check (total_out >= 0),
  closing_balance numeric(14, 2) not null,
  unique (report_id, fund_id),
  constraint report_line_balances_add_up check (closing_balance = opening_balance + total_in - total_out)
);

create function public.guard_monthly_reports() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status <> 'verified') then
    if (select auth.uid()) is not null then
      if not public.has_role('admin') then
        raise exception 'only_admin_can_verify_reports' using errcode = '42501';
      end if;
      new.verified_by := (select auth.uid());
    end if;
    new.verified_at := now();
  end if;
  return new;
end $$;
create trigger monthly_reports_guard before insert or update on public.monthly_reports
  for each row execute function public.guard_monthly_reports();

-- ---------------------------------------------------------------------------
-- audit_logs: append-only. Written only by audit triggers (SECURITY DEFINER).
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create function public.block_audit_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log_is_append_only' using errcode = '42501';
end $$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.block_audit_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.block_truncate();

-- TG_ARGV[0] = 'values'  -> store old/new row (financial tables)
--            = 'columns' -> store only changed column names (tables holding personal data)
create function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id text;
  v_meta jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    if v_old = v_new then
      return new;
    end if;
  end if;
  v_id := coalesce(v_new, v_old) ->> 'id';

  if coalesce(tg_argv[0], 'columns') = 'values' then
    v_meta := jsonb_build_object('old', v_old, 'new', v_new);
  else
    v_meta := jsonb_build_object('changed_columns', (
      select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
      from jsonb_object_keys(coalesce(v_new, v_old)) as k
      where tg_op <> 'UPDATE' or (v_old -> k) is distinct from (v_new -> k)
    ));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), lower(tg_op), tg_table_name, v_id, v_meta);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger audit_profiles              after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('columns');
create trigger audit_membership_applications after insert or update or delete on public.membership_applications
  for each row execute function public.audit_row_change('columns');
create trigger audit_beneficiaries         after insert or update or delete on public.beneficiaries
  for each row execute function public.audit_row_change('columns');
create trigger audit_user_roles            after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change('values');
create trigger audit_funds                 after update or delete on public.funds
  for each row execute function public.audit_row_change('values');
create trigger audit_contributions         after insert or update or delete on public.contributions
  for each row execute function public.audit_row_change('values');
create trigger audit_fund_transactions     after insert or update or delete on public.fund_transactions
  for each row execute function public.audit_row_change('values');
create trigger audit_assistance_records    after insert or update or delete on public.assistance_records
  for each row execute function public.audit_row_change('values');
create trigger audit_employment_projects   after insert or update or delete on public.employment_projects
  for each row execute function public.audit_row_change('values');
create trigger audit_monthly_reports       after insert or update or delete on public.monthly_reports
  for each row execute function public.audit_row_change('values');
