# Phase 3: member login and member dashboard

## What exists
* `/login`: Member ID + password, Bengali/English, session persistence, logout, loading/validation/error states.
* `/dashboard/*`: 12 sections (Overview, My Profile, My Contribution History, Fund Overview, Monthly Financial Reports, Beneficiary & Assistance Updates, Employment Initiatives, Medical Assistance Updates, Activities, Announcements, Documents & Rules, Account Settings).
* Guard: `RequireMember` (UI) **and** Row Level Security / security-definer functions (database). The guard is only a usability layer.

## How login works (and why a Member ID alone proves nothing)
1. The typed Member ID (`IBD-0001`) is validated and mapped to the Auth email `ibd-0001@<VITE_MEMBER_AUTH_EMAIL_DOMAIN>`.
2. **Supabase Auth checks the password** and issues the JWT. Without the password the Member ID is just a name.
3. The app then reads *the signed-in user's own profile* (through RLS) and requires `profile.member_id` to equal the typed ID, otherwise it signs out and shows the generic "ID or password incorrect" message. A profile without a match is refused too.
4. The database enforces the same binding (`profiles_bind_member_id` trigger, migration `20261012000100`): a profile can only exist for the Auth user whose email local part equals its `member_id`, and `member_id` cannot be re-pointed.
5. `membership_status` is read from the database at every sign-in. Only `active` opens the dashboard; pending/suspended/resigned/no-profile/load-error each get their own message and a logout button.
6. The same message is shown for unknown ID and wrong password (no account enumeration). Supabase Auth provides rate limiting (`429` is mapped to a clear message). No OTP is implemented or faked; `profiles.phone` is unique so phone+OTP can be added later.

Roles are never read from the browser. Members cannot write `user_roles`, change `membership_status`, `member_id`, `membership_start_date` or `public_profile_approved` (RLS + trigger), and cannot write the ledger (no client write policy exists).

## What a member can and cannot see
| Data | Member can read | How it is enforced |
|---|---|---|
| Own profile | yes, own row only | RLS `id = auth.uid()` |
| Own contributions + receipts | yes | RLS `profile_id = auth.uid()`; storage folder policy |
| Other members' profile / contributions / contact details | **no** | RLS |
| Fund balances from the ledger, ledger rows, roles, audit log, applications, contact messages | **no** | RLS (treasurer/admin only) |
| Monthly reports + per-fund lines | verified AND published only, active members only | RLS `is_active_member()` |
| Assistance / employment | **aggregates only** (counts; totals when >= 3 cases) | `get_assistance_summary()` / `get_employment_summary()` (security definer, active members only, no identifying columns; private records excluded; small-cell suppression) |
| Announcements / documents | published + audience/access `public`/`members` | RLS |

Assistance records default to `privacy_level = 'private'`, so **nothing is shared until an administrator marks records shareable**.

## Required Supabase configuration (not applied by me)
1. Apply migration `20261012000100_member_dashboard.sql` (after your approval).
2. Auth settings: **disable sign-ups** (email and global), minimum password length 8, secure password change on. `supabase/config.toml` now says so for `supabase config push`; for the hosted dashboard set the same under Authentication.
3. Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MEMBER_AUTH_EMAIL_DOMAIN` (use a domain you control or `members.<yourdomain>`; the mailbox does not need to exist but email-change confirmation mails must not be deliverable to strangers).
4. **There are no Auth users or profiles in the live project yet.** Bootstrap by hand until the account-creation Edge Function exists (service-role code, not built):
   ```sql
   -- 1) allocate the Member ID (postgres / service role only): returns IBD-0001 for the first member
   select public.generate_member_id();
   -- 2) Dashboard > Authentication > Users > Add user: email ibd-0001@<domain>, a strong password, "Auto Confirm User"
   -- 3) create the profile for THAT user id (the trigger rejects a mismatched Member ID)
   insert into public.profiles (id, member_id, full_name, membership_status, membership_start_date)
   values ('<auth user uuid>', 'IBD-0001', 'Full Name', 'active', current_date);
   -- 4) first administrator only:
   insert into public.user_roles (user_id, role) values ('<auth user uuid>', 'admin');
   ```
5. **Migration history drift:** the live project recorded the demo-content migrations as `20261011101802` and `20261011102848`, while the repo files are `20261011101301` and `20261011102733`. Before using `supabase db push`, reconcile with `supabase migration repair --status reverted 20261011101802 20261011102848` then `--status applied 20261011101301 20261011102733`, or the CLI will try to apply those two files again.
6. Storage uploads (profile photo) use the existing `member-photos` policies (own folder, 2 MB, jpeg/png/webp). Uploading a new photo withdraws public approval until an administrator re-approves.

## Not done / not verified
* **Real Supabase Auth (GoTrue) and Supabase Storage were never exercised**: no Auth users exist in the live project and I did not create any. Login, password change (`updateUser`), "log out other devices" and signed-URL storage access are verified only against mocks and a fake auth/storage backend.
* No self-service password reset (no real mailbox per member). Members contact an administrator.
* No member-submitted contribution form (history is read-only); no CMS or admin panel (out of scope for this phase).
* Auth-hook level blocking of non-active members at token issue time is not configured; access is enforced by RLS and the app instead. Suspended members can still read their own profile/contributions, but not reports, announcements-for-members, documents, or aggregates.
* Client-side rate limiting of login attempts is not implemented (Supabase Auth limits apply).

## Tests: what each kind proves
| Suite | Command | Backend | Proves |
|---|---|---|---|
| Unit + UI (mocked) | `npm test` | in-memory fake Supabase | app logic, routing, guards, forms, i18n, accessibility (axe), contrast. Does **not** prove security. |
| Database | `npm run test:db` | real PostgreSQL 16 + stub of Supabase `auth`/`storage` | RLS, triggers, ledger rules, binding, aggregates (167 assertions) |
| Integration | `npm run test:integration` | **real PostgREST 12.2.12 + PostgreSQL**, JWTs signed with the PostgREST secret | the app's real queries through supabase-js; member isolation; aggregates; forged/expired JWT rejection (40 tests) |
| Browser E2E | `npm run test:e2e` | headless Chromium + real PostgREST/PostgreSQL; **fake** GoTrue and storage | layout at 360/768/1280px, Bengali font, login flow, persistence, logout, blocked users, in-browser isolation (210 checks) |
These need local PostgreSQL, a PostgREST static binary (`POSTGREST_BIN`) and, for E2E, `npm i puppeteer-core @sparticuz/chromium` in `BROWSER_TOOLS` (default `/tmp/browser`). Linux/WSL only. A mutation check (injecting leaky policies) makes 7 integration tests fail, confirming they detect leaks.
