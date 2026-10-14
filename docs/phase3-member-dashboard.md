# Phase 3: member login and member dashboard

## What exists
* `/login`: phone number + password (first password = the phone number, changed at `/first-login`), Bengali/English, session persistence, logout, loading/validation/error states.
* `/dashboard/*`: 12 sections (Overview, My Profile, My Contribution History, Fund Overview, Monthly Financial Reports, Beneficiary & Assistance Updates, Employment Initiatives, Medical Assistance Updates, Activities, Announcements, Documents & Rules, Account Settings).
* Guard: `RequireMember` (UI) **and** Row Level Security / security-definer functions (database). The guard is only a usability layer.

## How login works (phone number + password) and why a phone number alone proves nothing
1. **Login ID is the phone number.** `01712345678`, `+8801712345678` or Bengali digits all become `+8801712345678`, which maps to the Supabase Auth email `8801712345678@<VITE_MEMBER_AUTH_EMAIL_DOMAIN>` (shared code: `supabase/functions/_shared/phone.ts`, used by the browser and the Edge Functions).
2. **Supabase Auth checks the password** and issues the JWT. Without it the phone number is just a name.
3. The app then reads *the signed-in user's own profile* (through RLS) and requires `profile.phone` to equal the typed number, otherwise it signs out with the generic "incorrect" message. The database enforces the same binding (`profiles_bind_phone` trigger): a profile can only exist for the Auth user whose email local part equals its phone digits, and `phone` cannot be edited through the API (members or admins).
4. **First password = the phone number itself** (local form, e.g. `01712345678`). `profiles.must_change_password` is `true` until the member sets a real password through the `complete-first-login` Edge Function (service role). While it is true:
   * the app shows only `/first-login` (the new password must be 8+ characters and not the phone number), and
   * the **database** treats the member as not active for data access (`is_active_member()` is false), so reports, members-only announcements/documents and the aggregates are withheld even if the UI is bypassed. Neither members nor admins can clear the flag through the API; only the Edge Function can.
5. `membership_status` is read from the database at every sign-in; only `active` opens the dashboard. Same generic message for unknown number and wrong password (no enumeration). Supabase Auth rate limits apply (`429` is mapped to a clear message). No OTP is implemented or faked.

### Risk you chose to accept (phone number as the first password)
A phone number is not secret. Until a new member has logged in once, **anyone who knows their number can sign in as them and set their own password**, locking the real member out and gaining access to that member's own data (their profile and contributions; the database withholds everything else until the password is changed). Mitigations in place: forced change, server-enforced gate, same-as-phone passwords refused, minimum length 8, Auth rate limits. Recommended extra (not built, one decision away): at the first login also ask for the **last 4 digits of the NID** the admin recorded, and check it in `complete-first-login`. Also: hand over credentials promptly after creating an account.

## Creating members (administrator)
* **Add member page** `/dashboard/admin/members/new` (admins only; the page is hidden from others and the function re-checks the role on the server). It calls the `admin-create-member` Edge Function, which creates the Auth account (email from the phone, password = phone), the profile (`active`, `must_change_password = true`, new Member ID) and the **private NID record**, and deletes the Auth account again if any step fails. It can also mark a membership application approved (`applicationId`).
* **NID numbers** (10, 13 or 17 digits) live in `member_private_details`: admin read/write only, unique, not in `profiles`, not readable by members or treasurers, never written to `audit_logs` (column names only). Recommended before scale: enable column encryption (Supabase Vault/pgsodium).
* Not yet built: editing a member's phone (needs an Edge Function that updates the Auth email too), an applications review screen, and mapping the Google Form questions (the form returned an access error when I tried to read it, so its field list is still needed).

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
1. Apply migrations `20261012000100_member_dashboard.sql` and `20261013000100_phone_login.sql` (after your approval, in that order).
2. Auth settings: **disable sign-ups** (email and global), minimum password length 8, secure password change on (`supabase/config.toml` says so for `supabase config push`; for the hosted dashboard set the same under Authentication).
3. **Deploy the two Edge Functions** (`supabase functions deploy admin-create-member` and `complete-first-login`) and set the secret `MEMBER_AUTH_EMAIL_DOMAIN` (same value as `VITE_MEMBER_AUTH_EMAIL_DOMAIN`). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by Supabase and must never appear in the repo or frontend. The function code has **not been run on Deno or deployed**; its logic is unit-tested (`supabase/functions/_shared/members.test.ts`) but the wiring is unverified.
4. Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MEMBER_AUTH_EMAIL_DOMAIN`.
5. **There are no Auth users or profiles in the live project yet.** Bootstrap the first administrator by hand (the Edge Function needs an admin to exist):
   ```sql
   -- Dashboard > Authentication > Users > Add user: email 8801XXXXXXXXX@<domain> (phone digits), a strong password, "Auto Confirm User"
   insert into public.profiles (id, full_name, phone, membership_status, membership_start_date, must_change_password)
   values ('<auth user uuid>', 'Full Name', '+8801XXXXXXXXX', 'active', current_date, false);   -- Member ID is generated automatically
   insert into public.user_roles (user_id, role) values ('<auth user uuid>', 'admin');
   ```
6. **Migration history drift:** the live project recorded the demo-content migrations as `20261011101802` and `20261011102848`, while the repo files are `20261011101301` and `20261011102733`. Before using `supabase db push`, reconcile with `supabase migration repair --status reverted 20261011101802 20261011102848` then `--status applied 20261011101301 20261011102733`.
7. Storage (profile photo) uses the existing `member-photos` policies (own folder, 2 MB, jpeg/png/webp).

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
| Database | `npm run test:db` | real PostgreSQL 16 + stub of Supabase `auth`/`storage` | RLS, triggers, ledger rules, binding, aggregates (193 assertions) |
| Integration | `npm run test:integration` | **real PostgREST 12.2.12 + PostgreSQL**, JWTs signed with the PostgREST secret | the app's real queries through supabase-js; member isolation; first-login gating; NID privacy; aggregates; forged/expired JWT rejection (52 tests) |
| Browser E2E | `npm run test:e2e` | headless Chromium + real PostgREST/PostgreSQL; **fake** GoTrue, storage and Edge Functions | layout at 360/768/1280px, Bengali font, login flow, persistence, logout, blocked users, in-browser isolation (223 checks) |
These need local PostgreSQL, a PostgREST static binary (`POSTGREST_BIN`) and, for E2E, `npm i puppeteer-core @sparticuz/chromium` in `BROWSER_TOOLS` (default `/tmp/browser`). Linux/WSL only. A mutation check (injecting leaky policies) makes 7 integration tests fail, confirming they detect leaks.
