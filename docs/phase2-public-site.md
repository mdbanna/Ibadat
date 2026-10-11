# Phase 2: public website

## Pages
| Route | Content | Data source |
|---|---|---|
| `/` | Hero, how it works, three funds, recent activities, gallery preview, members-only contribution notice | `activities`, `gallery_images` (published only) |
| `/about` | Who we are, values, funding, where reports are, three funds | static (translations) |
| `/activities`, `/activities/:slug` | Activity list and detail with related photos | `activities`, `gallery_images` |
| `/gallery` | Paginated grid ("load more") with accessible lightbox | `gallery_images` (published + public) |
| `/members` | Opt-in, admin-approved member directory; how to join | `list_public_member_profiles()` |
| `/join` | Custom membership application form | `submit_membership_application()` |
| `/contact` | Contact form + optional contact channels | `submit_contact_message()` (new) |

## Rules enforced
* No donate button or route anywhere. `MemberFundedNotice` explains that contributions come only from registered members (Home, About, Members, Join). A test fails if a donate link/button appears on any page.
* Member profiles appear only if `public_profile_preference` AND `public_profile_approved` AND `membership_status = 'active'` (database function; the client never reads `profiles`).
* Financial reports and private member data are not requested by any public page.
* Public queries filter `published` / `public` explicitly (signed-in editors would otherwise see drafts) and never `select('*')`.
* Images come from private buckets through short-lived signed URLs.
* The language choice (default Bengali) persists in `localStorage` across navigation.

## CMS readiness (admin panel comes later)
Activities, gallery images and announcements already have bilingual columns, `publication_status`, `privacy_level`, editor-role RLS and storage policies. To publish: an editor inserts an `activities` row with `publication_status = 'published'` (cover image uploaded to the `gallery` bucket, path in `cover_image_path`), and `gallery_images` rows with `publication_status = 'published'`, `privacy_level = 'public'`. No code change is needed.

## New migration: `supabase/migrations/20261010000100_public_site.sql` (NOT applied anywhere)
1. `contact_messages` + `submit_contact_message()`: the Contact page needs somewhere to send messages. Admin-only read/update, handler stamped from the session, global cap of 100 messages/hour (stop-gap; add CAPTCHA via an Edge Function before launch).
2. Anonymous column grants on `activities` and `gallery_images`: hides `created_by` (internal user ids) from the public API.
3. `storage_gallery_read` is replaced so activity cover images are readable exactly when the activity is readable.
Tested locally (124 assertions across migrations 1-7). Existing migrations are untouched. Rollback script updated.

## Supabase configuration still required
1. Apply the six Phase 1 migrations, the proposed hardening file, and `20261010000100_public_site.sql` (after approval).
2. Auth settings: **disable public sign-ups**.
3. Create the first admin by hand (auth user, `profiles` row, `user_roles` row) until the account-creation Edge Function exists.
4. `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and optional `VITE_CONTACT_EMAIL`, `VITE_CONTACT_PHONE`, `VITE_CONTACT_ADDRESS`.
5. Upload real content (activities, photos). No sample data is seeded.
6. Add CAPTCHA/rate limiting to the application and contact RPCs.
