-- IBADAT Phase 1 / migration 1: enum types
-- All enums live in the public schema. Add values with ALTER TYPE ... ADD VALUE in later migrations.

create type public.app_role            as enum ('member', 'editor', 'treasurer', 'admin');
create type public.membership_status   as enum ('pending', 'active', 'suspended', 'resigned');
create type public.application_status  as enum ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn');
create type public.contribution_status as enum ('pending', 'verified', 'rejected', 'reversed');
create type public.payment_method      as enum ('cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'other');
create type public.fund_type           as enum ('direct_aid', 'employment', 'emergency_medical');
create type public.ledger_transaction_type as enum ('allocation', 'disbursement', 'transfer_in', 'transfer_out', 'adjustment', 'reversal');
create type public.ledger_direction    as enum ('credit', 'debit');
create type public.approval_status     as enum ('pending', 'approved', 'rejected');
create type public.review_status       as enum ('pending', 'verified', 'rejected');
create type public.eligibility_status  as enum ('pending', 'eligible', 'ineligible');
create type public.consent_status      as enum ('pending', 'granted', 'withdrawn');
create type public.assistance_status   as enum ('proposed', 'approved', 'partially_disbursed', 'disbursed', 'rejected', 'cancelled');
create type public.privacy_level       as enum ('private', 'members', 'public_anonymized', 'public');
create type public.project_status      as enum ('planned', 'approved', 'in_progress', 'completed', 'cancelled');
create type public.follow_up_status    as enum ('not_due', 'due', 'completed', 'overdue');
create type public.publication_status  as enum ('draft', 'published', 'archived');
create type public.audience_type       as enum ('public', 'members', 'admins');
create type public.document_access     as enum ('public', 'members', 'admin');
create type public.document_type       as enum ('constitution', 'policy', 'report', 'form', 'other');
