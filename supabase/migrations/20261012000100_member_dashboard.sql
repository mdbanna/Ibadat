-- IBADAT Phase 3 / migration: support for member login and the member dashboard.
-- Existing migrations are untouched. This file adds:
--   (a) a database-enforced binding between Member ID and the Supabase Auth account,
--   (b) privacy-safe aggregate functions for assistance and employment updates.

-- ---------------------------------------------------------------------------
-- (a) Member ID <-> Auth account binding.
-- Login maps Member ID "IBD-0001" to the Auth email "ibd-0001@<domain>". This trigger guarantees that a profile can only
-- exist for the Auth user whose email local part equals the profile's member_id, so the mapping can never drift
-- (typing someone else's Member ID can never resolve to a different person's profile).
-- Account creation order (server side): allocate the Member ID, create the Auth user with the derived email, insert the profile.
-- ---------------------------------------------------------------------------
create function public.check_member_auth_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = new.id;
  if v_email is null or lower(split_part(v_email, '@', 1)) <> lower(new.member_id) then
    raise exception 'member_id_must_match_auth_account' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.check_member_auth_email() from public, anon, authenticated;

create trigger profiles_bind_member_id before insert or update of id, member_id on public.profiles
  for each row execute function public.check_member_auth_email();

-- ---------------------------------------------------------------------------
-- (b) Privacy-safe aggregates for active members. No beneficiary identifiers, locations or case references are returned.
--     * Only assistance whose privacy_level is not 'private' and whose status is approved/partially_disbursed/disbursed counts.
--       (privacy_level defaults to 'private', so nothing is shared until an administrator opts a record in.)
--     * Small-cell suppression: when 1 or 2 cases exist, amounts are withheld (amounts_suppressed = true), because a total
--       over so few cases could identify a person.
-- ---------------------------------------------------------------------------
create function public.get_assistance_summary()
returns table (
  fund_type         public.fund_type,
  cases_total       integer,
  cases_completed   integer,
  cases_in_progress integer,
  disbursed_total   numeric,
  amounts_suppressed boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  with eligible as (
    select f.fund_type as ft, a.status as st, a.disbursed_amount as paid
    from public.assistance_records a
    join public.funds f on f.id = a.fund_id
    where a.status in ('approved', 'partially_disbursed', 'disbursed')
      and a.privacy_level <> 'private'
  )
  select f.fund_type,
         count(e.ft)::integer,
         (count(e.ft) filter (where e.st = 'disbursed'))::integer,
         (count(e.ft) filter (where e.st <> 'disbursed'))::integer,
         case when count(e.ft) = 0 or count(e.ft) >= 3 then coalesce(sum(e.paid), 0) end,
         (count(e.ft) between 1 and 2)
  from public.funds f
  left join eligible e on e.ft = f.fund_type
  group by f.fund_type
  order by f.fund_type;
end $$;

create function public.get_employment_summary()
returns table (
  projects_total        integer,
  projects_planned      integer,
  projects_approved     integer,
  projects_in_progress  integer,
  projects_completed    integer,
  approved_budget_total numeric,
  actual_expense_total  numeric,
  amounts_suppressed    boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select count(*)::integer,
         (count(*) filter (where p.implementation_status = 'planned'))::integer,
         (count(*) filter (where p.implementation_status = 'approved'))::integer,
         (count(*) filter (where p.implementation_status = 'in_progress'))::integer,
         (count(*) filter (where p.implementation_status = 'completed'))::integer,
         case when count(*) = 0 or count(*) >= 3 then coalesce(sum(p.approved_budget), 0) end,
         case when count(*) = 0 or count(*) >= 3 then coalesce(sum(p.actual_expense), 0) end,
         (count(*) between 1 and 2)
  from public.employment_projects p
  where p.implementation_status <> 'cancelled';
end $$;

revoke execute on function public.get_assistance_summary(), public.get_employment_summary() from public, anon;
grant execute on function public.get_assistance_summary(), public.get_employment_summary() to authenticated;
