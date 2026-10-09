-- IBADAT Phase 1 / migration 3: funds, contributions and the append-only fund ledger.
--
-- Model:
--   contributions       what members paid (one row per payment, verified by a treasurer)
--   fund_transactions   append-only ledger; every fund balance is derived from approved rows
--   Verifying a contribution automatically writes one allocation per fund (50/25/25 default).
--   Reversing a verified contribution automatically writes opposite entries. Nothing is edited or deleted.
-- Ledger currency is BDT only in Phase 1.

-- ---------------------------------------------------------------------------
-- funds (reference data: the three initial funds, no balances stored here)
-- ---------------------------------------------------------------------------
create table public.funds (
  id                         uuid primary key default gen_random_uuid(),
  fund_type                  public.fund_type not null unique,
  name                       text not null,
  name_bn                    text not null,
  description                text,
  description_bn             text,
  default_allocation_percent numeric(5, 2) not null check (default_allocation_percent between 0 and 100),
  active_status              boolean not null default true,
  created_at                 timestamptz not null default now()
);

insert into public.funds (fund_type, name, name_bn, default_allocation_percent) values
  ('direct_aid',        'Direct Aid Fund',        'সরাসরি সহায়তা তহবিল', 50),
  ('employment',        'Employment Fund',        'কর্মসংস্থান তহবিল',     25),
  ('emergency_medical', 'Emergency Medical Fund', 'জরুরি চিকিৎসা তহবিল',   25);

-- ---------------------------------------------------------------------------
-- contributions
-- ---------------------------------------------------------------------------
create table public.contributions (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles (id) on delete restrict,
  amount                numeric(12, 2) not null check (amount > 0),
  currency              char(3) not null default 'BDT' check (currency = 'BDT'),
  contribution_date     date not null check (contribution_date <= current_date),
  contribution_month    date not null check (extract(day from contribution_month) = 1),
  payment_method        public.payment_method not null,
  transaction_reference text check (char_length(btrim(transaction_reference)) between 3 and 80),
  receipt_path          text,
  verification_status   public.contribution_status not null default 'pending',
  verified_by           uuid references auth.users (id) on delete restrict,
  verified_at           timestamptz,
  reversed_by           uuid references auth.users (id) on delete restrict,
  reversed_at           timestamptz,
  reversal_reason       text check (char_length(reversal_reason) <= 1000),
  created_at            timestamptz not null default now(),
  constraint contributions_receipt_in_owner_folder
    check (receipt_path is null or receipt_path like profile_id::text || '/%'),
  constraint contributions_verified_fields
    check (verification_status not in ('verified', 'reversed') or (verified_by is not null and verified_at is not null)),
  constraint contributions_reversed_fields
    check (verification_status <> 'reversed' or (reversed_by is not null and reversed_at is not null and reversal_reason is not null))
);
-- Same payment reference cannot be recorded twice for the same method (rejected rows excluded).
create unique index contributions_payment_reference_key
  on public.contributions (payment_method, lower(btrim(transaction_reference)))
  where transaction_reference is not null and verification_status <> 'rejected';
create index contributions_profile_month_idx on public.contributions (profile_id, contribution_month desc);
create index contributions_status_idx on public.contributions (verification_status, created_at desc);

-- ---------------------------------------------------------------------------
-- fund_transactions (ledger). assistance_record_id FK is added in migration 4.
-- ---------------------------------------------------------------------------
create table public.fund_transactions (
  id                    uuid primary key default gen_random_uuid(),
  fund_id               uuid not null references public.funds (id) on delete restrict,
  transaction_type      public.ledger_transaction_type not null,
  direction             public.ledger_direction not null,
  amount                numeric(14, 2) not null check (amount > 0),
  transaction_date      date not null,
  contribution_id       uuid references public.contributions (id) on delete restrict,
  assistance_record_id  uuid,
  transfer_reference    uuid,
  reverses_transaction_id uuid references public.fund_transactions (id) on delete restrict,
  description           text check (char_length(description) <= 1000),
  approval_status       public.approval_status not null default 'pending',
  created_by            uuid references auth.users (id) on delete restrict,
  approved_by           uuid references auth.users (id) on delete restrict,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  constraint fund_tx_direction_matches_type check (
    (transaction_type in ('allocation', 'transfer_in') and direction = 'credit')
    or (transaction_type in ('disbursement', 'transfer_out') and direction = 'debit')
    or transaction_type in ('adjustment', 'reversal')
  ),
  constraint fund_tx_required_reference check (
    case transaction_type
      when 'allocation'   then contribution_id is not null
      when 'disbursement' then assistance_record_id is not null
      when 'transfer_in'  then transfer_reference is not null
      when 'transfer_out' then transfer_reference is not null
      when 'reversal'     then reverses_transaction_id is not null
      when 'adjustment'   then char_length(btrim(coalesce(description, ''))) > 0
    end
  ),
  constraint fund_tx_approved_fields check (
    approval_status <> 'approved' or (approved_by is not null and approved_at is not null)
  ),
  -- maker-checker: the approver differs from the creator, except for system-driven allocations/reversals
  constraint fund_tx_maker_checker check (
    approved_by is null or created_by is null or approved_by <> created_by
    or transaction_type in ('allocation', 'reversal')
  )
);
create unique index fund_tx_one_allocation_per_fund on public.fund_transactions (contribution_id, fund_id)
  where transaction_type = 'allocation';
create unique index fund_tx_reversed_once on public.fund_transactions (reverses_transaction_id)
  where reverses_transaction_id is not null;
create index fund_tx_fund_date_idx on public.fund_transactions (fund_id, transaction_date desc);
create index fund_tx_contribution_idx on public.fund_transactions (contribution_id);
create index fund_tx_transfer_idx on public.fund_transactions (transfer_reference) where transfer_reference is not null;

-- Ledger integrity: no DELETE/TRUNCATE ever; approved/rejected rows are frozen; pending rows may only be decided.
-- Approved debits may not take a fund below zero (fund row is locked to serialise concurrent debits).
create function public.guard_fund_transactions() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_balance numeric;
  v_orig public.fund_transactions;
begin
  if tg_op = 'DELETE' then
    raise exception 'ledger_is_append_only' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if old.approval_status <> 'pending' then
      raise exception 'ledger_row_is_final' using errcode = '42501';
    end if;
    if (old.fund_id, old.transaction_type, old.direction, old.amount, old.transaction_date, old.contribution_id,
        old.assistance_record_id, old.transfer_reference, old.reverses_transaction_id, old.description, old.created_by, old.created_at)
       is distinct from
       (new.fund_id, new.transaction_type, new.direction, new.amount, new.transaction_date, new.contribution_id,
        new.assistance_record_id, new.transfer_reference, new.reverses_transaction_id, new.description, new.created_by, new.created_at) then
      raise exception 'ledger_row_is_immutable' using errcode = '42501';
    end if;
  end if;

  if new.transaction_type = 'reversal' and tg_op = 'INSERT' then
    select * into v_orig from public.fund_transactions where id = new.reverses_transaction_id;
    if not found or v_orig.approval_status <> 'approved' or v_orig.transaction_type = 'reversal'
       or v_orig.fund_id <> new.fund_id or v_orig.amount <> new.amount or v_orig.direction = new.direction then
      raise exception 'invalid_reversal' using errcode = '23514';
    end if;
  end if;

  if new.approval_status = 'approved' and new.direction = 'debit' then
    perform 1 from public.funds where id = new.fund_id for update;
    select coalesce(sum(case direction when 'credit' then amount else -amount end), 0) into v_balance
    from public.fund_transactions where fund_id = new.fund_id and approval_status = 'approved';
    if v_balance - new.amount < 0 then
      raise exception 'insufficient_fund_balance' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger fund_transactions_guard before insert or update or delete on public.fund_transactions
  for each row execute function public.guard_fund_transactions();

create function public.block_truncate() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'truncate_not_allowed' using errcode = '42501';
end $$;
create trigger fund_transactions_no_truncate before truncate on public.fund_transactions
  for each statement execute function public.block_truncate();

-- Balances come only from approved ledger rows. Visible to treasurers/admins only (security_invoker + filter).
create view public.fund_balances with (security_invoker = true) as
select f.id as fund_id, f.fund_type, f.name, f.name_bn,
       coalesce(sum(case t.direction when 'credit' then t.amount else -t.amount end), 0)::numeric(14, 2) as balance
from public.funds f
left join public.fund_transactions t on t.fund_id = f.id and t.approval_status = 'approved'
where public.has_role('treasurer')
group by f.id;

-- ---------------------------------------------------------------------------
-- Contribution guard: lifecycle rules and who may verify / reverse.
-- ---------------------------------------------------------------------------
create function public.guard_contributions() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    raise exception 'contributions_are_append_only' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if old.verification_status in ('verified', 'reversed') then
      if (old.profile_id, old.amount, old.currency, old.contribution_date, old.contribution_month, old.payment_method,
          old.transaction_reference, old.receipt_path, old.verified_by, old.verified_at)
         is distinct from
         (new.profile_id, new.amount, new.currency, new.contribution_date, new.contribution_month, new.payment_method,
          new.transaction_reference, new.receipt_path, new.verified_by, new.verified_at) then
        raise exception 'verified_contribution_is_immutable' using errcode = '42501';
      end if;
    end if;
    if old.verification_status = 'reversed' or old.verification_status = 'rejected' then
      if new.verification_status is distinct from old.verification_status then
        raise exception 'terminal_contribution_status' using errcode = '23514';
      end if;
    end if;
    if old.verification_status = 'verified' and new.verification_status not in ('verified', 'reversed') then
      raise exception 'verified_contribution_can_only_be_reversed' using errcode = '23514';
    end if;
  end if;

  -- becoming verified
  if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status <> 'verified') then
    if v_actor is not null then
      if not public.has_role('treasurer') then
        raise exception 'not_authorized_to_verify' using errcode = '42501';
      end if;
      new.verified_by := v_actor;
    end if;
    if new.verified_by is null then
      raise exception 'verifier_required' using errcode = '23514';
    end if;
    if new.verified_by = new.profile_id then
      raise exception 'cannot_verify_own_contribution' using errcode = '42501';
    end if;
    new.verified_at := now();
  end if;

  -- becoming reversed
  if new.verification_status = 'reversed' and tg_op = 'UPDATE' and old.verification_status <> 'reversed' then
    if v_actor is not null then
      if not public.has_role('treasurer') then
        raise exception 'not_authorized_to_reverse' using errcode = '42501';
      end if;
      new.reversed_by := v_actor;
    end if;
    new.reversed_at := now();
  end if;
  return new;
end $$;

create trigger contributions_guard before insert or update or delete on public.contributions
  for each row execute function public.guard_contributions();

-- Ledger postings. SECURITY DEFINER: this is the ONLY path that writes allocation/reversal entries.
create function public.post_contribution_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pct_total numeric;
begin
  if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status <> 'verified') then
    select coalesce(sum(default_allocation_percent), 0) into v_pct_total
    from public.funds where active_status and default_allocation_percent > 0;
    if v_pct_total <> 100 then
      raise exception 'allocation_percentages_must_total_100' using errcode = '23514';
    end if;

    with f as (
      select id, row_number() over (order by default_allocation_percent desc, fund_type) as rn,
             round(new.amount * default_allocation_percent / 100, 2) as amt
      from public.funds where active_status and default_allocation_percent > 0
    )
    insert into public.fund_transactions (
      fund_id, transaction_type, direction, amount, transaction_date, contribution_id,
      description, approval_status, created_by, approved_by, approved_at
    )
    select f.id, 'allocation', 'credit',
           -- rounding remainder goes to the largest fund so allocations always sum to the contribution
           case when f.rn = 1 then new.amount - coalesce((select sum(amt) from f where rn > 1), 0) else f.amt end,
           new.contribution_date, new.id, 'Automatic allocation of verified contribution',
           'approved', new.verified_by, new.verified_by, now()
    from f;

  elsif new.verification_status = 'reversed' and tg_op = 'UPDATE' and old.verification_status = 'verified' then
    insert into public.fund_transactions (
      fund_id, transaction_type, direction, amount, transaction_date, contribution_id,
      reverses_transaction_id, description, approval_status, created_by, approved_by, approved_at
    )
    select t.fund_id, 'reversal', 'debit', t.amount, current_date, t.contribution_id,
           t.id, 'Reversal: ' || coalesce(new.reversal_reason, ''), 'approved', new.reversed_by, new.reversed_by, now()
    from public.fund_transactions t
    where t.contribution_id = new.id and t.transaction_type = 'allocation' and t.approval_status = 'approved'
      and not exists (select 1 from public.fund_transactions r where r.reverses_transaction_id = t.id);
  end if;
  return null;
end $$;

create trigger contributions_post_ledger after insert or update of verification_status on public.contributions
  for each row execute function public.post_contribution_ledger();
