# IBADAT platform: architecture, data model and permissions (Phase 1)

## Project inspection
The repository was empty when connected (no commits). The stack was therefore chosen for this environment:
Vite 8 + React 19 + TypeScript (strict), Tailwind CSS 4 (design tokens in `src/styles/tokens.css`),
react-router, i18next/react-i18next, `@supabase/supabase-js`. Supabase project `Ibadat` (ref `rwojyrbihcfadnuqlavr`, ap-southeast-2)
was empty: no tables, no migrations, no Edge Functions.

## Roles
| Role | Granted by | Can |
|---|---|---|
| anonymous | none | read published content, the 3 funds, public member directory (function), submit an application (function) |
| member (authenticated, `membership_status = active`) | admin approval | own profile (descriptive fields only), own contributions, own receipts/photos, members-only content, **published + verified** monthly reports |
| editor | service role | create/edit activities, gallery, announcements, documents |
| treasurer | service role | read profiles/contributions/ledger/balances, record + verify + reverse contributions, prepare monthly reports |
| admin | service role | everything above, applications, beneficiaries, assistance, projects, audit log, verify reports, publish content deletions |

`has_role(x)` is true for `x` or `admin`. Roles live in `user_roles`, which has **no client write path**, so nobody can self-promote.
Roles are granted only by service-role code (Edge Function or SQL). That function does not exist yet.

## Tables and relationships
```
auth.users 1─1 profiles 1─* contributions ─(verify)→ fund_transactions *─1 funds
auth.users 1─* user_roles                                   │ └─ assistance_record_id → assistance_records *─1 beneficiaries
membership_applications ─(approved_profile_id)→ profiles    └─ reverses_transaction_id → fund_transactions
beneficiaries 1─* employment_projects
activities 1─* gallery_images        monthly_reports 1─* monthly_report_fund_lines *─1 funds
announcements, documents, audit_logs (standalone)
```
Enums are defined in migration 1. Bilingual content uses `*_bn` / `*_en` columns (at least one title required).

## Identity and login
* Member ID format `IBD-0001` is sequence-generated, never derived from NID/birth registration. No NID is collected.
* Login is Member ID + password. Supabase Auth needs an email, so each approved member gets a synthetic auth email
  `ibd-0001@<VITE_MEMBER_AUTH_EMAIL_DOMAIN>`; real contact details are in `profiles`.
* `profiles.phone` is unique, so phone + OTP can be added later with no schema change. No OTP code or password is stored in any table.
* Profiles cannot be inserted by clients. A future Edge Function (service role) must create the auth user, profile, and link the application.

## Membership applications
Anonymous visitors call `submit_membership_application(...)` (SECURITY DEFINER). There is no INSERT policy on the table.
One open application per phone number. Admins review through RLS-guarded updates; `reviewed_by/at` are stamped from the session.
Spam protection (CAPTCHA/rate limit) is **not** implemented; put the RPC behind an Edge Function before launch.

## Financial model
* `contributions` = what a member paid. `fund_transactions` = append-only ledger. Balances are derived (`fund_balances` view, treasurers/admins only).
* Verifying a contribution (treasurer/admin only, never your own) automatically writes one `allocation` per active fund using
  `funds.default_allocation_percent` (50/25/25). Rounding remainder goes to the largest fund so allocations always equal the payment.
  Active percentages must total 100 or verification fails.
* Reversing a verified contribution writes opposite `reversal` entries (each original reversible once). A reversal that would overdraw a fund is refused.
* Ledger rows are frozen once approved; no UPDATE/DELETE/TRUNCATE. Pending rows can only be decided. Approved debits cannot take a fund below zero.
* Maker-checker: approver differs from creator except for automatic allocations/reversals.
* Verified contributions are immutable (amount, payer, date...) and can only move to `reversed`. Duplicate payment references are blocked per method.
* No client role has any write policy on `fund_transactions`. Writes happen only through triggers on `contributions` (SECURITY DEFINER).
* Currency is BDT only. Allocation uses `contribution_date` as the ledger date.
* **Not built (document for the fund-management phase):** disbursement/transfer RPCs, eligibility rules per fund, approval workflow UI,
  monthly report generation from the ledger. The ledger columns and constraints for them exist.

## Audit
`audit_logs` is append-only (trigger blocks UPDATE/DELETE/TRUNCATE) and readable by admins. Triggers record changes on profiles,
applications, beneficiaries (column names only, no personal values) and on roles, funds, contributions, ledger, assistance, projects, reports (old/new values).

## Storage
All buckets are private; serve with signed URLs. See `docs/storage.md`.

## Known limits of this phase
* Anonymous application RPC has no rate limit.
* Public gallery/member photos use signed URLs (not CDN-cached public URLs).
* RLS was exercised on a local PostgreSQL 16 with a stub of Supabase's `auth`/`storage` schemas, not on the live project.
